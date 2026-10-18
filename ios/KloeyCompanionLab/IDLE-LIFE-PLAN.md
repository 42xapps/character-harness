# Calm companion life — implementation and reference plan

Goal: the companion feels peacefully occupied when nobody is speaking: grounded
short walks, gentle turns, purposeful pauses near the clearing's plants, and a
smooth return to attentive conversation. Preserve the current forest, wind fix,
transparent cards, touch camera, session restoration and speech performance.

## 1. Establish the existing contracts

- Read lab README.md, NATURE.md, AGENTS.md, Swift host AGENTS.md and the installed
  Kaigen setup plugin.
- Read SDK hz-core, hz-game and hz-build; use wiki/index.md to locate only the
  character, animation, IK, navigation, physics and camera references needed.
- Inspect harness README.md, player/README.md, docs/architecture.md,
  docs/bring-your-own-character.md, docs/character-manifest.md, FoxGlove README,
  manifest/animation conversion, states and actual voice/VAD state.
- Check current Git state and checkpoint before new changes. Shared SDK and
  synced project sources remain read-only; provider keys stay on the server.

## 2. Research and acquire suitable motion

- Use web research and primary sources for human walking, acceleration/turning,
  foot contact and interruption transitions; verify every downloaded asset's
  provenance and redistribution/commercial license.
- Inspect available Kaigen gameplay/animation capabilities before choosing the
  locomotion integration. Avoid competing writers on the character pose/root.
- Find a compatible, well-authored relaxed walk cycle plus start/stop/turn support,
  retarget to FoxGlove through the existing harness tools where supported, and
  inspect the result before allowing world movement.
- Preserve a record of sources, licenses, conversions and animation parameters.

## 3. Author a small, believable activity space

- Define destinations in the current clearing: home, a flower patch and a scenic
  resting spot; use safe traversable routes with generous tree/rock clearance.
- Supply actual ground/obstacle/navigation data. Grounding must agree with the
  rendered terrain, with no hovering, sinking or walking through scenery.
- Keep routes short and within a comfortable conversational distance. Use
  unhurried timing, varied pauses and restrained gaze, with no restless loops.

## 4. Implement local behavior and locomotion

- Explicit states: attentive/resting, preparing to move, strolling, observing,
  returning attention; per-state transitions and one owner for locomotion.
- Blend locomotion and idle poses, synchronize feet with displacement, smooth
  speed/heading, and use engine foot placement/IK where appropriate.
- Delay wandering until genuine inactivity. User speech, pending responses,
  assistant audio and conversational gestures take priority. Speech onset stops
  wandering promptly and smoothly; resume only after another quiet interval.
- Idle activity runs on-device and creates no additional LLM requests.
- Follow the actual character position with a stable, softly damped camera;
  preserve orbit/pinch/reset and card headroom without sudden camera jumps.
- Suspend activity safely while inactive/backgrounded or presenting a detail.

## 5. Verify the experience, not just compilation

- Focused deterministic checks for state transitions, bounds, interruption,
  grounding and walk/idle blending. No tests that merely repeat implementation.
- Inspect timed renders/animation sequences: start, cruise, turn, stop, observe,
  conversation interrupt, resume, cards expanded and camera interaction.
- Build native macOS and native iOS, install on the paired iPhone, and inspect
  rendered captures. Test live conversation interruption and saved reconnect.
- Check frame pacing/memory after warm-up and during activity; record limits of
  the sample and avoid claims of sustained battery/thermal performance.
- Re-run the existing exported-world/wind and message/session contract checks.
- Document behavior, tuning points, assets and remaining limitations. Save a
  reviewable commit, with unrelated user edits preserved.

## Initial local references

- `app/hz/.claude/skills/{hz-core,hz-game,hz-build}/SKILL.md`
- `app/hz/wiki/index.md`
- `app/hz/wiki/engine/{navigation,ik,animation,physics,rigidbody}.md`
- `app/hz/modules/gameplay_blocks/wiki/{character,camera-rig}.md`
- `app/hz/wiki/rendering/camera.md`
- `app/src/app/{player.c,app_character.c,app_character.h}`
- `app/assets/{characters/foxglove.hzt,foxglove/states.hzt}`
- `tools/prepare-nature.py`, `tools/verify-nature.py`, `NATURE.md`
- Sibling `character-harness/` runtime, character manifests and animation tools.
- Installed plugin: `/Users/m0saan/.codex/.tmp/marketplaces/kaigen/plugins/kaigen/skills/kaigen-setup/SKILL.md`
- https://kaigen3d.com/docs/
- https://kaigen3d.com/docs/writing-applications

Web references and concrete verification results will be added as inspected.

## Implementation decisions and evidence

The baseline was clean commit db233f2. CalmLife now drives a Kaigen kinematic
character along three physically bounded destinations in the clearing. The
exported-space check validates flat terrain and prop clearance. This small
authored corridor needs no navmesh; full-world navigation remains a separate
expansion. A CC0 Quaternius walk was retargeted with the harness helpers and
bound by joint name. Cadence follows actual ground speed. Camera follow, native
activity/Reduce Motion and detail visibility are integrated.

Rendered tests exposed idle-loop/performance ownership and an interaction
between foot planting and the skirt. Idle loops no longer block the quiet
timer; foreign performances retain priority. The extra foot-planting pass was
removed after it distorted cloth in repeated rendered checks. Current walking
uses the verified flat ground; precise foot locking/slope traversal and authored
pivot/start/stop clips are outside this first activity space.

Desktop interruption replay, physical-device cards/camera/lifecycle UI tests,
source-world checks and session/message contracts pass. See IDLE-LIFE.md for
source/provenance links, reproduction and the limits of these checks.
