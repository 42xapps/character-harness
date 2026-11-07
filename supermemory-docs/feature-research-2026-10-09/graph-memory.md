> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Graph memory

> How facts connect, update and stay true: relationships, temporal truth and automatic forgetting.

**How understanding is stored and stays true over time.**

Supermemory builds a **living knowledge graph of facts on top of other facts** — not a static folder of embeddings, and not classic entity–relation–entity triples you maintain by hand.

The **pipeline** that turns a chat or file into memories is [How it works](/docs/concepts/how-it-works).

This page is the **model**: what a memory is, how edges form, and why agents utilize supermemory's graph

## Try it

Get a key from the [developer console](https://console.supermemory.ai) — **API Keys → Create API Key** — then add a memory and pull it back with related edges:

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
import { Supermemory } from "supermemory";

const supermemory = new Supermemory({ apiKey: "sm_..." }); // from console.supermemory.ai → API Keys

await supermemory.add("user_123", {
  content: "Alex mentioned he just started at Stripe",
  dreaming: "instant", // memories land in the graph right away
});

const results = await supermemory.search("user_123", {
  query: "where does Alex work?",
  include: { related: true },
  searchMode: "memories",
});
```

Full walkthrough with a live example: [Quickstart](/docs/quickstart).

<img src="https://mintcdn.com/supermemory/nafXZdsbm5CLncox/images/graph-view.png?fit=max&auto=format&n=nafXZdsbm5CLncox&q=85&s=e05dffd1f85e514d65e962b8bcbe70c3" alt="" width="2786" height="1662" data-path="images/graph-view.png" />

## Documents vs memories

| | **Documents** | **Memories** |
| - | - | - |
| **What** | Raw input you send | Facts Supermemory extracts |
| **Examples** | PDF, chat log, Drive file, URL | “Alex is a PM at Stripe” |
| **Role** | Source of truth for RAG / SuperRAG | Personal and entity state over time |
| **Lifecycle** | You add / update / delete | Graph updates, extends, derives, forgets |

Think of documents as books you hand the system. Memories are the insights it keeps — connected to each other as new content arrives.

<Note>
  Uploading a long PDF does more than store bytes: Supermemory derives many memories and links them to what it already knows about that entity or user. Chunks of the document remain available for [SuperRAG](/docs/concepts/super-rag) grounding.
</Note>

## Properties and rules of memories

1. Memories are atomic - Each memory has enough information and context about one particular topic
2. They always build on top of each other - with `updates`, the model knows the history, a memory `extends` from other memories, and new facts are derived (`derives` relation) from existing knowledge.

## Memory relationships

<img src="https://mintcdn.com/supermemory/nafXZdsbm5CLncox/images/memories-inferred.png?fit=max&auto=format&n=nafXZdsbm5CLncox&q=85&s=1755eced95305da072bcd9a598d5e3b5" alt="" width="5120" height="2880" data-path="images/memories-inferred.png" />

When content is processed, new facts connect to existing ones through three relationship types.

### Updates — information changes

New fact **replaces** what was true before for search purposes; history can remain for audit.

```text theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
Memory 1: "Alex works at Google as a software engineer"
Memory 2: "Alex just started at Stripe as a PM"
         → Memory 2 UPDATES Memory 1
```

`isLatest` (and related graph fields) keep retrieval on the current fact without erasing the past.

### Extends — information enriches

New fact **adds detail** without invalidating the old one.

```text theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
Memory 1: "Alex works at Stripe as a PM"
Memory 2: "Alex focuses on payments and leads a team of 5"
         → Memory 2 EXTENDS Memory 1
```

Both stay valid; context gets richer.

### Derives — information infers

Supermemory **infers** a fact you never stated in one place, from patterns across memories.

```text theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
Memory 1: "Alex is a PM at Stripe"
Memory 2: "Alex frequently discusses payment APIs and fraud detection"
         → Derived: "Alex likely works on Stripe's core payments product"
```

That is the same class of “entity chain” you see in the [quickstart](/docs/quickstart) (gift → VP of Product → Sarah → Tokyo offsite). Search can expose edges via `include: { related: true }`; they come back under `included.related` — see [Search API](/docs/recall/search).

## Automatic extraction (one input → many facts)

**Input:**

> Had a great call with Alex. He's enjoying the new PM role at Stripe, though the payments work is intense. He moved to Seattle for the job—Capitol Hill. Wants dinner next time I'm in town.

**Example extracted memories:**

* Alex works at Stripe as a PM
* Alex works on payments infrastructure *(extends role)*
* Alex lives in Seattle, Capitol Hill
* Alex wants to meet for dinner *(episodic)*

You do not define schema or draw edges. You [add content](/docs/ingestion/add-memories); the graph updates.

## Dreaming keeps the graph alive

Ingest is not a one-shot snapshot. After (and alongside) indexing, **dreaming** continues building the graph: extracting facts, linking related memories, resolving updates, and producing derives you never stated in one place.

By default Supermemory uses **`dreaming: "dynamic"`** — related documents are grouped so memories form from **coherent units** (e.g. a real multi-turn session), not each isolated write in isolation. That is why production quality is higher when you keep a stable `id` on conversations and let dynamic dreaming do its job.

Use **`dreaming: "instant"`** when this document must hit the graph immediately (demos, “search right after add”). That path processes the document alone and costs an extra operation.

How to set the flag, statuses, and when `done` means what: [How it works → Dreaming](/docs/concepts/how-it-works#dreaming-how-memories-enter-the-graph) and [Processing modes](/docs/ingestion/add-memories#processing-modes).

## Memory types

| Type | Example | Behavior |
| - | - | - |
| **Facts** | “Alex is a PM at Stripe” | Persists until updated |
| **Preferences** | “Alex prefers morning meetings” | Strengthens with repetition |
| **Episodes** | “Met Alex for coffee Tuesday” | Decays unless significant |

## Automatic forgetting

* **Time-based** — temporary facts drop after they expire (“exam tomorrow”, “meeting at 3pm today”).
* **Contradiction** — updates win for “what’s true now.”
* **Noise filtering** — casual, non-meaningful chatter is less likely to become durable memory.

For explicit product controls (forget, review low-confidence derives), see [Forget & update](/docs/recall/memory-operations) and [Memory review](/docs/recall/memory-review).

## What you don’t do

You do **not** hand-maintain the graph. You:

1. Ingest under a [namespace](/docs/concepts/container-tags)
2. Wait for the [pipeline](/docs/concepts/how-it-works) when needed
3. [Search](/docs/recall/search) or load a [profile](/docs/recall/user-profiles)

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
await supermemory.add("user_123", {
  content: "Alex mentioned he just started at Stripe",
});

const results = await supermemory.search("user_123", {
  query: "where does Alex work?",
  include: { related: true },
  searchMode: "memories",
});
// Prefer latest work fact (Stripe); history remains in the graph.
// Related edges come back under results[i].included.related
```

## Related in the docs

| If you need… | Go to |
| - | - |
| Pipeline statuses, dreaming, documents in | [How it works](/docs/concepts/how-it-works) |
| Memory vs document retrieval | [Memory vs RAG](/docs/concepts/memory-vs-rag) · [SuperRAG](/docs/concepts/super-rag) |
| Always-on summary of a user | [Profiles](/docs/concepts/user-profiles) |
| Isolation / tenants | [Multi-tenancy](/docs/concepts/container-tags) |
| API: add / search / forget | [Ingestion](/docs/ingestion/add-memories) · [Search](/docs/recall/search) · [Forget & update](/docs/recall/memory-operations) |

<CardGroup cols={2}>
  <Card title="How it works" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/cpu.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=1c725ade87b0133078337f6571870617" href="/docs/concepts/how-it-works" width="24" height="24" data-path="icons/hugeicons/cpu.svg">
    Ingest pipeline, statuses, and outputs.
  </Card>

  <Card title="Memory vs RAG" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/balance-scale.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=61389626467a795f811b458391f85327" href="/docs/concepts/memory-vs-rag" width="24" height="24" data-path="icons/hugeicons/balance-scale.svg">
    When to use memory vs document retrieval.
  </Card>

  <Card title="Profiles" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/user.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=215e9fc6444666b1367756f3d7a4c7f2" href="/docs/concepts/user-profiles" width="24" height="24" data-path="icons/hugeicons/user.svg">
    Static + dynamic context built from the graph.
  </Card>

  <Card title="Quickstart" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/play.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=96bf80d731de5a0e33803652c6ae151d" href="/docs/quickstart" width="24" height="24" data-path="icons/hugeicons/play.svg">
    See entity chains in a full conversation + document flow.
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.