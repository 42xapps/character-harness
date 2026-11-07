> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Migrate Supermemory v3/v4 to v5

> Upgrade legacy API calls to the namespace-scoped v5 API

## Migrate with an agent

The quickest path is one command in your project root. It scans the repo for v3/v4 usage, reads your Supermemory packages and AI SDK, builds a migration prompt for this project, and launches your coding agent with it:

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
npx supermemory@latest migrate            # pick your agent interactively
npx supermemory@latest migrate --agent codex
```

<Accordion title="No Node or no coding agent? Paste this prompt instead">
  This prompt fetches the guide as markdown and rewrites every legacy call:

  ```text theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  Migrate this repository from Supermemory v3/v4 to v5. Fetch https://supermemory.ai/docs/migration/api-v5.md and follow it. First write a checklist in your reply, not as a file in the repository, of every legacy call site and of every Supermemory-specific name in this codebase: containerTag, containerTags, customId, entityContext, filterByMetadata, filters, including option names, config keys, environment variables and tests. Migrate them one by one and tick each off. Rename those names to the v5 ones (namespace, id, supportingContext, group, filter) with no aliases. A document belongs to exactly one namespace in v5, so a containerTags array becomes one namespace. If an operation has no v5 replacement, do not invent one: keep going, and list it at the end with the alternative the guide suggests.
  ```
</Accordion>

## Migrate by hand

<Warning>
  This is a breaking API migration. Do not change only the URL: fields moved, search defaults changed, response envelopes changed, and some legacy operations have no v5 replacement.
</Warning>

The API base URL and bearer keys do not change.

**Where parameters live:** `GET` options go in the query string. `POST`, `PATCH`, and `PUT` options go in the JSON body, or as form fields on file uploads; the one exception is list pagination (`page`, `limit`, `sort`, `order`), which stays in the query string. `DELETE` options such as `moveTo` go in the query string, while bulk deletes send their `ids` in the JSON body. Routes reject options sent in the wrong place with `400`. v5 application routes are unversioned; [`/v5/reference`](https://api.supermemory.ai/v5/reference) is the interactive v5 reference, not an API path prefix.

## Recommended migration process

<Steps>
  <Step title="Inventory every legacy call">
    Search for `/v3/`, `/v4/`, `containerTag`, `containerTags`, `customId`, `entityContext`, `filterByMetadata`, `filters`, and legacy SDK methods such as `client.search.execute`, `client.profile`, and `client.connections.*`.
  </Step>

  <Step title="Resolve one namespace per request">
    Move the legacy `containerTag` into `/ns/{namespace}`. Never infer scope from a document or memory ID, and never send multiple namespaces to one v5 request.
  </Step>

  <Step title="Translate requests by domain">
    Apply [ingestion](/docs/migration/api-v5-document-writes), [updates](/docs/migration/api-v5-document-updates), [content management](/docs/migration/api-v5-document-reads), [search](/docs/migration/api-v5-recall), [profiles](/docs/migration/api-v5-profiles), [forgetting](/docs/migration/api-v5-memory-forgetting), [namespaces](/docs/migration/api-v5-settings), [organization](/docs/migration/api-v5-organization), and [filter](/docs/migration/api-v5-filters) changes independently.
  </Step>

  <Step title="Update response readers">
    Migrate envelopes, includes, pagination, profile buckets, system fields, and partial-error handling before switching traffic.
  </Step>

  <Step title="Verify legacy and v5 side by side">
    Follow the [verification and rollout guide](/docs/migration/api-v5-rollout). Compare identity and behavior—not raw JSON ordering—and set changed defaults explicitly during rollout.
  </Step>

  <Step title="Cut over one domain at a time">
    Switch traffic, monitor failures and semantic drift, then remove legacy compatibility code only after that domain passes verification.
  </Step>
</Steps>

## Upgrade the SDK

The v5 TypeScript SDK ships as the same `supermemory` package. Install it, then replace the legacy client:

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
npm i supermemory
```

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  import Supermemory from "supermemory"

  const client = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY })
  await client.add({ content: "new turn", containerTag: "user_1" })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  import { Supermemory } from "supermemory"

  const supermemory = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY })
  await supermemory.add("user_1", { content: "new turn" })
  ```
</CodeGroup>

Every v5 call takes one object. `namespace`, path IDs, and query parameters are top-level keys; the JSON body goes under `body`. Legacy `containerTag` never appears in a body again. There is no v5 Python SDK yet.

## Endpoint map

| Legacy | v5 | SDK method |
| - | - | - |
| `POST /v3/documents` | `POST /ns/{namespace}/document` | `supermemory.add` |
| `POST /v3/documents/batch` | `POST /ns/{namespace}/document/batch` | `supermemory.documents.batchAdd` |
| `POST /v3/documents/file` | `POST /ns/{namespace}/document/file` | `supermemory.documents.uploadFile` |
| `GET/PATCH /v3/documents/{id}` | `GET/PATCH /ns/{namespace}/document/{id}` | `supermemory.documents.get` / `supermemory.documents.update` |
| File replace or partial file update | `POST/PATCH /ns/{namespace}/document/file/{id}` | `supermemory.documents.replaceWithFile` / `supermemory.documents.updateFile` |
| Single or bulk document delete | `DELETE /ns/{namespace}/document` | `supermemory.documents.delete` |
| Legacy document or memory lists | `POST /ns/{namespace}/list/{type}` | `supermemory.list` |
| `POST /v3/search` or `/v4/search` | `POST /ns/{namespace}/search` | `supermemory.search` |
| `POST /v4/profile` | `POST /ns/{namespace}/profile` | `supermemory.profile` |
| `POST /v4/profile/buckets` | `GET/PUT/DELETE /ns/{namespace}/profile/buckets` | `supermemory.profiles.getBuckets` / `setBuckets` / `deleteBuckets` |
| Legacy memory forget routes | `DELETE /ns/{namespace}/memories...` | `supermemory.memories.forget` / `supermemory.memories.forgetMatching` |
| Container-tag settings and lifecycle | `/namespaces` and `/ns/{namespace}` | `supermemory.namespaces.list` / `get` / `update` / `delete` |
| `GET/PATCH /v3/settings` | `GET/PATCH /organization` | `supermemory.organization.get` / `update` |

### Connectors

Connector routes also move under the namespace. Legacy `containerTags` arrays become one namespace per connector.

| Legacy | v5 | SDK method |
| - | - | - |
| `POST /v3/connections/list` | `GET /ns/{namespace}/connectors` or `GET /connectors` | `supermemory.connectors.list` / `supermemory.connectors.listAll` |
| `POST /v3/connections/{provider}` | `POST /ns/{namespace}/connectors` | `supermemory.connectors.create` |
| `GET /v3/connections/{connectionId}` | `GET /ns/{namespace}/connectors/{id}` | `supermemory.connectors.get` |
| `POST /v3/connections/{connectionId}/configure` | `PATCH /ns/{namespace}/connectors/{id}` | `supermemory.connectors.update` |
| `DELETE /v3/connections/{connectionId}` | `DELETE /ns/{namespace}/connectors/{id}` | `supermemory.connectors.delete` |
| `POST /v3/connections/{provider}/import` | `POST /ns/{namespace}/connectors/{id}/sync` | `supermemory.connectors.sync` |

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const connection = await client.connections.create("notion", {
    containerTags: ["user_1"],
    redirectUrl: "https://app.example.com/connected",
  })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const { id, authorization } = await supermemory.connectors.create("user_1", {
    provider: "notion",
    redirectUrl: "https://app.example.com/connected"
  })
  ```
