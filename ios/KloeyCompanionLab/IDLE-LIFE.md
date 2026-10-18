# Calm companion activity

FoxGlove now takes short, slow walks around the existing clearing when the
conversation is quiet. This runs locally on iPhone and does not ask the LLM
for activity decisions or generate extra STT/TTS requests.

## Behavior

- First stroll after roughly 32 seconds of quiet; allow an existing idle break
  to finish. After conversation, wait a varied 30–48 seconds.
- Step into a turn, stroll at 0.58 m/s, ease to a stop, turn toward the user and
  nearby flowers, and observe for 16–28 seconds. A further 24–40 second rest
  follows before the next walk. Existing breathing, blinks and idle breaks
  remain active between walks.
- Three destinations stay close to home along the clear center path. A swept
  kinematic capsule and physical floor/bounds contain movement. A stuck/timeout
  guard exits an obstructed walk.
- User speech onset/VAD, transcription, model thinking, queued/playing audio,
  and director performances take priority. Movement decelerates and its pose
  fades back to the harness. A final held pose yields only after a quiet interval.
- The camera softly follows the real character position. Orbit, pinch, reset
  and expanded-card headroom still apply. Gaze uses the actual camera position.
- Native scene inactivity, card details and Reduce Motion pause wandering;
  returning requires a fresh quiet interval.

## Where to develop it

| Concern | Location |
| --- | --- |
| Local behavior, cadence, destinations, bone mask | app/src/app/calm_life.c and .h |
| Voice priority, frame order, physics bounds, follow camera | app/src/app/player.c |
| Native visibility/Reduce Motion input | app_swift/Sources/ContentView.swift |
| Card-detail visibility signal | app_swift/Sources/CardsView.swift |
| Tag 5 activity bridge (4-byte flags) | host_msgs.gen.h/.c, HZMessages.swift |
| Original motion, license and provenance | art/locomotion/ |
| Repeatable retargeting | tools/prepare-locomotion.ts |
| Exported scene/corridor regression guard | tools/verify-life-space.py |

Tag 5 flags: bit 0 is active/visible; bit 1 is Reduce Motion. Only value 1
permits wandering. Existing tags 1–4 and session storage retain their contracts.

The Kaigen gameplay_blocks module supplies the actual character mover. Intent
is an ECS system; movement uses the engine's 60 Hz fixed step with interpolation.
A separate, name-remapped walk pose blends before skinning. Its mask excludes
face, neck, accessory and cloth-control joints, preserving the harness's rig
suppression and procedural face/gaze. The actor's idle-break scheduler yields
while locomotion owns the body. No changes to the shared SDK are required.

## Scope and limits

This is a deliberately small authored activity space, not free navigation of
the whole forest. Its floor matches the exported terrain at y=-0.025 m.
verify-life-space.py checks the actual swept area, not just destinations:
32 ground triangles are flat at that height and no prop triangles intersect it.
Changing the world/path requires this check to pass. A larger walkable world
would need terrain/prop colliders and navmesh routes using Kaigen navigation.

Walk speed is matched to measured retargeted stance-foot travel. Turning uses
step blending; dedicated authored start/stop/pivot clips are not included.
The extra ECS foot-planting pass was tested twice and visibly distorted the
existing skirt/cloth setup, including at rest. It is not enabled or left as dead
code. The flat corridor avoids uneven-ground foot-placement requirements;
precise foot locking and slope walking remain future work. No SDK patch or
engine bug report was submitted.

The current binding is for FoxGlove's skeleton/profile. Other avatars need a
matching retarget and bone mask; this does not automatically enable locomotion
on every imported VRM.

## Verification

- Native macOS and signed iPhone builds pass.
- Timed desktop captures inspect rest, turning, walking, observing and resuming.
- The mid-walk interruption replay holds position with 0.000 m measured drift
  between its 6.5 and 9 second snapshots, remains grounded, and resumes after
  the simulated speech plus quiet interval. This is a simulated voice-state
  replay, not a new human voice audition.
- After unlocking the final installed app, normal conversation mode completed
  two production-paced stroll/observe cycles. State logs and physical-device
  captures confirm turning, walking and settling with camera follow; no engine
  errors appeared. This used the saved session, not the accelerated preview.
- Physical iPhone 14 UI test passes: walking, collapsed/expanded cards, paging,
  world drag/pinch/reset and background/resume. Rendered screenshots inspected.
- Held-gesture replay passes: exactly one release, then a walk and observation.
- Existing session restore, camera/cards message contracts and new activity
  message checks pass. The exported wind/material guard also passes.
- Short desktop sample: about 9 ms GPU. Final native iPhone 14 sample at rest
  (100 frames after 100 warm-up frames): 15.13 ms average GPU time, 16.69 ms
  median frame time, 16.84 ms mean frame time and 289.53 MB GPU memory. No
  engine errors appeared in that sample. This does not establish sustained
  walking performance, battery use or thermal behavior.

Fast behavior preview (3 second initial wait; production pacing is unchanged):

```sh
cd app
HARNESS_CHARACTER=foxglove HARNESS_PREVIEW=life hz/hzbuild macos run
```

Use HARNESS_PREVIEW=life-interrupt for a simulated busy interval from seconds
6–10, or life-held for a held-gesture handoff check. Session settings are not
saved from explicit preview launches.

Reproduce the interruption measurement:

```sh
cd app
HARNESS_CHARACTER=foxglove HARNESS_PREVIEW=life-interrupt hz/hzbuild macos run --commands '5.8:dump_entity:FoxGlove;6.5:dump_entity:FoxGlove;9:dump_entity:FoxGlove;21:quit' > life-interruption.log 2>&1
cd ..
python3 tools/check-life-interruption.py app/life-interruption.log
```

Build for iPhone with ./build-engine.sh, then Run the existing Xcode project.
The script validates both wind/materials and the walking space before packaging.

## References used

- Lab/harness READMEs, FoxGlove animation/state manifests and harness rig code.
- Installed Kaigen setup plugin and SDK hz-core, hz-game and hz-build skills.
- SDK wiki: ECS, animation, IK, physics, navigation, gameplay character/camera.
- SDK character-controller source and canonical example_ik.c. The shared SDK
  remained read-only.
- https://kaigen3d.com/docs/writing-applications
- https://vrm.dev/en/vrma/ — normalized humanoid animation and retargeting.
- https://quaternius.com/packs/universalanimationlibrary.html — motion and CC0 license.
