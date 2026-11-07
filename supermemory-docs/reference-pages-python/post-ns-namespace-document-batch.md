# Batch add documents

- **Method:** `POST`
- **Path:** `/ns/{namespace}/document/batch`
- **Operation ID:** `postNsByNamespaceDocumentBatch`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Build a knowledge base efficiently by ingesting up to 600 text or URL documents at once. Existing caller-defined IDs append new information using the same semantics as single-document ingestion.

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
          "documents": {
            "minItems": 1,
            "maxItems": 600,
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "content": {
                  "type": "string",
                  "description": "The content to process. This may be plaintext or a URL to supported rich content.",
                  "example": "Supermemory turns unstructured content into evolving memory."
                },
                "id": {
                  "description": "An optional caller-defined document ID",
                  "type": "string",
                  "minLength": 1,
                  "maxLength": 255,
                  "example": "my-doc-123"
                },
                "supportingContext": {
                  "description": "Context used to guide memory extraction within this namespace. Max 1500 characters.",
                  "example": "Focus on product decisions, dates, and owners.",
                  "type": "string",
                  "maxLength": 1500
                },
                "metadata": {
                  "description": "Arbitrary metadata attached to the document and derived data",
                  "example": {
                    "source": "api-docs"
                  },
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {
                    "anyOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "number"
                      },
                      {
                        "type": "boolean"
                      },
                      {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      }
                    ]
                  }
                },
                "group": {
                  "description": "Metadata values that isolate related context within the namespace",
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {
                    "anyOf": [
                      {
                        "type": "string"
                      },
                      {
                        "type": "number"
                      },
                      {
                        "type": "boolean"
                      },
                      {
                        "type": "array",
                        "items": {
                          "type": "string"
                        }
                      }
                    ]
                  }
                },
                "date": {
                  "description": "When the source content is from, in ISO 8601 format",
                  "example": "2026-01-15",
                  "type": "string"
                }
              },
              "required": [
                "content"
              ],
              "additionalProperties": false
            },
            "description": "Documents to ingest or append in one request"
          },
          "taskType": {
            "description": "Processing pipeline. \"memory\" builds durable learned context; \"superrag\" optimizes the document for retrieval without generating memories.",
            "type": "string",
            "enum": [
              "memory",
              "superrag"
            ]
          },
          "dreaming": {
            "description": "Processing mode. \"dynamic\" (default) groups related documents so memories form from coherent context. \"instant\" processes each document independently right away and bills one extra operation per document.",
            "type": "string",
            "enum": [
              "dynamic",
              "instant"
            ]
          }
        },
        "required": [
          "documents"
        ],
        "additionalProperties": false
      }
    }
  }
}
```

## Responses

### 200 — Batch accepted for processing

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "results": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string",
                  "description": "Document identifier"
                },
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
                    "failed",
                    "error"
                  ],
                  "description": "The document's processing state after this request, or error when this item failed"
                },
                "error": {
                  "description": "Failure reason",
                  "type": "string"
                },
                "details": {
                  "description": "Human-readable explanation of the failure",
                  "type": "string"
                },
                "url": {
                  "description": "URL of the failed item, when it had one",
                  "type": "string"
                }
              },
              "required": [
                "id",
                "status"
              ],
              "additionalProperties": false
            },
            "description": "One result per submitted document: accepted documents first, in request order, then failed ones. Match results by id, or by url for a failed item with no id."
          },
          "count": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Number of documents accepted"
          },
          "failed": {
            "type": "integer",
            "minimum": 0,
            "maximum": 9007199254740991,
            "description": "Number of documents that failed"
          }
        },
        "required": [
          "results",
          "count",
          "failed"
        ],
        "additionalProperties": false
      }
    }
  },
  "description": "Batch accepted for processing"
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

### 402 — Insufficient processing credits

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Insufficient processing credits"
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

res = client.documents.batch_add(
    "user_123",
    documents=[
        {"content": "Q3 roadmap notes", "id": "doc_roadmap"},
        {"content": "Gift policy for VP promotions", "id": "doc_gifts"},
    ],
    dreaming="instant",
)
print(res.count, res.failed)
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
