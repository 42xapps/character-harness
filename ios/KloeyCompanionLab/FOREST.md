> Historical integration: the active scene now uses the animated Quaternius clearing. See [NATURE.md](NATURE.md). These assets remain available for rollback.

# Imported forest environment

Source: [Walk in the Woods](https://poly.pizza/m/38m6Q1H12DU) by Don Carson,
via Poly Pizza, [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
The attribution is retained in NOTICE, next to the model and in the app's
Your view → Forest credits section.

## Files

- `art/forest/WalkInTheWoods.source.glb`: unmodified downloaded model.
- `art/forest/forest.blend`: editable Blender 5.2 scene prepared for the app.
- `tools/prepare-forest.py`: repeatable preparation from the original GLB.
- `art/forest/preparation.json`: record of the preparation.
- `app/assets/environments/walk_in_the_woods/forest.glb`: exported game asset.
- `app/assets/environments/walk_in_the_woods/forest.import.hzt`: Kaigen import settings.
- `app/assets/environments/walk_in_the_woods/materials/`: importer-generated materials.
- `app/assets/mutuals/main_scene/chunk_0.hzt`: camera, lighting, character spawn
  and the forest entity's placement.

## Preparation

The source was a complete forest section. One foreground boulder hid the
character's lower body from the portrait camera, so that object was removed.
The remaining static meshes were joined in Blender, preserving their materials.
The game export has 37,986 triangles, one mesh, nine material sections, no image
textures and no required glTF extensions. It is about 3 MB.

The forest entity is scaled by 14, positioned at (-1.4, 1.325660, -7.7), and
keeps its original orientation. This places FoxGlove at source-space
(0.1, -0.09469, 0.55) on the path, with the character's feet at world height 0.
The camera, character rig, animations and voice/session code are unchanged.

Reproduce the prepared asset from the lab root:

```bash
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/prepare-forest.py
./build-engine.sh
```

This is a separate Blender process and does not change a user's open Blender
project. Alternatively, open `art/forest/forest.blend`, make deliberate edits,
and export the selected Forest object as an uncompressed GLB over the game asset.
Running the preparation script again overwrites that prepared Blender file and
the game GLB from the preserved original; save custom art iterations separately.

Then Run in the existing Xcode project. Its cooked resource folder carries the
imported model and materials onto the phone. No runtime import on the phone is
needed.

## Build findings

The first native cook generated material `.hzt` files without immediately
including their cooked outputs. Refreshing those new project-owned material
inputs and rebuilding the native target produced the required `.hza` files.
Do not hand-edit the generated material files for lasting shader changes; use
the `.import.hzt` overrides described in Kaigen's asset-cook wiki.

The standalone `hzbuild cook` path also checks the existing character's WebGPU
shader, which exceeds that browser backend's texture limit. The native macOS
and iOS builds succeed. No SDK or character shader was changed for this import.

## Validation

- Native macOS portrait render inspected: `app/out/forest-preview.png`.
- Native iOS framework build and asset cook succeeded, with zero failed assets.
- Signed SwiftUI app build succeeded and installed on the user's paired iPhone 14.
- The forest inside the built app was checked byte-for-byte against its current
  cooked asset before installation.
- The phone launch supplied no harness connection settings; its saved session
  restored successfully. The runtime recorded a new GPT-6 Luna FoxGlove session
  and an ElevenLabs voice connection.
- The full-body character, forest path and native card were visually inspected
  in `app_swift/build/forest-iphone.png`.
- At this environment-integration checkpoint, the C player, character assets,
  shaders, engine pin, session-restoration code, Xcode project/signing
  configuration and harness runtime were unchanged.
- This is an import and device smoke test, not a sustained frame-rate, thermal
  or battery benchmark.

## References consulted

- Harness `README.md` and `player/README.md`: player/runtime separation,
  native framework build, preview settings and third-party asset licenses.
- Installed Kaigen setup plugin; SDK hz-core, hz-game and hz-build skills.
- SDK wiki: `engine/asset-cook.md`, `engine/scene.md`,
  `engine/model-import.md` and the build screenshot guidance.
- [Kaigen application documentation](https://kaigen3d.com/docs/writing-applications).
