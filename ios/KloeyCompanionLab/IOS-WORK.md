# iOS implementation tracker

Native iOS only. Reuse existing OpenAI key. No sign-in or production identity integration while in development.

Source: [saved audit](docs/review-2026-10-19.md). Engine: `0.6.2.001-beta`.

Current results: [validation report](docs/ios-validation-2026-10-19.md).

Review range: `45f0b6d` → `abb4468`; remediation and evidence are tracked below.

`implemented` means code is in place. `verified` means the recorded acceptance passed. Outstanding device/CI work stays listed until it passes.

The JSON file is the source of truth. Update with `python3 tools/ios-progress.py <id> ...`.

| Step | Status | Work |
|---|---|---|
| 01 | verified | Consistent iOS Debug/Release artifacts and truthful capture results |
| 02 | implemented | Reliable host commands and suspension transitions |
| 03 | implemented | Matching foliage shadow and temporal motion shaders |
| 04 | implemented | Target-specific iOS asset staging and size budget |
| 05 | implemented | Working intention and chat cards with native accessibility |
| 06 | implemented | Kaigen camera rig and authored collision geometry |
| 07 | implemented | Measured mobile quality, thermal policy, pacing and upscaling |
| 08 | implemented | Navigation and smoother locomotion with safe pose ownership |
| 09 | implemented | Fast automatic cues and reply reactions |
| 10 | awaiting_external | Shared-source drift guards, configuration cleanup and iOS CI |
| 11 | in_progress | Final iOS device and conversation verification |

**Excluded by the user**

- Conversation state UI/mute/stop controls
- Persistent memory
- Sign-in/production account integration
- Desktop/Windows/WebGPU fixes and validation
- Changes to shared SDK or separate working copies

**01. Consistent iOS Debug/Release artifacts and truthful capture results — verified**

Audit mapping: F1 shared POD copy; F2; F6.

Acceptance: Build both iOS configurations, reject stale reuse, reproduce failure exit propagation.

Guidance:

- AGENTS.md
- app/AGENTS.md
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-build/SKILL.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Inside-a-project
- https://kaigen3d.com/docs/writing-applications#configuration

Changes:

- Pass Debug/Release through both native build layers; stamp inputs, engine identity and output hashes; reject stale reuse.
- Copy the fixed POD profile with explicit termination; preserve screenshot test exit status and require named captures.

Evidence:

- Debug and Release engine + iphoneos SwiftUI builds pass; configuration/input/output hashes reject stale or wrong-configuration reuse.
- Intentional missing-control assertion exits 65 through shot.sh while exporting its diagnostic image; successful native UI run exits 0 with all named captures.
- Capture names match exactly and output cleanup is confined to app_swift/build; unsafe output paths are rejected before deletion.

**02. Reliable host commands and suspension transitions — implemented**

Audit mapping: F3; F4.

Acceptance: Stress real bridge; preserve all settings and quiet reset across inactive/active without a simulation tick.

Guidance:

- AGENTS.md
- app/AGENTS.md
- app_swift/AGENTS.md
- IDLE-LIFE.md
- app/hz/.claude/skills/hz-core/SKILL.md
- app/hz/.claude/skills/hz-game/SKILL.md
- app/hz/wiki/engine/ecs.md#Events-between-systems
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Rules
- https://kaigen3d.com/docs/writing-applications#every-core-runs-your-code

Changes:

- Replace lossy camera/settings ring with an exclusive-slot SPSC snapshot; accumulate bounded orbit inputs and retain latest settings plus suspension generations.
- Carry reset generations through CalmLifeInput so intent observes a pause even after immediate resume.

Evidence:

- tools/check-ios-bridge.py passed 1000 queued inputs, reset ordering and 100000 concurrent publications with profile integrity checks.

Remaining:

- Physical background/resume and quiet-interval validation in step 11.

**03. Matching foliage shadow and temporal motion shaders — implemented**

Audit mapping: F5; temporal prerequisites.

Acceptance: Compile pinned Metal iOS variants and inspect physical-device captures.

Guidance:

- AGENTS.md
- app/AGENTS.md
- app/hz/.claude/skills/hz-shaders/SKILL.md
- app/hz/wiki/shaders/conventions.md
- app/hz/wiki/rendering/material.md
- app/hz/wiki/rendering/renderer.md
- app/hz/src/engine/rendering/material.h
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Rules
- https://kaigen3d.com/docs/writing-applications#the-main-systems

