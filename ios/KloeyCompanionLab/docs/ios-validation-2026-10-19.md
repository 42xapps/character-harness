# iOS remediation evidence — 2026-10-19

The review covers additions after `45f0b6d495662fd5c6c2d7d7f08f104fcef38406`
through `abb446878af993ca4d3074320ca8f417804f2846`. The remediation is tracked on
`codex/character-harness-ios-20261018` in the integrated
`character-harness/ios/KloeyCompanionLab` project.
The [original audit](review-2026-10-19.md) is retained as historical evidence.
[IOS-WORK.md](../IOS-WORK.md) and [ios-progress.json](../ios-progress.json) contain
the current todo list, per-step guidance receipts and remaining acceptance work.

The project remains on Kaigen `0.6.2.001-beta` (SDK SHA
`abd44c1843da14eac0489fd4d4fb4e7695145061`). The installed Kaigen setup plugin,
project/host `AGENTS.md`, relevant pinned SDK skills and wiki pages, and public
Kaigen/Apple/OpenAI documentation were checked at each relevant step. No SDK
source or synced `sources/` file was edited.

## Original findings and fixes

| Finding | Change | Evidence and limit |
| --- | --- | --- |
| F1: const POD copy | Pass the fixed profile value and explicitly terminate its fields | Both native configurations compile; Unicode/profile and wire contracts pass |
| F2: Release packaged Debug C | Propagate configuration and bind reuse to SDK/input/output hashes | Debug and Release engine + SwiftUI builds pass; wrong-configuration reuse is rejected |
| F3: bounded ring drops settings/orbit | Latest-state SPSC publication, accumulated camera input, separate ordered text queue with refusal | Actual C transport passes 1,000 queued inputs and 100,000 concurrent publications without torn profiles |
| F4: coalesced pause/resume loses quiet reset | Carry sticky suspension generations into the activity system | Bridge edge preservation passes; physical quiet/resume timing remains open |
| F5: static foliage shadows | Shared color/shadow/depth deformation and typed current/previous frame time | Pinned Metal iOS variants and material-routing guards pass; physical image acceptance remains open |
| F6: screenshot runner hides a failed test | Preserve xcodebuild exit status, require exact named captures, bound output cleanup to the build folder | Intentional assertion failure exits 65 and exports diagnostics; successful UI run exits 0; unsafe output paths are rejected |
| F7: whole development cook ships | Resolve reflected dependencies, dynamic animation groups, iOS shaders and ASTC images into a separate resource stage | Final signed archive contains exactly 599 expected files / 90,781,937 bytes, with every SHA-256 matching the report |

The final resource stage is **86.58 MiB**, compared with about 403 MiB in the
original audit. The final local signed Release archive and debugging export
both succeeded. Xcode's App Thinning Size Report estimates **25.6 MB compressed**
and **96.5 MB installed** for the export. This is a local Xcode estimate, not an
App Store measurement. That signed Release was installed during the original
verification. The startup follow-up below describes the current installed build.

## Integrated improvements

- Explicit intention and chat actions use the existing voice pipeline's text
  injection, history, cancellation and staging. UTF-8 length limits, queue
  refusal, request identifiers and disconnected acknowledgements are handled.
  Swift-produced request bytes are consumed by the actual C bridge, and its
  generated acknowledgement is decoded by the actual Swift dispatcher.
- Native cards support wrapping text, 44-point controls, Reduce Motion and
  scrollable details. At the largest accessibility size, decorative elements
  yield to text, controls remain readable and settings uses a large sheet.
- Kaigen CameraFollow composes app framing/director/card policy with a colliding
  boom. Authored ground and fixed props come from the actual exported GLB.
- Hardware presets, resolution bounds, two frames in flight, thermal and Low
  Power input are integrated. Every quality-policy combination passes its
  offline contract. `HARNESS_PERF=1` exposes periodic engine timing samples.
- Asynchronous walk-only paths, controller movement and a separate masked
  animation layer provide start/stop/pivot/observe transitions. Derived clips
  retain their CC0 source and use the canonical harness retarget helpers.
- Automatic cue gestures and OpenAI Decisions reactions precede the director.
  Runtime-owned `staged_beats` lets later extensions respect earlier channels
  without resending cues or implying verified playback. Session-level tests
  cover isolation, exactly-once emission and in-flight cancellation.
- Repeated Xcode project regeneration preserves saved signing teams. Seven
  matching player helpers have a drift guard and explicit synchronization command. Redundant retarget
  copies, unused configuration and UI were removed. Native startup logging no
  longer prints the bearer session URL.

`HARNESS_EXTENDED_WALKS=1` and `HARNESS_TEMPORAL=1` are opt-in evaluation paths.
The default walking corridor and 2x MSAA remain. Foot planting remains disabled;
the documented skirt interaction still needs a physical rendered investigation.

The lint pass also checked allocation lifetimes, main-lane/ECS ownership,
barriers before renderer reads, format arity and pinned API signatures. The
host mailbox is an intentional ABI storage exception: messages can arrive
before AppState exists. It uses SDK atomics; the SDK byte ring is not a
thread-safe latest-state mailbox. Collision uses reflected cooked assets, and
the staging tool reads the pinned format rather than introducing an app binary
format. Missing/unknown dependencies fail packaging.

## Validation completed

