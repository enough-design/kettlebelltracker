#include <fstream>
#include <sstream>
#include <string>
#include <set>
#include <cstdlib>
#include <cstdint>
uint16_t g_mtu_value = 23;
#include "kb_tracker.ino"

static uint16_t u16(const std::vector<uint8_t>& d, int o){ return d[o] | (d[o+1] << 8); }
static uint32_t u32(const std::vector<uint8_t>& d, int o){ return d[o] | (d[o+1]<<8) | (d[o+2]<<16) | ((uint32_t)d[o+3]<<24); }

int csvTest(const char* path) {
  std::ifstream f(path); std::string line; std::getline(f, line);
  while (std::getline(f, line)) {
    std::stringstream ss(line); std::string c; std::vector<std::string> v;
    while (std::getline(ss, c, ',')) v.push_back(c);
    g_ms = (uint32_t)std::stoul(v[1]);
    gx = std::stof(v[7]); gy = std::stof(v[8]); gz = std::stof(v[9]);
    processSample(std::stof(v[4])/1000.f, std::stof(v[5])/1000.f, std::stof(v[6])/1000.f);
  }
  int n = 0;
  printf("rep  set inSet total peak_mg interval gyroPk(dps) sweep(deg) gyroL(dps)\n");
  for (auto& p : g_pkts) if (p.kind == "rep") {
    n++;
    printf("%3d  %3u %5u %5u %7u %8u %12.1f %10.1f %10.1f   [len %zu]\n", n, p.d[0], u16(p.d,1), u16(p.d,3), u16(p.d,5), u16(p.d,7),
      u16(p.d,9)/10.0, u16(p.d,11)/10.0, u16(p.d,13)/10.0, p.d.size());
  }
  return n;
}

int batchTest(uint16_t mtu) {
  g_pkts.clear(); g_mtu_value = mtu; g_connected = true; rawOn = true; rawN = 0; rawSeq = 0;
  // synthetic 100 Hz stream (10 ms nominal with +-1 ms jitter), 10 s
  std::vector<uint32_t> times; std::vector<int16_t> axs;
  uint32_t t = 100000; srand(1);
  for (int i = 0; i < 1000; i++) {
    t += 10 + (rand() % 3) - 1;
    g_ms = t; gx = (i % 50) - 25; gy = -3.3f; gz = 123.4f;
    float ax = 0.5f + 0.001f * (i % 1000);
    times.push_back(t); axs.push_back((int16_t)(ax * 1000));
    processSample(ax, 0.1f, -0.2f);
  }
  flushRaw();
  size_t samples = 0; int pk = 0; size_t maxLen = 0; int seqBad = 0, timeBad = 0, valBad = 0; uint8_t expectSeq = 0;
  size_t idx = 0;
  for (auto& p : g_pkts) if (p.kind == "raw") {
    pk++; maxLen = std::max(maxLen, p.d.size());
    uint32_t t0 = u32(p.d, 0); uint8_t seq = p.d[4], n = p.d[5];
    if (seq != expectSeq) { seqBad++; } expectSeq = seq + 1;
    if (p.d.size() != (size_t)(6 + 13 * n)) valBad++;
    for (int i = 0; i < n; i++) {
      const uint8_t* s = &p.d[6 + 13 * i];
      uint32_t ts = t0 + s[0];
      int16_t ax = (int16_t)(s[1] | (s[2] << 8));
      auto it = std::find(times.begin(), times.end(), ts);
      if (it == times.end()) timeBad++; else if (ax != axs[it - times.begin()]) valBad++;
      idx++; samples++;
    }
  }
  printf("MTU %3u: %3d packets, %4zu samples, longest packet %3zu B (limit %u), samples/packet %.1f, "
         "seq errors %d, time mismatches %d, bad values/lengths %d\n",
         mtu, pk, samples, maxLen, mtu - 3, (double)samples / pk, seqBad, timeBad, valBad);
  return 0;
}

static void dumpHex(const char* kind, const char* path) {
  FILE* o = fopen(path, "w");
  fprintf(o, "[");
  bool first = true;
  for (auto& p : g_pkts) if (p.kind == kind) {
    fprintf(o, "%s\"", first ? "" : ","); first = false;
    for (auto b : p.d) fprintf(o, "%02x", b);
    fprintf(o, "\"");
  }
  fprintf(o, "]\n"); fclose(o);
}
int main(int argc, char** argv) {
  if (argc > 2 && std::string(argv[1]) == "dumprepsat") {
    csvTest(argv[2]);
    FILE* o = fopen(argv[3], "w");
    for (auto& p : g_pkts) if (p.kind == "rep")
      fprintf(o, "%u,%u,%u,%u,%u,%u,%u,%u,%u,%u\n", p.at, p.d[0], u16(p.d,1), u16(p.d,3), u16(p.d,5), u16(p.d,7), u16(p.d,9), u16(p.d,11), u16(p.d,13), 0);
    fclose(o); return 0; }
  if (argc > 3 && std::string(argv[1]) == "dumpreps") { csvTest(argv[2]); dumpHex("rep", argv[3]); return 0; }
  if (argc > 3 && std::string(argv[1]) == "dumpraw") { batchTest((uint16_t)atoi(argv[2])); dumpHex("raw", argv[3]); return 0; }
  if (argc > 1) { csvTest(argv[1]); return 0; }
  for (uint16_t m : {23, 100, 185, 247, 517}) batchTest(m);
}
