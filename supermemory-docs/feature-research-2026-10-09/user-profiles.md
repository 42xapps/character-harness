> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# User profiles

> Fetch and use automatically maintained user context

User profiles are extremely short summaries of context about an entity (Usually a user, but can be anything) which includes both the *static* facts about them, as well as a few recent episodes.

> You can think of these as a dynamic compaction that's done by supermemory in real-time.

This profile should be injected into the agent context for truly personalized experiences. To read more, visit [User profiles - Concept](/docs/concepts/user-profiles)

Get a user's profile — their static facts and dynamic context — with a single API call. One profile per `namespace` (what v3/v4 called a container tag).

<Tip>
  Profiles are built automatically as you [ingest content](/docs/ingestion/add-memories). No setup required. If you read a profile right after ingesting, pass `dreaming: "instant"` on the add; otherwise a fresh namespace can show an empty profile for minutes.
</Tip>

## Quick start

<Tabs>
  <Tab title="TypeScript">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    import { Supermemory } from "supermemory";

    const supermemory = new Supermemory({ apiKey: process.env.SUPERMEMORY_API_KEY });

    const { profile } = await supermemory.profile("user_123");

    console.log(profile.static.map((m) => m.memory));   // Long-term facts
    console.log(profile.dynamic.map((m) => m.memory));  // Recent context
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    from supermemory import Supermemory

    client = Supermemory()

    profile = client.profile("user_123").profile

    print([m.memory for m in profile.static])   # Long-term facts
    print([m.memory for m in profile.dynamic])  # Recent context
    ```
  </Tab>

  <Tab title="cURL">
    ```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    curl -X POST "https://api.supermemory.ai/ns/user_123/profile" \
      -H "Authorization: Bearer $SUPERMEMORY_API_KEY"
    ```
  </Tab>
</Tabs>

**Response:**

```json theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
{
  "profile": {
    "static": [
      { "id": "mem_1", "memory": "User is a software engineer" },
      { "id": "mem_2", "memory": "User specializes in Python and React" },
      { "id": "mem_3", "memory": "User prefers dark mode interfaces" }
    ],
    "dynamic": [
      { "id": "mem_4", "memory": "User is working on Project Alpha" },
      { "id": "mem_5", "memory": "User recently started learning Rust" },
      { "id": "mem_6", "memory": "User is debugging authentication issues" }
    ],
    "buckets": {}
  }
}
```

`static` and `dynamic` are always returned. Each entry is `{ id, memory }`; the `id` is the memory ID, so you can [forget](/docs/recall/memory-operations#forget-memories) a profile entry directly.

***

## Profile + search

The v5 profile call takes no query. When you also need query-ranked memories, run a [search](/docs/recall/search) next to it:

<Tabs>
  <Tab title="TypeScript">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    const [{ profile }, search] = await Promise.all([
      supermemory.profile("user_123"),
      supermemory.search("user_123", {
        query: "deployment errors",
        searchMode: "memories",
        limit: 5,
      }),
    ]);

    // Profile data
    const facts = profile.static.map((m) => m.memory);
    const context = profile.dynamic.map((m) => m.memory);

    // Query-specific memories
    const memories = search.results.map((r) => r.memory).filter(Boolean);
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    profile = client.profile("user_123").profile
    search = client.search(
        "user_123",
        query="deployment errors",
        search_mode="memories",
        limit=5,
    )

    # Profile data
    facts = [m.memory for m in profile.static]
    context = [m.memory for m in profile.dynamic]

    # Query-specific memories
    memories = [r.memory for r in search.results if r.memory]
    ```
  </Tab>
</Tabs>

***

## Parameters

`namespace` is a top-level key (URL path). `body` is optional and accepts only `filter` and `buckets`.

| Parameter | Type | Required | Description |
| - | - | - | - |
| `namespace` | string | Yes | User/project identifier |
| `body.filter` | object | No | Metadata filter applied to the memories that make up the profile |
| `body.buckets` | string\[] | No | Restrict the `buckets` section to specific names (up to 50). Omit for all configured buckets. See [Profile Buckets](/docs/user-profiles/buckets) |

***

## Filtering profiles

Profiles support the same [metadata filter](/docs/concepts/filtering) as `search` and `list` — `filter` narrows which memories are eligible to contribute to `static`, `dynamic`, and `buckets`.

