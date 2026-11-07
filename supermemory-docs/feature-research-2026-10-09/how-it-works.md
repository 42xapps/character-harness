> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# How Supermemory works

> How a file or chat turn becomes something you can search: the ingest pipeline, statuses and outputs.

At its core, supermemory is powered by a custom learning model and a graph database that we built internally.

<CardGroup cols={2}>
  <Card title="Learning model">
    Decides what and how to learn, what is important, when to forget, creating relations, etc.
  </Card>

  <Card title="Temporal vector-graph engine">
    Where the learnings are actually stored, optimized for search. Fact-based temporal graph that has Vector, FTS, and graph built in.
  </Card>
</CardGroup>

But, you don't have to think about the above. The interface for users is as simple as it gets.

## Get started in under a minute

<CardGroup cols={2}>
  <Card title="1. Get an API key" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/key-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=dbebb5b8c96e2f56479cdd0a6ec92a12" href="https://console.supermemory.ai" width="24" height="24" data-path="icons/hugeicons/key-01.svg">
    From the [developer console](https://console.supermemory.ai) — **API Keys → Create API Key**. `console.supermemory.ai` is where keys and usage live.
  </Card>

  <Card title="2. Use it" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/command-line.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=b91bfbcbffc8b80ae6295c771d68f59a" href="/docs/using-supermemory" width="24" height="24" data-path="icons/hugeicons/command-line.svg">
    Install the SDK, drop in your key, add a memory, and search it — right below, or the full [ingest → retrieve loop](/docs/using-supermemory).
  </Card>
</CardGroup>

<CodeGroup>
  ```typescript TypeScript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  import { Supermemory } from "supermemory";

  const supermemory = new Supermemory({ apiKey: "sm_..." }); // from console.supermemory.ai → API Keys

  await supermemory.add("user_123", {
    content: "The user loves Paris.",
    dreaming: "instant", // memories available right after processing
  });

  const { results } = await supermemory.search("user_123", {
    query: "where does the user want to travel?",
  });
  ```

  ```python Python theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  # pip install supermemory
  from supermemory import Supermemory

  client = Supermemory(api_key="sm_...")  # from console.supermemory.ai → API Keys

  client.add(
      "user_123",
      content="The user loves Paris.",
      dreaming="instant",  # memories available right after processing
  )

  results = client.search("user_123", query="where does the user want to travel?")
  ```

  ```bash curl theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  curl -X POST "https://api.supermemory.ai/ns/user_123/document?dreaming=instant" \
    -H "Authorization: Bearer sm_..." \
    -H "Content-Type: application/json" \
    -d '{ "content": "The user loves Paris." }'

  curl -X POST "https://api.supermemory.ai/ns/user_123/search" \
    -H "Authorization: Bearer sm_..." \
    -H "Content-Type: application/json" \
    -d '{ "query": "where does the user want to travel?" }'
  ```
</CodeGroup>

## What you send: documents

A **document** is raw input — whatever you hand Supermemory:

* Conversation transcripts and messages
* Text, markdown, HTML
* PDFs, images, audio/video, code
* URLs and connector items (Drive, Notion, Gmail, …)

You do not pre-chunk or pick an embedding model. See [Multi-modal ingestion](/docs/concepts/content-types) for formats, and [Add context](/docs/ingestion/add-memories) for the API.

Supermemory handles the ingestion and extraction for you. This also gives us a big advantage for quality - The engine extracts it in an optimized way with Contextual Chunking and other features for better quality search and memory generation.

> Use a stable **`id`** when the same conversation or file will be updated later (sessions, connector syncs). That identity also drives [diff billing](/docs/overview/billing#full-discount-on-already-seen-tokens-diff-billing) on re-ingest.

## What the pipeline does

| Stage | What happens |
| - | - |
| **Queued** | Accepted; waiting to run |
| **Extracting** | Text / OCR / transcription / page fetch |
| **Chunking** | Splits content for retrieval (type-aware where needed) |
| **Embedding** | Vectors for similarity search |
| **Indexing** | Makes chunks and derived structure searchable |
| **Done** | Document path is ready for search |

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
const doc = await supermemory.add("user_123", {
  content: conversationText,
  id: "chat_session_1",
});

// Poll until ready
const { system } = await supermemory.documents.get("user_123", doc.id);
// system.status → "queued" | "extracting" | ... | "done" | "failed"
```

Larger PDFs and long video take longer. Short chat turns usually finish in seconds.

## Dreaming (how memories enter the graph)

A document with status `done` has its chunks indexed for search. Memories (the graph's facts, updates and derived facts) come from a second phase called **dreaming**.

This is when the content is passed through the memory model and merged, arranged and organized for the future.

Pass `dreaming` on [add](/docs/ingestion/add-memories) (a query parameter, so a top-level key in the SDK):

| Mode | Default? | Behavior | When to use |
| - | - | - | - |
| **`dynamic`** | Yes | Related documents are grouped so memories form from **coherent units**, not one isolated write at a time. Graph quality is higher for real multi-turn / multi-doc flows. Memory extraction may continue **after** `status: "done"`. | Production agents, connectors, ongoing sessions |
| **`instant`** | No | This document is dreamed on its own, right away. Memories are available as soon as processing finishes for that document. Bills one extra [operation](/docs/overview/billing) per document. | Demos, quickstarts, “I need the graph now” |

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
// Production default — omit or set explicitly
await supermemory.add("user_123", {
  content: conversationText,
  id: "chat_session_1",
  dreaming: "dynamic",
});

// Need memories immediately (e.g. tutorial)
await supermemory.add("user_123", {
  content: conversationText,
  id: "chat_session_1",
  dreaming: "instant",
});
```

**Rule of thumb:** use `dynamic` in real apps for better quality and cost, because batching lets new memories connect to related ones. Use `instant` when the very next step is a memory search or profile that must already reflect this document, as in the [quickstart](/docs/quickstart).

How those memories connect and stay true over time is [Graph memory](/docs/concepts/graph-memory). API detail: [Processing modes](/docs/ingestion/add-memories#processing-modes).

## What you get out

After the pipeline runs, the same document leads to three things -> Chunks, Memories and Profile. (in the same `namespace`):

| Output | Role | Go deeper |
| - | - | - |
| **Document chunks** | Grounding in the raw source (RAG / SuperRAG) | [SuperRAG](/docs/concepts/super-rag), [Search API](/docs/recall/search) |
| **Memories** | Extracted facts in a living graph — updates, links, time | [Graph memory](/docs/concepts/graph-memory) |
| **Profile** | A sample of memories, static + dynamic summary for always-on context | [Profiles](/docs/concepts/user-profiles), [Profile API](/docs/recall/user-profiles) |

Supermemory does more than store the file. It derives memories (what it understood) and keeps chunks (the source), so you can both personalize and ground answers. That distinction is the core of [Memory vs RAG](/docs/concepts/memory-vs-rag).

## Isolation and identity

* **`namespace`** — hard isolation boundary (user, tenant, project), carried in the URL. See [Namespaces](/docs/concepts/container-tags).
* **Metadata** — soft dimensions *inside* a namespace for filtering. See [Metadata filtering](/docs/concepts/filtering).
* **Scoped API keys** — credentials that cannot cross a namespace. See [API keys](/docs/authentication#scoped-api-keys).

## Next steps

<CardGroup cols={2}>
  <Card title="Graph memory" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/share-08.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=9b849dda8874828c8a2b364218efa126" href="/docs/concepts/graph-memory" width="24" height="24" data-path="icons/hugeicons/share-08.svg">
    How facts connect, update, and stay true over time.
  </Card>

  <Card title="Multi-modal ingestion" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/files-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=5d877069f581908e54f816387a7e5dc9" href="/docs/concepts/content-types" width="24" height="24" data-path="icons/hugeicons/files-01.svg">
    Formats, extractors, and what you can send.
  </Card>

  <Card title="Add context" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/plus-sign.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=76201fd0c044376c8e40651e398cde41" href="/docs/ingestion/add-memories" width="24" height="24" data-path="icons/hugeicons/plus-sign.svg">
    API: add, id, files, dreaming, status.
  </Card>

  <Card title="Search API" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/search-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=8758614baf45904094a215b61f8f6bc3" href="/docs/recall/search" width="24" height="24" data-path="icons/hugeicons/search-01.svg">
    Query documents and memories after the pipeline finishes.
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.