#pragma once
#include <cstdint>
#include <cstring>
#include <cmath>
#include <cstdio>
#include <algorithm>
#include <vector>
using std::min; using std::max;
#define HIGH 1
#define LOW 0
#define OUTPUT 1
#define LED_BUILTIN 13
#define BLERead 1
#define BLENotify 2
#define BLEWrite 4
enum BLEEventType { BLEDisconnected };
struct BLEDevice {};
inline uint32_t g_ms = 0;
inline bool g_connected = false;
inline uint32_t millis() { return g_ms; }
inline void pinMode(int,int){}
inline void digitalWrite(int,int){}
inline int digitalRead(int){ return 0; }
inline void delay(int){}
struct SerialStub { void begin(int){} explicit operator bool() const { return false; }
  template<class T> void print(T, int=0){} template<class T> void println(T){} };
inline SerialStub Serial;
struct Pkt { std::string kind; std::vector<uint8_t> d; uint32_t at; };
inline std::vector<Pkt> g_pkts;
struct BLEService { BLEService(const char*){} template<class T> void addCharacteristic(T&){} };
struct BLECharacteristic {
  std::string id;
  BLECharacteristic(const char* uuid, int, int, bool){ id = uuid; }
  bool writeValue(const uint8_t* p, int n){
    g_pkts.push_back({ id.find("0002")!=std::string::npos ? "rep" : "raw", std::vector<uint8_t>(p,p+n), g_ms }); return true; }
};
struct BLEByteCharacteristic { BLEByteCharacteristic(const char*, int){} bool written(){return false;} uint8_t value(){return 0;} };
struct BLEClass {
  bool begin(){return true;} void setLocalName(const char*){} void setDeviceName(const char*){}
  void setConnectionInterval(uint16_t,uint16_t){}
  template<class T> void setAdvertisedService(T&){} template<class T> void addService(T&){}
  void setEventHandler(int, void(*)(BLEDevice)){} void advertise(){} void poll(){} bool connected(){return g_connected;}
};
inline BLEClass BLE;
