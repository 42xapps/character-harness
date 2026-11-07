# Supermemory v5 long-term memory for Kloey

Plan agreed October 22, 2026. This file records the design and implementation gates;
the [qualification report](../reports/supermemory-implementation.md) records actual results.

## Goal and invariants

Provide durable, useful companion memory through a dedicated extension. Preserve
all existing prompts, character configuration, chat model, STT, TTS, animation,
world context and existing extension behavior. Memory is opt-in; qualification
failure must leave current conversations working exactly as before.

- Local first with `gemma4:12b-mlx` in Ollama; no cloud fallback.
- English-only initially, using local `Xenova/bge-base-en-v1.5`, 768 dimensions.
- Hard isolation for each authenticated user–companion instance pair.
- Remember eligible conversations after enablement until deleted.
- No automatic import of Jev stores or development traces.
- Keys only in `.env`; manifests and configuration contain variable names.
- Initial estimate: 2–4 engineer-days for a qualified prototype; 5–8 engineer-weeks
  for complete local-first hardening, contingent on provider qualification.

## Architecture and contracts

`extensions/supermemory` owns learning, retrieval, durable writes and management.
It writes only `state.ext.supermemory` and the prompt context it explicitly adds.
Character-specific extraction guidance and profile buckets live in a referenced
character configuration, not in runtime code.

The generic runtime supplies an optional trusted session principal, a unique
accepted-input event ID and timestamp, and a generation outcome. Existing session
and turn identifiers remain unchanged. The phone/model cannot select namespaces.
The local identity resolver is explicitly development-only; production callers
must supply principals from authenticated backend connections.

The application maps relationship identities to opaque namespaces. An encrypted
SQLite journal/outbox persists accepted input before generation, finalizes outcomes
after turns, and quarantines uncertain work. A single leased worker serializes
namespace writes and persists acceptance/processing checkpoints. Profiles and
relevant search results rebuild a bounded memory context each turn.

Public service operations: `enqueueConversation`, `getProfile`, `recall`, `list`,
`previewForget`, `forget`, `correct`, `deleteRelationship`, pause/resume, and local
inspection/reconciliation. Recall exposes provenance, time, truth/inference flags
and availability behind an adapter for the pinned official TypeScript v5 SDK.

Deletion suppresses recall immediately, fences in-flight writes, invalidates caches,
removes affected retained sources and retires the old namespace. Rebuild occurs
only after erasure. An independently retained signed deletion ledger prevents
supported backup restoration from reinstating erased relationships.