Changes:

- Use extras.hz_material to author all foliage pass ownership; a sidecar shadow override conflicts with the importer-created cutout pass in this SDK.
- Share wind across lit/depth/shadow shaders, preserve cutout silhouettes, and publish typed current/previous frame times through a renderer feature.

Evidence:

- Pinned iOS shader/cook/framework build and the expanded material contract guard passed.

Remaining:

- Inspect foliage and temporal output on the physical iPhone in step 11.

**04. Target-specific iOS asset staging and size budget — implemented**

Audit mapping: F7.

Acceptance: Verify dependency closure and compare resource bytes; launch from staged assets.

Guidance:

- AGENTS.md
- app/AGENTS.md
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-build/SKILL.md
- app/hz/wiki/engine/asset-cook.md
- app/hz/wiki/engine/assets.md
- app/hz/wiki/lib/blob-asset.md
- app/hz/wiki/lib/assets-io.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Inside-a-project
- https://developer.apple.com/documentation/xcode/reducing-your-app-s-size
- https://kaigen3d.com/docs/

Changes:

- Follow BlobAssetRefs with the pinned generated reflection, keep explicit dynamic clip groups, select ASTC/iOS shaders, and enforce a 112 MiB resource budget.
- Xcode stages the selected closure instead of copying app/cooked; project regeneration preserves saved signing teams for both app and tests.

Evidence:

- Final signed archive contains exactly 599 staged files / 90,781,937 bytes (86.58 MiB), each matching the staging report SHA-256.
- Xcode thinning estimate: 25.6 MB compressed / 96.5 MB installed. The dependency-removal guard fails, and staging preserves unrelated files by refusing an unowned destination.

Remaining:

- Launch and inspect the latest staged 3D bundle on an awake physical iPhone in step 11.

**05. Working intention and chat cards with native accessibility — implemented**

Audit mapping: iOS roadmap; UI cleanup.

Acceptance: Use existing character_voice_inject_user_text; test native flows and exact command contract.

Guidance:

- AGENTS.md
- app/AGENTS.md
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-core/SKILL.md
- app/hz/.claude/skills/hz-game/SKILL.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Inside-a-project
- https://kaigen3d.com/docs/writing-applications#the-main-systems
- https://developer.apple.com/la/videos/play/wwdc2024/10074/
- app/hz/src/engine/character/character.h#typed-user-turns
- app_swift/AGENTS.md

Changes:

- Tag 7 typed submissions and tag 8 acknowledgements use an independent ordered queue, with queue refusal and disconnected feedback instead of silent loss.
- Intentions and chat cards use character_voice_inject_user_text; remove unused UI, respect Reduce Motion and support scalable text/hit targets.
- Fix full-screen error presentation, large-type wrapping, badge/control overlap and adaptive settings height.

Evidence:

- Native iphoneos SwiftUI and engine builds passed; UTF-8/wire/ack and existing profile contracts passed; bounded text-queue stress passed.
- Default native UI flow and accessibility XXXL on iPhone 13 mini Simulator pass; exported captures were inspected. The final run has no SwiftUI publishing-during-update warning.

Remaining:

- Verify the typed-card handoff through the actual engine/phone conversation and current 3D overlay headroom in step 11.

**06. Kaigen camera rig and authored collision geometry — implemented**

Audit mapping: iOS roadmap; damping duplication.

Acceptance: Preserve orbit/framing/headroom/director offsets; verify clipping on iPhone.

Guidance:

- AGENTS.md
- app/AGENTS.md
- IDLE-LIFE.md
- app/hz/.claude/skills/hz-core/SKILL.md
- app/hz/.claude/skills/hz-game/SKILL.md
- app/hz/modules/gameplay_blocks/wiki/camera-rig.md
- app/hz/modules/gameplay_blocks/src/gameplay/camera_rig/camera_rig.h
- app/hz/wiki/engine/physics.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Rules
- https://kaigen3d.com/docs/writing-applications#every-core-runs-your-code
- AGENTS.md
- app/AGENTS.md
- app/hz/.claude/skills/hz-core/SKILL.md
- app/hz/.claude/skills/hz-game/SKILL.md
- app/hz/.claude/skills/hz-build/SKILL.md
- app/hz/wiki/engine/assets.md
- app/hz/wiki/lib/blob-asset.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md
- https://kaigen3d.com/docs/writing-applications
- https://developer.apple.com/documentation/xcode/diagnosing-issues-using-crash-reports-and-device-logs

