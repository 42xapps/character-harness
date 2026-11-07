# Supermemory API v5 reference pages (Python)

Generated offline from `../supermemory-api.json` (API 5.0.0, 32 operations). These are OpenAPI-derived reference pages; they are not a live scrape or provider qualification.

Snapshot SHA-256: `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`.

Regenerate: `python3 supermemory-docs/generate_reference_pages.py`. Check: `python3 supermemory-docs/generate_reference_pages.py --check`.

The generator uses each operation's method/path as its filename and checks exact coverage. Examples are preserved from the snapshot and may contain placeholders; consult schemas and the current official migration guide.

- [Add document — POST /ns/{namespace}/document](post-ns-namespace-document.md)
- [Add or update profile buckets — PUT /ns/{namespace}/profile/buckets](put-ns-namespace-profile-buckets.md)
- [Batch add documents — POST /ns/{namespace}/document/batch](post-ns-namespace-document-batch.md)
- [Create connector — POST /ns/{namespace}/connectors](post-ns-namespace-connectors.md)
- [Delete connector — DELETE /ns/{namespace}/connectors/{id}](delete-ns-namespace-connectors-id.md)
- [Delete documents — DELETE /ns/{namespace}/document](delete-ns-namespace-document.md)
- [Delete namespace — DELETE /ns/{namespace}](delete-ns-namespace.md)
- [Delete profile buckets — DELETE /ns/{namespace}/profile/buckets](delete-ns-namespace-profile-buckets.md)
- [Forget memories by ID — DELETE /ns/{namespace}/memories](delete-ns-namespace-memories.md)
- [Forget memories semantically — DELETE /ns/{namespace}/memories/semantic](delete-ns-namespace-memories-semantic.md)
- [Get connector — GET /ns/{namespace}/connectors/{id}](get-ns-namespace-connectors-id.md)
- [Get document — GET /ns/{namespace}/document/{id}](get-ns-namespace-document-id.md)
- [Get memory — GET /ns/{namespace}/memories/{id}](get-ns-namespace-memories-id.md)
- [Get namespace settings — GET /ns/{namespace}](get-ns-namespace.md)
- [Get organization settings — GET /organization](get-organization.md)
- [Get profile buckets — GET /ns/{namespace}/profile/buckets](get-ns-namespace-profile-buckets.md)
- [Get profile — POST /ns/{namespace}/profile](post-ns-namespace-profile.md)
- [List all connectors — GET /connectors](get-connectors.md)
- [List connectors — GET /ns/{namespace}/connectors](get-ns-namespace-connectors.md)
- [List namespaces — GET /namespaces](get-namespaces.md)
- [List namespaces — GET /ns](get-ns.md)
- [List resources — POST /ns/{namespace}/list/{type}](post-ns-namespace-list-type.md)
- [Partially update document file — PATCH /ns/{namespace}/document/file/{id}](patch-ns-namespace-document-file-id.md)
- [Replace document with file — POST /ns/{namespace}/document/file/{id}](post-ns-namespace-document-file-id.md)
- [Search memories — POST /ns/{namespace}/search](post-ns-namespace-search.md)
- [Send feedback — POST /feedback](post-feedback.md)
- [Sync connector — POST /ns/{namespace}/connectors/{id}/sync](post-ns-namespace-connectors-id-sync.md)
- [Update connector — PATCH /ns/{namespace}/connectors/{id}](patch-ns-namespace-connectors-id.md)
- [Update document — PATCH /ns/{namespace}/document/{id}](patch-ns-namespace-document-id.md)
- [Update namespace settings — PATCH /ns/{namespace}](patch-ns-namespace.md)
- [Update organization settings — PATCH /organization](patch-organization.md)
- [Upload file — POST /ns/{namespace}/document/file](post-ns-namespace-document-file.md)
