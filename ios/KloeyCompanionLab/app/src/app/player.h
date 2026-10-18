#pragma once
#include "ecs/ecs.h"
#include "lib/reflect.h"
#include "lib/typedefs.h"
#include "lib/hzmath.h"

// The stage scene carries these three components. The player only drives
// LightAim; the other two are declared so the scene still deserializes.

HZ_REFLECT()
typedef enum {
  STAGE_BACKDROP_GRADIENT = 0,
  STAGE_BACKDROP_IMAGE = 1,
} StageBackdropKind;

HZ_REFLECT()
ECS_COMPONENT(StageBackdrop) {
  b32 enabled;
  StageBackdropKind kind;
  ColorF32 inner_color;
  ColorF32 outer_color;
  f32 radius;
  f32 softness;
  f32 intensity;
  f32 light_follow;
  f32 image_scale;
  f32 image_offset_x;
  f32 image_offset_y;
  ColorF32 image_tint;
};

HZ_REFLECT()
ECS_COMPONENT(StageShadowCatcher) {
  b32 enabled;
  ColorF32 shadow_color;
  f32 opacity;
  f32 size;
  f32 falloff;
  f32 height;
};

// directional-light aim as azimuth/elevation degrees; a system rebuilds the
// light's rotation from them each frame
HZ_REFLECT()
ECS_COMPONENT(LightAim) {
  f32 azimuth_deg;
  f32 elevation_deg;
};

// SwiftUI chooses the camera framing; gestures remain conversation-driven.
void player_set_framing(void *ctx, u32 mode);

void player_orbit(void *ctx, f32 yaw, f32 pitch, f32 zoom);

void player_set_cards_layout(void *ctx, f32 reserved_fraction);

// bit 0: visible/active; bit 1: Reduce Motion.
void player_set_activity(void *ctx, u32 flags);
