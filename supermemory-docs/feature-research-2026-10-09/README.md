# Official Supermemory feature-research sources

Fetched 9 October 2026 for the [Tolan comparison](../../ios/docs/supermemory-tolan-feature-map-2026-10-09.md). These are unmodified public source downloads, not provider qualification. [Manifest](sources.json) records exact URLs, HTTP statuses, sizes and SHA-256 hashes. No credentials were used.

## Authority and limitations

- Current v5 operation schemas and the migration guide take priority over generic examples. Some concept/integration guides mix legacy SDK names/routes or incorrectly place JSON options in query strings.
- `memory-review.md` documents legacy v3 review routes; no v5 review operation appears in the snapshot. `billing.md` also shows legacy v3 administrative endpoints. Neither is proposed for our v5 runtime.
- Python samples in public guides and generated references do not establish a released v5 Python SDK. Keep the existing async HTTPX adapter for this work.
- Live `openapi-v5.json` equals the saved `../supermemory-api.json` as parsed JSON: 32 operations, no schema differences. Different byte serialization produces a different hash.
- The archive preserves upstream Markdown, including relative links, images, examples and historical snippets. Use the official URL to follow its site navigation; the table below links the local copy.

## Download inventory

The [schema comparison artifact](schema-comparison.json) records parsed equality and the complete operation inventory.

| Local copy | Official URL | HTTP |
| --- | --- | --- |
| [graph-memory.md](graph-memory.md) | [Official source](https://supermemory.ai/docs/concepts/graph-memory.md) | 200 |
| [how-it-works.md](how-it-works.md) | [Official source](https://supermemory.ai/docs/concepts/how-it-works.md) | 200 |
| [customization.md](customization.md) | [Official source](https://supermemory.ai/docs/concepts/customization.md) | 200 |
| [profile-buckets.md](profile-buckets.md) | [Official source](https://supermemory.ai/docs/user-profiles/buckets.md) | 200 |
| [user-profiles.md](user-profiles.md) | [Official source](https://supermemory.ai/docs/recall/user-profiles.md) | 200 |
| [search-guide.md](search-guide.md) | [Official source](https://supermemory.ai/docs/recall/search.md) | 200 |
| [memory-review.md](memory-review.md) | [Official source](https://supermemory.ai/docs/recall/memory-review.md) | 200 |
| [rules.md](rules.md) | [Official source](https://supermemory.ai/docs/concepts/rules.md) | 200 |
| [billing.md](billing.md) | [Official source](https://supermemory.ai/docs/overview/billing.md) | 200 |
| [memorybench.md](memorybench.md) | [Official source](https://supermemory.ai/docs/memorybench/overview.md) | 200 |
| [memorybench-custom.md](memorybench-custom.md) | [Official source](https://supermemory.ai/docs/memorybench/extend-benchmark.md) | 200 |
| [memorybench-scoring.md](memorybench-scoring.md) | [Official source](https://supermemory.ai/docs/memorybench/memscore.md) | 200 |
| [agents-sdk.md](agents-sdk.md) | [Official source](https://supermemory.ai/docs/integrations/openai-agents-sdk.md) | 200 |
| [v5-add.md](v5-add.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/ingest/add-document.md) | 200 |
| [v5-search.md](v5-search.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/recall-search/search-memories.md) | 200 |
| [v5-profile.md](v5-profile.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/profiles/get-profile.md) | 200 |
| [v5-buckets.md](v5-buckets.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/profiles/add-or-update-profile-buckets.md) | 200 |
| [v5-namespace-settings.md](v5-namespace-settings.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/namespaces/update-namespace-settings.md) | 200 |
| [v5-organization.md](v5-organization.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/organization/update-organization-settings.md) | 200 |
| [v5-list.md](v5-list.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/content-management/list-resources.md) | 200 |
| [v5-forget.md](v5-forget.md) | [Official source](https://supermemory.ai/docs/v5/api-reference/content-management/forget-memories-by-id.md) | 200 |
| [v5-migration.md](v5-migration.md) | [Official source](https://supermemory.ai/docs/migration/api-v5.md) | 200 |
| [v5-recall-migration.md](v5-recall-migration.md) | [Official source](https://supermemory.ai/docs/migration/api-v5-recall.md) | 200 |
| [openapi-v5.json](openapi-v5.json) | [Official source](https://api.supermemory.ai/v5/openapi) | 200 |

## Re-fetch safely

Fetch only the public URLs listed in `sources.json`, without Authorization headers, preserving the response bytes and recording new hashes/date. Do not overwrite `supermemory-api.json` or regenerate operation pages merely because serialization changed. No account API or hosted synthetic namespace was accessed in this phase.
