> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Update namespace settings

> Shape how Supermemory understands an existing namespace by updating the background context used during ingestion and memory formation.



## OpenAPI

````yaml https://api.supermemory.ai/v5/openapi patch /ns/{namespace}
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
  /ns/{namespace}:
    patch:
      tags:
        - Namespaces
      summary: Update namespace settings
      description: >-
        Shape how Supermemory understands an existing namespace by updating the
        background context used during ingestion and memory formation.
      operationId: patchNsByNamespace
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
            Namespace identifier. This can be an ID for your user, a project ID,
            or any other identifier you wish to use to scope documents and
            memories.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                supportingContext:
                  description: >-
                    Background that guides how Supermemory interprets documents
                    and forms memories. Max 1500 characters. Set null to clear
                    it.
                  example: This namespace holds Acme Corp support tickets.
                  anyOf:
                    - type: string
                      maxLength: 1500
                    - type: 'null'
              additionalProperties: false
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  namespace:
                    type: string
                    description: Namespace identifier used in API paths
                  supportingContext:
                    anyOf:
                      - type: string
                      - type: 'null'
                    description: >-
                      Background that helps Supermemory interpret documents and
                      form better memories in this namespace
                  system:
                    type: object
                    properties:
                      createdAt:
                        type: string
                        format: date-time
                        description: ISO 8601 timestamp when the namespace was created
                      updatedAt:
                        type: string
                        format: date-time
                        description: ISO 8601 timestamp of the latest settings update
                    required:
                      - createdAt
                      - updatedAt
                    description: Namespace lifecycle timestamps
                required:
                  - namespace
                  - supportingContext
                  - system
          description: Updated namespace settings
        '400':
          description: Invalid namespace settings
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
          description: Write access required
        '404':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Namespace not found
        '500':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Internal server error
      x-codeSamples:
        - lang: typescript
          label: TypeScript SDK
          source: |-
            import { Supermemory } from "supermemory";

            const client = new Supermemory(); // reads SUPERMEMORY_API_KEY

            await client.namespaces.update("user_123", {
              supportingContext: "A paying customer on the Pro plan; prefers concise answers.",
            });
        - lang: python
          label: Python SDK
          source: |-
            from supermemory import Supermemory

            client = Supermemory()  # reads SUPERMEMORY_API_KEY

            client.namespaces.update(
                "user_123",
                supporting_context="A paying customer on the Pro plan; prefers concise answers.",
            )
        - lang: bash
          label: cURL
          source: |-
            curl -X PATCH "https://api.supermemory.ai/ns/user_123" \
              -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
              -H "Content-Type: application/json" \
              -d '{ "supportingContext": "A paying customer on the Pro plan; prefers concise answers." }'
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