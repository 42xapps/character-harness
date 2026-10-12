# Architecture

Three parts: the **engine** renders the character, the **runtime** runs the conversation, and **extensions** add behavior. A **character** is a folder the runtime loads through its manifest.

## The turn loop

The runtime fires an event at each step of a turn and knows nothing about what extensions do with it.

```
input (voice, chat, screen)
  ├→ before_reply   should she reply?
  └→ before_llm     build the prompt; inject context
     → llm          the character's model writes the reply
     → after_llm    the full reply is written
  → on_sentence     per sentence, once before_reply is done, while TTS synthesizes it
  → on_speak        audio plays, the rig moves
  → after_turn      the turn is closed
```

`before_reply` runs at the same time as `before_llm` and the LLM call. `on_sentence` fires per sentence while the model is still writing, so staging never delays the first audio, and early sentences may play before `after_llm`.

Around the turns, two session events:

```
on_session_start   someone joined, or a call started
  … turns …
on_session_end     the call or conversation ended
```

## Cancelling a turn

`before_reply` decides whether she replies. It runs alongside `before_llm` and the LLM call, so it doesn't add its time to every turn. The first sentence waits until it finishes. Its extensions work on their own copy of the state, and the runtime keeps only `cancel` from them.

A blocking extension on `before_reply` or `before_llm` ends the turn by setting `cancel: true`. The runtime skips or aborts the LLM call, nothing is spoken, and `after_turn` still fires. If a `before_reply` extension times out, she replies.

## Hooks

| Hook | Fires | State ready | Typical use |
|---|---|---|---|
| `on_session_start` | a session opens | `character`, `session` | prefetch memories of who joined, open a gamification session |
| `before_reply` | input arrived; runs alongside `before_llm` and the LLM call | `input`, `messages` | the gate (reply or stay quiet), moderation that cancels the turn |
| `before_llm` | the prompt is being built | `input`, `messages`, `prompt` | memory recall, context injection, blocking a topic |
| `after_llm` | the full reply is written; early sentences may already be playing | `+ reply` | observability spans, logging the reply |
| `on_sentence` | per sentence, while TTS synthesizes it | `+ sentence` | staging: emotion, gesture, camera |
| `on_speak` | audio plays, the rig moves | `sentence` + `timing` | sync expressions to the audio |
| `after_turn` | the turn is closed | everything | memory writes, metrics, rewards, transcripts, eval data |
| `on_session_end` | the session closes | everything, plus the end reason | consolidate memory, close metrics, report the session to an eval service |

Every hook is blocking unless the extension sets `blocking: false` for it. See `extensions.md` for what that means.

## Speech to text

ElevenLabs is the first speech-to-text provider.

```yaml
stt:
  provider: elevenlabs
  model: scribe_v2_realtime
  language: en
  keyterms: [FoxGlove]               # optional, names from the character's world the model should hear right
```

- The runtime streams the user's audio and puts the transcript in `input`.
- It uses the same `ELEVENLABS_API_KEY` as the voice.

## The chat model

`models.chat` says which API to call, where, and with which key. Adding a provider is a manifest edit.

```yaml
models:
  chat:
    api: chat_completions            # or responses
    base_url: https://api.x.ai/v1
    api_key_env: XAI_API_KEY         # the key's name in .env
    model: grok-4-1-fast-non-reasoning
    params:                          # optional
      temperature: 0.9               # chat_completions only
      max_tokens: 1200
      # reasoning_effort: low        # responses only
```

| `api` | For |
|---|---|
| `chat_completions` | xAI, or any server that speaks OpenAI Chat Completions |
| `responses` | OpenAI's Responses API, for reasoning models |

- The runtime sends `prompt` as the system message, then `messages`. It streams the answer into sentences for `on_sentence` and writes the full text to `reply`.
- On failure the runtime sets `error` and ends the turn. `after_turn` still fires.

## The voice

ElevenLabs is the first voice provider.

```yaml
voice:
  provider: elevenlabs
  voice_id: <voice-id>
  model: eleven_v4_turbo
  params:                            # optional voice settings
    stability: 0.5
    similarity_boost: 0.75
```

- Each sentence comes back as streamed audio plus per-character timing. The runtime puts the timing in `timing` for `on_speak`, so expressions land on the word.
- The sentence goes to ElevenLabs as written, so delivery tags like `[laughs]` work.
- ElevenLabs uses `ELEVENLABS_API_KEY`.
- On failure the runtime sets `error` and ends the turn. `after_turn` still fires.

## State

Every event carries one JSON state object. Extensions receive it, may change it, and pass it on. Shared fields:

| Key | What |
|---|---|
| `schema` | state version |
| `character` | the loaded manifest |
| `session` | session id, who is in it, the channel, and the end reason on `on_session_end` |
| `input` | what came in this turn, and from which channel |
| `messages` | recent conversation |
| `prompt` | the system prompt being built |
| `reply` | the full reply, once written |
| `sentence` | the current sentence, inside `on_sentence` and `on_speak` |
| `timing` | when each character of the sentence is heard, inside `on_speak` |
| `cancel` | `true` to end the turn without replying, set on `before_reply` or `before_llm` |
| `error` | why the turn failed, if it did |
| `ext.<name>` | whatever an extension wants to keep |

The state shape is a public API and is versioned with `schema`. Renaming a key is a breaking change.

## Order

Extensions run in the order the character's manifest lists them. Within a hook, each one sees what the previous blocking ones wrote. Later hooks never see what `before_reply` wrote, only its `cancel`.
