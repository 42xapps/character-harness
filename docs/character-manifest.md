# Character manifest

`characters/<id>/character.yaml` describes what a character is and what she needs to run. The runtime loads her from this file and the `extension.yaml` of each extension it lists, so swapping a character is swapping a folder. Paths are relative to the character's folder.

```yaml
schema: 1

id: foxglove
name: FoxGlove
description: <one line on who she is>
purpose: <optional, what she's for>
author: Mutuals
license: <what people may do with this character; separate from the code license>

prompt: system.md

models:
  chat:
    api: chat_completions
    base_url: https://api.x.ai/v1
    api_key_env: XAI_API_KEY
    model: grok-4-1-fast-non-reasoning
    params:
      temperature: 0.9
      max_tokens: 1200

stt:
  provider: elevenlabs
  model: scribe_v2_realtime
  language: en
  keyterms: [FoxGlove]

voice:
  provider: elevenlabs
  voice_id: <voice-id>
  model: eleven_v4_turbo
  params:
    stability: 0.5
    similarity_boost: 0.75

rig:
  engine: ">=<engine-version>"
  model: model.vrm
  animations:
    idle: idle.vrma
    talk:
      regular: talk.vrma
      upbeat: talk_upbeat.vrma
    gestures:
      wave: wave.vrma
      nod: nod.vrma

extensions:
  - path: ../../extensions/director
    config_file: director.yaml

env_file: ../../.env
```

## Identity

| Key | Required | What |
|---|---|---|
| `schema` | yes | Manifest version, so older characters keep loading. Currently `1`. |
| `id` | yes | Stable identifier. |
| `name` | yes | Display name. |
| `description` | yes | One line on who she is. |
| `purpose` | no | What she's for. |
| `author` | yes | Who made her. |
| `license` | yes | What people may do with the character itself (fan art, revenue, brand deals). Separate from the code license. |
| `prompt` | yes | Her personality, as one markdown file. |

## `models.chat`

| Key | Required | What |
|---|---|---|
| `api` | yes | `chat_completions` or `responses`. |
| `base_url` | yes | The provider's API root, like `https://api.x.ai/v1`. |
| `api_key_env` | yes | Name of the key in `.env`. |
| `model` | yes | The provider's model name. |
| `params.temperature` | no | `chat_completions` only. |
| `params.max_tokens` | no | Longest reply, in tokens. |
| `params.reasoning_effort` | no | `responses` only, like `low`. |

Models an extension uses belong to that extension, not here. See "The chat model" in `architecture.md`.

## `stt`

| Key | Required | What |
|---|---|---|
| `provider` | yes | `elevenlabs`. |
| `model` | yes | Like `scribe_v2_realtime`. |
| `language` | no | Language code, like `en`. |
| `keyterms` | no | Names from her world the model should hear right. |

## `voice`

| Key | Required | What |
|---|---|---|
| `provider` | yes | `elevenlabs`. |
| `voice_id` | yes | The provider's voice ID. |
| `model` | yes | Like `eleven_v4_turbo`. |
| `params` | no | Voice settings passed to the provider, like `stability` and `similarity_boost`. |
| `drop_tags` | no | Delivery tags removed from each sentence before the voice gets it, like `[quiet, whispers]` for tags it renders too quietly. |

## `rig`

The body. Either a VRM model with the animations it plays, or a profile cooked into a player build (the player in this repo ships none).

| Key | Required | What |
|---|---|---|
| `rig.engine` | yes | Engine versions the character works with. |
| `rig.model` | one of these | A `.vrm` file (VRM 0.x or 1.0). |
| `rig.profile` | one of these | A profile cooked into a player build, by name. Needs `emotions` too. |
| `rig.animations.idle` | no | The loop she plays while listening. One clip or a list. |
| `rig.animations.talk.<style>` | no | Loops she plays while talking, per talking style. `regular` is the default style; the others are what the director's `registers` pick from. |
| `rig.animations.gestures.<name>` | no | One-shot gestures the director's `gestures` pick from. A clip, or `{ clip, hold: true }` for a pose that holds until the next beat. |
| `emotions` | with `profile` | The profile's emotion set file. |

A clip is a `.vrma` file (VRM Animation), retargeted onto the model when the runtime starts, or the name of an animation already inside the model. Without an idle clip the model stands in its rest pose.

Gesture and style names are the words the director picks, so list the same names in its config (`director.yaml`). See `bring-your-own-character.md`.

## `extensions`

A list, in the order the extensions run. Each extension declares its own hooks and the `.env` keys it needs in its `extension.yaml`. See `extensions.md`.

| Key | Required | What |
|---|---|---|
| `path` | yes | The extension's folder. |
| `config` | no | Anything. Passed to the extension untouched. |
| `config_file` | no | A YAML file in the character's folder with more config. Keys in `config` win. |

## Keys

| Key | Required | What |
|---|---|---|
| `env_file` | yes | Path to the `.env` file. At startup the runtime checks it has every key the character needs: `models.chat.api_key_env`, `ELEVENLABS_API_KEY` for speech to text and the voice, and each extension's `requires_env`. |