Changes:

- Use CameraFollow with native boom spherecasts, ground clearance and authored solid/terrain collision instead of hand-composed orbit/follow transforms.
- Preserve framing, card headroom and director offsets as app composition inputs; use pinned damping functions and run the rig in the documented ECS order.
- Register collision-world dependency enumeration and bind the two loaded mesh handles before marking its parent ready, following the existing profile loader pattern.

Evidence:

- iOS framework/cook built; collision inputs contain 4232 terrain and 57618 solid triangles; existing swept-corridor guard passes.
- Reproduced physical iPhone Debug startup trap at 1.2 s: collision_ground.hzt referenced before its runtime asset entry existed, despite the cooked meshes being bundled. The custom collision-world blob had no registered dependency loader.
- The collision dependency fix passes Debug and Release engine + signed native builds and exact cooked geometry verification. Fixed Debug installed; post-fix launch attempts were denied because the phone locked during rebuilding.
- Startup fix verified on physical iPhone 14 in Debug and Release: collision ready and character spawned, no application trap during bounded 45/70 s console observations. Release PID 6505 remains alive after the console timeout, and active rendered captures were inspected. Evidence: app_swift/build/iphone/crash-fix-evidence.json.

Remaining:

- Inspect controlled orbit/zoom limits and collision recovery on-device; startup and collapsed/expanded static framing now have physical captures.

**07. Measured mobile quality, thermal policy, pacing and upscaling — implemented**

Audit mapping: iOS roadmap.

Acceptance: Apply pinned quality APIs; test thermal transitions and sustained device performance.

Guidance:

- AGENTS.md
- app/AGENTS.md
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-core/SKILL.md
- app/hz/.claude/skills/hz-shaders/SKILL.md
- app/hz/wiki/rendering/renderer-views.md
- app/hz/wiki/rendering/gpu-tier.md
- app/hz/wiki/rendering/taa.md
- app/hz/wiki/engine/frame-pacer.md
- app/hz/src/engine/rendering/renderer_quality.h
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Inside-a-project
- https://developer.apple.com/documentation/foundation/processinfo/thermalstate-swift.enum
- https://kaigen3d.com/docs/writing-applications#configuration
- app/hz/wiki/engine/frame-pacer.md
- app/hz/src/app/app.h

Changes:

- Apply pinned hardware/dynamic quality and steady pacing; carry thermal/Low Power state through tag 9 with fixed budgets while constrained and dynamic recovery at nominal state.
- Integrate opt-in HARNESS_TEMPORAL=1 MetalFX/TAAU with matching wind history and exact motion matrix helpers; keep the measured MSAA path as the default pending visual A/B checks.
- HARNESS_PERF=1 records frame, p99, CPU, GPU and quality state every 15 seconds.

Evidence:

- Pinned iOS shader/framework build passed; cooked collision vertex/index checks now preserve both ground and solid arrays.
- Quality contract exhaustively passed every hardware/thermal/Low Power/visibility combination; latest native Debug/Release builds passed.
- Physical Debug startup reports that this pinned Metal runtime cannot apply STEADY and falls back to uncapped; the earlier configuration/build evidence did not establish steady presentation on iOS.
- Short Release sample on physical A15 iPhone with Low Power enabled and thermal nominal: frame average 16.67–16.73 ms, frame p99 16.92–20.54 ms, GPU 14.82–15.06 ms across three console samples through 52.6 s. This is a startup sample, not sustained walking/voice or thermal acceptance.

Remaining:

- Resolve or accurately constrain the pinned Metal pacing fallback, then collect sustained physical-device performance and temporal A/B image checks in step 11.

**08. Navigation and smoother locomotion with safe pose ownership — implemented**

Audit mapping: iOS roadmap.

Acceptance: Use engine navmesh/controller and authored start/stop/turn/observe clips; validate routes, interruption and cloth.

Guidance:

- AGENTS.md
- app/AGENTS.md
- IDLE-LIFE.md
- app/hz/.claude/skills/hz-core/SKILL.md
- app/hz/.claude/skills/hz-game/SKILL.md
- app/hz/wiki/engine/navigation.md
- app/hz/wiki/engine/animation.md
- app/hz/modules/gameplay_blocks/wiki/character.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Rules
- https://kaigen3d.com/docs/writing-applications#the-main-systems

Changes:

- Integrate asynchronous ECS navigation over authored terrain/props, with path acceptance, blocked/no-path handling, release on interruption and explicit arrival before observation.
- Author start/stop/pivot/observe transitions from the installed CC0 walk/idle clips; blend a separate masked AnimationLayer and retain voice/face/cloth ownership.
- HARNESS_EXTENDED_WALKS=1 enables two lateral POIs inside a bounded navigation area for device validation; default routes stay in the verified corridor.

Evidence:

- Native iOS engine, cook and SwiftUI linking passed; authored motion export and cooked geometry guards passed.

Remaining:

- Latest signed app installed; launch blocked by locked iPhone. Path and cloth visual validation remain in step 11.

**09. Fast automatic cues and reply reactions — implemented**

Audit mapping: iOS roadmap.

Acceptance: Preserve extension order/beat arbitration; validate configured providers and first-audio latency.

Guidance:

- ../../AGENTS.md
- ../../docs/architecture.md
- ../../examples/extensions/gesture-cues/README.md
- ../../extensions/reactions/README.md
- ../../extensions/director/extension.yaml
- AGENTS.md
- app/AGENTS.md
- app/hz/.claude/skills/hz-game/SKILL.md
- app/hz/src/engine/character/character.h
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Rules
- https://kaigen3d.com/docs/writing-applications
- https://developers.openai.com/api/docs/guides/decisions
- ../../docs/architecture.md
- ../../runtime/src/state.ts

Changes:

- Use the existing reactions extension with an OpenAI Decisions adapter and the existing OpenAI key; a two-question face-only config keeps gesture ownership with deterministic cues.
- Enable the shared gesture-cues extension, protect earlier gesture/opening emotion channels in director arbitration, and reduce the first director batch delay to 40 ms.
- Runtime exposes read-only staged_beats cues per sentence so downstream extensions can arbitrate after beats are emitted; no character-specific runtime branch.

Evidence:

- 152 offline runtime tests and typecheck pass; manifest check has 0 errors/warnings. Session-level tests prove staged-cue isolation, no duplicate emission and in-flight cancellation.
- Two bounded synthetic live probes returned PCM, with first audio 2331–2530 ms from submission / 191–193 ms from TTS request. Reaction-only examples took 480/308/306 ms with appropriate good-news/grief/neutral behavior. This is not phone playback or a before/after latency guarantee.

Remaining:

- Repeat spoken first-audio, barge-in and expression checks on the physical iPhone in step 11.

**10. Shared-source drift guards, configuration cleanup and iOS CI — awaiting_external**

Audit mapping: maintenance roadmap.

Acceptance: Remove redundant helpers/config, update docs/canonical paths, run native contracts and CI commands.

Guidance:

- ../../AGENTS.md
- ../../docs/architecture.md
- AGENTS.md
- app/AGENTS.md
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-lint/SKILL.md
- app/hz/.claude/skills/hz-build/SKILL.md
- app/hz/wiki/engine/codegen.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Inside-a-project
- https://kaigen3d.com/docs/
- https://github.com/actions/runner-images
- app/hz/.claude/skills/hz-lint/SKILL.md
- app/hz/wiki/rendering/renderer.md
- app/hz/wiki/lib/thread.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Terms
- https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
- https://docs.github.com/en/actions/reference/workflows-and-actions/variables
- https://github.com/actions/runner-images

Changes:

- Remove four identical vendored retarget helpers in favor of canonical runtime imports, remove unused configuration/UI, preserve signing through repeated generation, and add required native Debug/Release CI.
- Refresh current iOS notes and retain the historical audit; source-drift guard covers seven shared player files and fails when a reference is missing.
- Add an explicit synchronization command for the seven shared C helpers; add real Swift-to-C and C-to-Swift wire fixtures; remove the native startup bearer-URL log.

Evidence:

