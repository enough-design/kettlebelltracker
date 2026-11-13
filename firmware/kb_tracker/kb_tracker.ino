/*
  Kettlebell tracker - Arduino Nano 33 BLE Sense Rev2 (BMI270 + BMM150)
  Firmware v3: batched raw stream + per-rep metrics for a power estimate.
  v3 (13 Nov 2026): accelerometer range raised from +/-4 g to +/-8 g (swings were reaching
  3.99 g with the Nano on the back face of a 12 kg bell, and clipping silently at 4 g),
  and minimum float time 150 ms (floor bangs no longer count as swings).

  Libraries (Library Manager):
    - ArduinoBLE
    - Arduino_BMI270_BMM150

  REP COUNTING
  A rep is counted at the FLOAT at the top of the swing: for a moment the bell
  is close to weightless, so total acceleration |a| drops well below 1 g. That
  dip happens once per swing, whereas |a| has two peaks per swing.

  PER-REP METRICS (used by the web page for the power estimate)
  Between one float and the next the sketch tracks the peak |a| (the bell
  passing its lowest point at full speed), the gyro rate at that instant, and
  the angle the bell sweeps from there to the next float (integrated gyro).
  Peak speed follows from v = (a_peak - g) / w, because at the lowest point
  a_peak = g + w^2 * r and v = w * r, so the swing radius cancels out.

  BLE LAYOUT (little-endian). Service 4b420001-...
  Rep packet, 15 bytes - characteristic ...0002, notify/read
    u8  setNumber
    u16 repInSet
    u16 totalReps
    u16 peakMg         peak |a| since the previous rep, milli-g
    u16 intervalMs     float-to-float time (0 for the first rep of a set)
    u16 gyroPk10       gyro magnitude at the peak, 0.1 deg/s   (0 = not valid)
    u16 sweep10        angle swept from peak to this float, 0.1 deg (0 = not valid)
    u16 gyroLaunch10   gyro magnitude when the float starts, 0.1 deg/s

  Raw packet - characteristic ...0003, notify. Samples are BATCHED so one
  Bluetooth packet carries several IMU samples; the batch size adapts to the
  negotiated packet size (MTU) of the phone/laptop. If only a tiny packet size
  was negotiated (one sample per packet) the stream is thinned to 25 Hz.
    header (6 bytes): u32 t0 (device millis of first sample), u8 seq, u8 count
    then count x 13 bytes: u8 dtMs (sample time minus t0),
                           i16 ax, ay, az  (milli-g), i16 gx, gy, gz (0.1 deg/s)

  Command (1 byte write) - characteristic ...0004
    0x01 reset counts, 0x02 raw stream on, 0x03 raw stream off
*/

#include <ArduinoBLE.h>
#include <utility/ATT.h>
#include "Arduino_BMI270_BMM150.h"

#define FW_VERSION "v3 (+/-8 g)"

// ---- IMU at +/-8 g ----
// The library fixes the accelerometer at +/-4 g. This subclass uses the library's own hook
// (configure_sensor, "can be modified by subclassing") to switch the BMI270 to +/-8 g after
// the library has set it up. The library still divides raw counts by the 4 g scale factor
// (8192 counts per g), so readings are doubled to give g at the 8 g scale (4096 counts per g).
// Gyro is unchanged (+/-2000 dps). Resolution is still about 0.25 mg, far finer than needed.
#ifndef KB_HARNESS
class KbIMU : public BoschSensorClass {
  public:
    KbIMU(TwoWire& wire) : BoschSensorClass(wire) {}
    bool rangeOk = false;
    int readAcceleration(float& x, float& y, float& z) override {
      int r = BoschSensorClass::readAcceleration(x, y, z);
      if (rangeOk) { x *= 2; y *= 2; z *= 2; }
      return r;
    }
  protected:
    using BoschSensorClass::configure_sensor;
    int8_t configure_sensor(struct bmi2_dev *dev) override {
      int8_t rslt = BoschSensorClass::configure_sensor(dev);
      if (rslt != BMI2_OK) return rslt;
      struct bmi2_sens_config c;
      c.type = BMI2_ACCEL;
      rslt = bmi2_get_sensor_config(&c, 1, dev);
      if (rslt != BMI2_OK) return rslt;
      c.cfg.acc.range = BMI2_ACC_RANGE_8G;
      rslt = bmi2_set_sensor_config(&c, 1, dev);
      if (rslt == BMI2_OK) {   // read it back so the scaling is only applied if the sensor really is at 8 g
        struct bmi2_sens_config chk; chk.type = BMI2_ACCEL;
        rangeOk = bmi2_get_sensor_config(&chk, 1, dev) == BMI2_OK && chk.cfg.acc.range == BMI2_ACC_RANGE_8G;
      }
      return rslt;
    }
};
KbIMU kbImu(Wire1);   // the BMI270 is on the internal I2C bus (Wire1) on the Nano 33 BLE Sense Rev2
#define KB_IMU kbImu
#else
#define KB_IMU IMU    // test harness (stubbed sensor)
#endif

