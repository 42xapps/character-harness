# Supermemory v5 API reference — Python

> Generated from the local v5 OpenAPI snapshot in `supermemory-api.json`. Python SDK samples only. This is a saved snapshot, not a live scrape.

Reference: https://api.supermemory.ai/v5/reference

## Setup

```bash
pip install supermemory
export SUPERMEMORY_API_KEY="..."
```

The SDK client reads `SUPERMEMORY_API_KEY` by default. API server: `https://api.supermemory.ai`. Routes are namespace-scoped under `/ns/{namespace}`.

## POST /ns/{namespace}/document — Add document

Turn text or a supported URL into searchable, evolving memory. Supply a new ID to create a document, or reuse an existing ID to append new information while preserving its history.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

doc = client.add(
    "user_123",
    content="Sarah is being promoted to VP of Product.",
    id="chat_session_1",
    metadata={"type": "conversation"},
    dreaming="instant",
)
print(doc.id, doc.status)
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.

## DELETE /ns/{namespace}/document — Delete documents

Permanently remove documents and their derived knowledge by document ID or caller-defined ID. Each requested ID is handled independently so successful deletions are preserved when another ID fails.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

res = client.documents.delete("user_123", ids=["chat_session_1", "doc_roadmap"])
print(res.count, res.errors)
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.

## POST /ns/{namespace}/document/batch — Batch add documents

Build a knowledge base efficiently by ingesting up to 600 text or URL documents at once. Existing caller-defined IDs append new information using the same semantics as single-document ingestion.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

res = client.documents.batch_add(
    "user_123",
    documents=[
        {"content": "Q3 roadmap notes", "id": "doc_roadmap"},
        {"content": "Gift policy for VP promotions", "id": "doc_gifts"},
    ],
    dreaming="instant",
)
print(res.count, res.failed)
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.

## GET /ns/{namespace}/document/{id} — Get document

Retrieve a document's canonical content, metadata, and processing state by document ID or caller-defined ID. Optionally include its source chunks, derived memories, or both in the same response.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

doc = client.documents.get("user_123", "doc_abc123", include=["chunks", "memories"])
print(doc.system.status, len(doc.chunks or []), len(doc.memories or []))
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.
- `id` (path; required): The public document ID
- `include` (query; optional): Comma-separated child resources to include: chunks, memories, or both.

## PATCH /ns/{namespace}/document/{id} — Update document

Refresh an existing document without changing its stable ID. Supplied content replaces the canonical content and is reprocessed; omitted fields remain unchanged.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

updated = client.documents.update(
    "user_123",
    "chat_session_1",
    content="Updated notes: Sarah is now VP of Product.",
    metadata={"type": "conversation"},
)
print(updated.status)
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.
- `id` (path; required): The public document ID

## POST /ns/{namespace}/document/file — Upload file

Transform an uploaded file into searchable knowledge and learned memory. The response returns as soon as ingestion is safely queued while extraction and memory formation continue asynchronously.

```python
from supermemory import Supermemory
import json
client = Supermemory()  # reads SUPERMEMORY_API_KEY

with open("notes.pdf", "rb") as f:
    doc = client.documents.upload_file(
        "user_123",
        file=f,
        metadata=json.dumps({"source": "upload"}),  # multipart: metadata is a JSON string
    )
print(doc.id, doc.status)
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.

## POST /ns/{namespace}/document/file/{id} — Replace document with file

Replace an existing document with a new file while keeping its stable document ID. Content and caller metadata are overwritten, then the document is reprocessed asynchronously.

```python
from supermemory import Supermemory
import json
client = Supermemory()  # reads SUPERMEMORY_API_KEY

with open("notes-v2.pdf", "rb") as f:
    doc = client.documents.replace_with_file(
        "user_123",
        "doc_abc123",
        file=f,
        metadata=json.dumps({"revision": 2}),
    )
print(doc.status)
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.
- `id` (path; required): The public document ID

## PATCH /ns/{namespace}/document/file/{id} — Partially update document file

Refresh only the file-backed fields you provide. Supplying a file replaces the canonical content; omitted metadata and processing context remain unchanged.

```python
from supermemory import Supermemory
import json
client = Supermemory()  # reads SUPERMEMORY_API_KEY

doc = client.documents.update_file(
    "user_123",
    "doc_abc123",
    metadata=json.dumps({"reviewed": True}),  # file is optional here
)
print(doc.status)
```

Parameters:
- `namespace` (path; required): The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents.
- `id` (path; required): The public document ID

## POST /ns/{namespace}/search — Search memories

Recall the most relevant learned context and source passages from a namespace. Hybrid search combines memories with document chunks by default, with optional query rewriting, reranking, and supporting context attachments.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

response = client.search(
    "user_123",
    query="gift ideas for a VP promotion after a Tokyo offsite",
    search_mode="hybrid",
    limit=5,
    include={"related": True},
    filter={
        "operator": "and",
        "operands": [
            {"field": "category", "operator": "eq", "value": "work"},
            {"field": "importance", "operator": "gte", "value": 0.8},
        ],
    },
)
for r in response.results:
    print(round(r.similarity, 2), r.memory or r.chunk)
