#include "app/calm_life.h"
#include "gameplay/character/character.h"
#include "ecs/ecs_cloth/ecs_cloth.h"
#include "ecs/renderer/ecs_renderer.h"
#include "ik/ik.h"
#include "lib/thread_context.h"

#define CALM_SPEED 0.58f
#define CALM_CLIP_SPEED 1.09f // measured retargeted stance speed; tools/prepare-locomotion.ts

hz_internal void calm_life_destroy(void *ptr, i32 count, const EcsTypeInfo *ti, EcsWorld *w) {
  UNUSED(ti); UNUSED(w);
  CalmLife *lives = ptr;
  for (i32 i = 0; i < count; i++) ALLOC_DESTROY(&lives[i].pose_alloc);
}

void calm_life_init(EcsWorld *w) {
  ecs_resource_set(w, CalmLifeInput, {.camera = {0, 1.6f, 4.0f}});
  ecs_component_set_dtor(w, CalmLife, calm_life_destroy);
}

b32 calm_life_attach(EcsWorld *w, EcsEntity e, HzHandleT(AnimationBlobAsset) walk) {
  if (!e || ecs_component_exists(w, e, CalmLife)) return false;
  AssetSystem *as = ecs_resource_get_mut(w, AssetSystem);
  const EcsModelRef *ref = ecs_component_get(w, e, EcsModelRef);
  if (!ref || !asset_is_ready(as, ref->model.handle) || !asset_is_ready(as, walk)) return false;
  const EcsSkinnedModel *sk = ecs_component_get(w, e, EcsSkinnedModel);
  const EcsClothInstance *cloth = ecs_component_get(w, e, EcsClothInstance);
  if (!sk || !sk->joint_poses || !cloth || !cloth->model) return false;
  ModelBlobAsset *model = cloth->model;
  AnimationBlobAsset *clip = asset_get(as, walk, AnimationBlobAsset);
  if (ik_joint_find(model, "J_Bip_L_UpperLeg") < 0) return false;
  CalmLife life = {.wait = 32.0f, .rng = random_create(716), .gaze = {0, 1.6f, 4}};
  life.pose_alloc = make_arena_allocator(arena_create(MB(1), KB(64)));
  life.walk = (AnimationState){.animation = clip, .speed = 1, .weight = 1, .loop = true,
    .remap = animation_build_joint_remap(&life.pose_alloc, clip, model)};
  Array(StringBlob) names = blob_array_get(StringBlob, &model->joint_names);
  life.joint_count = names.len;
  life.mask = ALLOC_ARRAY(&life.pose_alloc, f32, names.len);
  for (u32 j = 0; j < names.len; j++) {
    CString name = string_blob_get(&names.items[j]);
    life.mask[j] = (!life.walk.remap || life.walk.remap->remap[j] >= 0) &&
      str_starts_with(cstr_to_str(name), STR_FROM_CSTR("J_Bip_")) &&
      !cstr_equal(name, "J_Bip_C_Head") && !cstr_equal(name, "J_Bip_C_Neck") ? 1.0f : 0.0f;
  }
  ecs_component_set(w, e, CalmLife, life);
  const WorldTransform *wt = ecs_component_get(w, e, WorldTransform);
  ecs_component_set(w, e, LocalTransform, {.position = wt->position, .rotation = wt->rotation, .scale = wt->scale});
  ecs_component_set(w, e, CharacterTuning, {
    .facing = CHARACTER_FACING_INPUT, .radius = .22f, .height = 1.75f,
    .walk_speed = CALM_SPEED, .accel_time = .6f, .decel_time = .24f,
    .turn_rate = 2.7f, .gravity = 9.81f, .step_height = .08f, .snap_distance = .12f});
  log_info("calm life: walk ready, % model joints, % clip joints", fmt_u32(life.joint_count), fmt_u32(blob_array_len(&clip->joint_names)));
  return true;
}

hz_internal void calm_life_state(CalmLife *life, CalmLifeState state) {
  if (life->state == state) return;
  life->state = state;
  life->elapsed = life->stuck = 0;
  log_info("calm life: state % destination %", fmt_u32((u32)state), fmt_u32(life->destination));
}

// This authored corridor stays inside the clearing's flat, prop-free center.
hz_internal v3 calm_life_destination(u32 index) {
  if (index == 0) return (v3){-.18f, 0, -1.35f};
  if (index == 1) return (v3){.18f, 0, 1.15f};
  return V3_ZERO;
}