// ---- Tuning (start here when calibrating) ----
const float    LOW_G        = 0.55;   // |a| below this = float (bell weightless)
const float    EXIT_G       = 0.9;    // float is over once |a| rises above this again
const float    ARM_G        = 1.5;    // a swing must have exceeded this since the last rep
const uint32_t MIN_FLOAT_MS = 150;    // |a| must stay below LOW_G this long. Was 20; bangs on the floor and putting the bell down float only 40-60 ms, real swings 500+ ms (150-250 all tested OK)
const uint32_t MIN_REP_GAP  = 900;    // ms, ignores the shallow dip in the middle of a swing
const uint32_t SET_TIMEOUT  = 8000;   // ms without a rep before the next rep starts a new set
const uint32_t METRIC_WINDOW_MS = 1500; // peak must be this recent for metrics to be valid
const uint32_t REST_RESET_MS    = 300;  // bell still for this long -> forget the old peak
const uint8_t  MAX_BATCH    = 10;     // max IMU samples per raw packet (10 = ~100 ms at 100 Hz)

// ---- BLE ----
#define SVC_UUID "4b420001-7a6c-4f10-9d3e-2b1c5a6e8f01"
#define REP_UUID "4b420002-7a6c-4f10-9d3e-2b1c5a6e8f01"
#define RAW_UUID "4b420003-7a6c-4f10-9d3e-2b1c5a6e8f01"
#define CMD_UUID "4b420004-7a6c-4f10-9d3e-2b1c5a6e8f01"

struct __attribute__((packed)) RepPacket {
  uint8_t  setNumber;
  uint16_t repInSet;
  uint16_t totalReps;
  uint16_t peakMg;
  uint16_t intervalMs;
  uint16_t gyroPk10;
  uint16_t sweep10;
  uint16_t gyroLaunch10;
};

const uint8_t  RAW_HDR = 6;
const uint8_t  RAW_SAMPLE = 13;
const uint16_t RAW_MAX_LEN = RAW_HDR + RAW_SAMPLE * MAX_BATCH;

BLEService kbService(SVC_UUID);
BLECharacteristic repChar(REP_UUID, BLERead | BLENotify, sizeof(RepPacket), true);
BLECharacteristic rawChar(RAW_UUID, BLENotify, RAW_MAX_LEN, false);   // variable length
BLEByteCharacteristic cmdChar(CMD_UUID, BLEWrite);

// ---- Rep state ----
uint8_t  setNumber = 1;
uint16_t repInSet = 0;
uint16_t totalReps = 0;
uint32_t lastRepTime = 0;     // time the last counted float began

bool     armed = false;       // a real swing (|a| > ARM_G) has happened since the last rep
bool     counted = false;     // this float has already been counted
uint32_t lowSince = 0;        // when |a| first dropped below LOW_G (0 = not currently low)

// ---- Per-rep metric tracking ----
float    runPeak = 0;         // highest |a| since the last rep (g)
uint32_t peakTime = 0;        // when it happened (0 = none)
float    peakGyro = 0;        // gyro magnitude around the peak (deg/s)
bool     peakFollow = false;  // still looking at the sample after the peak
float    sweepRad = 0;        // angle swept since the peak (rad)
float    prevGyroMag = 0;
uint32_t prevSampleMs = 0;
uint32_t stillSince = 0;      // when the bell last became still (0 = moving)

uint32_t ledOffAt = 0;

// ---- Raw stream state ----
bool     rawOn = false;
uint8_t  rawSeq = 0;
struct RawSample { uint32_t t; int16_t v[6]; };
RawSample rawBuf[MAX_BATCH];
uint8_t  rawN = 0;

float    gx = 0, gy = 0, gz = 0;

// ---- Diagnostics (printed to Serial only when a USB host is attached) ----
uint32_t statAt = 0, statSamples = 0, statPackets = 0;

