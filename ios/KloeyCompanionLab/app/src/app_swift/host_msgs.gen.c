// @generated from the host-message schema — do not edit by hand.
#include "app_swift/host_msgs.gen.h"
#include "app_swift/app_host.h"
#include "lib/memory.h"
#include "lib/thread_context.h"

// wire = [u32 tag][POD payload]. messages are fixed-size, so payloads move as
// whole structs (memcpy); there is no field-by-field codec.

hz_internal void hz__emit(u32 tag, const void *payload, u32 size) {
  u32 total = 4 + size;
  TempAllocator ta = tctx_temp_allocator_begin(NULL);
  u8 *b = ALLOC_ARRAY(&ta.allocator, u8, total);
  mem_cpy(b, &tag, 4);
  mem_cpy(b + 4, payload, size);
  engine_host_emit(b, total);
  tctx_temp_allocator_end(ta);
}

void hz_msg_dispatch(void *ctx, const u8 *buf, u32 len) {
  if (len < 4) return;
  u32 tag;
  mem_cpy(&tag, buf, 4);
  const u8 *p = buf + 4;
  u32 plen = len - 4;
  switch (tag) {
  case HZ_SET_COMPANION_PROFILE: {
    if (plen != sizeof(HZSetCompanionProfile)) return;
    HZSetCompanionProfile m;
    mem_cpy(&m, p, sizeof m);
    m.timezone[64] = 0;
    m.user_name[160] = 0;
    app_msg_set_companion_profile(ctx, m);
    break;
  }
  case HZ_SET_FRAMING: {
    if (plen < sizeof(HZSetFraming)) return;
    HZSetFraming m;
    mem_cpy(&m, p, sizeof m);
    app_msg_set_framing(ctx, m);
    break;
  }
  case HZ_SET_CARDS_LAYOUT: {
    if (plen != sizeof(HZSetCardsLayout)) return;
    HZSetCardsLayout m;
    mem_cpy(&m, p, sizeof m);
    app_msg_set_cards_layout(ctx, m);
    break;
  }
  case HZ_ORBIT_CAMERA: {
    if (plen != sizeof(HZOrbitCamera)) return;
    HZOrbitCamera m;
    mem_cpy(&m, p, sizeof m);
    app_msg_orbit_camera(ctx, m);
    break;
  }
  case HZ_SET_ACTIVITY: {
    if (plen != sizeof(HZSetActivity)) return;
    HZSetActivity m;
    mem_cpy(&m, p, sizeof m);
    app_msg_set_activity(ctx, m);
    break;
  }
  default:
    break;
  }
}

void hz_send_framing_changed(HZFramingChanged msg) { hz__emit(HZ_FRAMING_CHANGED, &msg, sizeof msg); }
