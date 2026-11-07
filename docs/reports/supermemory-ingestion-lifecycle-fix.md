# Ingestion lifecycle correction — October 22, 2026

The application incorrectly marked accepted documents as failed after ten minutes
measured from local outbox creation, including time spent waiting before submission.
It also held all later namespace submissions until the first document completed.
Together, these caused premature failures and an accumulating conversation backlog.

## Documented contract

- The [processing lifecycle](https://supermemory.ai/docs/concepts/how-it-works)
  distinguishes queued/extracting/chunking/embedding/indexing, document `done`, and
  later memory extraction. Age alone is not a documented failure response.
- [Dynamic dreaming](https://supermemory.ai/docs/ingestion/add-memories)
  groups related inputs and is the recommended ongoing-conversation mode. Document
  readiness and extracted-memory readiness must be tracked separately.
- [Stable-ID updates](https://supermemory.ai/docs/migration/api-v5-document-updates)
  use append/diff semantics. Existing immutable growing-prefix snapshots and stable
  document IDs are retained; replacement APIs and instant dreaming are not substituted.

The saved local lifecycle guide agrees with these contracts. The installed binary's
observed 15-minute dreaming trigger is not a general document-queue SLA and does
not establish the cause of a queued document. The earlier explanation conflated them.

## Change

The worker no longer converts queued/processing or ongoing dreaming into failure
based on outbox age. It polls pending processing at bounded intervals (2/10/30
seconds), with metadata-only counters for long waits. Explicit provider failures
and bounded transport retry exhaustion still produce dead letters. Queue capacity
remains bounded by the existing admission limit.

Submissions remain ordered within each relationship, including retries. API-accepted
writes no longer block later submissions. Processing checks run independently and
survive restart without resubmitting accepted sources. `done` and learning completion
remain distinct; missing dreaming status remains unknown.

No identity, memory namespace, data directory, embeddings, character prompt, chat
model, voice, hearing, animation or recall policy changed. The app server was
briefly restarted to activate the worker changes; its in-memory chat history reset.

## Verification

All **193 tests** and TypeScript checks passed. New regressions exercise hour-old
queued work across restart, eventual completion without duplicate submission,
retry ordering, delayed dreaming and explicit provider failure.

Seven premature failures were reconciled only after the provider confirmed their
source exists at an equal or newer revision and is not failed. Existing source
documents were not resent during that recovery. Metadata-only recovery evidence
is retained privately in `.cache/supermemory/timeout-recovery.json`.

The corrected worker submitted the remaining eight outbox snapshots. After
recovery and draining, 22 updates were document-ready and 16 were provider-accepted,
with zero local pending jobs and zero dead letters; all 72 finalized inputs remain.
The provider reported six done source documents and three queued documents at that
observation. This proves submission no longer waits on the first queued document;
it does not yet prove the provider's queued documents have finished.

## Live outcome and remaining provider issue

An isolated instant-processing synthetic probe did not finish within 90 seconds.
After restarting only the dedicated memory engine against the same encrypted
store, a fresh identical test completed document processing and fact extraction
in 18.3 seconds. Both test namespaces were removed. This establishes recovery of
new processing after restart, not the private engine's underlying root cause.

One of the three queued real documents subsequently completed. The worker then
confirmed 29 ready updates, nine still accepted, zero local pending jobs, zero
dead letters and all 72 finalized user inputs preserved. The nine accepted
snapshots refer to two source documents that still report queued.

Supported reprocessing was attempted under the worker lease on those two source
documents, using their exact retained published snapshots after matching provider
revision numbers. Queued document reads exposed no canonical text, so the original
encrypted outbox was used rather than inventing or summarizing a source. Dynamic
reprocessing and then one-time instant reprocessing were accepted but did not
complete during observation. Normal ingestion remains dynamic.

A final bounded attempt added only a trailing newline to each recovered source
and requested instant processing. The documents initially remained queued and
subsequently completed. The elapsed sequence does not establish which recovery
action or scheduler timing caused completion.
No statement was removed or reworded, and IDs and user metadata were retained.
The normal journal snapshots and character prompts were not changed. Audits live
privately under `.cache/supermemory/provider-queue*-recovery.json` and
`.cache/supermemory/provider-newline-recovery.json`.

[Upstream issue #1302](https://github.com/supermemoryai/supermemory/issues/1302)
describes unchanged-content reprocessing being skipped in server 0.0.5. It is
relevant to the observed no-progress retries, but does not prove the same cause
in this installed 0.0.9 server. No new store, duplicate source IDs, wipe, or direct
provider database modification was used to hide the remaining queued documents.

## Final verified state

The local worker defect is fixed and deployed. All nine relationship documents
now report `done`; all 38 local source-update checkpoints are complete, with zero
pending, accepted or failed jobs. All 72 finalized inputs remain in the same
encrypted journal and namespace. The two recovered canonical texts were verified
by SHA-256 against the retained originals, allowing only the documented trailing
newline. Their document IDs and revision metadata were preserved.

Document readiness does not certify graph completion: the recovered documents had
no attached memories at the source-integrity check, and the engine subsequently
logged a memory agent starting. Missing `dreamingStatus` remains unknown. The
separate synthetic extraction probe did pass after restart. The private engine's
internal queue-stall cause is not established, and the one-time recovery operations
are not installed as automatic content mutations or a change to normal dynamic mode.

GPT-OSS's previously reported employer-supersession failure is unrelated and remains
unresolved. See [final metadata-only verification](supermemory-ingestion-lifecycle-verification.json).