</CodeGroup>

`authorization` is `null` for config providers (`web-crawler`, `s3`, `granola`), which start syncing immediately. `connectors.sync` returns `{ id, status: "queued" }` and `409` when a sync is already running.

## SDKs, tools and the CLI

Check which client you call the API through before you translate requests. Both official SDKs speak v5; the integration packages do not yet.

| Client | v5 support | What to do |
| - | - | - |
| TypeScript SDK (`supermemory` on npm) | `5.0.0` and later | Run `npm i supermemory` and follow the SDK changes below. Versions before 5.0.0 use the v3/v4 surface. |
| Python SDK (`supermemory` on PyPI) | `5.0.0` and later | Run `pip install -U supermemory`. Calls take the namespace first, then keyword arguments: `client.add("user_alex", content="...")`. Versions before 5.0.0 use the v3/v4 surface. |
| `@supermemory/tools` (AI SDK, OpenAI, Mastra, VoltAgent, Claude memory) | `3.0.0` and later | Calls v5 and uses the v5 names. The config takes one `namespace` instead of `containerTags` or `projectId`, and `withSupermemory` takes `namespace` and `id` instead of `containerTag` and `customId`. See [Upgrading tools to 3.0](/docs/migration/tools-v3-upgrade). `@supermemory/ai-sdk` is retired; import from `@supermemory/tools/ai-sdk`. |
| CLI (`npx supermemory`) | `supermemory` 5.x | The CLI ships inside the npm package and now calls v5. `--tag` is `--namespace`, `SUPERMEMORY_TAG` is `SUPERMEMORY_NAMESPACE`, `supermemory tags` is `supermemory namespaces`, and `remember`, `update` and `tags merge` are gone (use `namespaces delete --move-to`). |
| `supermemory local` | Server v0.0.9 and later | Older local servers only serve v3/v4. Run `supermemory-server upgrade` before using the 5.x SDKs or CLI against it. |

### TypeScript SDK changes

The v5 SDK scopes every content call to one `namespace`, passed first. URL values (`namespace`, then `id` where there is one) are positional; everything else goes in one object:

```ts theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
import { Supermemory } from "supermemory";

const client = new Supermemory(); // reads SUPERMEMORY_API_KEY, as before

// v4
await client.add({ content: "Alex prefers morning meetings.", containerTag: "user_alex" });

// v5
await client.add("user_alex", { content: "Alex prefers morning meetings." });
await client.documents.get("user_alex", "doc-1", { include: ["chunks"] });
```

<Note>
  If your code passes a `containerTags` array, pick one namespace. A v5 document lives in exactly one namespace, so there is no multi-tag write to translate. Code that read across several tags runs one call per namespace and merges the results.
</Note>

| v4 | v5 |
| - | - |
| `client.search.memories({ q, containerTag })` | `client.search(namespace, { query })` |
| `client.profile({ containerTag, q })` | `client.profile(namespace)`; profile no longer takes a query, call `client.search` separately if you need results |
| `client.documents.list(...)`, `client.memories.list(...)` | `client.list(namespace, "documents" \| "chunks" \| "memories", { filter? })` |
| `client.containerTags.*` | `client.namespaces.*` |
| `client.connections.*` | `client.connectors.*` (`create`, `list`, `listAll`, `get`, `update`, `delete`, `sync`) |
| `client.settings.{get, update}` | `client.organization.{get, update}` |
| `containerTag`, `customId`, `q`, `filters` | `namespace` argument, `id`, `query`, typed `filter` |
| `APIError`, `NotFoundError`, `RateLimitError`, … | `SupermemoryError` (`statusCode`, `body`); `NotFoundError`, `UnauthorizedError`, `ConflictError`, … for common statuses; `SupermemoryTimeoutError` |
| `timeout` (ms), `baseURL`, `defaultHeaders` | `timeoutInSeconds`, `baseUrl`, `headers`; `maxRetries` still defaults to 2 |

Some v4 methods are gone from the v5 SDK. Most have a v5 way to do the same thing:

| v4 method | v5 |
| - | - |
| `conversations.add({ containerTag, messages })` | `client.add(namespace, { content, id })`. Pass the conversation text as `content` and a stable `id` per conversation (for example the session id). Repeating the same `id` updates that document, so one conversation stays one document. |
| `memories.add(...)` | `client.add(namespace, { content, dreaming: "instant" })`. Memories come from documents; there is no direct memory write. |
| `memories.updateMemory(...)` | Update the source document with `client.documents.update(namespace, id, { content })`. |
| `documents.search(...)` | `client.search(namespace, { query, searchMode: "chunks" })` |
| `documents.chunks(id)` | `client.documents.get(namespace, id, { include: ["chunks"] })` |
| `documents.listProcessing()` | `client.list(namespace, "documents")` and read `system.status` on each item |
| `containerTags.merge(...)`, `mergeStatus(...)` | `client.namespaces.delete(source, { moveTo: target })`. One source per call; the response carries an `operationId`. |
| `memories.forget({ content })` | `client.memories.forgetMatching(namespace, { query, dryRun: true })` to preview, then `memories.forget(namespace, { ids })` |

Gone with no replacement: `settings.reset`, `settings.suggestBuckets`, `documents.fileUrl`, and the `reason` field on forget.

The full method map is in the SDK's [migration guide](https://github.com/supermemoryai/sdk-ts/blob/main/MIGRATION.md).

## Document ingestion

v5 moves document scope into the URL and keeps repeated caller IDs attached to one evolving document.

### Rename common fields

| Legacy | v5 | Location |
| - | - | - |
| `containerTag` | `{namespace}` | Path |
| `customId` | `id` | JSON body |
| `entityContext` | `supportingContext` | JSON/form body |
| `filterByMetadata` | `group` | JSON/form body |
| `documentDate` | `date` | JSON/form body |
| `taskType`, `dreaming` | unchanged | JSON/form body |

### Add or append one document

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /v3/documents
  {"content":"new turn","customId":"conv_1","containerTag":"user_1"}
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /ns/user_1/document
  {"content":"new turn","id":"conv_1","dreaming":"dynamic"}
  ```
</CodeGroup>

The response remains an acceptance result with `id` and `status`. Its `status` is the document's processing state after the request: `queued` when new work was queued, otherwise the document's current state (for example `done` for an unchanged duplicate, or `failed` for a metadata-only update to a failed document). Possible values: `unknown`, `queued`, `extracting`, `chunking`, `embedding`, `indexing`, `done`, `failed`. Repeating the v5 request with `id: "conv_1"` adds or diffs the new content into that document; it does not silently replace the canonical source.

### Batch ingestion

<CodeGroup>
  ```json Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  {"documents":["first","second"],"containerTag":"user_1"}
  ```

  ```json v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  {"documents":[{"content":"first","id":"doc_1"},{"content":"second","id":"doc_2"}]}
  ```
</CodeGroup>

Send the v5 body to `POST /ns/user_1/document/batch`. The array accepts 1–600 document objects. `taskType` and `dreaming` sit at the top level of the body, next to `documents`, and apply to every item; document content, ID, context, metadata, grouping, and date stay per item.

`results` lists accepted documents first, in request order, then failed ones; match each result by `id`, or by `url` for a failed item with no ID. Inspect `count` (accepted), `failed`, and every item in `results`; each item's `status` is the document's processing state (`unknown`, `queued`, `extracting`, `chunking`, `embedding`, `indexing`, `done`, or `failed`), or `error` when that item failed, and a batch can contain successful and failed items together.

### File ingestion

Replace `POST /v3/documents/file` with `POST /ns/{namespace}/document/file`. Continue using `multipart/form-data`:

| Part | Encoding |
| - | - |
| `file` | Binary file |
| `supportingContext`, `date` | Plain strings |
| `metadata`, `group` | JSON-encoded strings |
| `taskType`, `dreaming` | Plain strings |
| `fileType`, `mimeType` | Plain strings, only when inference is insufficient |

The API acknowledges the file after durable acceptance, with `status` set as for a JSON add. Extraction, indexing, and memory formation continue asynchronously; poll the document rather than assuming the first response means processing is complete.

### Processing choices

* `taskType: "memory"` extracts long-term memories; `taskType: "superrag"` indexes source context without memory generation.
* `dreaming: "dynamic"` (default) groups related documents into coherent memory units.
* `dreaming: "instant"` processes each document independently and bills one extra operation per document.
* Memories appear quickly only with `dreaming: "instant"`. Under `dynamic`, a fresh namespace can show zero memories and an empty profile for several minutes. Use `instant` for quickstarts and parity tests.

These options go in the JSON body (or as form fields for file routes). Ingest routes take no query parameters; sending one returns `400`.

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await client.add({
    content: "new turn",
    customId: "conv_1",
    containerTag: "user_1",
    metadata: { source: "chat" },
  })

  await client.documents.batchAdd({
    documents: [{ content: "first" }, { content: "second" }],
    containerTag: "user_1",
  })

  await client.documents.uploadFile({ file, containerTag: "user_1" })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await client.add("user_1", {
    content: "new turn",
    id: "conv_1",
    metadata: { source: "chat" },
    dreaming: "instant",
  })

  await client.documents.batchAdd("user_1", {
    documents: [
      { content: "first", id: "doc_1" },
      { content: "second", id: "doc_2" },
    ],
  })

  await client.documents.uploadFile("user_1", {
    file,
    metadata: JSON.stringify({ source: "upload" }),
  })
  ```
</CodeGroup>

The namespace is the first argument on every call. `taskType` and `dreaming` sit next to `content` in the same object. `uploadFile` is multipart, so `metadata` is a JSON string there, not an object.

### Verification

* Ingest text, a public URL, and a file, then wait for each document to finish processing.
* Repeat a caller-defined ID and confirm append/diff behavior instead of replacement.
* Submit a mixed-success batch and verify each result matches its document by ID, with per-item errors.
* Confirm metadata and grouping remain filterable after processing.

## Document updates

v5 makes the difference between adding new information and replacing the canonical source explicit.

### Choose the correct write

