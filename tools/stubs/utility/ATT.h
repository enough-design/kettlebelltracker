#pragma once
#include <cstdint>
extern uint16_t g_mtu_value;
struct ATTClassStub { uint16_t mtu(uint16_t handle) const { return handle == 1 ? g_mtu_value : 23; } };
inline ATTClassStub ATT;
