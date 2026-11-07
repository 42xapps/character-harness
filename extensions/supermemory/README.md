# Supermemory extension

Local-first v5 companion memory with an encrypted conversation journal, leased
background outbox, bounded retrieval and deletion barriers. The existing Jev
extension remains unimported and disabled.

**Current state: enabled for the local iPhone test**, with `enabled: true` and
`qualified: true` explicitly configured. This flag enables the extension; it is
not a claim that all production release gates have passed. Previous Gemma checks
covered extraction, profiles, grounded recall, corrections, isolation and forgetting.
The latest GPT-OSS Cloud check passes nine of ten core fixtures but fails employer
supersession: both old and new employment remain marked current. It remains active
at the user's request; the model switch is not a successful temporal qualification. See
[measured results](../../docs/reports/supermemory-implementation.md) and the
[phased plan](../../docs/plans/supermemory-v5-long-term-memory.md).

## Prerequisites and activation

Use Node >=23.6 as required by the harness; verification used Node 26.0.0.
The official SDK is pinned to 5.0.2. The tested server is 0.0.9.
The dedicated local endpoint is `http://127.0.0.1:6779`. Keys live in the root
`.env`, not in YAML. `SUPERMEMORY_JOURNAL_KEY` is a separate base64 32-byte
encryption key; losing it makes the local journal and backups unreadable.

The character loads the integration through its manifest:

```yaml
- path: ../../extensions/supermemory
  config_file: memory.yaml
```

Configure stable local development identity in `.env`:

```dotenv
HARNESS_IDENTITY_MODE=local
HARNESS_USER_ID=local_user
HARNESS_COMPANION_ID=kloey_local
```

This identifies one explicitly chosen development relationship. A display name,
session token, user-supplied namespace or device telemetry is never an identity.
Production mode refuses this resolver. An authenticated hosted backend must call
`runSession` with the verified principal and authorize management calls itself.
Do not expose the development WebSocket server as a multi-user backend.

Restart to apply configuration changes. Removing the extension (or restarting
with `enabled: false`) stops learning/recall and does not activate Jev. Pausing
through the management interface takes effect in the shared journal immediately.
Already submitted provider work may finish; pause does not mean deletion.

## Isolated local qualification

### Active iPhone inference

The user-selected memory model is now **`gpt-oss:20b-cloud`**, through the signed-in
Ollama service on port 11434 and the existing loopback compatibility gateway on
6780. `OPENAI_MODEL`, `OPENAI_FAST_MODEL` and `OPENAI_TEXT_MODEL` are set in
`.cache/supermemory-tuned/.env`. This explicitly selected configuration sends
memory-processing prompts to Ollama Cloud. Embeddings, the encrypted journal and
the existing provider store remain local; the store, namespace and console on
6779 have not changed. Existing documents and memory IDs were checked after the
restart. See [preservation evidence](../../docs/reports/supermemory-gpt-oss-switch.json).
The [cloud model checks](../../docs/reports/supermemory-gpt-oss-cloud-verification.json)
record successful extraction, profiles, recall, isolation, semantic preview, forgetting
and erasure, plus the failed employer-supersession fixture. All 190 deterministic
tests and TypeScript checks pass; these do not override a failed live quality check.

The generic fresh-test configuration below retains its local Gemma default;
starting a new test directory does not implicitly opt it into cloud inference.

### Previous local Gemma qualification

The previously qualified local model configuration uses `gemma4:12b-mlx` weights under
the alias `kloey-memory-gemma4:12b`, with a 32,768-token context and temperature
0.1. It leaves the base model and companion's conversation model unchanged:

```sh
ollama create kloey-memory-gemma4:12b -f extensions/supermemory/Ollama.Modelfile
```

Supermemory 0.0.9's OpenAI-compatible JSON mode omits the response schema from
semantic-forget selection. `tools/supermemory/ollama.ts` supplies that specific
selection schema, constrains the result to the supplied candidate range, and
uses low reasoning for GPT-OSS and disables extended thinking for the previously
qualified Gemma memory workflows. It does not repair or invent
model answers. It binds only loopback, forwards only to local Ollama, rejects
other models/origins, bounds requests/responses/concurrency and logs no prompts
or responses. Recall does not pass through this gateway; it uses local embeddings.

For a new isolated test directory, start these in two terminals. The first
creates the private `.env` and embedding store; run the second before ingestion:

```sh
npm run memory:local -- .cache/supermemory-qualification/.env
npm run memory:ollama -- .cache/supermemory-qualification/.env
npm run memory:qualify -- .cache/supermemory-qualification/.env
npm run memory:verify-local -- .cache/supermemory-qualification/.env
```

For the already configured iPhone instance, `npm run memory:start --
.cache/supermemory-tuned/.env` starts detached memory/gateway processes or reuses
the matching services. It refuses a mismatched listener and never stops unrelated
processes. Its private state and logs live beside that `.env`. The iPhone harness
is still started by `run-iphone.sh --restart-server`; restarting it alone does not
start Supermemory. Keep the Mac and Ollama running during phone tests.

The launcher bypasses the installer wrapper that sources `~/.supermemory/env`.
It forwards a minimal environment, creates its own `.env` and store under the
chosen directory, uses that file's configured model and local embeddings, and
disables telemetry/update checks. Fresh test directories default to local Gemma;
the active iPhone configuration explicitly uses Ollama Cloud as described above.
It captures the generated test key in that `.env` and redacts it from
terminal output. First use downloads local model/runtime artifacts; **offline
operation has not been proven by an egress capture**. It must be verified before
that claim is made. Do not use `WORKFLOW_ENGINE=direct`: v0.0.9 rejects it.

The fixture contains synthetic facts only. The test reports API acceptance,
chunk readiness and learned-memory availability separately. Even a successful
basic probe never automatically qualifies a deployment: correction/deletion,
resource, egress and full quality gates still apply.

The installed 0.0.9 binary batches dynamic dreaming when roughly 10,000 pending
tokens accumulate or the oldest pending item reaches 15 minutes; the coordinator
runs every minute. Source chunks can be searchable much earlier. Short tests
must allow this window rather than treating an empty early profile as extraction
failure. This binary also omits `dreamingStatus` in document reads, so the adapter
reports unknown instead of inventing completion; verify learned facts separately.
`log_events: true` emits counts, latency, availability and injected context size,
without conversation text or credentials. Disable it for quieter operation.

Use a new test directory for each clean retry after a workflow failure; a stalled
workflow in an existing test store can affect later probes. Do not wipe or reuse
the user's running data directory for qualification.

`npm run memory:evaluate -- <test-.env>` runs the synthetic corpus against fresh
test namespaces and compares empty/profile/hybrid context. It measures retrieval
coverage/contradictions, **not** the companion's answer quality or abstention rate.
Namespace cleanup failures are explicitly listed in the result file.

## Local management

The built-in visual console is available at **http://localhost:6779/#memory** for
the active iPhone store. It shows documents, extracted memories and their graph.
Connect using `SUPERMEMORY_LOCAL_API_KEY` from the root `.env`; the console keeps
the key only for the current tab until cleared or reloaded. The original service
on port 6767 uses a separate store and key, so its console does not show Kloey's
new conversations. The active console was visually verified with five documents
and 23 memory entries (including lifecycle/history entries).

Application ownership controls are provided through a trusted local CLI. This
does not add phone UI, tools to the companion model or unauthenticated HTTP endpoints. The configured
identity selects the relationship; callers never supply provider namespaces.

```sh
npm run memory:control -- status --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- inspect --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- pause --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- resume --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- remember --text-file .cache/new-fact.txt --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- preview-forget --text-file .cache/forget-query.txt --preview-file .cache/forget-preview.json --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- forget --preview-file .cache/forget-preview.json --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- correct --preview-file .cache/forget-preview.json --text-file .cache/correction.txt --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- delete-all --config characters/foxglove/memory.yaml --env .env
npm run memory:control -- drain --config characters/foxglove/memory.yaml --env .env
```

Preview tokens are authenticated, relationship/generation bound and expire after
five minutes. Review the affected source IDs before applying. Forgetting removes
the entire affected conversation segments, so adjacent facts may also disappear.
Scoped rebuild has a separate `source_rebuild_qualified: false` default: source
attachments alone do not prove that duplicates or graph derivations cannot recreate
the fact from another conversation. Until live resurrection tests qualify this
feature, forgetting requires clearing the relationship. If source provenance cannot
be verified, `clearsAll` is also true and applying requires
`--allow-clear-all`; this clears the relationship rather than claiming precise
erasure. Corrections are persisted behind the erasure barrier and learned later.