| Intent | Operation | Content behavior |
| - | - | - |
| Add information to a stable caller ID | `POST /ns/{namespace}/document` | Append/diff |
| Replace text or URL content | `PATCH /ns/{namespace}/document/{id}` | Replace and reprocess |
| Update only supporting fields | Same `PATCH` without `content` | Canonical content unchanged |
| Replace a source file and its user metadata | `POST /ns/{namespace}/document/file/{id}` | Full replacement and reprocess |
| Partially update a file or its supporting fields | `PATCH /ns/{namespace}/document/file/{id}` | Omitted fields remain unchanged |

### Update text or URL content

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  PATCH /v3/documents/doc_1
  {"content":"corrected source","metadata":{"revision":2}}
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  PATCH /ns/user_1/document/doc_1
  {"content":"corrected source","metadata":{"revision":2},"dreaming":"dynamic"}
  ```
</CodeGroup>

The v5 body accepts any non-empty subset of `content`, `supportingContext`, `metadata`, `group`, or `date`, plus optional `taskType` and `dreaming` (which alone do not count as a change). Supplying `content` makes it the new canonical source; facts supported only by the previous source can disappear after reprocessing.

### Replace a file-backed document

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
POST /ns/user_1/document/file/doc_1
Content-Type: multipart/form-data

file=@corrected.pdf
metadata={"revision":2}
dreaming=dynamic
```

POST requires `file` and replaces the canonical source plus user-controlled metadata, grouping, context, and date. Omitted supporting fields are cleared. Use it when the submitted request is the complete new representation of the file-backed document.

### Partially update a file-backed document

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
PATCH /ns/user_1/document/file/doc_1
Content-Type: multipart/form-data

metadata={"reviewed":true}
dreaming=dynamic
```

PATCH changes only supplied fields. Include `file` to replace the source while retaining omitted supporting fields, or omit `file` for metadata-, group-, context-, or date-only changes. `metadata` and `group` are JSON-encoded strings; `supportingContext` and `date` are plain strings.

<Warning>
  There is no public v5 `PUT /ns/{namespace}/document/file/{id}` operation. Use POST for a complete replacement and PATCH for a partial update.
</Warning>

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await client.documents.update("doc_1", {
    content: "corrected source",
    metadata: { revision: 2 },
  })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await supermemory.documents.update("user_1", "doc_1", {
    content: "corrected source",
    metadata: { revision: 2 },
  })

  await supermemory.documents.replaceWithFile("user_1", "doc_1", {
    file,
    metadata: JSON.stringify({ revision: 2 }),
  })

  await supermemory.documents.updateFile("user_1", "doc_1", {
    metadata: JSON.stringify({ reviewed: true }),
  })
  ```
</CodeGroup>

`replaceWithFile` is the POST full replacement and requires `file`. `updateFile` is the PATCH partial update; `file` is optional and metadata merges key by key.

### IDs and scope

The path `id` may be the Supermemory document ID or your caller-defined ID. It is resolved only inside `{namespace}`; an ID from another namespace is not a cross-namespace update mechanism.

### Processing and conflicts

Content or file replacement is accepted before downstream processing completes. A document still processing, a namespace conflict, or a conflicting internal file path can return `409`; retry only after the conflicting operation reaches a terminal state.

### Verification

* Patch metadata alone and confirm document content and derived facts remain intact.
* Patch content and confirm the new source is canonical after processing.
* Replace a file with POST and confirm omitted user metadata is cleared.
* Patch a file-backed document and confirm omitted fields remain unchanged.
* Attempt the same ID in another namespace and confirm the update is rejected or not found.

## Content management

v5 retrieves, lists, and removes content within one explicit namespace.

### Retrieve a document and its derived context

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  GET /v3/documents/{id}
  GET /v3/documents/{id}/chunks
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  GET /ns/{namespace}/document/{id}?include=chunks,memories
  ```
</CodeGroup>

Pass `include` as a comma-separated list to return chunks, memories, or both. Keys you omit are absent; requested keys with no results are empty arrays. Lifecycle fields move under `system`:

```json theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
{"system":{"status":"done","createdAt":"...","updatedAt":"..."}}
```

`system.status` is one of `unknown`, `queued`, `extracting`, `chunking`, `embedding`, `indexing`, `done`, or `failed`.

### Retrieve a memory and its history

```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
GET /ns/{namespace}/memories/{id}?include=related,documents&relatedLimit=10
```

Returns one memory with `id`, `memory`, `metadata`, `isStatic`, `isInference`, `isLatest`, `isForgotten`, `version`, and `system.createdAt/updatedAt`. A memory from another namespace returns `404`; a forgotten memory, or one past its `forget_after`, is still returned with `isForgotten: true`.

* `include=related` adds `included.related.parents` (earlier versions), `children` (newer versions), and `siblings` (memories connected by `extends` or `derives`). Each list walks outward from the memory until it holds `relatedLimit` items (default `10`, maximum `100`). Forgotten memories and memories in other namespaces are left out.
* `include=documents` adds `included.document`, the most recently updated source document. With both values, every related memory also carries its own `document`.

### List documents, chunks, or memories

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /v3/documents/list
  POST /v4/memories/list
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /ns/{namespace}/list/{type}?page=1&limit=100&sort=createdAt&order=desc
  {}
  ```
</CodeGroup>

Set `type` to `documents`, `chunks`, or `memories`. Pagination and sorting move to the query string as plain integers and values; the body takes an optional `filter` and, for memories, `include`. Defaults are `page=1`, `limit=10` (maximum 100), `sort=createdAt`, and `order=desc`.

Memory lists hide forgotten memories and memories past their `forget_after`. Send `"include": {"forgotten": true}` to list them too; they come back with `isForgotten: true`. Document memories (`include=memories` on `GET /ns/{namespace}/document/{id}`) report the same flag.

Every response contains `documents`, `chunks`, `memories`, and `pagination`. Only the selected resource array is populated. Replace legacy `memories` assumptions in document-list callers with `documents`.

