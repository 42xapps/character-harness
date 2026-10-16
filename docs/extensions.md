# Extensions

An extension subscribes to events in the turn loop, receives the state, changes it, and passes it on.

New to extensions? `your-first-extension.md` builds a small one step by step, with its check and tests.

## The extension manifest

Every extension is a folder with an `extension.yaml`. The extension decides which hooks it runs on and which `.env` keys it needs.

```yaml
# extensions/my-extension/extension.yaml
name: my-extension
handler: index.ts                    # a module in this folder, or an http(s) URL
hooks:
  before_llm: { blocking: true, timeout_ms: 1000 }
  after_turn: { blocking: false }
requires_env: [MY_EXTENSION_API_KEY]
```

| Key | Required | What |
|---|---|---|
| `name` | yes | Unique among a character's extensions. By convention, its data goes under `state.ext.<name>`. |
| `handler` | yes | A module file in the folder, or an `http(s)` URL. |
| `hooks` | yes | A list of hook names, or a map of hook name to options. In the list form every hook is blocking. |
| `hooks.<hook>.blocking` | no | Default `true`. |
| `hooks.<hook>.timeout_ms` | no | Blocking hooks only. Default `5000`. |
| `requires_env` | no | Keys the extension needs from `.env`: names, or `{ config: model.api_key_env }` for a key the character's config for the extension names (dotted path). The runtime checks them at startup and keeps them from the player. |

Hooks: `on_session_start`, `before_reply`, `before_llm`, `after_llm`, `on_sentence`, `on_speak`, `after_turn`, `on_session_end`.

## Using it in a character

The character lists the extensions it uses, in the order they run, with any config:

```yaml
extensions:
  - path: ../../extensions/my-extension
    config: { anything: you-need }
```

The runtime passes `config` to the extension untouched. For a long config, `config_file` names a YAML file in the character's folder instead.

Three extensions ship with the harness: `emotion-tags` changes the face from the tag that opens each sentence, `director` stages each sentence with beats (see "Beats" in `architecture.md`), and `memory` remembers what the user tells her about their life.

## Handlers

| Kind | `handler` | When |
|---|---|---|
| Module | a file in the extension's folder, like `index.ts` | default; runs inside the runtime |
| HTTP | `http(s)://…` | any language, or a separate service |

Both get the same input and return the same output:

```
in:  { event, state, config }
out: { state }
```

A module's default export is that function, sync or async. Returning nothing means no change. An HTTP handler gets the input as a JSON `POST` and answers with the output. Keys from `.env` are in `process.env`.

An extension runs with the runtime's access: your keys, your files, the network. Only use extensions you trust (see `SECURITY.md`).

### Checking its config

A module may also export `check({ config, body })` (the name is reserved for this), which `npm run check` and `npm start` call before any conversation. `body` is what the player has for the character: `{ emotions, registers, gestures, cameras }`, each a list of names, or `null` when it can't be told from here (a profile this checkout doesn't have, say). It returns `{ errors, warnings }`, lists of messages, or nothing when all is well. The extension picks how serious each problem is: a warning is shown and the character starts anyway; an error is shown and `npm start` stops. The runtime only shows what it gets. The director, for example, makes a missing model or prompt an error, since it can't work without them, and a gesture, emotion, talking style or camera move the character doesn't have a warning, since on stage it would only do nothing.

## Blocking and non-blocking

- **Blocking** (default): the turn waits; the returned state goes to the next extension.
- **Non-blocking**: the extension gets a copy of the state and the turn moves on. Its return value is dropped. Use it for side effects like metrics or transcripts.

On `on_sentence` and `on_speak`, blocking only makes the next extension wait. It never delays the audio. On `before_reply`, blocking holds back only the first sentence, not `before_llm` or the LLM call, and the runtime keeps only `cancel`. See "Cancelling a turn" in `architecture.md`.

A blocking extension has 5 seconds by default. Set `timeout_ms` on the hook in `extension.yaml` to change it. If it runs out, the runtime logs it, drops the extension's changes, and the turn goes on.

## Examples

The extensions in `extensions/` ship with the harness and show the shape:

| Extension | Hooks | What it does |
|---|---|---|
| `emotion-tags` | `on_sentence`, blocking (500 ms) | changes the face the moment a sentence starts, from the delivery tag it opens with and the character's `tags` map (`[teasing]` → `playful` for FoxGlove). No model call |
| `director` | `on_sentence` blocking (10 s), `on_session_end` non-blocking | asks a second model to stage each line: an emotion, a talking style, a gesture and a camera move per phrase |
| `memory` | `before_llm` blocking (1.5 s), `after_turn` and `on_session_end` non-blocking | asks Typesafe's Jev whether what the user said is worth keeping, keeps it in their own words in a tree per character, marks what it makes out of date, and puts what she remembers in the prompt. See `extensions/memory/README.md` |

### The director's config

The director reads its words from the character's config, usually a `director.yaml` next to `character.yaml` (`config_file: director.yaml`). `characters/foxglove/director.yaml` is a complete one to copy.

| Key | What |
|---|---|
| `model` | `{ base_url, api_key_env, model }`: an OpenAI-compatible chat model that stages the lines |
| `emotions` | `{ name: hint }`: the emotions it may pick, each with what it means |
| `intense` | emotions only for peaks, capped per reply |
| `registers` | talking styles: the names under `rig.animations.talk` |
| `gestures` | the names under `rig.animations.gestures` |
| `cameras` | camera moves: `hold`, `push-in`, `close-up`, `pull-back` |
| `limits` | `{ cameras, intense }`: how many of each per reply |
| `tags` | `{ tag: emotion }`: delivery tags and near-miss words mapped to an emotion (`emotion-tags` reads it too) |
| `prompt` | the director's instructions |

Its `extension.yaml` asks for the key `model.api_key_env` names, so the runtime checks whichever key the character's director uses.

Other ideas the hooks fit: awarding points from how the character ended a turn (`after_turn`), sending turns to a monitoring or eval service (`after_llm`, non-blocking), or blocking a topic before the model sees it (`before_llm`).

## Sharing extensions

An extension is a folder with an `extension.yaml`; its `handler` is a file in that folder or an HTTP URL. A character uses one from anywhere by pointing `path` at its folder, so an extension can live in its own repo.

## What the runtime does not do

Namespacing, retries and storage are up to each extension. Convention: keep your data under `state.ext.<name>`.