- Local CI command passed both iOS configurations, source/wire/stress/quality checks and asset guards. Signing team survived two further regenerations; signed Release archive/export passed.
- Final native contract runner passes the real two-way Swift/C fixture, 100000 concurrent bridge publications and every quality-policy combination. Cooked vertex positions and triangle indices exactly match their authored sources.
- Bash syntax, Python compilation, git diff whitespace and final exact cooked vertex/index comparisons pass. Detailed results and tool limits are in docs/ios-validation-2026-10-19.md.
- The iOS workflow is present and locally validated. Remote inspection/setup is blocked: gh reports the configured GitHub token is invalid and GitHub API requests cannot connect; no KAIGEN_LICENSE or KAIGEN_TERMS_ACCEPTED setting is available in this environment. The workflow requires both and accepts Kaigen terms only when the repository variable explicitly asserts prior acceptance.
- GitHub keyring authentication and remote branch fetch succeed outside the command sandbox; the earlier token/API failures were sandbox access errors. Repository secret and variable names were both confirmed empty before commit/push.

Remaining:

- Configure the Kaigen license repository secret and confirm acceptance of the current agreements before setting KAIGEN_TERMS_ACCEPTED=true, then trigger the iOS workflow and inspect its artifacts and result.

**11. Final iOS device and conversation verification — in_progress**

Audit mapping: validation roadmap.

Acceptance: Build Release, inspect captures, test voice/barge-in/resume and record sustained performance without false certification.

Guidance:

- AGENTS.md
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-build/SKILL.md
- app/hz/.claude/skills/hz-build/references/platforms.md
- app/hz/.claude/skills/hz-build/references/screenshot-verification.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Rules
- https://kaigen3d.com/docs/writing-applications
- https://developer.apple.com/documentation/xcode/testing
- AGENTS.md
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-build/references/screenshot-verification.md
- app/hz/.claude/skills/hz-game/SKILL.md
- app/hz/wiki/engine/ecs.md
- app/hz/wiki/rendering/renderer.md
- /Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md#Rules
- https://kaigen3d.com/docs/writing-applications
- https://developer.apple.com/documentation/xcode/testing
- https://developer.apple.com/documentation/foundation/processinfo/thermalstate-swift.enum
- app_swift/AGENTS.md
- app/hz/.claude/skills/hz-build/references/screenshot-verification.md

Evidence:

- Release archive and local debugging export succeeded; Xcode App Thinning Size Report estimates 25.6 MB compressed and 96.5 MB installed.
- Live synthetic WebSocket turn with the existing OpenAI/ElevenLabs keys: 264960 PCM bytes, first audio 2331 ms from submission / 193 ms from TTS request; reactions and director events arrived. This is not physical microphone/playback evidence.
- The final signed Release archive, export and installation pass. Its 599 staged resource files match the report hash-for-hash; launch is denied by CoreDevice because the iPhone is locked.
- Current live network probe returns 245760 PCM bytes: first audio 2530 ms after user submission / 191 ms after the TTS request. Native iPhone microphone/playback is still unverified.
- After the user reported the iPhone unlocked, xcrun devicectl list devices still timed out waiting for CoreDeviceService; xcdevice reported invalid CoreSimulatorService, and USB inventory showed no attached iPhone. No new physical-device observations were possible.
- CoreDevice works outside the command sandbox: iPhone 14 is connected. Earlier device-service timeouts were sandbox access failures; unlocked-phone testing is now available.
- The fixed Debug build is installed and Release also builds/signs. Two post-fix launches were denied explicitly by iOS Locked after the screen went off. Current server restart succeeded. No post-fix runtime or rendering success is claimed.
- Patched Debug and Release both boot and render on the phone. Debug expanded-card and Release collapsed-card captures were inspected; the character, forest and static skirt render. Release process survives the bounded console observation. Mic capture/AEC initialize, but audible playback is not yet acceptance-tested.

Remaining:

- Complete controlled camera/cards, route/cloth and lifecycle/quiet-reset checks on the physical iPhone; current fixed Release is installed and running.
- Validate real microphone/playback, barge-in, audio interruptions and route changes; collect sustained walking-plus-voice thermal/performance/battery and MetalFX comparison evidence.
- Inspect skirt deformation during locomotion and resolve the foot-plant interaction before enabling it; foot planting remains disabled.

**Notes**

- Original audit retained unchanged. Existing untracked diff.txt is user-owned. A step is verified only against its recorded acceptance evidence.
- Foot planting must remain disabled unless the documented skirt distortion is resolved and visually verified.
