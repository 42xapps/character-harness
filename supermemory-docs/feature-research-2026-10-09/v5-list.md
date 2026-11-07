> ## Documentation Index
> Fetch the complete documentation index at: https://supermemory.ai/docs/llms.txt
> Use this file to discover all available pages before exploring further.

# List resources

> Browse documents, source chunks, or learned memories through one predictable paginated contract. Choose the collection in the path; the other collection arrays remain empty for a stable response shape.



## OpenAPI

````yaml https://api.supermemory.ai/v5/openapi post /ns/{namespace}/list/{type}
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
  /ns/{namespace}/list/{type}:
    post:
      tags:
        - Content Management
      summary: List resources
      description: >-
        Browse documents, source chunks, or learned memories through one
        predictable paginated contract. Choose the collection in the path; the
        other collection arrays remain empty for a stable response shape.
      operationId: postNsByNamespaceListByType
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
            Namespace containing the resources to list. This can be an ID for
            your user, a project ID, or any other identifier you wish to use to
            scope resources.
        - in: path
          name: type
          schema:
            type: string
            enum:
              - documents
              - chunks
              - memories
            example: memories
          required: true
          description: >-
            Resource collection to list: source documents, extracted chunks, or
            learned memories
        - in: query
          name: page
          schema:
            example: 1
            default: 1
            type: integer
            minimum: 1
            maximum: 9007199254740991
          description: One-based page number
        - in: query
          name: limit
          schema:
            example: 10
            default: 10
            type: integer
            minimum: 1
            maximum: 100
          description: Maximum resources to return per page
        - in: query
          name: sort
          schema:
            default: createdAt
            example: createdAt
            type: string
            enum:
              - createdAt
              - updatedAt
              - position
          description: >-
            Field used to order results. Position is available only when listing
            chunks.
        - in: query
          name: order
          schema:
            default: desc
            example: desc
            type: string
            enum:
              - asc
              - desc
          description: Ascending or descending sort direction
      requestBody:
        required: false
        content:
          application/json:
            schema:
              type: object
              properties:
                filter:
                  $ref: '#/components/schemas/FilterExpression'
                  description: Type-safe metadata conditions applied before pagination
                include:
                  default:
                    forgotten: false
                  description: Optional extras
                  example:
                    forgotten: true
                  type: object
                  properties:
                    forgotten:
                      default: false
                      description: >-
                        List forgotten and expired memories too, with
                        isForgotten: true. Applies to type memories only.
                      type: boolean
                  additionalProperties: false
              additionalProperties: false
      responses:
        '200':
          content:
            application/json:
              schema:
                type: object
                properties:
                  documents:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: Stable document identifier
                        title:
                          anyOf:
                            - type: string
                            - type: 'null'
                          description: Extracted or caller-provided document title
                        type:
                          type: string
                          description: Detected source or content type
                        summary:
                          anyOf:
                            - type: string
                            - type: 'null'
                          description: Generated summary of the document, when available
                        metadata:
                          type: object
                          propertyNames:
                            type: string
                          additionalProperties: {}
                          description: Public metadata attached to the document
                        url:
                          anyOf:
                            - type: string
                            - type: 'null'
                          description: >-
                            Original source URL, when the document was ingested
                            from the web
                        system:
                          type: object
                          properties:
                            status:
                              type: string
                              description: Current extraction and memory-processing status
                            createdAt:
                              type: string
                              format: date-time
                              pattern: >-
                                ^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$
                              description: ISO 8601 timestamp when the document was created
                            updatedAt:
                              type: string
                              format: date-time
                              pattern: >-
                                ^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$
                              description: ISO 8601 timestamp of the latest document update
                          required:
                            - status
                            - createdAt
                            - updatedAt
                          description: >-
                            Processing status, lifecycle timestamps, and storage
                            path maintained by Supermemory
                      required:
                        - id
                        - title
                        - type
                        - summary
                        - metadata
                        - url
                        - system
                      description: A document in this namespace without its content
                    description: >-
                      Documents on this page; empty when a different resource
                      type is requested
                  chunks:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: Stable chunk identifier
                        position:
                          type: integer
                          minimum: -9007199254740991
                          maximum: 9007199254740991
                          description: Zero-based order within the document
                        content:
                          type: string
                          description: Chunk text used for retrieval
                        type:
                          type: string
                          description: Chunk content type
                        metadata:
                          type: object
                          propertyNames:
                            type: string
                          additionalProperties: {}
                          description: Chunk metadata; empty object when none
                        system:
                          type: object
                          properties:
                            createdAt:
                              type: string
                              format: date-time
                              pattern: >-
                                ^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$
                              description: ISO 8601 timestamp when the chunk was created
                          required:
                            - createdAt
                          description: Lifecycle timestamps maintained by Supermemory
                        documentId:
                          type: string
                          description: ID of the chunk's parent document
                      required:
                        - id
                        - position
                        - content
                        - type
                        - metadata
                        - system
                        - documentId
                    description: >-
                      Chunks on this page; empty when a different resource type
                      is requested
                  memories:
                    type: array
                    items:
                      type: object
                      properties:
                        id:
                          type: string
                          description: Stable memory identifier
                        memory:
                          type: string
                          description: Learned fact or context extracted from the document
                        metadata:
                          type: object
                          propertyNames:
                            type: string
                          additionalProperties: {}
                          description: >-
                            Memory metadata, including temporal context; empty
                            object when none
                        isStatic:
                          type: boolean
                          description: >-
                            Whether the memory belongs to the stable profile
                            section
                        isInference:
                          type: boolean
                          description: >-
                            Whether the memory was inferred rather than
                            explicitly stated
                        isLatest:
                          type: boolean
                          description: >-
                            Whether this is the newest version in its memory
                            chain
                        isForgotten:
                          type: boolean
                          description: >-
                            Whether this memory has been excluded from normal
                            recall
                        version:
                          type: integer
                          minimum: -9007199254740991
                          maximum: 9007199254740991
                          description: Version number within the memory chain
                        system:
                          type: object
                          properties:
                            createdAt:
                              type: string
                              format: date-time
                              pattern: >-
                                ^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$
                              description: >-
                                ISO 8601 timestamp when this memory version was
                                created
                            updatedAt:
                              type: string
                              format: date-time
                              pattern: >-
                                ^(?:(?:\d\d[2468][048]|\d\d[13579][26]|\d\d0[48]|[02468][048]00|[13579][26]00)-02-29|\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\d|30)|(?:02)-(?:0[1-9]|1\d|2[0-8])))T(?:(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z))$
                              description: >-
                                ISO 8601 timestamp of the latest update to this
                                version
                          required:
                            - createdAt
                            - updatedAt
                          description: Lifecycle timestamps maintained by Supermemory
                      required:
                        - id
                        - memory
                        - metadata
                        - isStatic
                        - isInference
                        - isLatest
                        - isForgotten
                        - version
                        - system
                      description: A memory formed from documents in this namespace
                    description: >-
                      Memories on this page; empty when a different resource
                      type is requested
                  pagination:
                    type: object
                    properties:
                      currentPage:
                        type: number
                        description: Current one-based page number
                      limit:
                        default: 10
                        description: Maximum resources returned per page
                        type: number
                        maximum: 1100
                      totalItems:
                        type: number
                        description: Total resources matching the request
                      totalPages:
                        type: number
                        description: Total pages available at the selected limit
                    required:
                      - currentPage
                      - totalItems
                      - totalPages
                    description: Page metadata for the selected resource collection
                required:
                  - documents
                  - chunks
                  - memories
                  - pagination
                description: A namespace-scoped page of one resource type
          description: Namespace resources retrieved successfully
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
          description: Namespace access denied
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

            const page = await client.list("user_123", "documents", {
              page: 1,
              limit: 20,
              sort: "createdAt",
              order: "desc",
              filter: { field: "type", operator: "eq", value: "conversation" },
            });
            console.log(page.documents.length, page.pagination.totalPages);
        - lang: python
          label: Python SDK
          source: |-
            from supermemory import Supermemory

            client = Supermemory()  # reads SUPERMEMORY_API_KEY

            page = client.list(
                "user_123",
                "documents",
                page=1,
                limit=20,
                sort="createdAt",
                order="desc",
                filter={"field": "type", "operator": "eq", "value": "conversation"},
            )
            print(len(page.documents), page.pagination.total_pages)
        - lang: bash
          label: cURL
          source: >-
            curl -X POST
            "https://api.supermemory.ai/ns/user_123/list/documents?page=1&limit=20&sort=createdAt&order=desc"
            \
              -H "Authorization: Bearer $SUPERMEMORY_API_KEY" \
              -H "Content-Type: application/json" \
              -d '{ "filter": { "field": "type", "operator": "eq", "value": "conversation" } }'
