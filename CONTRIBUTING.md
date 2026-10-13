# Contributing

Issues and pull requests are welcome.

- **Where a change goes.** Most changes belong in a character folder or a new extension. `runtime/` should never special-case a single character. `AGENTS.md` and `docs/architecture.md` explain where things live.
- **Before a pull request.** Run `npm run typecheck` and `npm test`. Both run without keys or network, and CI runs them on every pull request.
- **Keys.** Never commit `.env` or a key. Manifests name keys (`api_key_env`, `requires_env`), never their values.
- **Style.** Match the code around your change: plain names, short comments that say why.
