# Get profile

- **Method:** `POST`
- **Path:** `/ns/{namespace}/profile`
- **Operation ID:** `postNsByNamespaceProfile`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Read a continuously maintained understanding of the subject represented by this namespace. Stable facts, evolving context, and selected custom buckets are returned together without requiring a search query.

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
  "required": false,
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "filter": {
            "description": "Type-safe metadata conditions that limit which memories contribute to the profile",
            "$ref": "#/components/schemas/FilterExpression"
          },
          "buckets": {
            "description": "Custom buckets to return. Omit to return every effective bucket.",
            "example": [
              "interests",
              "goals"
            ],
            "maxItems": 50,
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1,
              "maxLength": 64,
              "pattern": "^[a-z0-9][a-z0-9_-]*$",
              "description": "Stable slug for the bucket, stored on each memory"
            }
          }
        },
        "additionalProperties": false
      }
    }
  }
}
```

## Responses

### 200 — Namespace profile. Send `Accept: text/markdown` to receive it as a markdown document instead of JSON.

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "profile": {
            "type": "object",
            "properties": {
              "static": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Memory ID, or an aggregated_-prefixed ID for a summary synthesized from several memories"
                    },
                    "memory": {
                      "type": "string",
                      "description": "Memory text"
                    }
                  },
                  "required": [
                    "id",
                    "memory"
                  ]
                },
                "description": "Durable facts that define the subject and rarely change, such as identity or long-term preferences"
              },
              "dynamic": {
                "type": "array",
                "items": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string",
                      "description": "Memory ID, or an aggregated_-prefixed ID for a summary synthesized from several memories"
                    },
                    "memory": {
                      "type": "string",
                      "description": "Memory text"
                    }
                  },
                  "required": [
                    "id",
                    "memory"
                  ]
                },
                "description": "Recent or evolving context, such as current goals, projects, and active interests"
              },
              "buckets": {
                "type": "object",
                "propertyNames": {
                  "type": "string"
                },
                "additionalProperties": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "description": "Memory ID, or an aggregated_-prefixed ID for a summary synthesized from several memories"
                      },
                      "memory": {
                        "type": "string",
                        "description": "Memory text"
                      }
                    },
                    "required": [
                      "id",
                      "memory"
                    ]
                  }
                },
                "description": "Custom profile sections keyed by bucket name, with the memories currently assigned to each bucket"
              }
            },
            "required": [
              "static",
              "dynamic",
              "buckets"
            ],
            "description": "Continuously maintained understanding of the subject represented by this namespace"
          }
        },
        "required": [
          "profile"
        ]
      }
    },
    "text/markdown": {
      "schema": {
        "type": "string"
      }
    }
  },
  "description": "Namespace profile. Send `Accept: text/markdown` to receive it as a markdown document instead of JSON."
}
```

### 400 — Invalid request parameters

```json
{
  "description": "Invalid request parameters",
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

profile = client.profile("user_123").profile
print([m.memory for m in profile.static])
print([m.memory for m in profile.dynamic])
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

### FilterExpression

```json
{
  "description": "A type-safe metadata filter predicate or nested and/or expression. The API validates up to 5 levels of nesting.",
  "anyOf": [
    {
      "$ref": "#/components/schemas/FilterPredicate"
    },
    {
      "type": "object",
      "properties": {
        "operator": {
          "type": "string",
          "const": "and",
          "description": "Require every nested filter expression to match"
        },
        "operands": {
          "type": "array",
          "minItems": 1,
          "maxItems": 200,
          "items": {
            "$ref": "#/components/schemas/FilterExpression"
          },
          "description": "Filter expressions combined with logical AND"
        }
      },
      "required": [
        "operator",
        "operands"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "operator": {
          "type": "string",
          "const": "or",
          "description": "Require at least one nested filter expression to match"
        },
        "operands": {
          "type": "array",
          "minItems": 1,
          "maxItems": 200,
          "items": {
            "$ref": "#/components/schemas/FilterExpression"
          },
          "description": "Filter expressions combined with logical OR"
        }
      },
      "required": [
        "operator",
        "operands"
      ],
      "additionalProperties": false
    }
  ]
}
```

### FilterPredicate

```json
{
  "anyOf": [
    {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z0-9_.-]+$",
          "description": "Metadata key to evaluate, matched literally. A period is part of the key name, not a path into nested metadata."
        },
        "operator": {
          "type": "string",
          "enum": [
            "eq",
            "neq"
          ],
          "description": "Compare the field for equality or inequality"
        },
        "value": {
          "type": "string",
          "description": "String value to compare against"
        },
        "caseSensitive": {
          "default": true,
          "description": "Whether string comparison preserves letter case",
          "type": "boolean"
        }
      },
      "required": [
        "field",
        "operator",
        "value"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z0-9_.-]+$",
          "description": "Metadata key to evaluate, matched literally. A period is part of the key name, not a path into nested metadata."
        },
        "operator": {
          "type": "string",
          "enum": [
            "eq",
            "neq"
          ],
          "description": "Compare the field for equality or inequality"
        },
        "value": {
          "anyOf": [
            {
              "type": "number"
            },
            {
              "type": "boolean"
            }
          ],
          "description": "Numeric or boolean value to compare against"
        }
      },
      "required": [
        "field",
        "operator",
        "value"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z0-9_.-]+$",
          "description": "Metadata key to evaluate, matched literally. A period is part of the key name, not a path into nested metadata."
        },
        "operator": {
          "type": "string",
          "enum": [
            "gt",
            "gte",
            "lt",
            "lte"
          ],
          "description": "Numeric comparison to apply"
        },
        "value": {
          "type": "number",
          "description": "Numeric value to compare against"
        }
      },
      "required": [
        "field",
        "operator",
        "value"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z0-9_.-]+$",
          "description": "Metadata key to evaluate, matched literally. A period is part of the key name, not a path into nested metadata."
        },
        "operator": {
          "type": "string",
          "enum": [
            "contains",
            "notContains"
          ],
          "description": "Require or exclude a substring match"
        },
        "value": {
          "type": "string",
          "description": "Substring to look for"
        },
        "caseSensitive": {
          "default": true,
          "description": "Whether substring matching preserves letter case",
          "type": "boolean"
        }
      },
      "required": [
        "field",
        "operator",
        "value"
      ],
      "additionalProperties": false
    },
    {
      "type": "object",
      "properties": {
        "field": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z0-9_.-]+$",
          "description": "Metadata key to evaluate, matched literally. A period is part of the key name, not a path into nested metadata."
        },
        "operator": {
          "type": "string",
          "enum": [
            "arrayContains",
            "arrayNotContains"
          ],
          "description": "Require or exclude an exact array member"
        },
        "value": {
          "type": "string",
          "description": "Array member to look for"
        }
      },
      "required": [
        "field",
        "operator",
        "value"
      ],
      "additionalProperties": false
    }
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
