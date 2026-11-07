# Supermemory implementation and qualification — October 22, 2026

## Release status

**Active for the explicitly requested local iPhone test.** The manifest now loads
six extensions, including Supermemory, with `enabled: true` and `qualified: true`.
The configuration flag enables the local integration; it does not certify the
remaining production release gates. See the latest
[iPhone activation evidence](supermemory-iphone-test.md).

The user subsequently selected **GPT-OSS 20B through Ollama Cloud**. The dedicated
service now uses `gpt-oss:20b-cloud` with low reasoning; embeddings and storage
remain local. All six existing documents and 24 saved memory IDs survived the
restart in the same namespace. See [model-switch evidence](supermemory-gpt-oss-switch.json).
The earlier Gemma results below remain historical evidence for that configuration.
GPT-OSS Cloud passed nine of ten core live fixtures; employer supersession failed
because the previous employer remained current alongside the newly learned employer.
The requested cloud configuration remains active for testing, with that model
quality limitation recorded in the [cloud verification report](supermemory-gpt-oss-cloud-verification.json).

Core live checks now pass extraction, profiles, recall, temporal correction,
namespace isolation, semantic preview, exact forgetting and namespace erasure.
The phone's own accepted inputs are being journaled, indexed and retrieved. The
installed server batches dynamic learning at roughly 10000 tokens or 15 minutes;
earlier four-minute lifecycle tests ended before that window. Extended observation
confirmed extracted preferences and profile updates through the encrypted journal,
followed by successful suppression and provider erasure of the synthetic relationship.
See the [local verification report](supermemory-local-verification.json). No earlier
Jev/development conversations were imported.

| Phase | Status |
| --- | --- |
| 0 — Provider qualification | Core contract, dynamic learning/profile updates and journal erasure checks pass with tuned local Gemma and a narrow JSON compatibility gateway; full quality and operational qualification remain open |
| 1–4 — Identity, durability, learning/recall hooks and ownership controls | Local implementation and deterministic tests; live source persistence/recall working on the phone |
| 5 — Evaluation and operations | Full answer-quality, load, egress and production authentication gates remain open |

## Preservation of current behavior

The following existing files were checked against Git HEAD and remain byte-for-byte
unchanged: persona prompt, world-context configuration, director
configuration, reactions configuration, and the chat, STT and TTS adapters. There
are no player, iOS, animation or engine source changes. The character manifest
adds only the Supermemory extension; the original five entries and models are unchanged.

Runtime additions are generic and additive: optional server principal, unique
input-event identity, explicit generation outcome and optional extension disposal.
A regression test verifies that these fields never enter the model's messages,
that client principal/namespace/event-ID spoofing is ignored, and that reused
turn numbers receive distinct server-generated event IDs. Existing extensions
without a disposer retain their prior stop behavior.

The provided service key is stored only in ignored `.env`; a separate journal key
is also present there. Chat/voice provider credentials were not changed. The user's
running instance at port 6767 was subsequently tested with a separate synthetic
namespace, which was removed. The active phone integration uses its own store on
6779 and its own named key; unrelated existing namespaces remain separate.

## Implemented and locally verified

- Pinned official TypeScript SDK 5.0.2; explicit v5 namespace calls and response
  adapter, HTTP redirect rejection, bounded response size, timeouts and cancellation.
- Trusted server identity with isolated namespaces per user–companion instance.
  Development identity requires explicit configuration and is rejected in production.
- AES-256-GCM encrypted SQLite journal/outbox, immutable prefix snapshots, stable
  IDs, FULL synchronization, checkpointed processing, bounded admission and retries,
  dead letters and cross-process worker leases.
- Eligible user evidence survives failed/interrupted generation. Uncertain inputs
  are quarantined, with explicit retain/discard reconciliation. Generated assistant
  text is always labelled playback-unverified.
- Bounded hybrid recall and profile hydration/cache, current-fact filtering,
  inference exclusion, provenance and graph audit evidence. Current prompt content
  stays an unchanged prefix when recall is enabled. Disabled operation is a no-op.
- Local inspection, pause/resume, explicit remember, semantic preview, exact-ID
  forgetting, source-aware namespace rebuild, correction and relationship deletion.
- Signed generation barriers prevent late recalls/writes/corrections from crossing
  a newer deletion. A failed erasure stays suppressed, including after reopening.
- Queued namespace deletion is never counted as erasure completion. Chunk readiness
  and dreaming readiness have distinct durable checkpoints. Selective source rebuild
  is separately disabled until live tests establish that retained duplicate/derived
  evidence cannot recreate the forgotten fact; the safe default requires explicit
  acknowledgement of a complete relationship reset.
- Encrypted backup and restore tools apply the independently retained deletion ledger.
  A real CLI smoke drill created a synthetic backup, deleted its relationship,
  restored the older backup and confirmed zero restored inputs/jobs, with that
  relationship paused and erasure still pending.