```

Parameters:
- `namespace` (path; required): The isolated namespace to search. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.

## POST /ns/{namespace}/profile — Get profile

Read a continuously maintained understanding of the subject represented by this namespace. Stable facts, evolving context, and selected custom buckets are returned together without requiring a search query.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

profile = client.profile("user_123").profile
print([m.memory for m in profile.static])
print([m.memory for m in profile.dynamic])
```

Parameters:
- `namespace` (path; required): The isolated namespace to search. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.

## GET /ns/{namespace}/profile/buckets — Get profile buckets

Inspect the profile taxonomy active in this namespace. The response combines organization-wide buckets with namespace-owned additions as a concise name-to-description map.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

buckets = client.profiles.get_buckets("user_123")
print(buckets)
```

Parameters:
- `namespace` (path; required): The isolated namespace to search. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.

## PUT /ns/{namespace}/profile/buckets — Add or update profile buckets

Teach Supermemory new ways to organize this namespace's profile, or refine how existing namespace-owned buckets are classified. Omitted buckets remain unchanged and organization-wide buckets stay protected.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

client.profiles.set_buckets(
    "user_123",
    buckets={
        "work": "Job, team, and current projects",
        "preferences": "Food, travel, and communication preferences",
    },
)
```

Parameters:
- `namespace` (path; required): The isolated namespace to search. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.

## DELETE /ns/{namespace}/profile/buckets — Delete profile buckets

Remove profile categories created specifically for this namespace. Unknown names are safely ignored, while organization-wide buckets remain protected.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

client.profiles.delete_buckets("user_123", buckets=["work"])
```

Parameters:
- `namespace` (path; required): The isolated namespace to search. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.

## DELETE /ns/{namespace}/memories — Forget memories by ID

Remove exact memories from normal recall while preserving their audit history. Each ID is handled independently and any missing or ineligible memory is reported without rolling back successful changes.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

res = client.memories.forget("user_123", ids=["mem_1", "mem_2"])
print(res.count, res.errors)
```

Parameters:
- `namespace` (path; required): Namespace containing the memories to forget. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.

## DELETE /ns/{namespace}/memories/semantic — Forget memories semantically

Describe what should be forgotten in natural language, then preview or apply the matching set. Use dry-run results with the exact-ID endpoint when you need a reviewable, drift-free workflow.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

# Preview first, then run again with dry_run=False
preview = client.memories.forget_matching(
    "user_123",
    query="forget everything about the old pricing plan",
    dry_run=True,
)
print([m.memory for m in preview.matches])
```

Parameters:
- `namespace` (path; required): Namespace containing the memories to forget. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.

## POST /ns/{namespace}/list/{type} — List resources

Browse documents, source chunks, or learned memories through one predictable paginated contract. Choose the collection in the path; the other collection arrays remain empty for a stable response shape.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

page = client.list(
    "user_123",
    "documents",
    page=1,
    limit=20,
    sort="createdAt",
    order="desc",
    filter={"field": "type", "operator": "eq", "value": "conversation"},
)
print(len(page.documents), page.pagination.total_pages)
```

Parameters:
- `namespace` (path; required): Namespace containing the resources to list. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope resources.
- `type` (path; required): Resource collection to list: source documents, extracted chunks, or learned memories
- `page` (query; optional): One-based page number
- `limit` (query; optional): Maximum resources to return per page
- `sort` (query; optional): Field used to order results. Position is available only when listing chunks.
- `order` (query; optional): Ascending or descending sort direction

## GET /connectors — List all connectors

List connectors across every namespace this key can read. Use it for admin views that span users or projects.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

page = client.connectors.list_all(provider="notion", limit=50)
for c in page.connectors:
    print(c.namespace, c.provider, c.latest_run.system.status if c.latest_run else None)
