# Delete documents

- **Method:** `DELETE`
- **Path:** `/ns/{namespace}/document`
- **Operation ID:** `deleteNsByNamespaceDocument`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Permanently remove documents and their derived knowledge by document ID or caller-defined ID. Each requested ID is handled independently so successful deletions are preserved when another ID fails.

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
    "description": "The isolated namespace. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope documents."
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
          "ids": {
            "minItems": 1,
            "maxItems": 100,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 255,
              "example": "my-doc-123",
              "description": "A document ID or caller-defined ID"
            },
            "description": "Document identifiers to permanently delete from this namespace",
            "example": [
              "my-doc-123"
            ]
          }
        },
        "required": [
          "ids"
        ],
        "additionalProperties": false
      }
    }
  }
}
```

## Responses

### 200 — Document deletion completed

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Number of documents successfully deleted"
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 255,
                  "example": "my-doc-123",
                  "description": "The requested document identifier"
                },
                "error": {
                  "type": "string",
                  "minLength": 1,
                  "description": "Why this document could not be deleted"
                }
              },
              "required": [
                "id",
                "error"
              ],
              "additionalProperties": false
            },
            "description": "Per-document failures; successful deletions are not rolled back"
          }
        },
        "required": [
          "count",
          "errors"
        ],
        "additionalProperties": false
      }
    }
  },
  "description": "Document deletion completed"
}
```

### 400 — Invalid delete request

```json
{
  "description": "Invalid delete request",
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

### 403 — Write access required for this namespace

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Write access required for this namespace"
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

res = client.documents.delete("user_123", ids=["chat_session_1", "doc_roadmap"])
print(res.count, res.errors)
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
