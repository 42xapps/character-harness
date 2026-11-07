# Delete namespace

- **Method:** `DELETE`
- **Path:** `/ns/{namespace}`
- **Operation ID:** `deleteNsByNamespace`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Retire a namespace by permanently deleting its content, or preserve that knowledge by moving everything into another namespace first. Moves are queued and complete asynchronously.

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
  },
  {
    "in": "query",
    "name": "moveTo",
    "schema": {
      "example": "project_archive",
      "type": "string",
      "maxLength": 100,
      "pattern": "^[a-zA-Z0-9_:-]+$"
    },
    "description": "Destination namespace that should receive this namespace's content before deletion. Omit to permanently delete the content."
  }
]
```

## Responses

### 200 — Namespace permanently deleted (status "deleted"). A move answers 202 with status "queued".

```json
{
  "content": {
    "application/json": {
      "schema": {
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "deleted",
                "description": "The namespace and its content are gone"
              },
              "namespace": {
                "type": "string",
                "description": "Deleted namespace identifier"
              },
              "deletedDocumentsCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991,
                "description": "Number of documents permanently removed"
              },
              "deletedMemoriesCount": {
                "type": "integer",
                "minimum": 0,
                "maximum": 9007199254740991,
                "description": "Number of memories permanently removed"
              }
            },
            "required": [
              "status",
              "namespace",
              "deletedDocumentsCount",
              "deletedMemoriesCount"
            ]
          },
          {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "const": "queued",
                "description": "The move continues asynchronously after this response"
              },
              "operationId": {
                "type": "string",
                "description": "Identifier used to trace the asynchronous move operation"
              },
              "namespace": {
                "type": "string",
                "description": "Source namespace being removed"
              },
              "moveTo": {
                "type": "string",
                "description": "Destination namespace receiving the content"
              }
            },
            "required": [
              "status",
              "operationId",
              "namespace",
              "moveTo"
            ]
          }
        ]
      }
    }
  },
  "description": "Namespace permanently deleted (status \"deleted\"). A move answers 202 with status \"queued\"."
}
```

### 202 — Namespace move queued

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "status": {
            "type": "string",
            "const": "queued",
            "description": "The move continues asynchronously after this response"
          },
          "operationId": {
            "type": "string",
            "description": "Identifier used to trace the asynchronous move operation"
          },
          "namespace": {
            "type": "string",
            "description": "Source namespace being removed"
          },
          "moveTo": {
            "type": "string",
            "description": "Destination namespace receiving the content"
          }
        },
        "required": [
          "status",
          "operationId",
          "namespace",
          "moveTo"
        ]
      }
    }
  },
  "description": "Namespace move queued"
}
```

### 400 — Invalid move destination

```json
{
  "description": "Invalid move destination",
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

### 409 — Namespace is busy

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Namespace is busy"
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

# Move everything into another namespace instead of deleting: add move_to="project_main"
res = client.namespaces.delete("project_old")
print(res.status)  # "deleted", or "queued" when moving
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
