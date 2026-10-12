# Extensions

An extension subscribes to events in the turn loop, receives the state, changes it, and passes it on.

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
| `requires_env` | no | Keys the extension needs from `.env`. The runtime checks them at startup. |

Hooks: `on_session_start`, `before_reply`, `before_llm`, `after_llm`, `on_sentence`, `on_speak`, `after_turn`, `on_session_end`.

## Using it in a character

The character lists the extensions it uses, in the order they run, with any config:

```yaml
extensions:
  - path: ../../extensions/my-extension
    config: { anything: you-need }
```

The runtime passes `config` to the extension untouched. For a long config, `config_file` names a YAML file in the character's folder instead.

Two extensions ship with the harness: `emotion-tags` changes the face from the tag that opens each sentence, and `director` stages each sentence with beats (see "Beats" in `architecture.md`).

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

## Blocking and non-blocking

- **Blocking** (default): the turn waits; the returned state goes to the next extension.
- **Non-blocking**: the extension gets a copy of the state and the turn moves on. Its return value is dropped. Use it for side effects like metrics or transcripts.

On `on_sentence` and `on_speak`, blocking only makes the next extension wait. It never delays the audio. On `before_reply`, blocking holds back only the first sentence, not `before_llm` or the LLM call, and the runtime keeps only `cancel`. See "Cancelling a turn" in `architecture.md`.

A blocking extension has 5 seconds by default. Set `timeout_ms` on the hook in `extension.yaml` to change it. If it runs out, the runtime logs it, drops the extension's changes, and the turn goes on.

## Examples

| Extension | Hooks | What it does |
|---|---|---|
| rewards | `after_turn`, non-blocking | reads how the character ended the turn (happy, annoyed) and awards points to the user |
| observability / evals | `after_llm` or `after_turn`, non-blocking | sends the turn to a monitoring or eval service |
| moderation | `before_llm` blocking + `after_turn` non-blocking | blocks a topic in the prompt; flags users after the fact |

## Sharing extensions

Not decided yet. For now, an extension is a folder or a URL.

## What the runtime does not do

Namespacing, retries and storage are up to each extension. Convention: keep your data under `state.ext.<name>`.