- Synthetic retrieval corpus and evaluation tooling compare none/profile/hybrid
  context. They intentionally do not claim answer-level or abstention measurements.

See [operations and activation](../../extensions/supermemory/README.md) and the
[phased design](../plans/supermemory-v5-long-term-memory.md).

## Historical qualification evidence before the local configuration fix

Environment: server 0.0.9; SDK 5.0.2; Ollama `gemma4:12b-mlx`;
local `Xenova/bge-base-en-v1.5`, 768-dimensional embeddings. The synthetic test
instance used port 6779 and a separate repository-ignored store. It was stopped
after testing; the user's server on 6767 was left running.

### First probe

- Ingestion accepted in approximately 47 ms; namespace settings and buckets accepted.
- Chunks reached `done` in approximately 28 seconds, including first-run embedding
  model download. Source/hybrid searches returned the synthetic source in 22–36 ms.
- Learned-memory search returned no facts; profiles and memory listing were empty.
- The engine subsequently logged memory-agent completion after approximately
  78.9 seconds with **zero memories**.
- Semantic-forget preview exceeded the 10-second client deadline.
- Workflow logs included `envoy lost threshold` and actor persistence/shutdown errors.
- Namespace deletion returned success. That does not independently prove protection
  against resurrection from still-running provider workflows.

### Repeat probe

Repeated after adding an explicit wait for learned facts. Ingestion/settings/buckets
were accepted, but processing did not complete within 180 seconds and learned facts
did not become available during a further 180-second search window. Profiles and
memory listing remained empty. Semantic preview again timed out. The full latest
synthetic report is [supermemory-qualification.json](supermemory-qualification.json).

### Diagnostics

A separate synthetic Ollama call successfully produced a `save_fact` tool call in
approximately 5.1 seconds. This confirms basic tool-call transport; it does not
prove compatibility or quality with Supermemory's complete agent prompt.

A fresh isolated experiment with `WORKFLOW_ENGINE=direct` was rejected on startup:
v0.0.9 has removed that engine and requires Rivet. This option is not a workaround.

An upstream report describes done documents with zero memories after local-model
timeouts, but concerns server v0.0.5. It is relevant diagnostic context, **not a
confirmed cause of this v0.0.9 failure**:
[upstream issue #1300](https://github.com/supermemoryai/supermemory/issues/1300).
The downloaded local server implementation is not in the public source checkout.

## Remaining gates

1. Repeat local qualification on upgrades and expand beyond the small successful
   fixtures. Dynamic extraction/profile learning now passes with the installed Gemma
   weights; no cloud fallback occurred.
2. Expand correction, temporal/multi-hop reasoning and deletion-resurrection tests,
   including late provider workflows and profile aggregates. The basic employer
   correction and synthetic journal-to-erasure lifecycle already pass.
3. Measure fact recall, correction accuracy and answer-level abstention against the
   agreed 90% / 95% / 95% targets. The full corpus evaluation was not run against
   the failing engine; no score is claimed.
4. Verify egress after first download, resource limits, sustained ingestion/recall
   latency, disk exhaustion and shutdown behavior on the deployment hardware.
5. Integrate real hosted authentication and authorize management calls before
   multi-user deployment. The local CLI is an operator interface, not phone UI.
6. Confirm licensing/capacity and backup/key-management policies. Startup reports a
   10,000-document lite limit. Hosted connectors, scoped keys and managed scale are
   not features this local extension can manufacture.

Conservative initial limits: serialized input at most 4,000 bytes, retained assistant
output at most 1,000 bytes, segments at most 16 exchanges / 6,000 bytes, context at
most 1,500 bytes. Oversized user input is skipped whole and counted. These limits
fit beneath the planned token ceilings and should be tuned only after measurement.
Aggregated profiles and inference-based personalization remain excluded until their
lifecycle/provenance can be qualified. Rewrite/rerank, SuperRAG, media and connectors
remain deferred as specified in the plan.

Long-term deletion does not delete the phone's existing conversation history,
independent development traces, or old encrypted backup media. Supported restoration
honors current deletion barriers; an administrator who rolls back both the ledger
and the database is outside that guarantee.

## Verification

TypeScript checks pass using Node 26.0.0. All **193 tests pass**, including
the original 152 tests and 41 added memory/runtime regressions. The encrypted CLI
backup/restore drill passes. `git diff --check` passes. Core live checks now pass as described in the linked activation report. This
implementation must not be described as a completed production rollout.

The subsequent [ingestion lifecycle correction](supermemory-ingestion-lifecycle-fix.md)
removes false age-based failures and separates ordered submission from processing.
It is deployed; all nine documents and 38 outbox checkpoints reached document-ready
status after recovery, with no remaining queued or failed writes. Graph readiness
remains a separate checkpoint, not inferred from document completion.
