# gesture-cues

The extension `docs/your-first-extension.md` builds. When the character says one of its cue phrases, it plays a gesture on that phrase: a wave on "hello", a cheer on "you did it".

No model call and no key. It runs on `on_sentence`, blocking, with 500 ms.

This example re-exports the shared implementation in `extensions/gesture-cues`.
Production manifests can point there directly. An existing gesture from an
earlier extension takes priority, so a cue never duplicates its gesture.

## Use it

```yaml
extensions:
  - path: ../../examples/extensions/gesture-cues
    config:
      cues:
        hello: wave
        "you did it": cheer
```

| Key | What |
|---|---|
| `cues` | `{ phrase: gesture }`. A phrase matches in any case, as whole words. The gesture is a name from the character's own gestures (`rig.animations.gestures`, or the gestures of its profile). |

When a sentence has several cues, the first one in the sentence plays. Delivery tags like `[laughs]` aren't spoken, so they never match.

List it before any extension that calls a model on `on_sentence`, like `director`: extensions on one hook run one after another, so after the director its gesture would wait for the director's model call.

## What `npm run check` says

- `cues` missing or not a map, or a cue that isn't a phrase (up to 200 characters) mapped to a name: an error. `npm start` stops.
- A gesture the character doesn't have: a warning. The character starts, and that cue does nothing.

Its tests are in `runtime/test/examples.test.ts`.