```

Parameters:
- `provider` (query; optional): Only return connectors for this provider
- `page` (query; optional): One-based page number
- `limit` (query; optional): Maximum connectors to return per page

## POST /ns/{namespace}/connectors — Create connector

Connect an external source to this namespace. OAuth providers return an authorization url to send the user to; providers that authenticate with config start syncing right away.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

setup = client.connectors.create(
    "user_123",
    request={"provider": "notion", "redirectUrl": "https://app.example.com/connected"},
)
# OAuth providers return authorization.url to send the user to; config providers return None
print(setup.id, setup.authorization.url if setup.authorization else None)
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.

## GET /ns/{namespace}/connectors — List connectors

List the connectors that sync into this namespace.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

page = client.connectors.list("user_123")
for c in page.connectors:
    print(c.id, c.provider, c.document_count)
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.
- `provider` (query; optional): Only return connectors for this provider
- `page` (query; optional): One-based page number
- `limit` (query; optional): Maximum connectors to return per page

## GET /ns/{namespace}/connectors/{id} — Get connector

Read one connector. Add include=syncs to include its recent sync runs and the items that failed. include=picker needs an admin with write access, since the link changes what syncs.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

connector = client.connectors.get("user_123", "conn_abc123", include=["syncs", "picker"])
print(connector.latest_run, connector.syncs, connector.picker)
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.
- `id` (path; required): Connector identifier returned when the connector was created
- `include` (query; optional): Comma-separated extras. syncs: the 10 most recent sync runs with their failed items. picker: a one-time hosted picker URL.
- `returnUrl` (query; optional): Where the hosted picker sends the user when they finish

## PATCH /ns/{namespace}/connectors/{id} — Update connector

Change what a connector syncs. A new selection replaces the old one and starts a sync.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

client.connectors.update(
    "user_123",
    "conn_abc123",
    document_limit=500,
    selection={"repos": ["123456789"]},  # provider-specific selection
)
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.
- `id` (path; required): Connector identifier returned when the connector was created

## DELETE /ns/{namespace}/connectors/{id} — Delete connector

Disconnect a connector and stop its webhooks. Its imported documents are deleted too unless deleteDocuments is false.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

client.connectors.delete("user_123", "conn_abc123", delete_documents=True)
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.
- `id` (path; required): Connector identifier returned when the connector was created
- `deleteDocuments` (query; optional): Also delete documents this connector imported. Defaults to true.

## POST /ns/{namespace}/connectors/{id}/sync — Sync connector

Start a sync now. Returns 409 while a sync for this connector is already running.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

run = client.connectors.sync("user_123", "conn_abc123")
print(run.status)  # "queued"; 409 if a sync is already running
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.
- `id` (path; required): Connector identifier returned when the connector was created

## GET /namespaces — List namespaces

Discover every namespace available to the caller, including its purpose, document volume, memory count, and lifecycle timestamps.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

page = client.namespaces.list(page=1, limit=50)
print([ns.namespace for ns in page.namespaces])
```

Parameters:
- `page` (query; optional): One-based page number
- `limit` (query; optional): Maximum namespaces to return per page

## GET /ns — List namespaces

Discover every namespace available to the caller, including its purpose, document volume, memory count, and lifecycle timestamps.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

page = client.namespaces.list(page=1, limit=50)
for ns in page.namespaces:
    print(ns.namespace, ns.document_count, ns.memory_count)
print(page.pagination.total_pages)
```

Parameters:
- `page` (query; optional): One-based page number
- `limit` (query; optional): Maximum namespaces to return per page

## GET /ns/{namespace} — Get namespace settings

Read the supporting context that helps Supermemory understand content and form better memories inside this namespace.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

ns = client.namespaces.get("user_123")
print(ns.supporting_context, ns.system.created_at)
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.

## PATCH /ns/{namespace} — Update namespace settings

Shape how Supermemory understands an existing namespace by updating the background context used during ingestion and memory formation.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

client.namespaces.update(
    "user_123",
    supporting_context="A paying customer on the Pro plan; prefers concise answers.",
)
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.

## DELETE /ns/{namespace} — Delete namespace

Retire a namespace by permanently deleting its content, or preserve that knowledge by moving everything into another namespace first. Moves are queued and complete asynchronously.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

# Move everything into another namespace instead of deleting: add move_to="project_main"
res = client.namespaces.delete("project_old")
print(res.status)  # "deleted", or "queued" when moving
```

Parameters:
- `namespace` (path; required): Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories.
- `moveTo` (query; optional): Destination namespace that should receive this namespace's content before deletion. Omit to permanently delete the content.

## GET /organization — Get organization settings

Read the shared background that guides memory formation across the organization, together with the number of active namespaces.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

org = client.organization.get()
print(org.organizational_context, org.namespace_count)
```

## PATCH /organization — Update organization settings

Give Supermemory organization-wide background that improves how content is interpreted across every namespace. Send null to remove the existing context.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

client.organization.update(
    organizational_context="Acme sells billing software to dental clinics.",
)
```

## GET /ns/{namespace}/memories/{id} — Get memory

Retrieve one memory by ID. Optionally include its version history and connected memories (each list walks outward up to relatedLimit) and its source document.

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

memory = client.memories.get("user_123", "mem_abc123", include=["related", "documents"])
print(memory.memory, memory.is_latest)
```

Parameters:
- `namespace` (path; required): Namespace containing the memories to forget. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories.
- `id` (path; required): Memory identifier
- `include` (query; optional): Comma-separated extras. related: the memory's version history and connected memories. documents: the source document, also attached to each related memory when both are requested.
- `relatedLimit` (query; optional): Maximum parents, children and siblings to return, applied to each list separately. Each list walks outward from the memory until it reaches this many.

## POST /feedback — Send feedback

Report a bug, request a feature or flag a docs problem to the Supermemory team. Built for AI agents: send structured JSON and an engineer picks it up.

Authentication is optional for requests with a usable client IP. Cross-zone Cloudflare Worker requests and requests without a client IP must provide an API key. With an API key the limit is 3 submissions per organization per UTC day; without one it is 3 per IPv4 address or IPv6 /64, shared with everyone behind that address. Authenticated submissions have a separate 200/day pool; anonymous submissions share a 20/day pool. Pass your API key to get your own quota.

No Python SDK code sample is included in the snapshot.
