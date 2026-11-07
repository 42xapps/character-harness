> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Add document

> Turn text or a supported URL into searchable, evolving memory. Supply a new ID to create a document, or reuse an existing ID to append new information while preserving its history.



## OpenAPI

````yaml https://api.supermemory.ai/v5/openapi post /ns/{namespace}/document
openapi: 3.1.0
info:
  title: supermemory API
  description: >-
    The Memory API for the AI era. OpenAPI operations include x-codeSamples for
    the official TypeScript and Python SDKs (Mintlify-compatible).
  version: 5.0.0
servers:
  - description: Production Server
    url: https://api.supermemory.ai
security:
  - bearerAuth: []
tags:
  - name: Ingest
    description: Ingest documents, files, URLs, conversations, and other content
  - name: Recall (Search)
    description: >-
      Semantic recall across your content — supports memories, hybrid, and
      documents modes
  - name: Profiles
    description: Maintained static, dynamic, and custom-bucket profiles scoped by namespace
  - name: Content Management
    description: List, get, update, and delete content and memories
  - name: Namespaces
    description: List and manage isolated namespaces and their settings
  - name: Connectors
    description: >-
      Sync external sources such as Google Drive, Notion and GitHub into a
      namespace
  - name: Organization
    description: Read and update organization-wide settings
  - name: Feedback
    description: Report bugs, request features, and flag documentation issues
paths:
  /ns/{namespace}/document:
    post:
      tags:
        - Ingest
      summary: Add document
      description: >-
        Turn text or a supported URL into searchable, evolving memory. Supply a
        new ID to create a document, or reuse an existing ID to append new
        information while preserving its history.
      operationId: postNsByNamespaceDocument
      parameters:
        - in: path
          name: namespace
          schema:
            example: user_alex
            type: string
            maxLength: 100
            pattern: ^[a-zA-Z0-9_:-]+$
          required: true
          description: >-
            The isolated namespace. This can be an ID for your user, a project
            ID, or any other identifier you wish to use to scope documents.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                content:
                  type: string
                  description: >-
                    The content to process. This may be plaintext or a URL to
                    supported rich content.
                  example: Supermemory turns unstructured content into evolving memory.
                id:
                  description: An optional caller-defined document ID
                  type: string
                  minLength: 1
                  maxLength: 255
                  example: my-doc-123
                supportingContext:
                  description: >-
                    Context used to guide memory extraction within this
                    namespace. Max 1500 characters.
                  example: Focus on product decisions, dates, and owners.
                  type: string
                  maxLength: 1500
                metadata:
                  description: Arbitrary metadata attached to the document and derived data
                  example:
                    source: api-docs
                  type: object
                  propertyNames:
                    type: string
                  additionalProperties:
                    anyOf:
                      - type: string
                      - type: number
                      - type: boolean
                      - type: array
                        items:
                          type: string
                group:
                  description: >-
                    Metadata values that isolate related context within the
                    namespace
                  type: object
                  propertyNames:
                    type: string
                  additionalProperties:
                    anyOf:
                      - type: string
                      - type: number
                      - type: boolean
                      - type: array
                        items:
                          type: string
                date:
                  description: When the source content is from, in ISO 8601 format
                  example: '2026-01-15'
                  type: string
                taskType:
                  description: >-
                    Processing pipeline. "memory" builds durable learned
                    context; "superrag" optimizes the document for retrieval
                    without generating memories.
                  type: string
                  enum:
                    - memory
                    - superrag
                dreaming:
                  description: >-
                    Processing mode. "dynamic" (default) groups related
                    documents so memories form from coherent context. "instant"
                    processes each document independently right away and bills
                    one extra operation per document.
                  type: string
                  enum:
                    - dynamic
                    - instant
              required:
                - content
              additionalProperties: false
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  id:
                    type: string
                    minLength: 1
                    description: Document identifier to poll or retrieve
                  status:
                    type: string
                    enum:
                      - unknown
                      - queued
                      - extracting
                      - chunking
                      - embedding
                      - indexing
                      - done
                      - failed
                    description: >-
                      The document's processing state after this request. queued
                      when new work was queued; otherwise its current state,
                      e.g. done for an unchanged duplicate or failed for a
                      metadata-only update to a failed document.
                required:
                  - id
                  - status
                additionalProperties: false
          description: Document accepted for processing
        '400':
          description: Invalid request parameters
          content:
            application/json:
              schema:
                oneOf:
                  - $ref: '#/components/schemas/ErrorResponse'
                  - $ref: '#/components/schemas/ValidationErrorResponse'
        '401':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Unauthorized
        '402':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Insufficient processing credits
        '403':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Namespace write access denied
        '409':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Namespace merge or filepath conflict
        '500':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Server error
      x-codeSamples:
        - lang: typescript
          label: TypeScript SDK
          source: |-
            import { Supermemory } from "supermemory";

            const client = new Supermemory(); // reads SUPERMEMORY_API_KEY

            const doc = await client.add("user_123", {
              content: "Sarah is being promoted to VP of Product.",
              id: "chat_session_1",
              metadata: { type: "conversation" },
              dreaming: "instant",
            });
            console.log(doc.id, doc.status);
        - lang: python
          label: Python SDK
          source: |-
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
        - lang: bash
          label: cURL
          source: |-
            curl -X POST "https://api.supermemory.ai/ns/user_123/document" \
              -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
              -H "Content-Type: application/json" \
              -d '{
                "content": "Sarah is being promoted to VP of Product.",
                "id": "chat_session_1",
                "metadata": { "type": "conversation" },
                "dreaming": "instant"
              }'
components:
  schemas:
    ErrorResponse:
      type: object
      properties:
        error:
          type: string
          description: Error message
          example: Invalid request parameters
        details:
          type: string
          description: Additional error details
          example: Query must be at least 1 character long
      required:
        - error
    ValidationErrorResponse:
      type: object
      description: Body returned when request input fails schema validation
      properties:
        success:
          type: boolean
          enum:
            - false
        error:
          type: array
          description: Validation issues
          items:
            type: object
            properties:
              message:
                type: string
              path:
                type: array
                items:
                  oneOf:
                    - type: string
                    - type: number
            required:
              - message
        data:
          description: The input that failed validation
      required:
        - success
        - error
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.