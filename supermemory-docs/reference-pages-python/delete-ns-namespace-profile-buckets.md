# Delete profile buckets

- **Method:** `DELETE`
- **Path:** `/ns/{namespace}/profile/buckets`
- **Operation ID:** `deleteNsByNamespaceProfileBuckets`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Remove profile categories created specifically for this namespace. Unknown names are safely ignored, while organization-wide buckets remain protected.

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
    "description": "The isolated namespace to search. This can be an ID for your user, a project ID, or any other identifier you wish to use to scope memories."
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
          "buckets": {
            "minItems": 1,
            "maxItems": 50,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64,
              "pattern": "^[a-z0-9][a-z0-9_-]*$",
              "description": "Stable slug for the bucket, stored on each memory"
            },
            "description": "Namespace-owned bucket names to delete. Organization-level buckets are protected and cannot be removed here.",
            "example": [
              "interests"
            ]
          }
        },
        "required": [
          "buckets"
        ],
        "additionalProperties": false
      }
    }
  }
}
```

## Responses

### 200 — Updated effective namespace profile bucket definitions

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "buckets": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {
              "type": "string"
            },
            "description": "Effective bucket definitions keyed by name. Includes organization buckets and namespace-owned additions."
          }
        },
        "required": [
          "buckets"
        ]
      }
    }
  },
  "description": "Updated effective namespace profile bucket definitions"
}
```

### 400 — Invalid profile bucket names

```json
{
  "description": "Invalid profile bucket names",
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

### 403 — Namespace write access required

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Namespace write access required"
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

### 409 — An organization-level bucket cannot be deleted

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "An organization-level bucket cannot be deleted"
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

client.profiles.delete_buckets("user_123", buckets=["work"])
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
