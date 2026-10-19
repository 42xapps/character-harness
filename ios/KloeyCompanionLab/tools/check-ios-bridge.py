"""Compile the actual host transport with CLI dependency shims and stress its contract."""
from pathlib import Path
import re
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def source(name):
    return re.sub(r'^#include.*\n', '', (ROOT / 'app/src/app_swift' / name).read_text(), flags=re.M)


PREFIX = r'''
#include <stdint.h>
#include <string.h>
#include <assert.h>
#include <math.h>
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
typedef uint8_t u8; typedef uint32_t u32; typedef uint64_t u64;
typedef float f32; typedef double f64;
typedef void (*HostRecvFn)(const u8*, u32, void*);
#define hz_internal static
#define mem_cpy memcpy
typedef struct { void *last; } TestAllocator;
typedef struct { TestAllocator allocator; } TempAllocator;
static TempAllocator tctx_temp_allocator_begin(void *unused) { (void)unused;return (TempAllocator){0}; }
static void *test_alloc(TestAllocator *a,size_t size) { a->last=malloc(size);assert(a->last);return a->last; }
static void tctx_temp_allocator_end(TempAllocator ta) { free(ta.allocator.last); }
#define ALLOC_ARRAY(a,t,n) ((t*)test_alloc(a,sizeof(t)*(n)))
#define atomic_u32_eval_assign(p,v) __atomic_exchange_n(p,v,__ATOMIC_SEQ_CST)
#define atomic_u32_read_relaxed(p) __atomic_load_n(p,__ATOMIC_RELAXED)
#define atomic_u32_write_release(p,v) __atomic_store_n(p,v,__ATOMIC_RELEASE)
#define atomic_u32_read_acquire(p) __atomic_load_n(p,__ATOMIC_ACQUIRE)
static float m_clampf(float x,float low,float high) { return fminf(fmaxf(x,low),high); }
'''
TEST = r'''
static u32 activity, pauses, profiles, texts, fixtures, acknowledgements;
void app_msg_submit_text(void *ctx,HZSubmitText m) {
  (void)ctx;
  if(m.request_id==0x10203040) {
    const char *expected="My intention: مرحبا Élodie 🦊";
    assert(m.length==strlen(expected) && memcmp(m.text,expected,m.length)==0 && !m.text[m.length]);
    fixtures++;
    hz_send_text_submitted((HZTextSubmitted){m.request_id,1});
  } else assert(m.request_id==texts++);
}
static void receive_ack(const u8 *bytes,u32 size,void *ctx) {
  assert(size==12 && fwrite(bytes,1,size,(FILE*)ctx)==size);acknowledgements++;
}
static double yaw;
void app_msg_set_device_budget(void *ctx,HZSetDeviceBudget m) { (void)ctx;(void)m; }
void app_msg_set_framing(void *ctx,HZSetFraming m) { (void)ctx;(void)m; yaw=0; }
void app_msg_set_cards_layout(void *ctx,HZSetCardsLayout m) { (void)ctx; assert(m.reserved_fraction <= .65f); }
void app_msg_set_activity(void *ctx,HZSetActivity m) { (void)ctx;activity=m.flags; if(!m.flags)pauses++; }
void app_msg_set_companion_profile(void *ctx,HZSetCompanionProfile m) {
  (void)ctx; profiles++; assert(m.timezone[64]==0 && m.user_name[160]==0);
  for (int i=1;i<160;i++) assert(m.user_name[i]==m.user_name[0]);
}
void app_msg_orbit_camera(void *ctx,HZOrbitCamera m) { (void)ctx; yaw+=m.yaw; }
static void send_activity(u32 flags) {
  struct {u32 tag, flags;} m={5,flags}; assert(engine_recv((u8*)&m,sizeof m));
}
static u32 finished;
static void *produce(void *unused) {
  (void)unused;
  struct {u32 tag; HZOrbitCamera value;} orbit={3,{.001f,0,0}};
  struct {u32 tag; HZSetCompanionProfile value;} profile={.tag=6};
  for(u32 i=0;i<100000;i++) {
    assert(engine_recv((u8*)&orbit,sizeof orbit));
    memset(profile.value.user_name,'A'+i%26,160);
    assert(engine_recv((u8*)&profile,4+sizeof profile.value));
    if(i%97==0) {send_activity(0);send_activity(1);}
  }
  __atomic_store_n(&finished,1,__ATOMIC_RELEASE); return NULL;
}
int main(int argc,char **argv) {
  assert(argc==1 || argc==3);
  FILE *ack=argc==3?fopen(argv[2],"wb"):NULL;
  if(argc==3) {assert(ack);engine_set_host_recv(receive_ack,ack);}
  struct {u32 tag; HZOrbitCamera value;} orbit={3,{.01f,0,0}};
  for(int i=0;i<1000;i++) assert(engine_recv((u8*)&orbit,sizeof orbit));
  send_activity(0); send_activity(1); app_host_drain(NULL);
  assert(activity==1 && pauses==1 && fabs(yaw-10)<.0001);
  app_host_drain(NULL); assert(pauses==1);
  struct {u32 tag, value;} framing={1,1};
  assert(engine_recv((u8*)&framing,sizeof framing));
  assert(engine_recv((u8*)&orbit,sizeof orbit)); app_host_drain(NULL);
  assert(fabs(yaw-.01)<.00001);
  assert(!engine_recv((u8*)&framing,7)); assert(!engine_recv(NULL,0));
  pthread_t producer; assert(!pthread_create(&producer,NULL,produce,NULL));
  while(!__atomic_load_n(&finished,__ATOMIC_ACQUIRE)) app_host_drain(NULL);
  assert(!pthread_join(producer,NULL)); app_host_drain(NULL);
  assert(fabs(yaw-100.01)<.001 && activity==1 && profiles>0);
  struct {u32 tag; HZSubmitText value;} text={.tag=7};
  for(u32 i=0;i<16;i++) {text.value.request_id=i;assert(engine_recv((u8*)&text,sizeof text));}
  assert(!engine_recv((u8*)&text,sizeof text)); send_activity(0); app_host_drain(NULL);
  assert(texts==16 && activity==0);
  if(argc==3) {
    FILE *input=fopen(argv[1],"rb");assert(input);
    u8 bytes[4+sizeof(HZSubmitText)];
    assert(fread(bytes,1,sizeof bytes,input)==sizeof bytes && fgetc(input)==EOF);fclose(input);
    assert(engine_recv(bytes,sizeof bytes));app_host_drain(NULL);
    assert(fixtures==1 && acknowledgements==1);fclose(ack);
    puts("Swift -> C text and C -> Swift acknowledgement fixtures emitted by the real message bridge.");
  }
  puts("Bridge passed: 1000 queued orbits + pause/resume; reset ordering; 100000 concurrent publications; no torn profiles.");
}
'''


with tempfile.TemporaryDirectory(prefix='kloey-bridge-') as directory:
    test = Path(directory) / 'bridge.c'
    test.write_text(PREFIX + source('host_msgs.gen.h') + source('app_host.c') + source('host_msgs.gen.c') + TEST)
    binary = Path(directory) / 'bridge'
    subprocess.run(['clang', '-std=c11', '-Wall', '-Wextra', '-Werror', '-Wno-pragma-once-outside-header',
                    '-pthread', str(test), '-o', str(binary)], check=True)
    subprocess.run([str(binary), *sys.argv[1:]], check=True)