| Check | Result | Local evidence, relative to the lab |
| --- | --- | --- |
| TypeScript typecheck + runtime suite | 152 tests pass, no failures | `app_swift/build/ios-work-typecheck.log`, `ios-work-runtime-tests.log` |
| Active FoxGlove manifest/providers/extensions | 0 errors, 0 warnings; existing OpenAI and ElevenLabs keys reused | `app_swift/build/ios-work-character-check.log` |
| Native contracts, both directions across Swift/C, transport stress, profile and quality policy | Pass | `app_swift/build/ios-work-contracts.log` |
| Native iOS Debug and Release engine + SwiftUI builds | Pass | `app_swift/build/ios-work-final-builds.log`, `ios-checks/` |
| Source/asset/collision/shader guards and configuration-bound artifact reuse | Pass | Engine logs in `app_swift/build/ios-checks/` and `app/out/ios-framework/build-stamp.json` |
| Signed final Release archive, local thinning export and install | Pass | `app_swift/build/ios-work-delivery-{archive,export,install}.log`, `ios-export-delivery/App Thinning Size Report.txt` |
| Default Simulator UI: intention, error feedback, settings and background/resume | Pass; captures inspected | `app_swift/build/ios-ui-normal/` and `ios-work-ui-normal.log` |
| iPhone 13 mini Simulator at accessibility XXXL | Pass; captures inspected after fixing truncation, badge and sheet layout | `app_swift/build/ios-ui-mini-final/` and `ios-work-ui-mini-final.log` |
| Bounded live first-sentence network probes | PCM returned; observed first audio 2.33–2.53 s from submission and 191–193 ms from TTS request | `app_swift/build/ios-work-live-conversation.json`; not phone microphone, audible playback or a latency guarantee |
| Small reaction-only provider sample | Correct good-news, grief and neutral behavior; 306–480 ms | Ignored `app_swift/build/ios-work-reaction-benchmark*.json`; not a general model evaluation |

Simulator captures show a deliberate viewport placeholder. They establish
native UI behavior, not the forest, character, shaders or movement. One earlier
Simulator run completed its test case but hung while Xcode finalized the result
bundle; it was terminated and replaced by a successful serial rerun. The final
run contains no SwiftUI publishing-during-update warning. Host/Simulator beta
warnings about OS-build parsing and duplicate system accessibility classes are
separate from app failures.

## Startup crash follow-up

The current Debug app was reproduced crashing at 1.2 seconds while resolving
`collision_ground.hzt`. Both cooked mesh files were bundled, but the custom
collision-world asset had no dependency loader, so its READY state did not
ensure those mesh assets had been loaded. `calm_world.c` now registers a
dependency pass and binds the loaded ground/solid handles before the parent
becomes ready, following the existing character-profile loader pattern.

Debug and Release engine/native builds pass with this fix and cooked geometry
verification passes. After the phone was unlocked, both configurations loaded
the collision meshes, spawned the character and rendered the forest. The Debug
expanded-card and Release collapsed-card captures were inspected: character,
forest, native controls and static skirt are visible. The startup crash is
verified fixed. The current installed app is the patched Release; the server
was restarted with current source/configuration and its health check passes.

Bounded console observations lasted 45 seconds in Debug and 70 seconds in
Release without an application trap. The commands ended at their configured
timeouts; the Release process (PID 6505) was independently confirmed alive
afterward and a fresh active capture was inspected. An earlier black Release
capture was rejected and replaced. Earlier locked launch attempts are retained
as history. Evidence and hashes: `app_swift/build/iphone/crash-fix-evidence.json`;
the matching console logs and PNGs are in that directory.

Short Release timing samples through 52.6 seconds on the A15 iPhone in Low Power
mode, thermal nominal, show frame averages 16.67–16.73 ms and GPU averages
14.82–15.06 ms. Microphone capture and AEC initialized. These observations do
not establish audible output, controlled interruption, sustained walking/voice,
thermal behavior or moving-skirt correctness.

CoreDevice works outside the command sandbox and reports the physical iPhone
connected. Earlier service-initialization failures were sandbox access errors;
they did not establish that the phone was disconnected. The startup console
also warns that this pinned Metal runtime falls back from `STEADY` to uncapped;
physical frame-pacing acceptance remains open.

## Remaining acceptance checklist

- [x] Verify the startup fix in Debug and Release on the connected iPhone;
  inspect active rendered captures and independently confirm process survival.
- [ ] Inspect current default/close framing, orbit/zoom limits, boom recovery,
  foliage/shadow alignment and collapsed/expanded-card headroom on the phone.
- [ ] Run normal and `life`, `life-interrupt`, `life-held` previews; verify real
  path progress/arrival, stopping, feet/cloth and voice priority before accepting
  the motion layer or promoting expanded routes.
- [ ] Exercise an explicit card/typed turn, microphone speech and barge-in,
  background/resume, audio interruption and route changes. Listen to actual
  output and repeat the targeted spoken formatting/question-pacing evaluation.
- [ ] Record a sustained walking-plus-voice thermal/performance/battery sample;
  resolve the pinned Metal frame-pacing fallback and compare the opt-in
  temporal path against MSAA on representative camera views.
- [ ] Investigate the documented foot-plant/skirt issue and inspect it before
  enabling IK. No silent wholesale enablement was made.
- [ ] Configure the repository's `KAIGEN_LICENSE` secret and, after the maintainer reviews and
  accepts current Kaigen terms, `KAIGEN_TERMS_ACCEPTED=true`; then run the new
  native CI job. GitHub keyring authentication works outside the command
  sandbox; the earlier token/API failures were sandbox access errors. The
  repository's secrets and variables were both confirmed empty. The workflow
  is included on this task branch; its native CI job has not been run remotely.

Conversation state/mute/stop UI, persistent memory, sign-in/production identity,
and other platforms remain excluded as requested. The remaining checklist is
required acceptance work; this report does not mark the whole app production-ready.
