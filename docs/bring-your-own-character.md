# Bring your own character

Any VRM model (0.x or 1.0) can be a character's body.

1. Make a folder `characters/<id>/` with a `character.yaml` (see `character-manifest.md`), a `system.md` for the personality, and your model.
2. Point `rig.model` at the model and list its animations:

   ```yaml
   rig:
     engine: ">=0.5.8"
     model: model.vrm
     animations:
       idle: idle.vrma
       talk: { regular: talk.vrma }
       gestures: { wave: wave.vrma }
   ```

3. Run `npm start -- characters/<id>`. With `HARNESS_PLAYER` in `.env`, the player opens too.

## The body

List the character's animations under `rig.animations` in `character.yaml`: an idle loop, talking loops per style, and gestures. Without them the model stands in its rest pose.

- **`.vrma` files (VRM Animation).** The runtime retargets each one onto your model's skeleton when it starts, through VRM's standard humanoid bones, so a clip made for any VRM fits yours. Export them from VRoid Studio, Blender (with the VRM add-on) or a motion capture tool.
- **Clips inside your model.** If your model file already has animations made for it, name them instead of a file: `idle: Breathing`.

The result is cached in `.cache/characters/<id>/` and rebuilt only when the model or a clip changes.

Gestures and talking styles are what the director picks between. List the same names in the director's `gestures` and `registers` (`director.yaml`), or it will pick ones your character doesn't have.

## The face

The player builds the face from the model's own VRM expressions: happy, angry, sad, relaxed, surprised, blinking, and the five vowel mouth shapes for lip sync. The harness's emotions (warm, playful, thoughtful...) are mixed from those.

## Not yet

- Hair and cloth physics (VRM spring bones). Hair stays still.
- Models with several skins (common in VRMs exported from Unity).
- VRM 0.x models with transparent materials.
- Expressions in `.vrma` files are ignored. The face follows the conversation.