<Tabs>
  <Tab title="TypeScript">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    const { profile } = await supermemory.profile("user_123", {
      filter: { field: "source", operator: "eq", value: "onboarding" },
    });
    ```
  </Tab>

  <Tab title="Python">
    ```python theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    profile = client.profile(
        "user_123",
        filter={"field": "source", "operator": "eq", "value": "onboarding"},
    ).profile
    ```
  </Tab>

  <Tab title="cURL">
    ```bash theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    curl -X POST "https://api.supermemory.ai/ns/user_123/profile" \
      -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
      -H "Content-Type: application/json" \
      -d '{
        "filter": { "field": "source", "operator": "eq", "value": "onboarding" }
      }'
    ```
  </Tab>
</Tabs>

Combine `filter` with `buckets` to scope both the profile synthesis and the bucket section in one call:

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
const { profile } = await supermemory.profile("org_customer_442", {
  filter: { field: "channel", operator: "eq", value: "support_ticket" },
  buckets: ["billing"],
});
```

All filter operators from [Organizing & Filtering](/docs/concepts/filtering) are supported — `eq`/`neq`, `contains`/`notContains`, numeric comparisons, `arrayContains`, and nested `and`/`or`.

***

## Building prompts

The most common pattern — inject profile into your LLM's system prompt:

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
async function chat(userId: string, message: string) {
  const { profile } = await supermemory.profile(userId);

  const systemPrompt = `You are assisting a user.

ABOUT THE USER:
${profile.static.map((m) => m.memory).join('\n') || 'No profile yet.'}

CURRENT CONTEXT:
${profile.dynamic.map((m) => m.memory).join('\n') || 'No recent activity.'}

Personalize responses to their expertise and preferences.`;

  return llm.chat({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ]
  });
}
```

***

## Full context pattern

Get profile + query-specific memories:

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
async function getContext(userId: string, query: string) {
  const [{ profile }, search] = await Promise.all([
    supermemory.profile(userId),
    supermemory.search(userId, {
      query,
      threshold: 0.6,
      searchMode: "memories",
    }),
  ]);

  return `
User Background:
${profile.static.map((m) => m.memory).join('\n')}

Current Context:
${profile.dynamic.map((m) => m.memory).join('\n')}

Relevant Memories:
${search.results.map((r) => r.memory).filter(Boolean).join('\n') || 'None'}
  `;
}
```

***

## Profile buckets

Buckets are **custom topical categories** for a profile — an axis that sits alongside
`static` and `dynamic`, grouping facts by subject (e.g. `preferences`, `goals`,
`work`) instead of by how long-lived they are.

<Card title="Profile Buckets" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/tag-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=56c6fe8e2dd478492108ac015f922b7d" href="/docs/user-profiles/buckets" width="24" height="24" data-path="icons/hugeicons/tag-01.svg">
  Read and configure buckets — request bucketed profiles, create namespace buckets,
  and see validation limits.
</Card>

***

## Framework examples

<Accordion title="Express.js middleware">
  ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  async function withProfile(req, res, next) {
    if (!req.user?.id) return next();

    try {
      const { profile } = await supermemory.profile(req.user.id);
      req.userProfile = profile;
    } catch (e) {
      req.userProfile = null;
    }
    next();
  }

  app.use(withProfile);

  app.post('/chat', (req, res) => {
    // req.userProfile available in all routes
  });
  ```
</Accordion>

<Accordion title="Next.js API route">
  ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  // app/api/chat/route.ts
  export async function POST(req: NextRequest) {
    const { userId, message } = await req.json();

    const { profile } = await supermemory.profile(userId);

    const response = await generateResponse(message, profile);
    return NextResponse.json({ response });
  }
  ```
</Accordion>

<Accordion title="AI SDK integration">
  ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  import { withSupermemory } from "@supermemory/tools/ai-sdk"
  import { openai } from "@ai-sdk/openai"

  // Profiles automatically injected
  const model = withSupermemory(openai("gpt-4"), {
    namespace: "user-123",
    id: "conv-1",
  })

  const result = await generateText({
    model,
    messages: [{ role: "user", content: "Help with my project" }]
  });
  ```

  See [AI SDK Integration](/docs/integrations/ai-sdk) for details.
</Accordion>

***

## Response schema

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
interface ProfileEntry {
  id: string;       // memory ID
  memory: string;   // the fact
}

interface ProfileResponse {
  profile: {
    static: ProfileEntry[];                      // Long-term facts
    dynamic: ProfileEntry[];                     // Recent context
    buckets: Record<string, ProfileEntry[]>;     // Topical buckets, keyed by bucket name
  };
}
```

***

## Next steps

* [Profile Buckets](/docs/user-profiles/buckets) — Custom topical categories for profiles
* [User Profiles Concept](/docs/concepts/user-profiles) — Understand static vs dynamic
* [Ingesting Content](/docs/ingestion/add-memories) — Build profiles by adding content
* [AI SDK Integration](/docs/integrations/ai-sdk) — Automatic profile injection


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.