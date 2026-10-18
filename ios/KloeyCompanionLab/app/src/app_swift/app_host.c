#include "app_swift/app_host.h"
#include "app_swift/host_msgs.gen.h"
#include "lib/memory.h"
#include "lib/thread_context.h"
#include "lib/typedefs.h"

// Single-producer (host UI thread) / single-consumer (engine main lane) ring.
// The host enqueues via engine_recv; the engine drains at frame start. Messages
// are never processed on the caller's thread.
//
// The file-scope state below is the sanctioned host-boundary exception to the
// engine's no-globals rule (same class as the os/entrypoint layers): Swift
// calls engine_recv as a bare C symbol, before and independently of any app
// state, so the ring cannot hang off a context pointer.
#define HZ_RING_SLOTS 32
#define HZ_RING_SLOT_BYTES 4096

hz_internal struct {
  u8 ring[HZ_RING_SLOTS][HZ_RING_SLOT_BYTES];
  u32 len[HZ_RING_SLOTS];
  u32 w;
  u32 r;
  HostRecvFn recv_fn;
  void *recv_ctx;
} g_host;

void engine_recv(const u8 *buf, u32 len) {
  if (!buf || len == 0 || len > HZ_RING_SLOT_BYTES) return;
  u32 w = atomic_u32_read_relaxed(&g_host.w);
  u32 r = atomic_u32_read_acquire(&g_host.r);
  if (w - r >= HZ_RING_SLOTS) return;
  u32 slot = w % HZ_RING_SLOTS;
  mem_cpy(g_host.ring[slot], buf, len);
  g_host.len[slot] = len;
  atomic_u32_write_release(&g_host.w, w + 1);
}

void app_host_drain(void *ctx) {
  u32 r = atomic_u32_read_relaxed(&g_host.r);
  u32 w = atomic_u32_read_acquire(&g_host.w);
  while (r != w) {
    u32 slot = r % HZ_RING_SLOTS;
    hz_msg_dispatch(ctx, g_host.ring[slot], g_host.len[slot]);
    r++;
  }
  atomic_u32_write_release(&g_host.r, r);
}

void engine_set_host_recv(HostRecvFn fn, void *ctx) {
  g_host.recv_fn = fn;
  g_host.recv_ctx = ctx;
}

void engine_host_emit(const u8 *buf, u32 len) {
  if (g_host.recv_fn) g_host.recv_fn(buf, len, g_host.recv_ctx);
}