ecs_system(calm_life_intent_system, EcsInOut(CalmLife), EcsIn(Character), EcsInOut(CharacterInput), EcsResIn(CalmLifeInput)) {
  const CalmLifeInput *in = ecs_sys_get_resource(CalmLifeInput);
  for (i32 i = 0; i < it->count; i++) {
    CalmLife *life = ecs_sys_get_component_mut(CalmLife, i);
    const Character *c = ecs_sys_get_component(Character, i);
    CharacterInput *ci = ecs_sys_get_component_mut(CharacterInput, i);
    f32 dt = m_minf(it->delta_time, .1f);
    life->elapsed += dt;
    ci->move = (v2){0};
    v3 to_camera = v3_sub(in->camera, c->position);
    f32 camera_yaw = m_atan2f(to_camera.x, to_camera.z);
    b32 interrupt = in->busy || in->suspended;
    if (interrupt) {
      life->quiet = 0;
      if (life->state != CALM_ATTEND) life->wait = in->preview ? 5.0f : random_f32_range(&life->rng, 30, 48);
      calm_life_state(life, CALM_ATTEND);
    } else life->quiet += dt;
    if (life->state == CALM_ATTEND) {
      ci->face_yaw = camera_yaw;
      if (!interrupt && life->quiet >= life->wait) calm_life_state(life, CALM_REST);
    }
    if (life->state == CALM_REST && !interrupt) {
      ci->face_yaw = camera_yaw;
      f32 wait = in->preview ? 3.0f : life->wait;
      if (life->quiet >= wait && !in->body_occupied) {
        life->target = calm_life_destination(life->destination);
        v3 d = v3_sub(life->target, c->position);
        life->turn_yaw = m_atan2f(d.x, d.z);
        life->turn_to_walk = true;
        calm_life_state(life, CALM_TURN);
      }
    }
    if (life->state == CALM_TURN && !interrupt) {
      ci->face_yaw = life->turn_yaw;
      f32 error = m_fabsf(m_wrap_pi(c->yaw - life->turn_yaw));
      if (error < .1f && life->elapsed > .65f) {
        calm_life_state(life, life->turn_to_walk ? CALM_WALK : CALM_OBSERVE);
        life->wait = in->preview ? 5.0f : random_f32_range(&life->rng, 16, 28);
      }
    }
    if (life->state == CALM_WALK && !interrupt) {
      v3 delta = v3_sub(life->target, c->position); delta.y = 0;
      f32 distance = v3_length(delta);
      ci->face_yaw = m_atan2f(delta.x, delta.z);
      f32 speed = m_minf(1.0f, distance / .27f);
      if (distance > .045f) ci->move = (v2){delta.x / distance * speed, -delta.z / distance * speed};
      if (life->elapsed > 1 && character_planar_speed(c) < .025f) life->stuck += dt;
      else life->stuck = 0;
      if ((distance < .05f && character_planar_speed(c) < .1f) || life->stuck > 1 || life->elapsed > 14) {
        life->destination = (life->destination + 1) % 3;
        life->turn_yaw = camera_yaw + (life->destination == 1 ? -.4f : .35f);
        life->turn_to_walk = false;
        calm_life_state(life, CALM_TURN);
      }
    }
    if (life->state == CALM_OBSERVE && !interrupt) {
      ci->face_yaw = life->turn_yaw;
      if (life->elapsed >= life->wait) {
        life->quiet = 0;
        life->wait = in->preview ? 3.0f : random_f32_range(&life->rng, 24, 40);
        calm_life_state(life, CALM_REST);
      }
    }
    b32 walking = life->state == CALM_WALK && !interrupt;
    f32 turn = life->state == CALM_TURN && !interrupt ? m_saturatef(m_fabsf(m_wrap_pi(c->yaw - life->turn_yaw)) / .65f) : 0;
    f32 speed = character_planar_speed(c);
    f32 want = walking ? m_saturatef(speed / .17f) : turn * .65f;
    life->weight = m_damp(life->weight, want, interrupt ? 14.0f : 7.0f, dt);
    life->walk.speed = walking ? speed / CALM_CLIP_SPEED : turn * .42f;
    animation_update(&life->walk, &(AnimationUpdateDesc){.dt = dt});
    if (in->busy || life->state == CALM_REST || life->state == CALM_ATTEND) life->gaze = in->camera;
    else if (walking) life->gaze = v3_add(life->target, (v3){0, 1.15f, 0});
    else life->gaze = v3_add(c->position, (v3){life->destination == 1 ? -.85f : .85f, .8f, .8f});
  }
}

// Compose only the locomotion layer; the harness continues to own the face and gestures.
ecs_system(calm_life_pose_system, EcsIn(CalmLife), EcsInOut(EcsSkinnedModel)) {
  for (i32 i = 0; i < it->count; i++) {
    const CalmLife *life = ecs_sys_get_component(CalmLife, i);
    EcsSkinnedModel *sk = ecs_sys_get_component_mut(EcsSkinnedModel, i);
    if (life->weight < .001f || !sk->joint_poses || sk->joint_count != life->joint_count) continue;
    tctx_temp_allocator_scope(ta, NULL) {
      JointPose *pose = ALLOC_ARRAY(&ta.allocator, JointPose, sk->joint_count);
      f32 *mask = ALLOC_ARRAY(&ta.allocator, f32, sk->joint_count);
      AnimationState walk = life->walk;
      animation_sample(&walk, pose, life->joint_count);
      for (u32 j = 0; j < sk->joint_count; j++) mask[j] = life->weight * (j < life->joint_count ? life->mask[j] : 0);
      animation_pose_blend_masked(sk->joint_poses, sk->joint_poses, pose, mask, sk->joint_count);
    }
  }
}

void calm_life_schedule_intent(EcsWorld *w) { ecs_schedule(w, calm_life_intent_system); }
void calm_life_schedule_pose(EcsWorld *w) { ecs_schedule(w, calm_life_pose_system); }
