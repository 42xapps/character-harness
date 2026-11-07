# List namespaces

- **Method:** `GET`
- **Path:** `/namespaces`
- **Operation ID:** `getNamespaces`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Discover every namespace available to the caller, including its purpose, document volume, memory count, and lifecycle timestamps.

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
    "in": "query",
    "name": "page",
    "schema": {
      "default": 1,
      "type": "integer",
      "minimum": 1,
      "maximum": 9007199254740991
    },
    "description": "One-based page number"
  },
  {
    "in": "query",
    "name": "limit",
    "schema": {
      "default": 10,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "description": "Maximum namespaces to return per page"
  }
]
```

## Responses

### 200 — Namespaces available to the caller

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "namespaces": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Internal identifier for the namespace"
                },
                "namespace": {
                  "type": "string",
                  "description": "Namespace identifier used in API paths"
                },
                "documentCount": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991,
                  "description": "Number of active source documents in the namespace"
                },
                "memoryCount": {
                  "type": "integer",
                  "minimum": 0,
                  "maximum": 9007199254740991,
                  "description": "Number of current, recallable memories in the namespace"
                },
                "description": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ],
                  "description": "Human-readable purpose or scope of the namespace"
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
                      "description": "ISO 8601 timestamp of the latest namespace update"
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
                "id",
                "namespace",
                "documentCount",
                "memoryCount",
                "description",
                "system"
              ]
            },
            "description": "Namespaces on this page, newest first"
          },
          "pagination": {
            "type": "object",
            "properties": {
              "currentPage": {
                "type": "number"
              },
              "limit": {
                "default": 10,
                "type": "number",
                "maximum": 1100
              },
              "totalItems": {
                "type": "number"
              },
              "totalPages": {
                "type": "number"
              }
            },
            "required": [
              "currentPage",
              "totalItems",
              "totalPages"
            ],
            "description": "Pagination metadata",
            "example": {
              "currentPage": 1,
              "limit": 10,
              "totalItems": 100,
              "totalPages": 10
            }
          }
        },
        "required": [
          "namespaces",
          "pagination"
        ]
      }
    }
  },
  "description": "Namespaces available to the caller"
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

page = client.namespaces.list(page=1, limit=50)
print([ns.namespace for ns in page.namespaces])
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