components:
  schemas:
    FilterExpression:
      description: >-
        A type-safe metadata filter predicate or nested and/or expression. The
        API validates up to 5 levels of nesting.
      anyOf:
        - $ref: '#/components/schemas/FilterPredicate'
        - type: object
          properties:
            operator:
              type: string
              const: and
              description: Require every nested filter expression to match
            operands:
              type: array
              minItems: 1
              maxItems: 200
              items:
                $ref: '#/components/schemas/FilterExpression'
              description: Filter expressions combined with logical AND
          required:
            - operator
            - operands
          additionalProperties: false
        - type: object
          properties:
            operator:
              type: string
              const: or
              description: Require at least one nested filter expression to match
            operands:
              type: array
              minItems: 1
              maxItems: 200
              items:
                $ref: '#/components/schemas/FilterExpression'
              description: Filter expressions combined with logical OR
          required:
            - operator
            - operands
          additionalProperties: false
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
    FilterPredicate:
      anyOf:
        - type: object
          properties:
            field:
              type: string
              minLength: 1
              pattern: ^[a-zA-Z0-9_.-]+$
              description: >-
                Metadata key to evaluate, matched literally. A period is part of
                the key name, not a path into nested metadata.
            operator:
              type: string
              enum:
                - eq
                - neq
              description: Compare the field for equality or inequality
            value:
              type: string
              description: String value to compare against
            caseSensitive:
              default: true
              description: Whether string comparison preserves letter case
              type: boolean
          required:
            - field
            - operator
            - value
          additionalProperties: false
        - type: object
          properties:
            field:
              type: string
              minLength: 1
              pattern: ^[a-zA-Z0-9_.-]+$
              description: >-
                Metadata key to evaluate, matched literally. A period is part of
                the key name, not a path into nested metadata.
            operator:
              type: string
              enum:
                - eq
                - neq
              description: Compare the field for equality or inequality
            value:
              anyOf:
                - type: number
                - type: boolean
              description: Numeric or boolean value to compare against
          required:
            - field
            - operator
            - value
          additionalProperties: false
        - type: object
          properties:
            field:
              type: string
              minLength: 1
              pattern: ^[a-zA-Z0-9_.-]+$
              description: >-
                Metadata key to evaluate, matched literally. A period is part of
                the key name, not a path into nested metadata.
            operator:
              type: string
              enum:
                - gt
                - gte
                - lt
                - lte
              description: Numeric comparison to apply
            value:
              type: number
              description: Numeric value to compare against
          required:
            - field
            - operator
            - value
          additionalProperties: false
        - type: object
          properties:
            field:
              type: string
              minLength: 1
              pattern: ^[a-zA-Z0-9_.-]+$
              description: >-
                Metadata key to evaluate, matched literally. A period is part of
                the key name, not a path into nested metadata.
            operator:
              type: string
              enum:
                - contains
                - notContains
              description: Require or exclude a substring match
            value:
              type: string
              description: Substring to look for
            caseSensitive:
              default: true
              description: Whether substring matching preserves letter case
              type: boolean
          required:
            - field
            - operator
            - value
          additionalProperties: false
        - type: object
          properties:
            field:
              type: string
              minLength: 1
              pattern: ^[a-zA-Z0-9_.-]+$
              description: >-
                Metadata key to evaluate, matched literally. A period is part of
                the key name, not a path into nested metadata.
            operator:
              type: string
              enum:
                - arrayContains
                - arrayNotContains
              description: Require or exclude an exact array member
            value:
              type: string
              description: Array member to look for
          required:
            - field
            - operator
            - value
          additionalProperties: false
  securitySchemes:
    bearerAuth:
      scheme: bearer
      type: http

````

This documentation is built and hosted on [Mintlify](https://mintlify.com), a developer documentation platform.