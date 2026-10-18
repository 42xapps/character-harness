#pragma once
#include "ecs/ecs.h"
#include "animation/animation.h"
#include "character/character.h"
#include "lib/random.h"

typedef enum { CALM_REST, CALM_TURN, CALM_WALK, CALM_OBSERVE, CALM_ATTEND } CalmLifeState;

typedef struct CalmLife {
  CalmLifeState state;
  f32 quiet, wait, elapsed, stuck, weight, turn_yaw;
  u32 destination;
  b32 turn_to_walk;
  v3 target, gaze;
  Random rng;
  AnimationState walk;
  Allocator pose_alloc;
  f32 *mask;
  u32 joint_count;
} CalmLife;
ECS_COMPONENT_TYPEDEF(CalmLife);

typedef struct CalmLifeInput {
  b32 busy, suspended, preview, body_occupied;
  v3 camera;
} CalmLifeInput;
ECS_COMPONENT_TYPEDEF(CalmLifeInput);

void calm_life_init(EcsWorld *w);
b32 calm_life_attach(EcsWorld *w, EcsEntity e, HzHandleT(AnimationBlobAsset) walk);
void calm_life_schedule_intent(EcsWorld *w);
void calm_life_schedule_pose(EcsWorld *w);
