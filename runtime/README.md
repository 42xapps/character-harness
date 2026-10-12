# Runtime

The conversation loop: speech in, the gate alongside the LLM, per-sentence staging, speech out. It fires the events described in `../docs/architecture.md` and holds no character-specific logic.

It runs on Node and loads extensions from their folders.

```bash
npm install
npm start                      # characters/foxglove
npm start -- characters/<id>   # another character
```

It serves the app on `ws://127.0.0.1:8788/session`. Set `PORT` to change the port, and `HOST=0.0.0.0` so another device on the same network can reach it.

`src/session.ts` lists the messages of the app protocol.
