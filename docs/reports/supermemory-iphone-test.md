# Local iPhone memory activation — October 22, 2026

Kloey is installed on m0saan’s iPhone (00008110-0012494E1429401E). The physical UI check passed and the original persona, world, director, reactions, chat model, hearing and voice adapters remain unchanged. The manifest adds only the Supermemory extension.

## Current configuration

- Memory enabled and the operator qualification flag set true for this requested local test. This does not certify the remaining production gates.
- Dedicated Supermemory 0.0.9 on loopback 6779; original user service on 6767 preserved.
- Official SDK 5.0.2, local bge-base-en-v1.5 embeddings (768 dimensions).
- User-requested model switch: gpt-oss:20b-cloud through the signed-in Ollama service and existing loopback gateway; low reasoning effort. Memory processing now uses Ollama Cloud explicitly. Companion GPT-6 Luna remains unchanged.
- Loopback gateway supplies the response schema missing from the server’s semantic-forget selection request. The prior Gemma qualification below describes the earlier local inference configuration.
- Stable local relationship identity and encrypted journal; no old Jev or development conversations imported. Root .env contains the dedicated service key under SUPERMEMORY_LOCAL_API_KEY; the original service key and chat/voice keys are preserved.

## Measured evidence

The model switch preserved all six existing documents and 24 existing memory IDs
in the same namespace and `.cache/supermemory-tuned/data` store. Neither the
original service on 6767 nor the data directory from the example command was
used. See [model-switch preservation evidence](supermemory-gpt-oss-switch.json).

GPT-OSS Cloud passed nine of ten core synthetic checks, including extraction,
profiles, recall, isolation, semantic preview and erasure. Employer supersession
failed: the new employer was learned while the previous employer remained marked
current. The requested cloud model remains active for testing, with that quality
limitation recorded in the [cloud verification report](supermemory-gpt-oss-cloud-verification.json).
All 190 deterministic tests and TypeScript checks pass.

The corrected synthetic run passed namespace settings and five buckets, five explicit facts, grounded memory/hybrid recall, profiles, hypothetical/suggestion handling, isolation, employer correction, semantic preview, exact forgetting, and namespace erasure. Recall took approximately 20–55 ms in those small fixtures. The local journal also recalled its source after reopening. Full-suite results: 189 tests pass; TypeScript and the enabled character check pass.

The first test run incorrectly tried namespace settings before ingestion created the namespace, and matched “no longer works at Cedar” as a current employer. Both fixture bugs were corrected. Earlier lifecycle tests stopped after four minutes, before dynamic dreaming’s 15-minute batching window. Extended observation confirmed that dynamic ingestion through the encrypted journal produces extracted preferences and profile entries, including across an engine restart. Immediate suppression and the durable erasure worker were then verified against that synthetic relationship. The original and corrected observations are retained in the [local verification report](supermemory-local-verification.json); these small fixtures do not establish a full production quality score.

## Live verification

The server started with all six extensions at 05:18:52 UTC. Its first phone turn was durably retained; recall completed in 37 ms with no prior memories. Metadata-only events distinguish input retention, API acceptance, chunk readiness, profiles, recall and context preparation. Conversations before this activation were not retained and are not imported.

At 05:31 UTC, the phone relationship had 38 finalized inputs and 19 source updates at chunk-ready status, with no pending jobs, dead letters or erasures. All 38 turn recalls completed in 20–73 ms; later searches returned up to 12 entries. These entries include source chunks and do not prove extracted facts exist yet. The phone's profile remained empty ahead of its first dynamic batch. An independent process reopened the encrypted journal and retrieved usable memory context in 36 ms. The app server, memory engine and local inference gateway were all listening. Existing engine errors predated this phone activation; no errors appeared in the active conversation server log.

Subsequent visual verification of the built-in console at **http://localhost:6779/#memory** confirmed five documents, 23 memory entries and a populated graph in the real phone relationship. This confirms extraction has now occurred for that relationship, beyond the earlier source-only recall. The console includes historical lifecycle entries; its count is not a count of distinct current facts. The service on port 6767 has a different store and does not contain these conversations. The connected console was left open for the user; its key is held only in that tab.

## Production boundaries

This remains a local development identity, rejected in NODE_ENV=production. Authenticated deployment, a full answer/abstention evaluation, sustained load/failure/restore drills, egress observation, licensing/capacity review and safe selective source rebuilding remain release gates. The v0.0.9 document API omits dreamingStatus; unknown completion remains explicitly unknown. Ordinary dynamic dreaming needs roughly 10000 pending tokens or 15 minutes plus the coordinator interval.

Initial management remains the trusted local CLI. Saying “forget” in dialogue is not a substitute for confirmed deletion through those controls. Selective erasure remains disabled; a matching forget may require an explicitly acknowledged relationship reset to prevent old source chunks from restoring the fact.
