#pragma once
#include "ecs/ecs.h"
#include "animation/animation.h"
#include "character/character.h"
#include "lib/random.h"
#include "ecs/ecs_navigation/ecs_navigation.h"

typedef enum { CALM_REST, CALM_TURN, CALM_WALK, CALM_OBSERVE, CALM_ATTEND } CalmLifeState;

typedef enum { CALM_MOTION_WALK, CALM_MOTION_START, CALM_MOTION_STOP, CALM_MOTION_LEFT,
  CALM_MOTION_RIGHT, CALM_MOTION_OBSERVE, CALM_MOTION_COUNT } CalmMotion;

typedef struct CalmLifeAssets { HzHandleT(AnimationBlobAsset) motions[CALM_MOTION_COUNT]; } CalmLifeAssets;
ECS_COMPONENT_TYPEDEF(CalmLifeAssets);

typedef struct CalmLife {
  CalmLifeState state;
  f32 quiet, wait, elapsed, stuck, weight, turn_yaw;
  u32 destination, reset_generation_seen;
  b32 turn_to_walk;
  v3 target, gaze;
  Random rng;
  AnimationState motions[CALM_MOTION_COUNT];
  AnimationLayer motion;
  CalmMotion motion_kind;
  NavRequestId path;
  i32 waypoint;
  f32 path_wait, stop_time;
  b32 route_final, stopping;
  Allocator pose_alloc;
  f32 *mask;
  u32 joint_count;
} CalmLife;
ECS_COMPONENT_TYPEDEF(CalmLife);

typedef struct CalmLifeInput {
  b32 busy, suspended, preview, body_occupied, extended;
  u32 reset_generation;
  v3 camera;
} CalmLifeInput;
ECS_COMPONENT_TYPEDEF(CalmLifeInput);

void calm_life_init(EcsWorld *w);
b32 calm_life_attach(EcsWorld *w, EcsEntity e);
void calm_life_schedule_intent(EcsWorld *w);
void calm_life_schedule_pose(EcsWorld *w);
