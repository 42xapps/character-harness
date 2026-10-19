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

Five extensions ship with the harness: `emotion-tags` changes the face from delivery tags, `director` stages each line, `memory` remembers what the user says about their life, `reactions` starts replies with a reaction, and `world-context` grounds replies in optional app telemetry.

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
| `memory` | `before_llm` blocking (1.5 s), `after_turn` and `on_session_end` non-blocking | asks Typesafe's Jev whether what the user said is worth keeping, keeps it in their own words in a tree per character, marks what it makes out of date, and puts what the character remembers in the prompt. See `extensions/memory/README.md` |
| `reactions` | `before_reply` blocking (1.5 s), `on_sentence` blocking (500 ms), `on_session_end` non-blocking | asks the configured decision provider (Typesafe or OpenAI) how the character takes the user's message, and starts the reply's first sentence with an emotion and optional gesture. List it after `emotion-tags` and before `director`. See `extensions/reactions/README.md` |

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

## World context and local development traces

`extensions/world-context` uses `before_llm` to append descriptive context to
the character prompt. Configure it with `characters/foxglove/world.yaml`:
scene/avatar ids, authored environment and appearance, capability descriptions,
unsupported actions, and `trace: { enabled: false, max_bytes: 2097152 }`.
Optional `threads` contains up to 24 authored, unresolved taste opinions, and
optional `anchor` is a trusted, character-authored reminder appended after the
context block. Neither is supplied by the player. The daily thread is selected
deterministically from the local ISO date and pinned in this extension's session
state; midnight never changes a conversation's chosen topic. The user's replies
are followed through the ordinary conversation history, with no persistent memory.

Time and user name use `state.context.profile`, independently of scene freshness.
`time` is rebuilt each turn from the server clock and the phone's validated zone;
`user.name` preserves the supplied spelling. Missing values are omitted. Static
recognized-scene facts precede activity, age, time, name and thread to preserve
a stable prompt prefix. The prompt distinguishes origin-story lore from these
live facts and forbids inventing offscreen experiences for a thread.
Config is checked at startup. There is no extra model call. Missing/stale or
unrecognized telemetry must not be filled in from old assistant claims.

The active display name is **Kloey**. The folder, manifest id and rig profile
remain `foxglove` for saved-session and cooked-asset compatibility. The director's
vocabulary, delivery tags, voice and models retain their existing contracts.

Non-blocking `after_llm`, `on_sentence`, `after_turn` and `on_session_end` hooks
write private local JSONL files to `.cache/conversations/<session-id>.jsonl`.
They record generated replies and TTS-requested sentences separately. These
are **not confirmed audible transcripts**: device interruption/playback is not
acknowledged by this protocol. Raw microphone audio is not stored. Trace entries
carry `playback_verified: false`; error/end fields are included when available.
Input/reply text is bounded to 8,000/16,000 characters. Known credential values,
API-key patterns and WebSocket URLs are redacted. No full history, environment
file, provider header or keys are logged. File mode is 0600, the directory is
0700 when created, files are ignored by Git, each file stops growing at the
configured cap, and pending writes are bounded. Existing traces are retained
locally; review and remove them deliberately when finished. Trace collection is
for this development setup, not a production analytics policy.

The reference config defaults to `trace.enabled: false`. For a deliberate local debugging session, set it to `true` and restart the runtime; set it back to `false` and restart to stop future writes. Changing the file does not alter an already running runtime or delete existing traces.
OpenAI Responses storage remains `false`; this extension does not enable remote
analytics, persistent memory or new action tools. It writes only its own
`state.ext["world-context"]` key and the shared `prompt` field.

Prompt references: [OpenAI GPT-6 guidance](https://developers.openai.com/api/docs/guides/latest-model#prompting-best-practices)
and [prompt engineering](https://developers.openai.com/api/docs/guides/prompt-engineering).
The prompt uses explicit identity/scope, separate descriptive context, short spoken
output rules and grounded examples. Coding-agent instructions from the model guide
are not copied into the companion persona. GPT-6 Luna, reasoning effort `none`,
the Responses request adapter and `store: false` remain as configured.

## Authored character lore and language

Kloey's prompt retains nine authored origin-story memories and ten expressive
flaws. Those fixed character facts are separate from current scene telemetry,
actual conversations with the user and cross-session personal memory. Story
streams, Josh, Comet Jr and historical audience counts do not describe the current
app channel, provide a live database or place an animal in the rendered scene.

The model projection excludes raw position coordinates and the route counter;
they remain validated app-to-server telemetry and may appear in an explicitly
enabled local debug trace. Narrative context still includes actual activity,
recent activity, authored scene facts and descriptive capabilities.

`stt.language` is omitted so Scribe v2 Realtime detects the spoken language.
`SttRelay` already omits `language_code` when no hint is configured; no STT relay
code change is needed. The original seven STT keyterms have been restored at the
user's request. This config change needs a runtime restart and does not establish
Arabic recognition or voice pronunciation quality. Source:
[ElevenLabs Realtime language parameter](https://elevenlabs.io/docs/api-reference/speech-to-text/v-1-speech-to-text-realtime).
