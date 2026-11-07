# Sync connector

- **Method:** `POST`
- **Path:** `/ns/{namespace}/connectors/{id}/sync`
- **Operation ID:** `postNsByNamespaceConnectorsByIdSync`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Start a sync now. Returns 409 while a sync for this connector is already running.

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
    "in": "path",
    "name": "id",
    "schema": {
      "type": "string",
      "minLength": 1,
      "example": "PTzGiUYei7pgzg5buzZHgA"
    },
    "required": true,
    "description": "Connector identifier returned when the connector was created"
  }
]
```

## Responses

### 202 — Sync queued

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Connector identifier"
          },
          "status": {
            "type": "string",
            "const": "queued"
          }
        },
        "required": [
          "id",
          "status"
        ]
      }
    }
  },
  "description": "Sync queued"
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

### 402 — Plan does not include this provider

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Plan does not include this provider"
}
```

### 403 — Namespace access denied

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Namespace access denied"
}
```

### 404 — Connector not found

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Connector not found"
}
```

### 409 — A sync is already running

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "A sync is already running"
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

### 503 — Provider is temporarily unavailable

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Provider is temporarily unavailable"
}
```

## Python examples from the snapshot

```python
from supermemory import Supermemory

client = Supermemory()  # reads SUPERMEMORY_API_KEY

run = client.connectors.sync("user_123", "conn_abc123")
print(run.status)  # "queued"; 409 if a sync is already running
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