### Delete documents

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  DELETE /v3/documents/{id}
  DELETE /v3/documents/bulk
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  DELETE /ns/{namespace}/document
  {"ids":["doc_1","external_id_2"]}
  ```
</CodeGroup>

The v5 array accepts 1–100 Supermemory or caller-defined IDs. Inspect both `count` and per-ID `errors`; HTTP success can include partial failures.

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const doc = await client.documents.get("doc_1")
  const page = await client.documents.list({ containerTags: ["user_1"] })
  const processing = await client.documents.listProcessing()
  await client.documents.delete("doc_1")
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const doc = await supermemory.documents.get("user_1", "doc_1", {
    include: ["chunks", "memories"],
  })

  const { documents, pagination } = await supermemory.list("user_1", "documents", {
    page: 1,
    limit: 100,
    sort: "createdAt",
    order: "desc",
  })

  const { memories } = await supermemory.list("user_1", "memories")

  const { count, errors } = await supermemory.documents.delete("user_1", {
    ids: ["doc_1", "external_id_2"],
  })
  ```
</CodeGroup>

There is no separate processing list. Read `system.status` on each item returned by `supermemory.list(namespace, "documents")`. Chunks come from `supermemory.list(namespace, "chunks")` or `documents.get` with `include: ["chunks"]`.

### Forget memories

| Legacy intent | v5 operation |
| - | - |
| Forget exact IDs | `DELETE /ns/{namespace}/memories` with `{ "ids": [...] }` |
| Find memories by meaning | `DELETE /ns/{namespace}/memories/semantic` with `{ "query": "...", "dryRun": true }` |

Both return `{ count, matches, errors }`. For drift-free semantic deletion, preview with `dryRun: true`, review the IDs, then submit them to the exact-ID endpoint.

See [memory forgetting](/docs/migration/api-v5-memory-forgetting) for the complete dry-run, approval, response, and audit workflow.

### Verification

* Assert requested empty includes are `[]`, while omitted includes are absent.
* Paginate each resource type until `currentPage >= totalPages`; unselected arrays stay empty.
* Verify chunk rows contain their parent `documentId`.
* Exercise partial document-delete failures and semantic dry runs.
* Verify IDs cannot read, list, or delete content outside their namespace.

## Search

v5 searches one namespace, defaults to hybrid recall, and takes every option in one typed JSON body. Search has no query-string parameters.

### Request mapping

| Legacy | v5 |
| - | - |
| `containerTag` | `/ns/{namespace}` |
| body `q` | body `query` |
| body `limit` | body `limit` |
| `searchMode: "documents"` | `searchMode: "chunks"` |
| omitted search mode | `searchMode: "hybrid"` |
| `filters` | singular `filter` |
| `include.documents` or `.summaries` | `include.documents` |
| `include.relatedMemories` | `include.related` |
| `include.forgottenMemories` | `include.forgotten` |
| `rerank: true` / `aggregate: true` | `rerank: "order"` / `"aggregate"` |

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /v4/search
  {"q":"What did the user decide?","containerTag":"user_1","limit":10,"searchMode":"memories"}
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /ns/user_1/search
  {"query":"What did the user decide?","limit":10,"searchMode":"memories","threshold":0.6,"rewriteQuery":false}
  ```
</CodeGroup>

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const memories = await client.search.memories({
    q: "What did the user decide?",
    containerTag: "user_1",
    limit: 10,
  })

  const docs = await client.search.execute({
    q: "launch plan",
    containerTags: ["user_1"],
  })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const memories = await supermemory.search("user_1", {
    query: "What did the user decide?",
    threshold: 0.6,
    rewriteQuery: false,
    searchMode: "memories",
    limit: 10,
  })

  const chunks = await supermemory.search("user_1", {
    query: "launch plan",
    searchMode: "chunks",
  })

  const hybrid = await supermemory.search("user_1", {
    query: "launch plan",
  })
  ```
</CodeGroup>

`query`, `searchMode`, `limit`, `threshold`, `filter`, `include`, `rerank`, and `rewriteQuery` all go in one object (the JSON body over HTTP). Omitting `searchMode` gives `hybrid`.

### Changed defaults

| Setting | v4 | v5 |
| - | - | - |
| Search mode | `memories` | `hybrid` |
| Similarity threshold | `0.6` | `0.3` |
| Reranking | Disabled | `rerank: "none"` |
| Query rewriting | Disabled | `false` |

Set mode and threshold explicitly while comparing versions. After parity testing, remove them only if you want the broader v5 hybrid defaults.

### Search modes

| Mode | Returns |
| - | - |
| `memories` | Formed memories only |
| `chunks` | Source chunks only |
| `hybrid` | Both result types in one ranked list |

Legacy `include.chunks` has no v5 equivalent. Choose `chunks` or `hybrid` instead.

### Included context and ranking

`include` is an object of booleans in the body, e.g. `"include": {"documents": true, "related": true}`. Each flag defaults to `false`.

* `include.documents` adds the most relevant source document to each result.
* `include.related` adds parent, child, and sibling memories. Related memories come only from the same namespace and must match the request's `filter`, so they never surface content the search itself would exclude.
* `include.forgotten` lets forgotten and expired memories appear in results, including as primary results.
* `rerank` accepts `none`, `order`, or `aggregate`; `rewriteQuery` controls retrieval-oriented query rewriting.

### Response mapping

| Legacy reader | v5 reader |
| - | - |
| Result array | `results` |
| Timing | `searchTime` |
| Source expansion | `result.included.document`, with timestamps under its `system` |
| Related context | `result.included.related.{parents,children,siblings}`, each with its memory `id` |
| Lifecycle fields | `result.system` |
| Version and inference flags | `result.isLatest`, `result.isInference` |

Each primary result contains either `memory`, `chunk`, or both only if the contract allows it. Branch on field presence rather than assuming one result shape.

### Verification

* Compare IDs using explicit v4-equivalent defaults, then test v5 hybrid behavior separately.
* Cover all three modes, thresholds at `0` and `1`, each rerank option, and query rewriting.
* Cover every include alone and in combination, including empty results.
* Verify filters, namespace isolation, result limits, and invalid body/query placement.

