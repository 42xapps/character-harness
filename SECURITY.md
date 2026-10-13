# Security

Please report a vulnerability privately, through "Report a vulnerability" on this repository's Security tab, not in a public issue. We'll answer there.

## What to trust

- **A character or extension is code.** Loading one runs its handlers inside the runtime, with your keys in reach: a manifest can name any environment variable as a key and send it to any `base_url`, and an HTTP handler gets the whole conversation. Only load characters and extensions from people you trust, and read them first.
- **The runtime's socket spends your keys.** It listens on 127.0.0.1 by default, needs the token it gives the player, and refuses web pages. With `HOST=0.0.0.0`, anyone on your network who learns the token can use it.
- **The player gets no keys.** The runtime starts it without the keys from `.env`; only `HARNESS_*` settings pass through.
