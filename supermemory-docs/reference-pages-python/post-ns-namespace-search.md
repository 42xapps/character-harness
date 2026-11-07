# Search memories

- **Method:** `POST`
- **Path:** `/ns/{namespace}/search`
- **Operation ID:** `postNsByNamespaceSearch`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Recall the most relevant learned context and source passages from a namespace. Hybrid search combines memories with document chunks by default, with optional query rewriting, reranking, and supporting context attachments.

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
          "query": {
            "type": "string",
            "minLength": 1,
            "description": "Natural-language question, topic, or phrase to retrieve relevant context for. Replaces the v4 `q` field.",
            "example": "what are the API rate limits"
          },
          "filter": {
            "description": "Type-safe metadata conditions applied before ranking results. Replaces the v4 `filters` field and unifies both legacy filter formats into one expression type.",
            "example": {
              "field": "source",
              "operator": "eq",
              "value": "api-docs"
            },
            "$ref": "#/components/schemas/FilterExpression"
          },
          "searchMode": {
            "default": "hybrid",
            "description": "Search surface. \"hybrid\" combines learned memories with source chunks, \"memories\" returns learned context, and \"chunks\" returns source passages.",
            "example": "hybrid",
            "type": "string",
            "enum": [
              "hybrid",
              "memories",
              "chunks"
            ]
          },
          "limit": {
            "default": 10,
            "description": "Maximum number of results to return",
            "example": 10,
            "type": "integer",
            "minimum": 1,
            "maximum": 100
          },
          "include": {
            "default": {
              "documents": false,
              "related": false,
              "forgotten": false
            },
            "description": "Optional context to include alongside each matching result",
            "example": {
              "related": true
            },
            "type": "object",
            "properties": {
              "documents": {
                "default": false,
                "description": "Include the source document for each result when one is available",
                "type": "boolean"
              },
              "related": {
                "default": false,
                "description": "Include parent, child, and sibling memories that explain how each memory evolved",
                "type": "boolean"
              },
              "forgotten": {
                "default": false,
                "description": "Let forgotten and expired memories appear in results",
                "type": "boolean"
              }
            },
            "additionalProperties": false
          },
          "threshold": {
            "default": 0.3,
            "description": "Minimum relevance score from 0 to 1. Raise it for precision (fewer, accurate results) or lower it for broader recall (more results).",
            "example": 0.5,
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "rerank": {
            "default": "none",
            "description": "Post-retrieval ranking. \"order\" improves result ordering; \"aggregate\" also combines overlapping context into cleaner answers. This is helpful if you want to ensure the most relevant results are returned.",
            "example": "order",
            "type": "string",
            "enum": [
              "none",
              "order",
              "aggregate"
            ]
          },
          "rewriteQuery": {
            "default": false,
            "description": "Expand and clarify the query before retrieval to improve recall for conversational or underspecified prompts. This increases the latency by about 400ms.",
            "example": false,
            "type": "boolean"
          }
        },
        "required": [
          "query"
        ],
        "additionalProperties": false
      }
    }
  }
}
```

## Responses

### 200 — Search results

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
                  "description": "Stable identifier for the matching result",
                  "example": "mem_abc123"
                },
                "memory": {
                  "description": "Learned fact or context returned by memory search (only present for memory results)",
                  "example": "The user prefers detailed API responses over minimal ones.",
                  "type": "string"
                },
                "chunk": {
                  "description": "Source passage returned by chunk search (only present for chunk results from hybrid search)",
                  "example": "This is a chunk of content from a document...",
                  "type": "string"
                },
                "metadata": {
                  "type": "object",
                  "propertyNames": {
                    "type": "string"
                  },
                  "additionalProperties": {},
                  "description": "Public metadata attached to the result",
                  "example": {
                    "source": "conversation",
                    "confidence": 0.9
                  }
                },
                "similarity": {
                  "type": "number",
                  "description": "Normalized relevance score used to rank the result, from 0 to 1",
                  "example": 0.89
                },
                "isLatest": {
                  "type": "boolean",
                  "description": "Whether the memory is its latest version; false for recalled forgotten memories"
                },
                "isInference": {
                  "type": "boolean",
                  "description": "Whether the memory was inferred rather than stated directly; false for chunks"
                },
                "system": {
                  "type": "object",
                  "properties": {
                    "updatedAt": {
                      "type": "string",
                      "description": "ISO 8601 timestamp of the latest result update"
                    },
                    "createdAt": {
                      "description": "ISO 8601 timestamp when the result was first created",
                      "type": "string"
                    }
                  },
                  "required": [
                    "updatedAt"
                  ],
                  "description": "Lifecycle and filesystem details for the result"
                },
                "included": {
                  "description": "Requested supporting context for the result",
                  "type": "object",
                  "properties": {
                    "related": {
                      "description": "Memory relationships included when requested",
                      "type": "object",
                      "properties": {
                        "parents": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "description": "Related memory ID"
                              },
                              "relation": {
                                "type": "string",
                                "enum": [
                                  "updates",
                                  "extends",
                                  "derives"
                                ],
                                "description": "How this memory is connected to the matched memory"
                              },
                              "version": {
                                "description": "Version number within the related memory's history",
                                "anyOf": [
                                  {
                                    "type": "number"
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "memory": {
                                "type": "string",
                                "description": "Related learned fact or context"
                              },
                              "metadata": {
                                "type": "object",
                                "propertyNames": {
                                  "type": "string"
                                },
                                "additionalProperties": {},
                                "description": "Public metadata associated with the related memory"
                              },
                              "system": {
                                "type": "object",
                                "properties": {
                                  "updatedAt": {
                                    "type": "string",
                                    "description": "ISO 8601 timestamp of the related memory's latest update"
                                  }
                                },
                                "required": [
                                  "updatedAt"
                                ],
                                "description": "Lifecycle details for the related memory"
                              }
                            },
                            "required": [
                              "id",
                              "relation",
                              "memory",
                              "metadata",
                              "system"
                            ]
                          },
                          "description": "Earlier memories this result updates or derives from"
                        },
                        "children": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "description": "Related memory ID"
                              },
                              "relation": {
                                "type": "string",
                                "enum": [
                                  "updates",
                                  "extends",
                                  "derives"
                                ],
                                "description": "How this memory is connected to the matched memory"
                              },
                              "version": {
                                "description": "Version number within the related memory's history",
                                "anyOf": [
                                  {
                                    "type": "number"
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "memory": {
                                "type": "string",
                                "description": "Related learned fact or context"
                              },
                              "metadata": {
                                "type": "object",
                                "propertyNames": {
                                  "type": "string"
                                },
                                "additionalProperties": {},
                                "description": "Public metadata associated with the related memory"
                              },
                              "system": {
                                "type": "object",
                                "properties": {
                                  "updatedAt": {
                                    "type": "string",
                                    "description": "ISO 8601 timestamp of the related memory's latest update"
                                  }
                                },
                                "required": [
                                  "updatedAt"
                                ],
                                "description": "Lifecycle details for the related memory"
                              }
                            },
                            "required": [
                              "id",
                              "relation",
                              "memory",
                              "metadata",
                              "system"
                            ]
                          },
                          "description": "Newer memories that update or extend this result"
                        },
                        "siblings": {
                          "type": "array",
                          "items": {
                            "type": "object",
                            "properties": {
                              "id": {
                                "type": "string",
                                "description": "Related memory ID"
                              },
                              "relation": {
                                "type": "string",
                                "enum": [
                                  "updates",
                                  "extends",
                                  "derives"
                                ],
                                "description": "How this memory is connected to the matched memory"
                              },
                              "version": {
                                "description": "Version number within the related memory's history",
                                "anyOf": [
                                  {
                                    "type": "number"
                                  },
                                  {
                                    "type": "null"
                                  }
                                ]
                              },
                              "memory": {
                                "type": "string",
                                "description": "Related learned fact or context"
                              },
                              "metadata": {
                                "type": "object",
                                "propertyNames": {
                                  "type": "string"
                                },
                                "additionalProperties": {},
                                "description": "Public metadata associated with the related memory"
                              },
                              "system": {
                                "type": "object",
                                "properties": {
                                  "updatedAt": {
                                    "type": "string",
                                    "description": "ISO 8601 timestamp of the related memory's latest update"
                                  }
                                },
                                "required": [
                                  "updatedAt"
                                ],
                                "description": "Lifecycle details for the related memory"
                              }
                            },
                            "required": [
                              "id",
                              "relation",
                              "memory",
                              "metadata",
                              "system"
                            ]
                          },
                          "description": "Other memories derived from related context"
                        }
                      },
                      "required": [
                        "parents",
                        "children",
                        "siblings"
                      ]
                    },
                    "document": {
                      "description": "Source document included when requested and available",
                      "type": "object",
                      "properties": {
                        "id": {
                          "type": "string",
                          "description": "Source document identifier"
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
                          "description": "Source document title"
                        },
                        "type": {
                          "anyOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ],
                          "description": "Detected source or content type"
                        },
                        "metadata": {
                          "type": "object",
                          "propertyNames": {
                            "type": "string"
                          },
                          "additionalProperties": {},
                          "description": "Public metadata attached to the source document"
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
                          "description": "Generated summary of the source document"
                        },
                        "system": {
                          "type": "object",
                          "properties": {
                            "createdAt": {
                              "type": "string",
                              "description": "ISO 8601 timestamp when the source document was created"
                            },
                            "updatedAt": {
                              "type": "string",
                              "description": "ISO 8601 timestamp of the source document's latest update"
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
                        "title",
                        "type",
                        "metadata",
                        "summary",
                        "system"
                      ]
                    }
                  }
                }
              },
              "required": [
                "id",
                "metadata",
                "similarity",
                "isLatest",
                "isInference",
                "system"
              ]
            },
            "description": "Ranked memories and source chunks matching the query"
          },
          "searchTime": {
            "type": "number",
            "description": "Server-side search duration in milliseconds"
          }
        },
        "required": [
          "results",
          "searchTime"
        ]
      }
    }
  },
  "description": "Search results"
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

### 402 — Search quota or credits exhausted

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Search quota or credits exhausted"
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

response = client.search(
    "user_123",
    query="gift ideas for a VP promotion after a Tokyo offsite",
    search_mode="hybrid",
    limit=5,
    include={"related": True},
    filter={
        "operator": "and",
        "operands": [
            {"field": "category", "operator": "eq", "value": "work"},
            {"field": "importance", "operator": "gte", "value": 0.8},
        ],
    },
)
for r in response.results:
    print(round(r.similarity, 2), r.memory or r.chunk)
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