## Profiles and buckets

v5 returns a maintained profile directly and gives profile bucket definitions their own namespace-scoped resource.

### Remove search behavior from profile calls

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /v4/profile
  {"containerTag":"user_1","q":"work preferences","threshold":0.6,"include":{}}
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /ns/user_1/profile
  {"filter":{"field":"region","operator":"eq","value":"us-west"},"buckets":["work"]}
  ```
</CodeGroup>

Remove legacy `q`, `threshold`, and `include`. If the caller needs query-ranked results, issue a separate v5 search request. Move `containerTag` to the path and rename `filters` to singular `filter`.

### Read the v5 profile shape

```json theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
{
  "profile": {
    "static": [{ "id": "mem_1", "memory": "The user works in design" }],
    "dynamic": [{ "id": "mem_2", "memory": "The user is preparing a launch" }],
    "buckets": { "work": [{ "id": "mem_3", "memory": "Prefers concise project updates" }] }
  }
}
```

`static` and `dynamic` are always returned and cannot be disabled. Omit `buckets` in the request to return every effective custom bucket; pass up to 50 names to narrow only the bucket section.

### Read bucket definitions

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  POST /v4/profile/buckets
  {"containerTag":"user_1"}
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  GET /ns/user_1/profile/buckets
  ```
</CodeGroup>

The response changes from key/description objects to a map:

```json theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
{"buckets":{"work":"Professional preferences and ongoing work"}}
```

### Add or edit namespace buckets

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
PUT /ns/user_1/profile/buckets
{"buckets":{"work":"Professional preferences and ongoing work"}}
```

Send one to 50 name-to-description entries. Existing namespace names are updated, new names are added, and omitted namespace buckets remain unchanged.

### Delete namespace buckets

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
DELETE /ns/user_1/profile/buckets
{"buckets":["work"]}
```

Names must be unique. Organization-owned buckets can appear in the effective GET response but cannot be changed or removed through namespace PUT or DELETE calls.

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const profile = await client.profile({ containerTag: "user_1", q: "work preferences" })
  const buckets = await client.profile.buckets({ containerTag: "user_1" })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const { profile } = await supermemory.profile("user_1", {
    buckets: ["work"],
  })

  const buckets = await supermemory.profiles.getBuckets("user_1")

  await supermemory.profiles.setBuckets("user_1", {
    buckets: { work: "Professional preferences and ongoing work" },
  })

  await supermemory.profiles.deleteBuckets("user_1", {
    buckets: ["work"],
  })
  ```
</CodeGroup>

`supermemory.profile` takes no query. `body` is optional and accepts only `filter` and `buckets`. Read `profile.static`, `profile.dynamic`, and `profile.buckets[name]` as arrays of `{ id, memory }`.

### Verification

* Confirm every profile response contains `static`, `dynamic`, and `buckets`.
* Compare omitted buckets with one-name and multi-name narrowing.
* Add, edit, and delete a namespace bucket without replacing omitted buckets.
* Attempt to mutate an inherited organization bucket and expect the documented error.

## Memory forgetting

v5 scopes forgetting to one namespace and returns the same result envelope for exact and semantic requests.

### Choose exact or semantic forgetting

| Intent | v5 operation |
| - | - |
| Forget reviewed memory IDs | `DELETE /ns/{namespace}/memories` |
| Find memories by meaning | `DELETE /ns/{namespace}/memories/semantic` |

### Forget exact IDs

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
DELETE /ns/user_1/memories
Content-Type: application/json

{"ids":["mem_1","mem_2"]}
```

Send 1–500 IDs. The response reports successful IDs in `matches` and missing or ineligible IDs in `errors`, so HTTP success does not imply every requested ID changed.

### Preview a semantic request

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
DELETE /ns/user_1/memories/semantic
Content-Type: application/json

{"query":"outdated home address","dryRun":true}
```

`dryRun: true` performs selection without changing memory state. `dryRun: false` forgets the memories selected when that request executes.

### Avoid selection drift

```text theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
semantic request with dryRun: true
                |
                v
review matches[].id
                |
                v
exact DELETE with reviewed IDs
```

Use this workflow when a human or policy must approve the exact set. Re-running the semantic request with `dryRun: false` can select a different set if memories changed after preview.

### Read the normalized response

```json theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
{
  "count": 1,
  "matches": [{ "id": "mem_1", "memory": "Old address" }],
  "errors": [{ "id": "mem_2", "error": "Memory not found" }]
}
```

`count` always equals `matches.length`. Both dry-run and applied semantic requests use this shape; the payload alone does not replace your record of which mode was sent.

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await client.memories.forget({ id: "mem_1" })
  await client.memories.forgetMatching({ query: "outdated home address" })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const preview = await supermemory.memories.forgetMatching("user_1", {
    query: "outdated home address",
    dryRun: true,
  })

  await supermemory.memories.forget("user_1", {
    ids: preview.matches.map((m) => m.id),
  })
  ```
</CodeGroup>

`dryRun` is required on `forgetMatching`. Both calls return `{ count, matches, errors }`.

### Removed memory-write routes

Direct v4 memory creation and version updates (`client.memories.add`, `client.memories.updateMemory`) have no v5 replacement. Ingest source material through document routes and update the canonical document when facts change.

### Verification

* Exercise all-success, partial-success, duplicate, unknown, and cross-namespace ID sets.
* Confirm dry runs leave matched memories recallable.
* Apply reviewed IDs exactly and confirm normal recall excludes them.
* Persist the request mode alongside audit logs for semantic operations.

## Namespaces

v5 renames the public isolation boundary from container tag to namespace. Existing values remain valid identifiers; no stored data rename is required.

### Endpoint mapping

| Legacy | v5 |
| - | - |
| `GET /v3/container-tags/list` | `GET /namespaces` |
| `GET /v3/container-tags/{tag}` | `GET /ns/{namespace}` |
| `PATCH /v3/container-tags/{tag}` | `PATCH /ns/{namespace}` |
| `DELETE /v3/container-tags/{tag}` | `DELETE /ns/{namespace}` |
| Merge container tags | `DELETE /ns/{source}?moveTo=target` |