// Negotiated ATT MTU for the connected central. ArduinoBLE has no public
// "current MTU" call, but ATT.mtu(handle) returns 23 for any handle that is
// not a live connection, so taking the largest over the small handle range
// finds it.
uint16_t currentMtu() {
  uint16_t best = 23;
  for (uint16_t h = 0; h < 32; h++) {
    uint16_t m = ATT.mtu(h);
    if (m > best) best = m;
  }
  return best;
}

uint8_t batchTarget() {
  int payload = (int)currentMtu() - 3;               // ATT notification header = 3 bytes
  int n = (payload - RAW_HDR) / RAW_SAMPLE;
  if (n < 1) n = 1;
  if (n > MAX_BATCH) n = MAX_BATCH;
  return (uint8_t)n;
}

void flushRaw() {
  if (rawN == 0) return;
  uint8_t pkt[RAW_MAX_LEN];
  uint32_t t0 = rawBuf[0].t;
  memcpy(&pkt[0], &t0, 4);
  pkt[4] = rawSeq++;
  pkt[5] = rawN;
  for (uint8_t i = 0; i < rawN; i++) {
    uint8_t* p = &pkt[RAW_HDR + i * RAW_SAMPLE];
    uint32_t dt = rawBuf[i].t - t0;
    p[0] = (uint8_t)(dt > 255 ? 255 : dt);
    memcpy(&p[1], rawBuf[i].v, 12);
  }
  rawChar.writeValue(pkt, RAW_HDR + rawN * RAW_SAMPLE);
  statPackets++;
  rawN = 0;
}

// With a small packet size only one sample fits per notification, and the
// radio can only carry ~28 notifications a second, so sending every sample
// would stall the sensor loop. In that case thin the stream to 25 Hz instead.
uint8_t decimCount = 0;

void queueRaw(uint32_t now, float ax, float ay, float az) {
  if (batchTarget() == 1 && (decimCount++ % 4) != 0) return;
  RawSample& s = rawBuf[rawN++];
  s.t = now;
  s.v[0] = (int16_t)(ax * 1000); s.v[1] = (int16_t)(ay * 1000); s.v[2] = (int16_t)(az * 1000);
  s.v[3] = (int16_t)(gx * 10);   s.v[4] = (int16_t)(gy * 10);   s.v[5] = (int16_t)(gz * 10);
  if (rawN >= batchTarget()) flushRaw();
}

void onDisconnected(BLEDevice central) {
  rawOn = false;
  rawN = 0;
  BLE.advertise();
}

static inline uint16_t clamp16(float v) {
  if (v < 0) return 0;
  if (v > 65535.0f) return 65535;
  return (uint16_t)v;
}

void registerRep(float peak, uint32_t t, float gyroLaunch) {
  uint16_t interval = 0;
  if (lastRepTime != 0 && (t - lastRepTime) > SET_TIMEOUT) {
    if (repInSet > 0) setNumber++;
    repInSet = 0;
  } else if (lastRepTime != 0) {
    interval = (uint16_t)min<uint32_t>(t - lastRepTime, 65535);
  }
  repInSet++;
  totalReps++;
  lastRepTime = t;

  bool valid = (peakTime != 0) && (t - peakTime) <= METRIC_WINDOW_MS && peak > 0;

  RepPacket p;
  p.setNumber    = setNumber;
  p.repInSet     = repInSet;
  p.totalReps    = totalReps;
  p.peakMg       = clamp16(peak * 1000.0f);
  p.intervalMs   = interval;
  p.gyroPk10     = valid ? clamp16(peakGyro * 10.0f) : 0;
  p.sweep10      = valid ? clamp16(sweepRad * 57.29578f * 10.0f) : 0;
  p.gyroLaunch10 = valid ? clamp16(gyroLaunch * 10.0f) : 0;
  repChar.writeValue((uint8_t*)&p, sizeof(p));

  digitalWrite(LED_BUILTIN, HIGH);
  ledOffAt = millis() + 80;
}

void resetTracking() {
  armed = false; counted = false; lowSince = 0;
  runPeak = 0; peakTime = 0; peakGyro = 0; peakFollow = false; sweepRad = 0;
}

void resetCounts() {
  setNumber = 1; repInSet = 0; totalReps = 0; lastRepTime = 0;
  resetTracking();
}

void handleCommand() {
  if (!cmdChar.written()) return;
  switch (cmdChar.value()) {
    case 0x01: resetCounts(); break;
    case 0x02: rawOn = true;  rawN = 0; break;
    case 0x03: rawOn = false; rawN = 0; break;
  }
}

