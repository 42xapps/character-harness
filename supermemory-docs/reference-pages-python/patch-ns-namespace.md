# Update namespace settings

- **Method:** `PATCH`
- **Path:** `/ns/{namespace}`
- **Operation ID:** `patchNsByNamespace`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Shape how Supermemory understands an existing namespace by updating the background context used during ingestion and memory formation.

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

## Parameters

```json
[
  {
    "in": "path",
    "name": "namespace",
    "schema": {
      "example": "user_alex",
      "type": "string",
      "maxLength": 100,
      "pattern": "^[a-zA-Z0-9_:-]+$"
    },
    "required": true,
    "description": "Namespace identifier. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents and memories."
  }
]
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
          "supportingContext": {
            "description": "Background that guides how Supermemory interprets documents and forms memories. Max 1500 characters. Set null to clear it.",
            "example": "This namespace holds Acme Corp support tickets.",
            "anyOf": [
              {
                "type": "string",
                "maxLength": 1500
              },
              {
                "type": "null"
              }
            ]
          }
        },
        "additionalProperties": false
      }
    }
  }
}
```

## Responses

### 200 — Updated namespace settings

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "namespace": {
            "type": "string",
            "description": "Namespace identifier used in API paths"
          },
          "supportingContext": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Background that helps Supermemory interpret documents and form better memories in this namespace"
          },
          "system": {
            "type": "object",
            "properties": {
              "createdAt": {
                "type": "string",
                "format": "date-time",
                "description": "ISO 8601 timestamp when the namespace was created"
              },
              "updatedAt": {
                "type": "string",
                "format": "date-time",
                "description": "ISO 8601 timestamp of the latest settings update"
              }
            },
            "required": [
              "createdAt",
              "updatedAt"
            ],
            "description": "Namespace lifecycle timestamps"
          }
        },
        "required": [
          "namespace",
          "supportingContext",
          "system"
        ]
      }
    }
  },
  "description": "Updated namespace settings"
}
```

### 400 — Invalid namespace settings

```json
{
  "description": "Invalid namespace settings",
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

### 401 — Unauthorized

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Unauthorized"
}
```

### 403 — Write access required

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Write access required"
}
```

### 404 — Namespace not found

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Namespace not found"
}
```

### 500 — Internal server error

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Internal server error"
}
```

## Python examples from the snapshot

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

client.namespaces.update(
    "user_123",
    supporting_context="A paying customer on the Pro plan; prefers concise answers.",
)
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
