#pragma once
struct IMUClass { bool begin(){return true;} bool gyroscopeAvailable(){return false;} bool accelerationAvailable(){return false;}
  void readGyroscope(float&,float&,float&){} void readAcceleration(float&,float&,float&){} };
inline IMUClass IMU;
