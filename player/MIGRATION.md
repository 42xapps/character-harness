# Kaigen 0.6.4.002 migration

This player targets the installed precompiled SDK `0.6.4.002`, engine SHA
`5a16f99bc2a367b2e873bed53765cdccfb06e468`. The original SDK pin was
`0.5.8.003-internal`, which the normal macOS restore endpoint no longer serves.

## Compatibility changes

- The toon and outline shaders use `.glsl` files and explicit renderer stage
  headers. Their material/import references were updated together. The shaders
  use the current shadow/fog function names and apply pre-exposure to emission.
- WebGPU allows 16 textures per shader stage (7 used by shadows, sky light and
  fog, leaving 9 of `mtoon.glsl`'s 14 maps). Unused maps are excluded per
  material via `MTOON_NO_<MAP>` keywords under `material_override` in
  `assets/foxglove/foxglove.import.hzt`, so `mtoon.glsl` builds and renders identically on
  both native desktop/iOS and WebGPU/WebAssembly.
- The authored stage light is converted from normalized intensity to lux,
  and ambient luminance to the current exposure scale. With the engine's
  default EV100 of 15, the old unit directional light becomes
  `pi * 1.2 * 2^15 = 123532.44` lux; ambient `0.5` becomes `19660.8`.
  This retains the reference scene's lighting at that exposure.
- The SDK cook/importer upgrades material and texture source schemas to version
  23, including its emission-strength conversion, and relative catalog paths.
  These generated source changes are included so subsequent cooks start from the
  current schema.
- Submesh material access uses `renderer_submesh_instance_material` rather than
  the removed instance field. Emote string rebuilding passes a field pointer,
  mutable emote access uses the mutable ECS API, and camera scheduling passes
  the new optional descriptor.
- The player uses full-body emotes for gestures. Its additive upper-body mask
  has zero weight and no entries, and no player code drives the additive overlay.
  `CharacterScheduleDesc.no_overlays` skips this unused layer.
  Facial animation, gaze, cloth and full-body emotes remain scheduled.
- A launch without `HARNESS_CHARACTER` previews the bundled FoxGlove profile.
  Explicit preview and screenshot runs skip microphone capture and voice-session
  ticking. The harness still supplies a character and session URL for live use.
- In `0.6.4.002`, WebAssembly publish bundles emit `host_messages.gen.js` alongside
  the worker scripts and reject `game.ready` with `HzBootError` (`webgpu_unavailable`
  or `memory_unavailable`) when WebGPU or WASM memory cannot initialize.
  `release-web.sh` and `frontend/scripts/web-player.ts` skip the unused generated
  host message file, and `frontend/server/web-player.html` surfaces `HzBootError`
  to Studio.

## Validation

Validated locally: native macOS build, WebAssembly (`wasm` and `wasm publish`)
builds, visual captures of FoxGlove previews, and `hz/hzbuild ios --framework`.
All runtime and frontend tests and the TypeScript typecheck pass.

The runtime provider configuration is unchanged. Live STT/LLM/TTS calls require
the API keys in `.env`; offline preview does not exercise those services.

## SDK linkage

Use `kaigen restore` on a fresh checkout, or `hz/hzbuild use 0.6.4.002` to switch
to this version. Verify the pin in `hzproject.hzt` and the identity with
`hz/hzbuild use --status` after switching.
Do not edit the shared SDK installation or commit the machine-local `hz` link.