`GET /ns` is an alias for `GET /namespaces`. Prefer `/namespaces` in new integrations.

### List namespaces

The list is paginated: `GET /namespaces?page=1&limit=10` returns `{namespaces, pagination}`, newest first, with `limit` up to 100. Each entry now exposes `id`, `namespace`, `documentCount`, `memoryCount`, nullable `description`, and `system.createdAt/updatedAt`. Update readers that still expect `containerTag`, flat timestamps, or unbounded internal settings.

### Read and update settings

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  PATCH /v3/container-tags/project_alpha
  {"entityContext":"Research project for distributed systems"}
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  PATCH /ns/project_alpha
  {"supportingContext":"Research project for distributed systems"}
  ```
</CodeGroup>

The public GET and PATCH shapes contain only `namespace`, `supportingContext`, and lifecycle timestamps. Profile buckets have their own `/profile/buckets` resource and are not namespace settings.

Send `supportingContext: null` to remove existing context. Omitting the field entirely is invalid because PATCH requires at least one supported setting.

### Permanently delete a namespace

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
DELETE /ns/project_alpha
```

With no `moveTo`, deletion is synchronous and returns `200` with `status: "deleted"`, `deletedDocumentsCount`, and `deletedMemoriesCount`. Branch on `status` (`deleted` or `queued`) to tell the two outcomes apart. This removes the namespace and its content.

