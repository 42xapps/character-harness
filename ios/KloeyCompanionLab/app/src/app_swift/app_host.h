// Host<->engine transport. `engine_recv` is the host-facing ABI: the iOS host
// delivers serialized messages through it and registers a callback for
// engine->host events. the app owns and implements this interface.
// `app_host_drain` processes queued host->engine messages once per frame on
// the main lane; `ctx` is passed opaquely to the generated dispatch and on to
// the app's message handlers.
//
// this header is exported into HZEngine.xcframework via `ios_public_headers`
// in hzproject.hzt, so it must stay free of engine includes — Swift compiles
// it directly.
#pragma once
#include <stdint.h>

// host -> engine: deliver one serialized message. The engine copies the bytes
// and processes them on its next frame.
void engine_recv(const uint8_t *buf, uint32_t len);

// engine -> host: the host registers a callback to receive serialized events.
// the buffer is valid only for the duration of the call (copy it to keep it).
typedef void (*HostRecvFn)(const uint8_t *buf, uint32_t len, void *ctx);
void engine_set_host_recv(HostRecvFn fn, void *ctx);

void app_host_drain(void *ctx);
// engine -> host: send one serialized event to the registered host callback.
void engine_host_emit(const uint8_t *buf, uint32_t len);
