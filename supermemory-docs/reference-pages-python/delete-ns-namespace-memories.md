# Forget memories by ID

- **Method:** `DELETE`
- **Path:** `/ns/{namespace}/memories`
- **Operation ID:** `deleteNsByNamespaceMemories`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Remove exact memories from normal recall while preserving their audit history. Each ID is handled independently and any missing or ineligible memory is reported without rolling back successful changes.

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
    "description": "Namespace containing the memories to forget. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories."
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
            "maxItems": 500,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "description": "Stable memory identifier"
            },
            "description": "Memory identifiers to remove from normal recall",
            "example": [
              "mem_abc123"
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

### 200 — Exact memory forget completed

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
            "description": "Number of memories matched by this operation"
          },
          "errors": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Requested memory identifier"
                },
                "error": {
                  "type": "string",
                  "description": "Why the memory could not be forgotten"
                }
              },
              "required": [
                "id",
                "error"
              ],
              "additionalProperties": false
            },
            "description": "Per-memory failures for exact-ID requests"
          },
          "matches": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Stable identifier of the matched memory"
                },
                "memory": {
                  "type": "string",
                  "description": "Matched memory text"
                }
              },
              "required": [
                "id",
                "memory"
              ],
              "additionalProperties": false
            },
            "description": "Memories selected by the operation, whether previewed or forgotten"
          }
        },
        "required": [
          "count",
          "errors",
          "matches"
        ],
        "additionalProperties": false
      }
    }
  },
  "description": "Exact memory forget completed"
}
```

### 400 — Invalid request

```json
{
  "description": "Invalid request",
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

### 403 — Namespace write access denied

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Namespace write access denied"
}
```

### 500 — Server error

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Server error"
}
```

## Python examples from the snapshot

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

res = client.memories.forget("user_123", ids=["mem_1", "mem_2"])
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
