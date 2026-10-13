# Runtime

The conversation loop: speech in, the gate alongside the LLM, per-sentence staging, speech out. It fires the events described in `../docs/architecture.md` and holds no character-specific logic.

It runs on Node and loads extensions from their folders.

```bash
npm install
npm start                      # characters/foxglove
npm start -- characters/<id>   # another character
```

For a character with `rig.model`, it first retargets the character's animations onto its model and writes the result to `.cache/characters/<id>/` for the player (`src/rig/`). With `HARNESS_PLAYER` set to the command that opens the player, it then starts it and stops when the player closes (`src/player.ts`).

It serves the app on `ws://127.0.0.1:8788/session`. Set `PORT` to change the port, and `HOST=0.0.0.0` so another device on the same network can reach it.

`src/session.ts` lists the messages of the app protocol.

`npm test` runs the tests in `test/`; they need no keys or network.
