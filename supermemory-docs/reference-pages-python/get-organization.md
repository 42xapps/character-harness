# Get organization settings

- **Method:** `GET`
- **Path:** `/organization`
- **Operation ID:** `getOrganization`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Read the shared background that guides memory formation across the organization, together with the number of active namespaces.

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

## Responses

### 200 — Organization settings retrieved successfully

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "organizationalContext": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Shared background that helps Supermemory interpret content consistently across every namespace"
          },
          "namespaceCount": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Number of namespaces in the organization"
          }
        },
        "required": [
          "organizationalContext",
          "namespaceCount"
        ]
      }
    }
  },
  "description": "Organization settings retrieved successfully"
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

org = client.organization.get()
print(org.organizational_context, org.namespace_count)
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