### Move then remove a namespace

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
DELETE /ns/project_alpha?moveTo=project_archive
```

`moveTo` is a query parameter. This returns `202` with `status: "queued"` and `operationId`. The destination must differ from the source. Do not treat acceptance as completed migration.

Legacy merge can accept multiple sources; v5 moves one source per request. Run multi-source migrations sequentially and record each operation independently.

### With the SDK

Replace calls to `/v3/container-tags/*` with `supermemory.namespaces`:

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  GET /v3/container-tags/list
  PATCH /v3/container-tags/project_alpha
  DELETE /v3/container-tags/project_alpha
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const { namespaces } = await supermemory.namespaces.list()
  const one = await supermemory.namespaces.get("project_alpha")

  await supermemory.namespaces.update("project_alpha", {
    supportingContext: "Research project for distributed systems",
  })

  await supermemory.namespaces.delete("project_alpha")

  await supermemory.namespaces.delete("project_alpha", {
    moveTo: "project_archive",
  })
  ```
</CodeGroup>

`namespaces.list()` returns `{ namespaces, pagination }`, where each namespace is `{ id, namespace, documentCount, memoryCount, description, system }`. A delete without `moveTo` returns `{ status: "deleted", namespace, deletedDocumentsCount, deletedMemoriesCount }`; with `moveTo` it returns `{ status: "queued", operationId, namespace, moveTo }`.

### Verification

* Confirm existing container-tag values resolve unchanged as namespace paths.
* Compare namespace counts with namespace-scoped document and memory lists.
* Verify a permanent delete returns final counts while a move returns `202`.
* Verify restricted callers cannot read or mutate namespaces outside their scope.
* Verify only organization-authorized callers can change settings or lifecycle.

## Organization settings

v5 exposes only the organization-wide context needed to guide memory formation. Internal controls and profile bucket mutation are no longer part of this settings resource.

### Endpoint mapping

| Legacy | v5 |
| - | - |
| `GET /v3/settings` | `GET /organization` |
| `PATCH /v3/settings` | `PATCH /organization` |
| `filterPrompt` | `organizationalContext` |

### Read organization settings

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
GET /organization
```

```json theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
{
  "organizationalContext": "Acme builds security tools for enterprises",
  "namespaceCount": 42
}
```

Remove readers for legacy settings that are not present in this allowlisted response. `namespaceCount` is informational and cannot be changed through PATCH.

### Update organization context

<CodeGroup>
  ```bash Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  PATCH /v3/settings
  {"filterPrompt":"Acme builds security tools for enterprises"}
  ```

  ```bash v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  PATCH /organization
  {"organizationalContext":"Acme builds security tools for enterprises"}
  ```
</CodeGroup>

The field is exhaustive: the supplied value replaces the existing context. Send `null` to remove it. Empty strings are rejected.

Organization updates require an organization administrator. Do not silently fall back to namespace context when the caller receives `403`.

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const settings = await client.settings.get()
  await client.settings.update({ filterPrompt: "Acme builds security tools for enterprises" })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  const { organizationalContext, namespaceCount } = await supermemory.organization.get()

  await supermemory.organization.update({
    organizationalContext: "Acme builds security tools for enterprises",
  })
  ```
</CodeGroup>

### Removed public operations

* Organization profile-bucket mutation is not exposed through organization settings.
* Bucket suggestion is not part of v5.
* Organization data reset is not part of v5.
* Namespace-owned profile buckets are managed through `/ns/{namespace}/profile/buckets`.

### Verification

* Compare the v5 context with the legacy `filterPrompt` before cutover.
* Set, replace, and clear organizational context.
* Confirm `namespaceCount` agrees with `pagination.totalItems` from `GET /namespaces` for the same credentials.
* Verify non-admin callers receive `403` on PATCH.
* Confirm removed fields are not required by downstream configuration code.

## Typed filters

v5 uses one optional singular `filter` field for search, profiles, and list operations.

### Shape

```ts theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
type Filter =
  | { field: string; operator: "eq" | "neq"; value: string; caseSensitive?: boolean }
  | { field: string; operator: "eq" | "neq"; value: number | boolean }
  | { field: string; operator: "gt" | "gte" | "lt" | "lte"; value: number }
  | { field: string; operator: "contains" | "notContains"; value: string; caseSensitive?: boolean }
  | { field: string; operator: "arrayContains" | "arrayNotContains"; value: string }
  | { operator: "and" | "or"; operands: Filter[] };
```

Fields may contain letters, numbers, `_`, `.`, and `-`. Expressions allow up to five nested levels and 200 operands per logical group.

### Operator mapping

| Legacy condition | v5 predicate |
| - | - |
| `{ key, value }` | `{ field: key, operator: "eq", value }` |
| `negate: true` equality | `operator: "neq"` |
| `filterType: "string_contains"` | `operator: "contains"` |
| contains + `negate: true` | `operator: "notContains"` |
| `filterType: "array_contains"` | `operator: "arrayContains"` |
| array contains + `negate: true` | `operator: "arrayNotContains"` |
| numeric `=` / numeric `=` + `negate: true` | `eq` / `neq` with a JSON number |
| numeric `>`, `>=`, `<`, `<=` | `gt`, `gte`, `lt`, `lte` |
| `AND` / `OR` arrays | lowercase `and` / `or` with `operands` |
| `ignoreCase: true` | `caseSensitive: false` |

### Before and after

<CodeGroup>
  ```json Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  {
    "AND": [
      { "key": "category", "value": "research" },
      { "key": "score", "value": 0.8, "filterType": "numeric", "numericOperator": ">=" }
    ]
  }
  ```

  ```json v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  {
    "operator": "and",
    "operands": [
      { "field": "category", "operator": "eq", "value": "research" },
      { "field": "score", "operator": "gte", "value": 0.8 }
    ]
  }
  ```
</CodeGroup>

### With the SDK

<CodeGroup>
  ```ts Legacy theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await client.search.execute({
    q: "research notes",
    containerTags: ["user_1"],
    filters: JSON.stringify({
      AND: [
        { key: "category", value: "research" },
        { key: "score", value: 0.8, filterType: "numeric", numericOperator: ">=" },
      ],
    }),
  })
  ```

  ```ts v5 theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await supermemory.search("user_1", {
    query: "research notes",
    filter: {
      operator: "and",
      operands: [
        { field: "category", operator: "eq", value: "research" },
        { field: "score", operator: "gte", value: 0.8 },
      ],
    },
    searchMode: "chunks",
  })
  ```
</CodeGroup>

`filter` is a typed object under `body`, not a JSON string. The same shape works in `supermemory.list` and `supermemory.profile`. Keys are literal: `customer.plan` is one field name, not a nested path.

### Deterministic conversion

1. Rename outer `filters` to `filter`.
2. Recursively replace `AND`/`OR` objects with `{ operator, operands }`.
3. Rename `key` to `field`.
4. Convert legacy flags into one explicit operator.
5. Keep numeric values as JSON numbers rather than numeric strings.
6. Remove legacy `filterType`, `negate`, `numericOperator`, and `ignoreCase` keys.

### Verification

* Compare result IDs for equality, inequality, contains, numeric, array, nested AND, and nested OR fixtures.
* Add negative tests: legacy shapes, empty operands, incompatible value types, and unknown keys must return `400`.
* Confirm omitted `filter` preserves unfiltered behavior.

## Verification and rollout

Treat migration as a behavioral comparison, not a raw response snapshot update.

### Build deterministic fixtures

Use an isolated namespace with stable IDs and fixed source content. Include plaintext, URL, file, batch, metadata, grouping, profile facts, related memories, forgotten memories, and empty-result cases.

Record each legacy request, v5 request, expected semantic result, and intentional difference. Never compare generated IDs, signed URLs, timing, or JSON object order unless the contract guarantees them.

### Compare writes

* Repeated POST appends or diffs; PATCH replaces canonical content.
* Batch outcomes list accepted documents first, then failures, and surface partial failures; match by ID, not position.
* Metadata-only updates leave source content unchanged.
* Accepted writes are polled until processing reaches a terminal state.

### Compare reads and recall

* Document includes are absent when omitted and empty arrays when requested without results.
* Unified list responses populate only the selected resource array.
* `metadata` is always an object, `{}` when empty; it is never `null`.
* Search parity uses explicit v4-equivalent mode and threshold before testing v5 defaults.
* Profiles always contain static, dynamic, and bucket sections.

### Exercise boundaries

| Boundary | Cases |
| - | - |
| Namespace | Correct, missing, unauthorized, cross-namespace ID |
| Pagination | First, middle, final, empty, maximum limit |
| Filters | Every operator, nested AND/OR, invalid type, excessive depth |
| Deletion | All success, partial success, unknown IDs, semantic dry run |
| Settings | Admin, non-admin, null removal, invalid empty value |

### Classify differences

```text theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
same request intent
       |
       +-- same semantic result ------> parity
       +-- documented v5 difference --> update assertion
       +-- undocumented difference ----> block cutover
```

Do not normalize away an undocumented difference. Capture the request pair, namespace, IDs, response status, and minimal response fragments needed to reproduce it.

### Cut over by domain

1. Ship v5 request construction behind a per-domain flag.
2. Dual-read or shadow-call where side effects allow it.
3. Switch ingestion, content management, search, profiles, then settings independently.
4. Monitor validation failures, authorization failures, latency, empty-result rate, and processing failures.
5. Retain the legacy path until the observation window passes.

### Completion checklist

* No application API call accidentally uses a `/v5` prefix.
* Connector calls use `/ns/{namespace}/connectors` or `supermemory.connectors.*`, not `/v3/connections`.
* No legacy field aliases or response readers remain.
* Every changed default is either accepted intentionally or passed explicitly.
* Rollback restores the previous caller without requiring data repair.

## Operations without a direct replacement

* Direct memory creation and version updates: ingest or replace a source document instead.
* Organization bucket suggestion and organization reset: not part of the v5 public surface.
* Connector resource listing and hosted pickers from `/v3/connections`: use `supermemory.connectors.get` with `include: ["syncs", "picker"]` instead. Connector create, list, get, update, delete, and sync all have v5 routes under `/ns/{namespace}/connectors`.

Use the [v5 reference](https://api.supermemory.ai/v5/reference) for the stable v5 API. [`/reference`](https://api.supermemory.ai/reference) always points to the latest public version.


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.