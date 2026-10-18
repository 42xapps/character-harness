// app_swift — the host boundary between this engine project and the SwiftUI
// app in ../../../app_swift.
//
// SHAPE
//   The engine ships to the host as HZEngine.xcframework
//   (`hz/hzbuild ios --framework` -> out/ios-framework/). The framework's
//   public headers are HZEngineView.h (engine-owned) plus every path listed
//   under `ios_public_headers` in hzproject.hzt — that is how app_host.h
//   becomes visible to Swift. The APP owns the message schema, not the
//   engine, so a new message needs no engine release.
//
//   host  --engine_recv(bytes)-->  SPSC ring  --app_host_drain-->  app_msg_*
//   host  <--HostRecvFn(bytes)--  engine_host_emit  <--hz_send_*
//
//   Wire format is [u32 tag][POD struct bytes]; both ends move whole structs
//   with memcpy and pin the sizes with _Static_assert / MemoryLayout.
//
// WIRING (left to you on purpose — `hzbuild new` never edits template code)
//   Call app_swift_update once per frame from your app's
//   app_update_and_render, on the main lane only:
//
//     lane_sync();
//     if (is_main_thread()) {
//       app_swift_update(state);
//     }
//
//   `state` is passed opaquely to the generated dispatch and on to your
//   app_msg_* handlers as `ctx`.
//
// ADDING A MESSAGE
//   Edit host_msgs.gen.h/.c and the two Swift mirrors in
//   ../../../app_swift/Sources/Generated. Keep the C _Static_assert size and
//   the Swift MemoryLayout assert equal — that pair IS the wire contract.
#pragma once

#include "app_swift/app_host.h"
#include "app_swift/host_msgs.gen.h"

// drains everything the host enqueued since the last frame, dispatching each
// message to its app_msg_* handler with `ctx`. main lane only.
void app_swift_update(void *ctx);
