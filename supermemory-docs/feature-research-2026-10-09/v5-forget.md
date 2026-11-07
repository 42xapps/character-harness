> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Forget memories by ID

> Remove exact memories from normal recall while preserving their audit history. Each ID is handled independently and any missing or ineligible memory is reported without rolling back successful changes.



## OpenAPI

````yaml https://api.supermemory.ai/v5/openapi delete /ns/{namespace}/memories
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
  /ns/{namespace}/memories:
    delete:
      tags:
        - Content Management
      summary: Forget memories by ID
      description: >-
        Remove exact memories from normal recall while preserving their audit
        history. Each ID is handled independently and any missing or ineligible
        memory is reported without rolling back successful changes.
      operationId: deleteNsByNamespaceMemories
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
            Namespace containing the memories to forget. This can be an ID for
            your user, a project ID, or any other identifier you wish to use to
            scope memories.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                ids:
                  minItems: 1
                  maxItems: 500
                  type: array
                  items:
                    type: string
                    minLength: 1
                    description: Stable memory identifier
                  description: Memory identifiers to remove from normal recall
                  example:
                    - mem_abc123
              required:
                - ids
              additionalProperties: false
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  count:
                    type: integer
                    minimum: 0
                    maximum: 9007199254740991
                    description: Number of memories matched by this operation
                  errors:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: Requested memory identifier
                        error:
                          type: string
                          description: Why the memory could not be forgotten
                      required:
                        - id
                        - error
                      additionalProperties: false
                    description: Per-memory failures for exact-ID requests
                  matches:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: Stable identifier of the matched memory
                        memory:
                          type: string
                          description: Matched memory text
                      required:
                        - id
                        - memory
                      additionalProperties: false
                    description: >-
                      Memories selected by the operation, whether previewed or
                      forgotten
                required:
                  - count
                  - errors
                  - matches
                additionalProperties: false
          description: Exact memory forget completed
        '400':
          description: Invalid request
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
        '403':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Namespace write access denied
        '500':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Server error
      x-codeSamples:
        - lang: typescript
          label: TypeScript SDK
          source: >-
            import { Supermemory } from "supermemory";


            const client = new Supermemory(); // reads SUPERMEMORY_API_KEY


            const res = await client.memories.forget("user_123", { ids:
            ["mem_1", "mem_2"] });

            console.log(res.count, res.errors);
        - lang: python
          label: Python SDK
          source: |-
            from supermemory import Supermemory

            client = Supermemory()  # reads SUPERMEMORY_API_KEY

            res = client.memories.forget("user_123", ids=["mem_1", "mem_2"])
            print(res.count, res.errors)
        - lang: bash
          label: cURL
          source: |-
            curl -X DELETE "https://api.supermemory.ai/ns/user_123/memories" \
              -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
              -H "Content-Type: application/json" \
              -d '{ "ids": ["mem_1", "mem_2"] }'
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