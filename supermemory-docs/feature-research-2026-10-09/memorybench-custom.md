> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Building a benchmark

> Add a custom benchmark dataset when the built-in ones don't match your use case

MemoryBench ships with three datasets — [LoCoMo](https://github.com/snap-research/locomo), [LongMemEval](https://huggingface.co/datasets/xiaowu0162/longmemeval-cleaned), and [ConvoMem](https://huggingface.co/datasets/Salesforce/ConvoMem) — but they won't cover every product. If your agent has a workflow the built-in benchmarks don't exercise (a specific domain, a scenario your users actually hit, a regression you want to guard against), you can add your own benchmark dataset and every provider — including Supermemory — runs against it the same way.

## Choosing between the built-in datasets

Before building your own, check whether one of the existing datasets already covers what you need:

| Benchmark | Best for | Primary challenge |
| - | - | - |
| **LoCoMo** | Personal assistants, support bots — anything with recurring sessions over days/weeks | Temporal context, cross-session recall |
| **LongMemEval** | RAG / document search, knowledge bases | Information density, precise retrieval, synthesis |
| **ConvoMem** | Dialogue systems, interview bots, meeting assistants | Reference resolution within a single conversation |

You can also run all three to get a full picture of where a memory system is strong or weak — a system that's great at LoCoMo but weak at LongMemEval is good at temporal recall but struggles with dense information retrieval, for example.

## The benchmark interface

Every dataset — built-in or custom — implements the same interface (`src/types/benchmark.ts`):

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
interface Benchmark {
  name: string
  load(config?: BenchmarkConfig): Promise<void>
  getQuestions(filter?: QuestionFilter): UnifiedQuestion[]
  getHaystackSessions(questionId: string): UnifiedSession[]
  getGroundTruth(questionId: string): string
  getQuestionTypes(): QuestionTypeRegistry
}
```

Sessions — the raw conversational data a provider ingests before being asked a question — are normalized to a single shape regardless of benchmark:

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
interface UnifiedSession {
  sessionId: string
  messages: Array<{ role: "user" | "assistant"; content: string }>
  metadata?: {
    date?: string           // ISO format
    formattedDate?: string  // human readable
    [key: string]: any
  }
}
```

## Adding your own benchmark

1. Create `src/benchmarks/mybenchmark/index.ts` implementing the `Benchmark` interface above
2. `load()` parses your dataset (JSON, CSV, whatever you have) into `UnifiedSession`s and questions
3. `getQuestions()` returns your question set, each with a ground-truth answer and a question type
4. Register it in `src/benchmarks/index.ts` and add the name to `BenchmarkName` in `src/types/benchmark.ts`
5. Run it exactly like a built-in benchmark:

```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
bun run src/index.ts run -p supermemory -b mybenchmark
bun run src/index.ts compare -p supermemory,mem0,zep -b mybenchmark
```

Question types are your own vocabulary — group questions however matters to your product (`billing_history`, `escalation_context`, `preference_drift`, etc.), and the final report breaks accuracy down per type so you can see exactly where a provider is strong or weak on *your* scenarios, not a generic academic one.

<Note>
  Full interface details and a working template: [`src/benchmarks/README.md`](https://github.com/supermemoryai/memorybench/blob/main/src/benchmarks/README.md) in the repo.
</Note>

***

## Next

<CardGroup cols={2}>
  <Card title="Adding a provider" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/plug-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=d19f94c6b17b7e2d41d1be8f717d95c0" href="/docs/memorybench/extend-provider" width="24" height="24" data-path="icons/hugeicons/plug-01.svg">
    Register a memory system to run against your new benchmark.
  </Card>

  <Card title="Measuring results" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/dashboard-speed-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=0ced843c641addbd38f2ac8a0983b75d" href="/docs/memorybench/memscore" width="24" height="24" data-path="icons/hugeicons/dashboard-speed-01.svg">
    How accuracy, latency, and MemScore are computed.
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.