# Get document

- **Method:** `GET`
- **Path:** `/ns/{namespace}/document/{id}`
- **Operation ID:** `getNsByNamespaceDocumentById`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Retrieve a document's canonical content, metadata, and processing state by document ID or caller-defined ID. Optionally include its source chunks, derived memories, or both in the same response.

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
  },
  {
    "in": "path",
    "name": "id",
    "schema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 255,
      "example": "my-doc-123"
    },
    "required": true,
    "description": "The public document ID"
  },
  {
    "in": "query",
    "name": "include",
    "schema": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "chunks",
          "memories"
        ]
      },
      "style": "form",
      "explode": false
    },
    "description": "Comma-separated child resources to include: chunks, memories, or both."
  }
]
```

## Responses

### 200 — Document retrieved successfully

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "id": {
            "type": "string",
            "description": "Stable document identifier",
            "example": "doc_xyz789"
          },
          "title": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Extracted or caller-provided document title",
            "example": "API Rate Limiting Policy"
          },
          "type": {
            "type": "string",
            "description": "Detected source or content type",
            "example": "text"
          },
          "summary": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Generated summary of the document, when available"
          },
          "content": {
            "anyOf": [
              {
                "type": "string"
              },
              {
                "type": "null"
              }
            ],
            "description": "Canonical extracted text used for processing and recall",
            "example": "Our API rate limits are 100 req/min on free and 1000 on pro."
          },
          "metadata": {
            "type": "object",
            "propertyNames": {
              "type": "string"
            },
            "additionalProperties": {},
            "description": "Caller metadata with internal fields removed",
            "example": {
              "source": "api-docs"
            }
          },
          "system": {
            "type": "object",
            "properties": {
              "status": {
                "type": "string",
                "enum": [
                  "unknown",
                  "queued",
                  "extracting",
                  "chunking",
                  "embedding",
                  "indexing",
                  "done",
                  "failed"
                ],
                "description": "Current extraction and memory-processing status"
              },
              "createdAt": {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                "description": "ISO 8601 timestamp when the document was created"
              },
              "updatedAt": {
                "type": "string",
                "format": "date-time",
                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                "description": "ISO 8601 timestamp of the latest document update"
              }
            },
            "required": [
              "status",
              "createdAt",
              "updatedAt"
            ],
            "description": "Processing status, lifecycle timestamps, and storage path maintained by Supermemory"
          },
          "chunks": {
            "description": "Ordered document chunks; included only when requested",
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Stable chunk identifier"
                },
                "position": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991,
                  "description": "Zero-based order within the document"
                },
                "content": {
                  "type": "string",
                  "description": "Chunk text used for retrieval"
                },
                "type": {
                  "type": "string",
                  "description": "Chunk content type"
                },
                "metadata": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {},
                  "description": "Chunk metadata; empty object when none"
                },
                "system": {
                  "type": "object",
                  "properties": {
                    "createdAt": {
                      "type": "string",
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                      "description": "ISO 8601 timestamp when the chunk was created"
                    }
                  },
                  "required": [
                    "createdAt"
                  ],
                  "description": "Lifecycle timestamps maintained by Supermemory"
                }
              },
              "required": [
                "id",
                "position",
                "content",
                "type",
                "metadata",
                "system"
              ],
              "description": "A chunk of source content belonging to a document"
            }
          },
          "memories": {
            "description": "Memories derived from the document; included only when requested",
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Stable memory identifier"
                },
                "memory": {
                  "type": "string",
                  "description": "Learned fact or context extracted from the document"
                },
                "metadata": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {},
                  "description": "Memory metadata, including temporal context; empty object when none"
                },
                "isStatic": {
                  "type": "boolean",
                  "description": "Whether the memory belongs to the stable profile section"
                },
                "isInference": {
                  "type": "boolean",
                  "description": "Whether the memory was inferred rather than explicitly stated"
                },
                "isLatest": {
                  "type": "boolean",
                  "description": "Whether this is the newest version in its memory chain"
                },
                "isForgotten": {
                  "type": "boolean",
                  "description": "Whether this memory has been excluded from normal recall"
                },
                "version": {
                  "type": "integer",
                  "minimum": -9007199254740991,
                  "maximum": 9007199254740991,
                  "description": "Version number within the memory chain"
                },
                "system": {
                  "type": "object",
                  "properties": {
                    "createdAt": {
                      "type": "string",
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                      "description": "ISO 8601 timestamp when this memory version was created"
                    },
                    "updatedAt": {
                      "type": "string",
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                      "description": "ISO 8601 timestamp of the latest update to this version"
                    }
                  },
                  "required": [
                    "createdAt",
                    "updatedAt"
                  ],
                  "description": "Lifecycle timestamps maintained by Supermemory"
                }
              },
              "required": [
                "id",
                "memory",
                "metadata",
                "isStatic",
                "isInference",
                "isLatest",
                "isForgotten",
                "version",
                "system"
              ],
              "description": "A memory formed from documents in this namespace"
            }
          }
        },
        "required": [
          "id",
          "title",
          "type",
          "summary",
          "content",
          "metadata",
          "system"
        ],
        "description": "Namespace-scoped document. Included keys are omitted unless requested and are empty arrays when requested without results."
      }
    }
  },
  "description": "Document retrieved successfully"
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

### 404 — Document not found

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Document not found"
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

doc = client.documents.get("user_123", "doc_abc123", include=["chunks", "memories"])
print(doc.system.status, len(doc.chunks or []), len(doc.memories or []))
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
