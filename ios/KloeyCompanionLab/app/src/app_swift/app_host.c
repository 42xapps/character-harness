#include "app_swift/app_host.h"
#include "app_swift/host_msgs.gen.h"
#include "lib/memory.h"
#include "lib/thread_context.h"
#include "lib/hzmath.h"

// ABI-owned storage: one UI producer, one engine-main consumer, no AppState at entry.
typedef struct {
  HZSetFraming framing;
  HZSetCardsLayout cards;
  HZSetActivity activity;
  HZSetDeviceBudget budget;
  HZSetCompanionProfile profile;
  u64 framing_version, cards_version, activity_version, profile_version, suspensions, budget_version;
  f64 yaw, pitch, zoom;
} HZHostState;

hz_internal struct {
  HZHostState pending, slots[3], seen;
  u32 back, middle, front;
  HZSubmitText texts[16];
  u32 text_write, text_read;
  HostRecvFn recv_fn;
  void *recv_ctx;
} g_host = {.back = 2, .middle = 1};

u32 engine_recv(const u8 *buf, u32 len) {
  if (!buf || len < 4) return 0;
  u32 tag;
  mem_cpy(&tag, buf, 4);
  HZHostState *s = &g_host.pending;
  const u8 *p = buf + 4;
  u32 size = len - 4;
  switch (tag) {
  case HZ_SUBMIT_TEXT: {
    if (size != sizeof(HZSubmitText)) return 0;
    u32 write = atomic_u32_read_relaxed(&g_host.text_write);
    if (write - atomic_u32_read_acquire(&g_host.text_read) >= 16) return 0;
    mem_cpy(&g_host.texts[write % 16], p, size);
    atomic_u32_write_release(&g_host.text_write, write + 1);
    return 1;
  }
  case HZ_SET_FRAMING:
    if (size != sizeof s->framing) return 0;
    mem_cpy(&s->framing, p, size);
    s->framing_version++;
    s->yaw = s->pitch = s->zoom = 0;
    break;
  case HZ_SET_CARDS_LAYOUT:
    if (size != sizeof s->cards) return 0;
    mem_cpy(&s->cards, p, size);
    s->cards_version++;
    break;
  case HZ_SET_DEVICE_BUDGET:
    if (size != sizeof s->budget) return 0;
    mem_cpy(&s->budget, p, size);
    s->budget_version++;
    break;
  case HZ_SET_ACTIVITY:
    if (size != sizeof s->activity) return 0;
    mem_cpy(&s->activity, p, size);
    s->activity.flags &= 3;
    if (s->activity.flags != 1) s->suspensions++;
    s->activity_version++;
    break;
  case HZ_SET_COMPANION_PROFILE:
    if (size != sizeof s->profile) return 0;
    mem_cpy(&s->profile, p, size);
    s->profile.timezone[64] = s->profile.user_name[160] = 0;
    s->profile_version++;
    break;
  case HZ_ORBIT_CAMERA: {
    if (size != sizeof(HZOrbitCamera)) return 0;
    HZOrbitCamera orbit;
    mem_cpy(&orbit, p, size);
    if (!(orbit.yaw >= -100 && orbit.yaw <= 100 && orbit.pitch >= -100 &&
          orbit.pitch <= 100 && orbit.zoom >= -100 && orbit.zoom <= 100)) return 0;
    s->yaw += m_clampf(orbit.yaw, -.5f, .5f);
    s->pitch = m_clampf((f32)s->pitch + m_clampf(orbit.pitch, -.3f, .3f), 0, .65f);
    s->zoom = m_clampf((f32)s->zoom + m_clampf(orbit.zoom, -.5f, .5f), -.55f, .95f);
    break;
  }
  default: return 0;
  }
  g_host.slots[g_host.back] = *s;
  // Exchange transfers exclusive slot ownership; bulk data is never concurrently accessed.
  g_host.back = atomic_u32_eval_assign(&g_host.middle, g_host.back | 4) & 3;
  return 1;
}

hz_internal void app_host_drain_state(void *ctx) {
  if (!(atomic_u32_read_acquire(&g_host.middle) & 4)) return;
  g_host.front = atomic_u32_eval_assign(&g_host.middle, g_host.front) & 3;
  const HZHostState *s = &g_host.slots[g_host.front];
  HZHostState *seen = &g_host.seen;
  if (s->framing_version != seen->framing_version) {
    app_msg_set_framing(ctx, s->framing);
    seen->yaw = seen->pitch = seen->zoom = 0;
  }
  if (s->budget_version != seen->budget_version) app_msg_set_device_budget(ctx, s->budget);
  if (s->cards_version != seen->cards_version) app_msg_set_cards_layout(ctx, s->cards);
  if (s->profile_version != seen->profile_version) app_msg_set_companion_profile(ctx, s->profile);
  // Preserve a coalesced pause/resume edge even when only the final active level survives.
  if (s->suspensions != seen->suspensions) app_msg_set_activity(ctx, (HZSetActivity){0});
  if (s->activity_version != seen->activity_version) app_msg_set_activity(ctx, s->activity);
  HZOrbitCamera delta = {(f32)(s->yaw - seen->yaw), (f32)(s->pitch - seen->pitch), (f32)(s->zoom - seen->zoom)};
  if (delta.yaw || delta.pitch || delta.zoom) app_msg_orbit_camera(ctx, delta);
  *seen = *s;
}

void app_host_drain(void *ctx) {
  app_host_drain_state(ctx);
  u32 read = atomic_u32_read_relaxed(&g_host.text_read);
  u32 write = atomic_u32_read_acquire(&g_host.text_write);
  while (read != write) {
    app_msg_submit_text(ctx, g_host.texts[read % 16]);
    read++;
  }
  atomic_u32_write_release(&g_host.text_read, read);
}

void engine_set_host_recv(HostRecvFn fn, void *ctx) {
  g_host.recv_fn = fn;
  g_host.recv_ctx = ctx;
}

void engine_host_emit(const u8 *buf, u32 len) {
  if (g_host.recv_fn) g_host.recv_fn(buf, len, g_host.recv_ctx);
}
