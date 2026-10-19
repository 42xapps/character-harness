#pragma once
#include "lib/typedefs.h"
#include "rendering/renderer_quality.h"

typedef struct {
  RendererQuality level;
  u32 max_pixels;
  b32 dynamic;
} CompanionQuality;

// Thermal values follow ProcessInfo.ThermalState; hidden scenes use the smallest budget.
static inline CompanionQuality companion_quality(u32 thermal, b32 low_power, b32 visible, RendererQuality hardware) {
  CompanionQuality policy = {.level = hardware, .max_pixels = 1350000, .dynamic = true};
  if (thermal == 1 || low_power) {
    policy.level = hardware < RENDERER_QUALITY_MEDIUM ? hardware : RENDERER_QUALITY_MEDIUM;
    policy.max_pixels = 921600;
    policy.dynamic = false;
  }
  if (thermal >= 2) {
    policy.level = RENDERER_QUALITY_LOW;
    policy.max_pixels = thermal >= 3 ? 360000 : 640000;
    policy.dynamic = false;
  }
  if (!visible) {
    policy.level = RENDERER_QUALITY_LOW;
    policy.max_pixels = 360000;
    policy.dynamic = false;
  }
  return policy;
}
