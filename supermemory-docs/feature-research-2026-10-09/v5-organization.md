> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# Update organization settings

> Give Supermemory organization-wide background that improves how content is interpreted across every namespace. Send null to remove the existing context.



## OpenAPI

````yaml https://api.supermemory.ai/v5/openapi patch /organization
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
  /organization:
    patch:
      tags:
        - Organization
      summary: Update organization settings
      description: >-
        Give Supermemory organization-wide background that improves how content
        is interpreted across every namespace. Send null to remove the existing
        context.
      operationId: patchOrganization
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                organizationalContext:
                  anyOf:
                    - type: string
                      minLength: 1
                    - type: 'null'
                  description: >-
                    Shared background that guides memory formation across every
                    namespace. Set null to clear it.
                  example: Acme Corp builds developer tools for startups.
              required:
                - organizationalContext
              additionalProperties: false
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  organizationalContext:
                    anyOf:
                      - type: string
                      - type: 'null'
                    description: >-
                      Shared background that helps Supermemory interpret content
                      consistently across every namespace
                  namespaceCount:
                    type: integer
                    minimum: 0
                    maximum: 9007199254740991
                    description: Number of namespaces in the organization
                required:
                  - organizationalContext
                  - namespaceCount
          description: Organization settings updated successfully
        '400':
          description: Invalid organization settings
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
          description: Admin access required
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

            await client.organization.update({
              organizationalContext: "Acme sells billing software to dental clinics.",
            });
        - lang: python
          label: Python SDK
          source: |-
            from supermemory import Supermemory

            client = Supermemory()  # reads SUPERMEMORY_API_KEY

            client.organization.update(
                organizational_context="Acme sells billing software to dental clinics.",
            )
        - lang: bash
          label: cURL
          source: |-
            curl -X PATCH "https://api.supermemory.ai/organization" \
              -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
              -H "Content-Type: application/json" \
              -d '{ "organizationalContext": "Acme sells billing software to dental clinics." }'
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