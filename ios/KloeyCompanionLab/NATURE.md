# Animated companion clearing

The active environment uses the **free Standard** edition of Quaternius's
[Stylized Nature MegaKit](https://quaternius.itch.io/stylized-nature-megakit),
under CC0. This is a new composition using its individual assets, not the
vendor's complete promotional scene or paid engine shaders.

## What is in the app

- A winding path, rolling ground, trees, orange foliage, rocks, ferns,
  flowers, grass, mushrooms and flowering bushes.
- 654 placed objects exported as 12 material-specific meshes in one model.
- 485,292 triangles; approximately 31 MB source GLB; textures capped at 512 px.
- A project-local foliage shader bends vegetation on the GPU. Fixed surfaces
  use the engine's standard shader. Explicit COLOR_0 RGB carries plant amplitude,
  per-plant phase and normalized tip height; its alpha stays 1. Textures retain
  cutout transparency.
- The character stays separate and its gestures, speech and expressions still
  come from the existing conversation harness.

## Touch controls

Drag the scene to orbit the companion horizontally; vertical dragging raises
the viewing angle. Pinch to zoom. Double-tap to return to full body. The
viewfinder sheet retains Full body / Close up and adds Return to companion.

This is camera exploration of a small clearing, not walking/navigation for
the character. Camera distance is bounded to 2–10 meters; elevation is bounded
above ground. There is no camera collision solver: at some angles foliage can
pass in front of the camera. It does not generate an endless world.

UIKit recognizers attach only to the engine viewport. Swift sends tag 3 with
three Float values (yaw, pitch, logarithmic zoom delta); the C dispatcher drains
that command on the engine's main lane. The camera eases toward the target.
Existing framing resets the target and acknowledges the selected mode. Provider
keys, session storage and the backend are unchanged.

## Edit and rebuild

| Change | Location |
| --- | --- |
| Layout and planting | `tools/prepare-nature.py` |
| Editable composed scene | `art/nature/clearing.blend` |
| Preserved selected source models/textures | `art/nature/source/` |
| Exported model and import shader overrides | `app/assets/environments/quaternius/` |
| Wind strength/speed | `app/shaders/renderer/nature_wind.glsl` |
| Camera limits and smoothing, renderer budget | `app/src/app/player.c` |
| Touch recognizers | `app_swift/Sources/EngineView.swift` |
| Native sheet / layout | `app_swift/Sources/ContentView.swift` |

From the lab root:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python tools/prepare-nature.py
./build-engine.sh
```

The preparation command rebuilds `clearing.blend`, the GLB and import sidecar.
Save manual Blender iterations separately before rerunning it. It uses a
separate Blender process and does not modify the user's open project or the
original Downloads folder.

The first cook can seed new material/texture sidecars without cooking every
new dependency in that same pass. If a preview reports a missing new `.hza`,
refresh the **new project's** material/texture `.hzt` timestamps and run the
native build again. Keep shader choices in the GLB's `extras.hz_material`,
authored by `tools/prepare-nature-materials.py`, rather than editing generated
materials. The import sidecar leaves shader/pass overrides unset so the importer
preserves the custom cutout and depth passes. No shared SDK edits are needed.

The previous forest and its Blender source remain in the repository. Its last
complete working checkpoint is `f2f1e2d`; its preparation notes are in FOREST.md.
Only the active scene reference was replaced.

## Performance and verification

The iOS renderer uses 2x MSAA and two 1024 px shadow cascades, rather than the
original desktop budget of 4x MSAA and four 4096 px cascades. Geometry buffers
are 32 MB vertices / 8 MB indices to hold the character plus this clearing.
The engine's existing adaptive quality controller remains enabled.

Desktop scene captures, native device builds, and the on-device orbit/pinch/
reset and native-sheet assertion test are saved under ignored `app/out/` and `app_swift/build/` folders.
The Swift session-restoration checks and camera wire-size/order checks pass.
On the connected iPhone 14, the original desktop shadow/MSAA settings sampled
~35 ms/frame with ~562 MB reported GPU memory. The iOS-specific settings sampled
16.69 ms/frame (~60 fps), 15.02 ms GPU time and ~289.54 MB GPU memory in the
default view after warm-up. These are short development samples, not sustained
thermal/battery benchmarks or a guarantee for every orbit angle/device.

## Wind correction and validation

The initial export was wrong: Blender's default material-driven color export
inserted an all-white COLOR_0, while the authored data was in other color
attributes. The shader read COLOR_0 alpha as full movement everywhere. Applying
that shader to ground, rocks and trunks made the whole scene ripple. The first
pixel-change check did not distinguish vegetation from fixed surfaces and did
not catch the defect.

The corrected preparation removes obsolete imported vertex-color links,
explicitly exports NatureData as COLOR_0, and exports one mesh per material to
avoid color substitution across material sections. Original alpha-cutout node
logic is preserved. Only leaf/grass/flower materials get the wind override.

All vertices of a plant share a phase. Smoothstep height weighting anchors its
base. The main sway is slow, with a smaller secondary oscillation and tip
flutter. Tree leaf amplitude is at most 7.5 cm before oscillation; smaller plants
are scaled to their height and capped at 3.5 cm. Trunks/rocks/terrain/mushrooms
have no wind program. The path is painted into the same terrain mesh, eliminating
intersections between the old separate path and rolling ground.

`python3 tools/verify-nature.py` checks the actual exported GLB and sidecar:
nonconstant vegetation weights, pinned roots, per-plant phase variation,
bounded amplitude, opaque vertex alpha, cutout/opaque material modes, and one
continuous painted ground. `--materials` also checks generated shader bindings
and the presence of referenced cooked textures. Preparation invokes the export
check; build-engine.sh gates iOS packaging on both checks. It rejects the original
all-white movement data.

Controlled desktop captures compare a fixed foreground-ground region separately
from foliage and flower/grass regions. The checked captures measured **0 / 3,750** changed foreground-ground pixels,
9,882 / 18,000 changed foliage pixels and 6,960 / 18,750 changed flower/grass
pixels. Both vegetation patches exclude the character. This checks the distinction
that the initial smoke test missed.

Reproduce the image comparison on this Mac after capturing the default 414×900
portrait scene at frames 240 and 480:

```sh
swift -module-cache-path app_swift/build/SessionModuleCache tools/check-nature-motion.swift app/out/wind-fixed-a.png app/out/wind-fixed-b.png
```

The corrected native build was signed, installed and visually inspected on the
iPhone 14 (`app_swift/build/wind-fixed-iphone.png`). Its short sample measured
15.09 ms average GPU time, 16.72 ms median frame time and 289.52 MB GPU memory;
the mean frame time was 21.01 ms with spikes in that sample. This is not a claim
of sustained 60 fps. Conversation/session code and ongoing SwiftUI edits were
not changed by the wind correction.

The wind bends visible foliage; it does not simulate branch physics. The audit
revision shares deformation between visible, shadow and depth shaders through
`nature_wind_common.glsl`. A typed renderer uniform supplies current and previous
render times, including when frame pacing changes. Alpha-cutout materials retain
their cutout shadow path. MToon and foliage now provide previous-frame motion;
`HARNESS_TEMPORAL=1` enables the opt-in MetalFX/temporal path for A/B checks.
The default remains 2x MSAA until physical-device image and performance evidence
supports changing it. The measurements and screenshots above are historical;
`IOS-WORK.md` records acceptance evidence for this revision.

## References consulted

- Harness README.md and player/README.md; lab AGENTS.md and Swift host notes.
- Installed Kaigen setup plugin; SDK hz-core, hz-game, hz-build and hz-shaders.
- SDK wiki: asset-cook, model-import, rendering/grass and shader conventions; renderer/quality headers.
- Installed Blender glTF exporter code: material-driven color export, explicit named color selection and material cutout handling.
- https://kaigen3d.com/docs/writing-applications
