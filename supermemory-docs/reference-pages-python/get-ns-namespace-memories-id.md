# Get memory

- **Method:** `GET`
- **Path:** `/ns/{namespace}/memories/{id}`
- **Operation ID:** `getNsByNamespaceMemoriesById`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Retrieve one memory by ID. Optionally include its version history and connected memories (each list walks outward up to relatedLimit) and its source document.

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
  },
  {
    "in": "path",
    "name": "id",
    "schema": {
      "type": "string",
      "minLength": 1,
      "example": "mem_abc123"
    },
    "required": true,
    "description": "Memory identifier"
  },
  {
    "in": "query",
    "name": "include",
    "schema": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": [
          "related",
          "documents"
        ]
      },
      "style": "form",
      "explode": false
    },
    "description": "Comma-separated extras. related: the memory's version history and connected memories. documents: the source document, also attached to each related memory when both are requested."
  },
  {
    "in": "query",
    "name": "relatedLimit",
    "schema": {
      "default": 10,
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    },
    "description": "Maximum parents, children and siblings to return, applied to each list separately. Each list walks outward from the memory until it reaches this many."
  }
]
```

## Responses

### 200 — Memory retrieved

```json
{
  "content": {
    "application/json": {
      "schema": {
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
          },
          "included": {
            "description": "Requested extras",
            "type": "object",
            "properties": {
              "related": {
                "description": "Present when include has related",
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
                        },
                        "document": {
                          "description": "Source document; present when include has both related and documents",
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
                      },
                      "required": [
                        "id",
                        "relation",
                        "memory",
                        "metadata",
                        "system"
                      ]
                    },
                    "description": "Earlier versions this memory updates"
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
                        },
                        "document": {
                          "description": "Source document; present when include has both related and documents",
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
                      },
                      "required": [
                        "id",
                        "relation",
                        "memory",
                        "metadata",
                        "system"
                      ]
                    },
                    "description": "Newer versions that update this memory"
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
                        },
                        "document": {
                          "description": "Source document; present when include has both related and documents",
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
                      },
                      "required": [
                        "id",
                        "relation",
                        "memory",
                        "metadata",
                        "system"
                      ]
                    },
                    "description": "Memories connected by extends or derives"
                  }
                },
                "required": [
                  "parents",
                  "children",
                  "siblings"
                ]
              },
              "document": {
                "description": "Source document; present when include has documents and one exists",
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
          "memory",
          "metadata",
          "isStatic",
          "isInference",
          "isLatest",
          "isForgotten",
          "version",
          "system"
        ]
      }
    }
  },
  "description": "Memory retrieved"
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

### 404 — Memory not found

```json
{
  "content": {
    "application/json": {
      "schema": {
        "$ref": "#/components/schemas/ErrorResponse"
      }
    }
  },
  "description": "Memory not found"
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

memory = client.memories.get("user_123", "mem_abc123", include=["related", "documents"])
print(memory.memory, memory.is_latest)
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