Tolan's published design motivates per-turn reconstruction from persona, recent
dialogue, retrieved memory, tone and app signals. Supermemory owns extraction and
consolidation; no additional LLM summarizer or nightly compressor is justified
until evaluation shows a need. Its published latency is not a local measurement.
[Tolan architecture](https://openai.com/index/tolan/).

## Phase 0 — Engine and model qualification (2–4 days)

Use a fresh synthetic-only store; preserve installed user stores. Pin and record
server/SDK/model/embedding identities. Isolate Ollama settings from application
chat-provider settings. Disable telemetry and update checks; verify actual egress
before claiming offline operation. Exercise ingestion, status, dynamic/instant
dreaming, all search modes, source/graph attachments, profiles, buckets, settings,
correction and deletion. Measure cold start, resource usage, backlog and concurrent
recall. A document marked done is not proof that learned memories exist.

**Exit:** reproducible contract and quality evidence. Failure prevents activation.

References: [quickstart](https://supermemory.ai/docs/self-hosting/quickstart),
[configuration](https://supermemory.ai/docs/self-hosting/configuration),
[providers](https://supermemory.ai/docs/self-hosting/providers),
[embeddings](https://supermemory.ai/docs/self-hosting/embeddings),
[saved OpenAPI](../../supermemory-docs/supermemory-api.json).

## Phase 1 — Identity, journal and adapter (4–6 days)

Implement trusted relationship identity, opaque namespace mapping, unique durable
input IDs, encrypted SQLite storage, outbox snapshots and checkpoints. Serialize
writes, bound backlog/retries, quarantine incomplete input, and expose dead letters.
Distinguish accepted, chunks-ready and learned/profile-ready states. Handle 401/403,
429, schema failures, network failures, provider processing failure and storage failure.

**Exit:** crash/replay/deduplication/isolation tests pass without changing replies.

References: [architecture](../architecture.md), [extensions](../extensions.md),
[v5 reference](https://supermemory.ai/docs/v5/api-reference/overview),
[v5 migration](../../supermemory-docs/feature-research-2026-10-09/v5-migration.md).

## Phase 2 — Learning and temporal truth (4–6 days)

Send role-labelled, dated conversation text directly to Supermemory. Use bounded
segments (at most 16 exchanges / 6,000 tokens), stable IDs and one consistent
growing-prefix strategy. Persist every eligible turn locally; flush after four
exchanges, 30 seconds or session end. Default to memory processing with dynamic
dreaming. Treat assistant output as generated, with playback unverified. Preserve
eligible failed/interrupted user inputs; exclude privacy/moderation-cancelled input.
Keep human, third parties, hypothetical examples and fictional character lore distinct.

**Exit:** corrections supersede old facts; hypothetical events and assistant
suggestions do not become user biography or completed actions.

References: [supplied rules](../../supermemory-docs/Rules-of-supermemory.md),
[graph memory](https://supermemory.ai/docs/concepts/graph-memory),
[processing](https://supermemory.ai/docs/concepts/how-it-works),
[customization](https://supermemory.ai/docs/concepts/customization).

## Phase 3 — Recall and natural continuity (4–6 days)

Prefetch static/dynamic profiles and topical buckets; cache per relationship and
generation with short TTL. Recall from the latest input plus a bounded recent
window, deduplicate, preserve provenance and exclude forgotten, superseded and
inferred facts from ordinary personalization. Start with a 300 ms recall deadline
and a conservative 1,500-token ceiling. Fall back without delaying speech. Treat
source chunks as historical evidence. Current explicit user corrections override
stale context. Keep all retrieved content below persona/rules in authority.

Evaluate query rewriting and reranking before enabling on deeper-recall paths.
Use profile context for greetings without forcing intrusive personal reminders.

**Exit:** improved multi-session continuity within the latency budget, with no
confident claims from outdated history or speculative inference.

References: [search](https://supermemory.ai/docs/recall/search),
[profiles](https://supermemory.ai/docs/recall/user-profiles),
[buckets](https://supermemory.ai/docs/user-profiles/buckets).

## Phase 4 — Ownership, correction and deletion (4–6 days)

Provide trusted backend/local controls to inspect, pause/resume, correct, forget
and delete all. Preview semantic forgetting, then apply authenticated exact-ID
selection. Handle partial failures explicitly. Distinguish fact forgetting,
document deletion and namespace deletion. Remove relevant sources and pending
snapshots; rebuild from retained evidence behind a deletion generation barrier.
If provenance is incomplete, require explicit acknowledgement of a broader reset.
Keep deletion effective across caches, aggregates, related edges, replay and restore.
Do not claim erasure before provider deletion completes. Exclude secrets and raw audio.

**Exit:** deletion survives restart, retry, later ingestion and supported restoration.

References: [exact forget](../../supermemory-docs/feature-research-2026-10-09/v5-forget.md),
[semantic forget](../../supermemory-docs/reference-pages-python/delete-ns-namespace-memories-semantic.md),
[document deletion](../../supermemory-docs/reference-pages-python/delete-ns-namespace-document.md),
[namespace deletion](../../supermemory-docs/reference-pages-python/delete-ns-namespace.md).

## Phase 5 — Evaluation and operations (5–8 days)

Compare no-memory, profile-only and hybrid recall on multi-session synthetic English
conversations. Measure extraction, retrieval and answer behavior separately. Cover
facts, episodes, relationships, dates, emotional context, multi-hop questions,
unanswerable questions, negation, ambiguous references, fiction and injection.
Exercise concurrent sessions, reused turn IDs, crashes, outages, stalled ingestion,
disk exhaustion, backups and restoration. Monitor aggregate latency/backlog/failures
without personal-content logs. Pin upgrades and document embedding migration.

**Release targets:** zero cross-relationship disclosures or deletion resurrection;
90% explicit-fact recall; 95% correct abstention; 95% correction handling; bounded
300 ms recall/fallback; bounded queues; all existing checks green. These targets
require measured evidence and are not claims of current capability.

Rollout: disabled → synthetic qualification → explicit local opt-in → authenticated
production qualification. Disabling memory never activates Jev.

References: [MemoryBench](https://supermemory.ai/docs/memorybench/overview),
[custom evaluations](../../supermemory-docs/feature-research-2026-10-09/memorybench-custom.md),
[scoring](../../supermemory-docs/feature-research-2026-10-09/memorybench-scoring.md).

## Feature boundaries

Core: extraction/dreaming, temporal graph, profiles/buckets, hybrid/source recall,
metadata/supporting context, inspection, exact/semantic forgetting and deletion.
Graph attachments inform audit/temporal grounding; old related nodes must not be
silently injected as current facts. Inference summaries without verifiable lifecycle
remain excluded. Rewrite/rerank are evaluation-gated. SuperRAG, files/media/URLs and
connectors are later explicit-permission work. Hosted scoped keys, connectors and
managed scale are not assumed present in the local binary.

Confirm license/capacity before production; the local startup reports a 10,000
document lite limit. Hosted migration requires an explicit data migration/privacy
decision, not only changing the endpoint.
[Local versus Enterprise](https://supermemory.ai/docs/self-hosting/local-vs-enterprise).
