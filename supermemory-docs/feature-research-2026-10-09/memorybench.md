> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# MemoryBench

> Open-source framework for benchmarking memory providers, including your own.

Benchmarking memory systems is hard, and most comparisons you'll find aren't apples-to-apples — different datasets, different judges, different prompts, cherry-picked runs. **MemoryBench** ([`supermemoryai/memorybench`](https://github.com/supermemoryai/memorybench), MIT licensed) is the open-source framework we built to fix that: the same benchmark questions, the same pipeline, and the same judges run against every provider, so a comparison actually means something.

We open-sourced it so you don't have to take our word for anything — you can run it yourself, against your own memory implementation, on the datasets that match your use case.

<Card title="git.new/membench" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/github.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=3e414fcf028a71e79cf737b7c1faa242" href="https://github.com/supermemoryai/memorybench" width="24" height="24" data-path="icons/hugeicons/github.svg">
  Clone it, run it against your own data, or read the source for exactly how each provider is scored.
</Card>

***

## Benchmark your own memory system

MemoryBench ships a **Claude Code skill** that automates the entire process of benchmarking a custom memory implementation — yours — against Supermemory, Mem0, and Zep. Point it at your code and it handles discovery, integration, and the run:

1. Asks a few questions about your setup (provider name, where your memory code lives, which benchmark, which competitors, how many questions)
2. Analyzes your memory code to find its init, ingest, and search methods
3. Generates a provider adapter and registers it with the framework
4. Runs the full benchmark against your chosen competitors
5. Reports accuracy, latency, and context-token results side by side

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
# From your project root
/memorybench
```

No manual TypeScript required to get a first result — see [Adding a Provider](/docs/memorybench/extend-provider) for what the skill generates and how to do it by hand.

***

## How it works

Every run goes through the same checkpointed pipeline, regardless of provider or benchmark:

```
INGEST → SEARCH → ANSWER → EVALUATE → REPORT
```

Ingestion can take hours for large datasets, and API calls fail — so every phase checkpoints independently and a run resumes from the last completed step instead of starting over.

<Columns cols={3}>
  <Card title="Supermemory" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/brain-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=0ab06c99fcc0924c3e42ca2007b7e8e9" href="https://supermemory.ai" width="24" height="24" data-path="icons/hugeicons/brain-01.svg">
    Chunk-based semantic search
  </Card>

  <Card title="Mem0" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/database-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=25b47dfe6ff1312512814b9d5b91fb5a" href="https://mem0.ai" width="24" height="24" data-path="icons/hugeicons/database-01.svg">
    LLM-powered memory extraction
  </Card>

  <Card title="Zep" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/flash.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=c464aedf918422993e85833592bb5763" href="https://getzep.com" width="24" height="24" data-path="icons/hugeicons/flash.svg">
    Knowledge graph construction
  </Card>
</Columns>

| Benchmark | Tests | Source |
| - | - | - |
| **LoCoMo** | Fact recall across extended, multi-session conversations — single-hop, multi-hop, temporal, adversarial | [snap-research/locomo](https://github.com/snap-research/locomo) |
| **LongMemEval** | Long-term memory across sessions, including knowledge that gets updated mid-conversation | [xiaowu0162/longmemeval](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned) |
| **ConvoMem** | Personalization, preference learning, and reference resolution within a conversation | [Salesforce/ConvoMem](https://huggingface.co/datasets/Salesforce/ConvoMem) |

None of these fit your use case? [Build your own benchmark](/docs/memorybench/extend-benchmark) — providers, benchmarks, and judges are all pluggable.

Judging is judge-agnostic too — score a run with GPT-4o, Claude, Gemini, or any model you configure, so results aren't an artifact of one evaluator's bias.

***

## Read next

<CardGroup cols={2}>
  <Card title="Building a benchmark" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/test-tube-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=918bc054b8ea821918b0f0b12286e9e3" href="/docs/memorybench/extend-benchmark" width="24" height="24" data-path="icons/hugeicons/test-tube-01.svg">
    Test on scenarios that actually match your product, not just the built-in datasets.
  </Card>

  <Card title="Adding a provider" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/plug-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=d19f94c6b17b7e2d41d1be8f717d95c0" href="/docs/memorybench/extend-provider" width="24" height="24" data-path="icons/hugeicons/plug-01.svg">
    Register your own memory system so it can be scored and compared.
  </Card>

  <Card title="Measuring results" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/dashboard-speed-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=0ced843c641addbd38f2ac8a0983b75d" href="/docs/memorybench/memscore" width="24" height="24" data-path="icons/hugeicons/dashboard-speed-01.svg">
    MemScore, judge scoring, and how to read a report.
  </Card>

  <Card title="Report an issue" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/bug-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=1756f936795f4767e753f11d8e8f9117" href="https://github.com/supermemoryai/memorybench/issues" width="24" height="24" data-path="icons/hugeicons/bug-01.svg">
    Found a bug, or want a provider/benchmark we don't support yet?
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.