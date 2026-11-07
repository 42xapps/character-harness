# Send feedback

- **Method:** `POST`
- **Path:** `/feedback`
- **Operation ID:** `postFeedback`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Report a bug, request a feature or flag a docs problem to the Supermemory team. Built for AI agents: send structured JSON and an engineer picks it up.

Authentication is optional for requests with a usable client IP. Cross-zone Cloudflare Worker requests and requests without a client IP must provide an API key. With an API key the limit is 3 submissions per organization per UTC day; without one it is 3 per IPv4 address or IPv6 /64, shared with everyone behind that address. Authenticated submissions have a separate 200/day pool; anonymous submissions share a 20/day pool. Pass your API key to get your own quota.

## Servers and authentication

```json
{
  "servers": [
    {
      "description": "Production Server",
      "url": "https://api.supermemory.ai"
    }
  ],
  "security": [
    {},
    {
      "bearerAuth": []
    }
  ],
  "securitySchemes": {
    "bearerAuth": {
      "scheme": "bearer",
      "type": "http"
    }
  }
}
```

## Request body

```json
{
  "required": true,
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": [
              "bug",
              "feature_request",
              "docs",
              "other"
            ],
            "description": "Kind of feedback",
            "example": "bug"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 120,
            "description": "One-line summary",
            "example": "Search returns no results for documents still in indexing"
          },
          "description": {
            "type": "string",
            "minLength": 1,
            "maxLength": 5000,
            "description": "What happened, with enough detail for an engineer to act on it",
            "example": "Documents added less than a minute ago are missing from /v4/search results even though GET /v3/documents/{id} reports status done."
          },
          "endpoint": {
            "description": "API operation the feedback is about",
            "example": "POST /v4/search",
            "type": "string",
            "maxLength": 200
          },
          "requestId": {
            "description": "Request ID of a failing call, if there is one",
            "type": "string",
            "maxLength": 200
          },
          "expected": {
            "description": "What you expected to happen",
            "type": "string",
            "maxLength": 2000
          },
          "actual": {
            "description": "What actually happened",
            "type": "string",
            "maxLength": 2000
          },
          "client": {
            "description": "Agent, tool or SDK sending the feedback",
            "example": "claude-code/2.1, supermemory-sdk-ts/5.0.0",
            "type": "string",
            "maxLength": 200
          },
          "contactEmail": {
            "description": "Where to reach you about this feedback",
            "type": "string",
            "maxLength": 320,
            "format": "email",
            "pattern": "^(?!\\.)(?!.*\\.\\.)([A-Za-z0-9_'+\\-\\.]*)[A-Za-z0-9_+-]@([A-Za-z0-9][A-Za-z0-9\\-]*\\.)+[A-Za-z]{2,}$"
          }
        },
        "required": [
          "type",
          "title",
          "description"
        ]
      }
    }
  }
}
```

## Responses

### 202 — Feedback received

```json
{
  "description": "Feedback received",
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Feedback reference",
            "example": "fb_k3m9q2x7wd"
          },
          "remaining": {
            "type": "number",
            "description": "Submissions left for this caller until 00:00 UTC",
            "example": 2
          }
        },
        "required": [
          "id",
          "remaining"
        ]
      }
    }
  }
}
```

### 400 — Invalid request body

```json
{
  "description": "Invalid request body",
  "content": {
    "application/json": {
      "schema": {
        "oneOf": [
          {
            "$ref": "#/components/schemas/ErrorResponse"
          },
          {
            "$ref": "#/components/schemas/ValidationErrorResponse"
          }
        ]
      }
    }
  }
}
```

### 401 — An API key is invalid or required for this request

```json
{
  "description": "An API key is invalid or required for this request",
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  }
}
```

### 403 — The API key cannot access this endpoint or namespace

```json
{
  "description": "The API key cannot access this endpoint or namespace",
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  }
}
```

### 429 — Daily limit reached. The Retry-After header gives the seconds until it resets.

```json
{
  "description": "Daily limit reached. The Retry-After header gives the seconds until it resets.",
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  }
}
```

### 502 — Slack rejected the feedback or delivery could not be confirmed. Only confirmed rejections are refunded; do not automatically retry uncertain deliveries.

```json
{
  "description": "Slack rejected the feedback or delivery could not be confirmed. Only confirmed rejections are refunded; do not automatically retry uncertain deliveries.",
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  }
}
```

### 503 — Feedback is not available on this deployment

```json
{
  "description": "Feedback is not available on this deployment",
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  }
}
```

## Referenced schemas

### ErrorResponse

```json
{
  "type": "object",
  "properties": {
    "error": {
      "type": "string",
      "description": "Error message",
      "example": "Invalid request parameters"
    },
    "details": {
      "type": "string",
      "description": "Additional error details",
      "example": "Query must be at least 1 character long"
    }
  },
  "required": [
    "error"
  ]
}
```

### ValidationErrorResponse

```json
{
  "type": "object",
  "description": "Body returned when request input fails schema validation",
  "properties": {
    "success": {
      "type": "boolean",
      "enum": [
        false
      ]
    },
    "error": {
      "type": "array",
      "description": "Validation issues",
      "items": {
        "type": "object",
        "properties": {
          "message": {
            "type": "string"
          },
          "path": {
            "type": "array",
            "items": {
              "oneOf": [
                {
                  "type": "string"
                },
                {
                  "type": "number"
                }
              ]
            }
          }
        },
        "required": [
          "message"
        ]
      }
    },
    "data": {
      "description": "The input that failed validation"
    }
  },
  "required": [
    "success",
    "error"
  ]
}
```
