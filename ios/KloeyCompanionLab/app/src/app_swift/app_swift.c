#include "app_swift/app_swift.h"
#include "app/player.h"
#include "app_swift/app_host.c"
#include "app_swift/host_msgs.gen.c"

void app_msg_set_framing(void *ctx, HZSetFraming msg) {
  player_set_framing(ctx, msg.value);
  hz_send_framing_changed((HZFramingChanged){.value = msg.value == 1 ? 1 : 0});
}

void app_swift_update(void *ctx) { app_host_drain(ctx); }

void app_msg_orbit_camera(void *ctx, HZOrbitCamera msg) {
  player_orbit(ctx, msg.yaw, msg.pitch, msg.zoom);
}

void app_msg_set_cards_layout(void *ctx, HZSetCardsLayout msg) {
  player_set_cards_layout(ctx, msg.reserved_fraction);
}

void app_msg_set_activity(void *ctx, HZSetActivity msg) {
  player_set_activity(ctx, msg.flags);
}

void app_msg_set_companion_profile(void *ctx, HZSetCompanionProfile msg) {
  player_set_profile(ctx, msg);
}

void app_msg_submit_text(void *ctx, HZSubmitText msg) { player_submit_text(ctx, msg); }

void app_msg_set_device_budget(void *ctx, HZSetDeviceBudget msg) { player_set_device_budget(ctx, msg); }
