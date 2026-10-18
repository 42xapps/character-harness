# Kaigen 0.6.2.001-beta migration

This player targets the installed precompiled SDK `0.6.2.001-beta`, engine SHA
`abd44c1843da14eac0489fd4d4fb4e7695145061`. The original SDK pin was
`0.5.8.003-internal`, which the normal macOS restore endpoint no longer serves.

## Compatibility changes

- The toon and outline shaders use `.glsl` files and explicit renderer stage
  headers. Their material/import references were updated together. The shaders
  use the current shadow/fog function names and apply pre-exposure to emission.
- The authored stage light is converted from normalized intensity to lux,
  and ambient luminance to the current exposure scale. With the engine's
  default EV100 of 15, the old unit directional light becomes
  `pi * 1.2 * 2^15 = 123532.44` lux; ambient `0.5` becomes `19660.8`.
  This retains the reference scene's lighting at that exposure.
- The SDK cook/importer upgrades material and texture source schemas to version
  23, including its emission-strength conversion. These generated source changes
  are included so subsequent cooks start from the current schema.
- Submesh material access uses `renderer_submesh_instance_material` rather than
  the removed instance field. Emote string rebuilding passes a field pointer,
  mutable emote access uses the mutable ECS API, and camera scheduling passes
  the new optional descriptor.
- The player uses full-body emotes for gestures. Its additive upper-body mask
  has zero weight and no entries, and no player code drives the additive overlay.
  `CharacterScheduleDesc.no_overlays` skips this unused layer. On this SDK the
  overlay resolver otherwise asserts while allocating from the world arena.
  Facial animation, gaze, cloth and full-body emotes remain scheduled.
- A launch without `HARNESS_CHARACTER` previews the bundled FoxGlove profile.
  Explicit preview and screenshot runs skip microphone capture and voice-session
  ticking. The harness still supplies a character and session URL for live use.

## Validation

Validated locally: native macOS build, visual captures of idle, wave and happy
expression previews, and `hz/hzbuild ios --framework`. All 132 existing runtime
tests and the TypeScript typecheck passed after installing locked dependencies. The iOS
output is a physical-device framework; compilation does not establish device
performance, microphone behavior or integration into the separately maintained
iPhone fork.

The runtime provider configuration is unchanged. Live STT/LLM/TTS calls require
the API keys in `.env`; offline preview does not exercise those services.

The custom toon shader still exceeds WebGPU's sampled-texture limit when its
features are compiled together. Native Metal builds are supported by this
migration; a browser/WASM port requires a separate material/texture redesign.

## SDK linkage

Use `kaigen restore` on a fresh checkout. When switching this checkout from a
missing `hz` link, the initial `use` command created the link but omitted the
version pin. Running `hz/hzbuild use 0.6.2.001-beta` again after that link existed
recorded it correctly. Verify the pin in `hzproject.hzt` and the identity with
`hz/hzbuild use --status` after switching.
Do not edit the shared SDK installation or commit the machine-local `hz` link.
