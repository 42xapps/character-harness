# Mutuals Character Harness

The harness [Mutuals](https://github.com/mutuals-inc) uses to give life to its characters: a character you can talk to by voice, with a face and body that react to what it says.

> Status: pre-release. The runtime works end to end. The player app that renders the character is not released yet.

## How it works

The **runtime** (this repo) runs the conversation: it hears you through ElevenLabs speech to text, writes the reply with a chat model, speaks it with an ElevenLabs voice, and stages each sentence with an emotion, a talking style and a gesture. The **player** app renders the character, plays the voice and captures the mic; it connects to the runtime over a local WebSocket.

A character is a folder with a manifest, a personality prompt and a body: either a profile built into the player, or any VRM model with the animations you bring. Extensions add behavior on every turn.

## What's inside

| Folder | What it is |
|---|---|
| `runtime/` | The conversation loop, and the preparation of VRM models and their animations for the player. |
| `extensions/` | Plug-ins that run on every turn: `emotion-tags` changes the face from a sentence's delivery tag, `director` stages each line. |
| `characters/` | Character manifests. `foxglove/` is the reference character. |
| `docs/` | How the pieces fit. Start with `docs/architecture.md`. |
| `engine/` | Where the player app will be documented once it is released. |

## Quickstart

Needs Node 23.6 or later, an ElevenLabs key and a key for the chat model the character uses.

1. Copy `.env.example` to `.env` and fill in the keys.
2. Run `npm install`, then `npm start` for FoxGlove, or `npm start -- characters/<id>` for another character.
3. Start the player. Set `HARNESS_PLAYER` in `.env` to the command that opens it, and `npm start` opens it too; otherwise the runtime prints what the player needs. It connects on `ws://127.0.0.1:8788/session`.
4. Open Claude Code or Codex in this folder and ask it to change something. `AGENTS.md` tells it where everything lives.

`npm test` runs the tests; they need no keys or network.

## Docs

- `docs/architecture.md`: the turn loop and the event system
- `docs/character-manifest.md`: what a character is
- `docs/extensions.md`: how to write an extension
- `docs/bring-your-own-character.md`: use your own VRM model and animations

## Contributing

Issues and pull requests are welcome. Most changes belong in a character folder or a new extension. `runtime/` should never special-case a single character.

## License

TBD.