Deletion returns `erasureComplete: false` until the worker has deleted the retired
namespace. A provider's `queued` deletion response does not complete erasure.
`status` exposes pending erasures; recall/resume stay suppressed while
they remain. A worker lease serializes provider writes across runtime/CLI processes.
The runtime worker starts with the first qualified identified session; `drain`
also processes work without a connected companion. It is bounded to 30 seconds;
pending work remains durable for later runs. No success claim is inferred from
`done` chunks alone.

`quarantined` lists unfinished event IDs after a crash/shutdown. An operator can
explicitly `reconcile --event <id> --decision retain|discard`. Retain preserves
only the accepted user evidence with an interrupted outcome, never invented
assistant delivery. Dead jobs remain visible in `status` and require diagnosis;
there is no automatic permanent-error replay loop.

These operations govern long-term memory. The phone's existing in-session history
and independently retained development traces are outside this store. Clear the
current conversation before testing whether a forgotten fact is truly absent.

## Storage and recovery

- SQLite uses WAL and FULL synchronization, private file permissions, and AES-256-GCM
  for conversation/outcome/snapshot payloads. Identity mappings contain hashes and
  opaque namespaces, not user names. There is a 256 MiB logical database cap.
- Queue admission is bounded; oversized inputs are skipped whole rather than
  truncated into a misleading fact. Input records have a conservative 4,000-byte
  serialized limit; assistant output is retained only up to 1,000 serialized bytes.
- Segments hold up to 16 exchanges / 6,000 UTF-8 bytes, a conservative implementation
  of the planned 6,000-token ceiling. Prompt context similarly uses a conservative
  1,500-byte cap under the 1,500-token ceiling. These are intentionally smaller than
  typical English token budgets; widening requires tokenizer/performance evaluation.
- Snapshots are immutable full-prefix updates. Submissions are ordered within a
  namespace, including across transient submission retries. Once a write is accepted,
  subsequent writes can be submitted without waiting for processing; accepted jobs
  are polled separately. Polling backs off from two to ten to thirty seconds as a
  job ages. Queued/processing responses never become failed solely because of age.
  Long waits emit `ingestion_waiting` counters; bounded queue admission still applies.
  An explicit provider `failed` state remains terminal. Document `done` means chunks
  are searchable, not that useful facts or profiles have been extracted. Learning
  has a separate `dreaming`, `done` or `unknown` checkpoint; this engine's omitted
  dreaming field remains unknown rather than being inferred from elapsed time.
  Retriable transport/429/5xx failures get at most eight
  attempts with jitter; permanent errors remain dead letters.
- Profile caching uses a 30-second TTL and generation/version checks. Individual
  facts are hydrated to verify lifecycle/inference flags. Aggregated summaries and
  inferred facts are omitted until their safety/quality can be qualified. Graph
  edges are retained as audit evidence; unverified historical nodes are not rendered
  as current facts. Query rewriting/reranking remain off.

```sh
npm run memory:backup -- create characters/foxglove/memory.yaml .env .cache/memory-backup.enc
# Stop every process using the memory journal before restore; retain the CURRENT ledger.
npm run memory:backup -- restore characters/foxglove/memory.yaml .env .cache/memory-backup.enc
```

Backups are additionally encrypted, created with owner-only access, and refuse to
overwrite an archive. Preserve `deletions.jsonl` independently and never roll it
back with a database snapshot. Restoration requires it, applies newer barriers,
purges affected restored inputs and leaves those relationships paused. A missing,
invalid or tampered ledger fails closed. Back up `.env` keys separately under your
own secure key-management policy. Filesystem access is trusted; a person who can
roll back both database and deletion ledger can bypass the restoration guarantee.

Changing embedding provider/model/dimensions requires a fresh provider store and
controlled re-ingestion; never point new embeddings at an old vector index.
Changing to a hosted endpoint does not migrate data. Physical backup/media erasure,
production access controls, hosted authentication, and deployment capacity remain
explicit production gates.

## Checks

```sh
npm run typecheck
npm test
```

Tests cover inactive behavior, actual enabled hook boundaries, identity spoofing,
event IDs, encryption, snapshots, leases, restart checkpoints, deadlines, pause,
retry classification, source-aware erasure, generation races, correction and
restoration barriers. No existing prompts or model/provider adapters were edited.
