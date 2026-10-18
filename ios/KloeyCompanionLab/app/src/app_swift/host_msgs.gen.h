// @generated from the host-message schema — do not edit by hand.
//
// (there is no generator yet: this file and its Swift mirrors are hand-shaped
// "as-if-generated". Keep all four in sync by hand.)
//
// Messages are fixed-size PODs: the struct's memory layout *is* the wire
// format. Both ends move whole structs with memcpy; there is no field-by-field
// codec. The _Static_asserts pin each struct's byte size as the wire contract
// (the Swift host asserts the same numbers).
#pragma once
#include "lib/typedefs.h"

typedef enum {
  HZ_SET_FRAMING = 1,
  HZ_FRAMING_CHANGED = 2,
  HZ_ORBIT_CAMERA = 3,
  HZ_SET_CARDS_LAYOUT = 4,
  HZ_SET_ACTIVITY = 5,
  HZ_SET_COMPANION_PROFILE = 6,
} HZMsgTag;

// --- commands (host -> engine): typed payloads + the handlers the app must
// implement (the engine won't link until each is defined). ctx is opaque.
typedef struct {
  u32 value;
} HZSetFraming;
_Static_assert(sizeof(HZSetFraming) == 4, "HZSetFraming wire size");

void app_msg_set_framing(void *ctx, HZSetFraming msg);

void hz_msg_dispatch(void *ctx, const u8 *buf, u32 len);

// --- events (engine -> host): typed payloads + per-event send functions.
typedef struct {
  u32 value;
} HZFramingChanged;
_Static_assert(sizeof(HZFramingChanged) == 4, "HZFramingChanged wire size");

void hz_send_framing_changed(HZFramingChanged msg);

typedef struct { f32 yaw, pitch, zoom; } HZOrbitCamera;
_Static_assert(sizeof(HZOrbitCamera) == 12, "HZOrbitCamera wire size");
void app_msg_orbit_camera(void *ctx, HZOrbitCamera msg);

typedef struct { f32 reserved_fraction; } HZSetCardsLayout;
_Static_assert(sizeof(HZSetCardsLayout) == 4, "HZSetCardsLayout wire size");
void app_msg_set_cards_layout(void *ctx, HZSetCardsLayout msg);

typedef struct { u32 flags; } HZSetActivity;
_Static_assert(sizeof(HZSetActivity) == 4, "HZSetActivity wire size");
void app_msg_set_activity(void *ctx, HZSetActivity msg);

// NUL-terminated UTF-8: IANA zone (64 bytes), optional name (40 Unicode scalars).
typedef struct { char timezone[65]; char user_name[161]; } HZSetCompanionProfile;
_Static_assert(sizeof(HZSetCompanionProfile) == 226, "HZSetCompanionProfile wire size");
void app_msg_set_companion_profile(void *ctx, HZSetCompanionProfile msg);
