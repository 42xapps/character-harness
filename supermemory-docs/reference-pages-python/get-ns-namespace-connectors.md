# List connectors

- **Method:** `GET`
- **Path:** `/ns/{namespace}/connectors`
- **Operation ID:** `getNsByNamespaceConnectors`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

List the connectors that sync into this namespace.

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
    "name": "provider",
    "schema": {
      "type": "string",
      "enum": [
        "notion",
        "google-drive",
        "onedrive",
        "gmail",
        "github",
        "web-crawler",
        "s3",
        "granola"
      ]
    },
    "description": "Only return connectors for this provider"
  },
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
    "description": "Maximum connectors to return per page"
  }
]
```

## Responses

### 200 — Connectors in this namespace

```json
{
  "content": {
    "application/json": {
      "schema": {
        "type": "object",
        "properties": {
          "connectors": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": {
                  "type": "string"
                },
                "provider": {
                  "type": "string",
                  "enum": [
                    "notion",
                    "google-drive",
                    "onedrive",
                    "gmail",
                    "github",
                    "web-crawler",
                    "s3",
                    "granola"
                  ],
                  "description": "External source"
                },
                "authorization": {
                  "description": "Present while pending, when the caller can create connectors in this namespace",
                  "type": "object",
                  "properties": {
                    "url": {
                      "type": "string",
                      "description": "Send the user here to authorize the provider"
                    },
                    "expiresAt": {
                      "type": "string",
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                      "description": "When url stops working"
                    }
                  },
                  "required": [
                    "url",
                    "expiresAt"
                  ]
                },
                "namespace": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ],
                  "description": "Namespace the connector syncs into. Null only for connectors created before namespaces were required."
                },
                "account": {
                  "anyOf": [
                    {
                      "type": "string"
                    },
                    {
                      "type": "null"
                    }
                  ],
                  "description": "Account on the provider side, usually an email"
                },
                "capabilities": {
                  "type": "object",
                  "properties": {
                    "selectable": {
                      "type": "boolean",
                      "description": "Supports choosing what to sync via the hosted picker"
                    },
                    "webhooks": {
                      "type": "boolean",
                      "description": "Receives change notifications instead of only polling"
                    }
                  },
                  "required": [
                    "selectable",
                    "webhooks"
                  ]
                },
                "config": {
                  "anyOf": [
                    {
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
                          }
                        ]
                      }
                    },
                    {
                      "type": "null"
                    }
                  ],
                  "description": "Non-secret setup, such as the S3 bucket, crawler start URL or Notion workspace. Credentials are never returned."
                },
                "selection": {
                  "anyOf": [
                    {
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
                              "type": "string"
                            },
                            "name": {
                              "type": "string"
                            }
                          },
                          "required": [
                            "id",
                            "name"
                          ]
                        }
                      }
                    },
                    {
                      "type": "null"
                    }
                  ],
                  "description": "What syncs, grouped by kind (repos, labels, files or folders), each a list of { id, name }. Null for connectors that sync everything.",
                  "example": {
                    "labels": [
                      {
                        "id": "INBOX",
                        "name": "Inbox"
                      }
                    ]
                  }
                },
                "documentLimit": {
                  "type": "number"
                },
                "documentCount": {
                  "type": "number"
                },
                "latestRun": {
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "errorCode": {
                          "anyOf": [
                            {
                              "type": "string",
                              "enum": [
                                "auth_expired",
                                "rate_limited",
                                "plan_required",
                                "provider_unavailable",
                                "internal"
                              ]
                            },
                            {
                              "type": "null"
                            }
                          ]
                        },
                        "error": {
                          "anyOf": [
                            {
                              "type": "string"
                            },
                            {
                              "type": "null"
                            }
                          ],
                          "description": "Customer-safe error message"
                        },
                        "system": {
                          "type": "object",
                          "properties": {
                            "status": {
                              "type": "string",
                              "enum": [
                                "running",
                                "completed",
                                "failed"
                              ]
                            },
                            "startedAt": {
                              "type": "string",
                              "format": "date-time",
                              "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                              "description": "ISO 8601 timestamp when the run started"
                            },
                            "completedAt": {
                              "anyOf": [
                                {
                                  "type": "string",
                                  "format": "date-time",
                                  "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"
                                },
                                {
                                  "type": "null"
                                }
                              ],
                              "description": "ISO 8601 timestamp when the run ended; null while running"
                            }
                          },
                          "required": [
                            "status",
                            "startedAt",
                            "completedAt"
                          ],
                          "description": "Run status and timestamps maintained by Supermemory"
                        }
                      },
                      "required": [
                        "errorCode",
                        "error",
                        "system"
                      ]
                    },
                    {
                      "type": "null"
                    }
                  ],
                  "description": "The most recent sync run, which may still be running or may have failed"
                },
                "system": {
                  "type": "object",
                  "properties": {
                    "status": {
                      "type": "string",
                      "enum": [
                        "pending_authorization",
                        "active"
                      ],
                      "description": "pending_authorization until the user finishes the provider login at authorization.url; DELETE cancels it. Pending connectors are not listed."
                    },
                    "createdAt": {
                      "type": "string",
                      "format": "date-time",
                      "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                      "description": "ISO 8601 timestamp when the connector was created"
                    },
                    "lastSuccessfulSyncAt": {
                      "anyOf": [
                        {
                          "type": "string",
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"
                        },
                        {
                          "type": "null"
                        }
                      ],
                      "description": "ISO 8601 timestamp when content last finished syncing successfully"
                    }
                  },
                  "required": [
                    "status",
                    "createdAt",
                    "lastSuccessfulSyncAt"
                  ],
                  "description": "Lifecycle status and timestamps maintained by Supermemory"
                },
                "syncs": {
                  "description": "Present when include=syncs",
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "errorCode": {
                        "anyOf": [
                          {
                            "type": "string",
                            "enum": [
                              "auth_expired",
                              "rate_limited",
                              "plan_required",
                              "provider_unavailable",
                              "internal"
                            ]
                          },
                          {
                            "type": "null"
                          }
                        ]
                      },
                      "error": {
                        "anyOf": [
                          {
                            "type": "string"
                          },
                          {
                            "type": "null"
                          }
                        ],
                        "description": "Customer-safe error message"
                      },
                      "system": {
                        "type": "object",
                        "properties": {
                          "status": {
                            "type": "string",
                            "enum": [
                              "running",
                              "completed",
                              "failed"
                            ]
                          },
                          "startedAt": {
                            "type": "string",
                            "format": "date-time",
                            "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$",
                            "description": "ISO 8601 timestamp when the run started"
                          },
                          "completedAt": {
                            "anyOf": [
                              {
                                "type": "string",
                                "format": "date-time",
                                "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"
                              },
                              {
                                "type": "null"
                              }
                            ],
                            "description": "ISO 8601 timestamp when the run ended; null while running"
                          }
                        },
                        "required": [
                          "status",
                          "startedAt",
                          "completedAt"
                        ],
                        "description": "Run status and timestamps maintained by Supermemory"
                      },
                      "id": {
                        "type": "string"
                      },
                      "trigger": {
                        "type": "string",
                        "enum": [
                          "event",
                          "cron",
                          "manual"
                        ]
                      },
                      "itemsProcessed": {
                        "type": "number"
                      },
                      "itemsFailed": {
                        "type": "number"
                      },
                      "failures": {
                        "type": "array",
                        "items": {
                          "type": "object",
                          "properties": {
                            "documentId": {
                              "type": "string"
                            },
                            "title": {
                              "anyOf": [
                                {
                                  "type": "string"
                                },
                                {
                                  "type": "null"
                                }
                              ]
                            },
                            "errorCode": {
                              "type": "string"
                            },
                            "errorMessage": {
                              "type": "string"
                            },
                            "failedAt": {
                              "type": "string"
                            }
                          },
                          "required": [
                            "documentId",
                            "title",
                            "errorCode",
                            "errorMessage",
                            "failedAt"
                          ]
                        },
                        "description": "Failed items, capped. itemsFailed is the true count."
                      }
                    },
                    "required": [
                      "errorCode",
                      "error",
                      "system",
                      "id",
                      "trigger",
                      "itemsProcessed",
                      "itemsFailed",
                      "failures"
                    ]
                  }
                },
                "picker": {
                  "description": "Present when include=picker. Null for connectors that sync everything.",
                  "anyOf": [
                    {
                      "type": "object",
                      "properties": {
                        "url": {
                          "type": "string",
                          "description": "Send the user here to choose what syncs. Works once, in any browser."
                        },
                        "expiresAt": {
                          "type": "string",
                          "format": "date-time",
                          "pattern": "^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?(?:Z))$"
                        }
                      },
                      "required": [
                        "url",
                        "expiresAt"
                      ]
                    },
                    {
                      "type": "null"
                    }
                  ]
                }
              },
              "required": [
                "id",
                "provider",
                "namespace",
                "account",
                "capabilities",
                "config",
                "selection",
                "documentLimit",
                "documentCount",
                "latestRun",
                "system"
              ]
            }
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
          "connectors",
          "pagination"
        ]
      }
    }
  },
  "description": "Connectors in this namespace"
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

page = client.connectors.list("user_123")
for c in page.connectors:
    print(c.id, c.provider, c.document_count)
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
