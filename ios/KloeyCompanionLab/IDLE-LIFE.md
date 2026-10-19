# Calm companion activity on iOS

The companion takes short walks when conversation is quiet. The local ECS
activity does not make LLM, STT or TTS calls. Voice, facial expression, gaze,
gestures and cloth retain priority over the locomotion layer.

## Behavior and ownership

The first walk follows about 32 seconds of quiet. After conversation the quiet
interval varies from 30–48 seconds. Walks cruise at 0.58 m/s, settle at the
actual destination, observe for 16–28 seconds, then rest for 24–40 seconds.
Preview launches shorten these intervals without changing production pacing.

Kaigen navigation requests a walk-only route from the current position. The
activity follows returned waypoints, rejects failed/blocked routes, and releases
requests when interrupted. Arrival requires reaching the final waypoint and
stopping; a timeout or obstruction returns to rest rather than claiming arrival.
The gameplay character controller moves at 60 Hz with frame interpolation.

The default three destinations remain in the verified flat center corridor.
`HARNESS_EXTENDED_WALKS=1` enables two additional authored destinations and wider
bounds for device evaluation. It is not the default. `tools/verify-life-space.py`
continues to guard the original swept corridor. Static collision is extracted
from the rendered clearing by `tools/prepare-collision.py`: ground is category 1,
fixed trunks/rocks/mushrooms category 2, and containment walls category 4. Moving
foliage is excluded. `tools/verify-collision.py` checks the cooked geometry.

`CameraFollow` owns the camera, with native orbit/framing/card headroom composed
before the rig runs. Boom collision uses categories 1–2; ground clearance uses
category 1. Containment walls do not shorten the camera boom.

The separate animation layer crossfades walk, start, stop, pivot and observation
clips. Start/stop/pivot/observation are transitions derived from the preserved
CC0 motion and idle pose, not newly licensed motion capture. Its named joint
remaps and bone mask exclude face, head/neck and accessory/cloth controls. The
harness pose runs first; locomotion blends before skinning and cloth evaluation.

Speech onset/VAD, transcription, thinking, queued/playing audio and active
performances decelerate movement and fade its pose. A held conversational pose
is released only after a quiet interval. Native scene inactivity, card details,
settings and Reduce Motion suspend activity. Sticky suspension generations
preserve even a background/resume pair between engine ticks; returning starts a
fresh quiet interval.

## Relevant files

| Concern | Location |
| --- | --- |
| Cadence, navigation, motion layer and bone mask | `app/src/app/calm_life.c`, `.h` |
| Voice priority, camera composition and frame order | `app/src/app/player.c` |
| Static collision asset and collider ownership | `app/src/app/calm_world.c`, `.h` |
| Native lifecycle and accessibility | `app_swift/Sources/ContentView.swift` |
| Host command contracts | `app/src/app_swift/`, Swift `Sources/Generated/` |
| Motion provenance and reproducible preparation | `art/locomotion/`, `tools/prepare-locomotion.ts` |

Tag 5 remains the four-byte activity command: bit 0 active, bit 1 Reduce Motion;
only value 1 permits wandering. Its wire contract is unchanged. Settings and
camera inputs use an SPSC snapshot; text actions use a separate ordered queue.

## Validation and limits

See `IOS-WORK.md` and `ios-progress.json` for evidence for this revision.
Earlier captures and timing numbers describe the pre-audit implementation and
are not acceptance evidence for the new navigation, collision or motion layer.
Debug/Release builds and geometry guards are automated; physical route, camera,
cloth and interruption checks remain required before accepting those changes.

Foot planting remains disabled. Previous rendered trials distorted the skirt,
including at rest. Do not enable it until that interaction is resolved and
visually checked on iPhone. Uneven-ground walking is not accepted by the default
corridor configuration. Other avatars need their own retarget and mask.

From the lab root, build and run a native preview:

```sh
./build-engine.sh
DEVICECTL_CHILD_HARNESS_PREVIEW=life DEVICECTL_CHILD_HARNESS_PERF=1 app_swift/run.sh --skip-engine --device <UDID> --console
```

`life-interrupt` replays a busy interval from seconds 6–10. `life-held` checks the
held-pose handoff. These are simulated voice-state tests; a real voice/barge-in
check is separately tracked. Explicit preview launches do not save session
settings.

## Guidance

Use the lab and Swift `AGENTS.md`, installed Kaigen setup plugin, pinned
`hz-core`, `hz-game`, `hz-build` skills, and SDK wiki pages for ECS, animation,
physics, navigation and the gameplay character/camera modules. Keep the shared
SDK read-only. Public guidance: https://kaigen3d.com/docs/writing-applications
