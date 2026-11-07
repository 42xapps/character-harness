> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Add or update profile buckets

> Teach Supermemory new ways to organize this namespace's profile, or refine how existing namespace-owned buckets are classified. Omitted buckets remain unchanged and organization-wide buckets stay protected.



## OpenAPI

````yaml https://api.supermemory.ai/v5/openapi put /ns/{namespace}/profile/buckets
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
  /ns/{namespace}/profile/buckets:
    put:
      tags:
        - Profiles
      summary: Add or update profile buckets
      description: >-
        Teach Supermemory new ways to organize this namespace's profile, or
        refine how existing namespace-owned buckets are classified. Omitted
        buckets remain unchanged and organization-wide buckets stay protected.
      operationId: putNsByNamespaceProfileBuckets
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
            The isolated namespace to search. This can be an ID for your user, a
            project ID, or any other identifier you wish to use to scope
            memories.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                buckets:
                  type: object
                  propertyNames:
                    type: string
                    minLength: 1
                    maxLength: 64
                    pattern: ^[a-z0-9][a-z0-9_-]*$
                    description: Stable slug for the bucket, stored on each memory
                  additionalProperties:
                    type: string
                    maxLength: 2000
                  description: >-
                    Namespace-owned bucket names mapped to descriptions that
                    guide memory classification. Existing names are updated; new
                    names are added.
                  example:
                    interests: Topics the subject actively follows
              required:
                - buckets
              additionalProperties: false
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  buckets:
                    type: object
                    propertyNames:
                      type: string
                    additionalProperties:
                      type: string
                    description: >-
                      Effective bucket definitions keyed by name. Includes
                      organization buckets and namespace-owned additions.
                required:
                  - buckets
          description: Updated effective namespace profile bucket definitions
        '400':
          description: Invalid profile bucket definitions
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
          description: Namespace write access required
        '404':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: Namespace not found
        '409':
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
          description: An organization-level bucket cannot be changed
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

            await client.profiles.setBuckets("user_123", {
              buckets: {
                work: "Job, team, and current projects",
                preferences: "Food, travel, and communication preferences",
              },
            });
        - lang: python
          label: Python SDK
          source: |-
            from supermemory import Supermemory

            client = Supermemory()  # reads SUPERMEMORY_API_KEY

            client.profiles.set_buckets(
                "user_123",
                buckets={
                    "work": "Job, team, and current projects",
                    "preferences": "Food, travel, and communication preferences",
                },
            )
        - lang: bash
          label: cURL
          source: >-
            curl -X PUT "https://api.supermemory.ai/ns/user_123/profile/buckets"
            \
              -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
              -H "Content-Type: application/json" \
              -d '{
                "buckets": {
                  "work": "Job, team, and current projects",
                  "preferences": "Food, travel, and communication preferences"
                }
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