# Walking motion

Quaternius Universal Animation Library, free Standard edition, CC0 1.0.
Official pack and license: https://quaternius.com/packs/universalanimationlibrary.html

The official itch.io free archive endpoint returned HTTP 429 during retrieval.
The preserved glTF and BIN came from this public mirror, pinned to commit
`e24c23cf2a1323488a3faa226ea7ea21f644b73e`:
https://github.com/J-Ponzo/gltf-universal-animation-library
Its CC0 license is preserved in LICENSE.txt. This is the Standard library;
no paid Pro/Source assets are used.

Run `node tools/prepare-locomotion.ts` from the lab root (Node >=23.6).
It maps the source's named humanoid bones and FoxGlove's named VRM bones,
then uses the character-harness normalized humanoid retargeter unchanged.
The tool imports the canonical helpers directly from runtime/src/rig. Their
Apache 2.0 license and provenance note remain under tools/vendor/harness.
FoxGlove's original GLB, materials, existing clips and harness manifest stay
unchanged. The output is a separate, skinless animation library in
app/assets/foxglove/locomotion.glb, bound to the live skeleton by joint name.

Both walk loops are 1.333 seconds; the relaxed Walk_Loop is active. On the
retargeted FoxGlove, low-stance foot velocity measures approximately -1.05 and
-1.13 m/s. CALM_CLIP_SPEED=1.09 m/s uses their average to match playback rate
to actual ground speed. The companion cruises at 0.58 m/s. Turning uses a
restrained step blend. The tool also derives 0.65 s start/stop, 0.8 s left/right
pivot and 3.2 s observation clips from the walk and idle pose. These are authored
transitions, not dedicated motion-capture clips from the source pack. A separate
Kaigen animation layer crossfades them while the harness retains face, gesture
and cloth priority. See IDLE-LIFE.md and IOS-WORK.md for the validation status.