void processSample(float ax, float ay, float az) {
  uint32_t now = millis();
  float mag  = sqrtf(ax * ax + ay * ay + az * az);
  float gmag = sqrtf(gx * gx + gy * gy + gz * gz);

  // ---- angle swept since the peak (trapezoid on gyro magnitude) ----
  uint32_t dt = (prevSampleMs == 0) ? 0 : now - prevSampleMs;
  if (dt > 100) dt = 100;
  if (peakTime != 0) {
    sweepRad += 0.5f * (prevGyroMag + gmag) * 0.0174533f * (dt / 1000.0f);
  }
  if (peakFollow) {                       // look one sample past the peak for the gyro maximum
    if (gmag > peakGyro) peakGyro = gmag;
    peakFollow = false;
  }

  // ---- new peak since the last rep ----
  if (mag > runPeak) {
    runPeak = mag;
    peakTime = now;
    peakGyro = max(prevGyroMag, gmag);
    peakFollow = true;
    sweepRad = 0;
  }
  prevGyroMag = gmag;
  prevSampleMs = now;

  // ---- bell sitting still: forget any stale peak so the next rep starts clean ----
  if (fabsf(mag - 1.0f) < 0.08f && gmag < 15.0f) {
    if (stillSince == 0) stillSince = now;
    if ((now - stillSince) >= REST_RESET_MS) {
      runPeak = 0; peakTime = 0; peakGyro = 0; peakFollow = false; sweepRad = 0; armed = false;
    }
  } else {
    stillSince = 0;
  }

  // ---- float detection = one rep ----
  if (mag > ARM_G) armed = true;

  if (mag < LOW_G) {
    if (lowSince == 0) lowSince = now;
    if (armed && !counted && (now - lowSince) >= MIN_FLOAT_MS &&
        (lastRepTime == 0 || (lowSince - lastRepTime) >= MIN_REP_GAP)) {
      registerRep(runPeak, lowSince, gmag);
      counted = true;
      armed = false;
      runPeak = 0; peakTime = 0; peakGyro = 0; peakFollow = false; sweepRad = 0;
    }
  } else if (mag > EXIT_G) {
    lowSince = 0;
    counted = false;
  }

  statSamples++;
  if (rawOn && BLE.connected()) queueRaw(now, ax, ay, az);
}

void printStats() {
  uint32_t now = millis();
  if (now - statAt < 2000) return;
  if (Serial && statAt != 0) {
    float s = (now - statAt) / 1000.0f;
    Serial.print("imu_hz=");   Serial.print(statSamples / s, 0);
    Serial.print(" raw_pkts_s="); Serial.print(statPackets / s, 1);
    Serial.print(" mtu=");     Serial.print(currentMtu());
    Serial.print(" batch=");   Serial.println(batchTarget());
  }
  statAt = now; statSamples = 0; statPackets = 0;
}

void setup() {
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.begin(115200);

  if (!KB_IMU.begin()) {
    // Fast blink = IMU not found
    while (true) { digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); delay(100); }
  }
  Serial.print("KB-Tracker firmware "); Serial.println(FW_VERSION);
#ifndef KB_HARNESS
  Serial.println(kbImu.rangeOk ? "Accelerometer range +/-8 g" : "WARNING: +/-8 g not set, running at the library default +/-4 g");
#endif
  if (!BLE.begin()) {
    // Slow blink = BLE failed
    while (true) { digitalWrite(LED_BUILTIN, !digitalRead(LED_BUILTIN)); delay(500); }
  }

  BLE.setLocalName("KB-Tracker");
  BLE.setDeviceName("KB-Tracker");
  BLE.setConnectionInterval(6, 12);       // hint: 7.5-15 ms connection interval (units of 1.25 ms)
  BLE.setAdvertisedService(kbService);
  kbService.addCharacteristic(repChar);
  kbService.addCharacteristic(rawChar);
  kbService.addCharacteristic(cmdChar);
  BLE.addService(kbService);
  BLE.setEventHandler(BLEDisconnected, onDisconnected);
  BLE.advertise();
}

void loop() {
  BLE.poll();
  handleCommand();

  if (KB_IMU.gyroscopeAvailable()) {
    KB_IMU.readGyroscope(gx, gy, gz);
  }
  if (KB_IMU.accelerationAvailable()) {
    float ax, ay, az;
    KB_IMU.readAcceleration(ax, ay, az);
    processSample(ax, ay, az);
  }

  // LED off shortly after a rep
  if (ledOffAt != 0 && millis() > ledOffAt) {
    digitalWrite(LED_BUILTIN, LOW);
    ledOffAt = 0;
  }
  printStats();
}
