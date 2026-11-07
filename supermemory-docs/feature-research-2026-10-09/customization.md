> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Customizing for your use case

> Configure Supermemory's behavior for your specific application

Configure how Supermemory processes and retrieves content for your specific use case.

## Organizational Context

Tell Supermemory what your organization does and what content matters during ingestion. This steers what gets extracted into memories across every namespace. In v3/v4 this field was called `filterPrompt`.

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
// Example: Brand guidelines assistant
await supermemory.organization.update({
  organizationalContext: `You are ingesting content for Brand.ai's brand guidelines system.

    Index:
    - Official brand values and mission statements
    - Approved tone of voice guidelines
    - Logo usage and visual identity docs
    - Approved messaging and taglines

    Skip:
    - Draft documents and work-in-progress
    - Outdated brand materials (pre-2024)
    - Internal discussions about brand changes
    - Competitor analysis docs`,
  },
});
```

<AccordionGroup>
  <Accordion title="Personal assistant">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    organizationalContext: `Personal AI assistant. Prioritize recent content, action items,
    and personal context. Exclude spam and duplicates.`
    ```
  </Accordion>

  <Accordion title="Customer support">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    organizationalContext: `Customer support agent. Prioritize verified solutions, official docs,
    and resolved tickets. Exclude internal discussions and PII.`
    ```
  </Accordion>

  <Accordion title="Legal assistant">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    organizationalContext: `Legal research assistant. Prioritize precedents, current regulations,
    and approved contract language. Exclude privileged communications.`
    ```
  </Accordion>

  <Accordion title="Finance agent">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    organizationalContext: `Financial analysis assistant. Prioritize latest reports, verified data,
    and regulatory filings. Exclude speculative data and MNPI.`
    ```
  </Accordion>

  <Accordion title="Healthcare">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    organizationalContext: `Healthcare information assistant. Prioritize evidence-based guidelines
    and FDA-approved info. Exclude PHI and outdated recommendations.`
    ```
  </Accordion>

  <Accordion title="Developer docs">
    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    organizationalContext: `Developer documentation assistant. Prioritize current APIs, working
    examples, and best practices. Exclude deprecated APIs and test fixtures.`
    ```
  </Accordion>
</AccordionGroup>

The value replaces the existing context in full. Send `null` to clear it. The legacy `shouldLLMFilter`, `categories`, `includeItems`, and `excludeItems` settings are not part of the v5 organization resource.

***

## Supporting Context

Guide memory extraction for a specific namespace. Organizational context is org-wide; supporting context is per namespace. In v3/v4 this field was called `entityContext`.

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
await supermemory.add("session_abc123", {
  content: "User asked about logo variations for dark backgrounds...",
  supportingContext: `Design exploration conversation between john@acme.com and Brand.ai assistant.
    Focus on John's design preferences and brand requirements.`,
});
```

<Accordion title="Update supporting context only">
  Set the supporting context for a namespace without uploading content.

  ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
  await supermemory.namespaces.update("session_abc123", {
    supportingContext: `Design exploration conversation between john@acme.com and Brand.ai assistant.
      Focus on John's design preferences and brand requirements.`,
  });
  ```
</Accordion>

<Note>
  Supporting context persists on the namespace and combines with the org-level organizational context.
</Note>

***

## Chunk size

Control how documents are split into searchable pieces. Smaller chunks = more precise retrieval but less context per result.

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
await client.settings.update({
  chunkSize: 512  // -1 for default
});
```

| Use Case | Chunk Size | Why |
| - | - | - |
| Citations & references | `256-512` | Precise source attribution |
| Q\&A / Support | `512-1024` | Balanced context |
| Long-form analysis | `1024-2048` | More context per chunk |
| Default | `-1` | Supermemory's optimized default |

<Note>
  Smaller chunks generate more memories per document. Larger chunks provide more context but may reduce precision.
</Note>

***

## Connector branding

Show "Log in to **YourApp**" instead of "Log in to Supermemory" when users connect external services. See [Connectors Overview](/docs/connectors/overview) for the full list of supported integrations.

<AccordionGroup>
  <Accordion title="Google Drive">
    1. Create OAuth credentials in [Google Cloud Console](https://console.cloud.google.com/)
    2. Redirect URI: `https://api.supermemory.ai/v3/connections/google-drive/callback`

    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    await client.settings.update({
      googleDriveCustomKeyEnabled: true,
      googleDriveClientId: "your-client-id.apps.googleusercontent.com",
      googleDriveClientSecret: "your-client-secret"
    });
    ```
  </Accordion>

  <Accordion title="Notion">
    1. Create integration at [Notion Developers](https://developers.notion.com/)
    2. Redirect URI: `https://api.supermemory.ai/v3/connections/notion/callback`

    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    await client.settings.update({
      notionCustomKeyEnabled: true,
      notionClientId: "your-notion-client-id",
      notionClientSecret: "your-notion-client-secret"
    });
    ```
  </Accordion>

  <Accordion title="OneDrive">
    1. Register app in [Azure Portal](https://portal.azure.com/)
    2. Redirect URI: `https://api.supermemory.ai/v3/connections/onedrive/callback`

    ```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
    await client.settings.update({
      onedriveCustomKeyEnabled: true,
      onedriveClientId: "your-azure-app-id",
      onedriveClientSecret: "your-azure-client-secret"
    });
    ```
  </Accordion>
</AccordionGroup>

***

## API reference

```typescript theme={"theme":{"light":"github-light-default","dark":"github-dark-default"}}
// Read organization settings
const { organizationalContext, namespaceCount } = await supermemory.organization.get();

// Update organization context
await supermemory.organization.update({ organizationalContext: "..." });

// Read and update one namespace
const ns = await supermemory.namespaces.get("session_abc123");
await supermemory.namespaces.update("session_abc123", {
  supportingContext: "...",
});
```

<Note>
  Organization settings are organization-wide and require an organization administrator. Changes apply to new content only—existing memories aren't reprocessed.
</Note>

***

## Next steps

<CardGroup cols={2}>
  <Card title="Add memories" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/plus-sign.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=76201fd0c044376c8e40651e398cde41" href="/docs/ingestion/add-memories" width="24" height="24" data-path="icons/hugeicons/plus-sign.svg">
    See your custom settings in action
  </Card>

  <Card title="Connectors" icon="https://mintcdn.com/supermemory/p0zPjih-OxhkPwgX/icons/hugeicons/plug-01.svg?fit=max&auto=format&n=p0zPjih-OxhkPwgX&q=85&s=d19f94c6b17b7e2d41d1be8f717d95c0" href="/docs/connectors/overview" width="24" height="24" data-path="icons/hugeicons/plug-01.svg">
    Set up automatic syncing from external platforms
  </Card>
</CardGroup>


This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.