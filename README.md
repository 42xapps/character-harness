# Mutuals Character Harness

The harness [Mutuals](https://github.com/mutuals-inc) uses to give life to its characters.

> Status: pre-release. This repo has the structure and contracts only. We are moving the runtime in now.

## What's inside

| Folder | What it is |
|---|---|
| `engine/` | The prebuilt rendering engine. |
| `runtime/` | The conversation loop. |
| `extensions/` | Plug-ins that run on every turn. |
| `characters/` | Character manifests. |
| `docs/` | How the pieces fit. Start with `docs/architecture.md`. |

## Quickstart

Not runnable yet. Once the runtime lands, the steps will be:

1. Download the engine (`engine/README.md`).
2. Copy `.env.example` to `.env` and fill in the keys.
3. Run the runtime and open the character.
4. Open Claude Code or Codex in this folder and ask it to change something. `AGENTS.md` tells it where everything lives.

## Docs

- `docs/architecture.md`: the turn loop and the event system
- `docs/character-manifest.md`: what a character is
- `docs/extensions.md`: how to write an extension

## Contributing

Issues and pull requests are welcome. Most changes belong in a character folder or a new extension. `runtime/` should never special-case a single character.

## License

TBD.
