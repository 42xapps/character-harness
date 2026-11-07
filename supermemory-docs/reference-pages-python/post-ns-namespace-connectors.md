# Create connector

- **Method:** `POST`
- **Path:** `/ns/{namespace}/connectors`
- **Operation ID:** `postNsByNamespaceConnectors`
- **Source:** `../supermemory-api.json` (saved OpenAPI snapshot)
- **Source SHA-256:** `5741d22f80e4bf08290fecee3bb5ebb81317bc75adc6f6c8995c45d681853b72`

Connect an external source to this namespace. OAuth providers return an authorization url to send the user to; providers that authenticate with config start syncing right away.

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
        "oneOf": [
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "notion"
              },
              "redirectUrl": {
                "description": "Where the user returns after authorizing with the provider",
                "type": "string",
                "format": "uri"
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              }
            },
            "required": [
              "provider"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "gmail"
              },
              "redirectUrl": {
                "description": "Where the user returns after authorizing with the provider",
                "type": "string",
                "format": "uri"
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              }
            },
            "required": [
              "provider"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "onedrive"
              },
              "redirectUrl": {
                "description": "Where the user returns after authorizing with the provider",
                "type": "string",
                "format": "uri"
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              }
            },
            "required": [
              "provider"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "github"
              },
              "redirectUrl": {
                "description": "Where the user returns after authorizing with the provider",
                "type": "string",
                "format": "uri"
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              }
            },
            "required": [
              "provider"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "google-drive"
              },
              "redirectUrl": {
                "description": "Where the user returns after authorizing with the provider",
                "type": "string",
                "format": "uri"
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              },
              "config": {
                "type": "object",
                "properties": {
                  "syncScope": {
                    "description": "selected (default) syncs only files the user picks. full syncs the whole Drive.",
                    "type": "string",
                    "enum": [
                      "selected",
                      "full"
                    ]
                  }
                },
                "additionalProperties": false
              }
            },
            "required": [
              "provider"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "s3"
              },
              "config": {
                "type": "object",
                "properties": {
                  "bucket": {
                    "type": "string",
                    "minLength": 1
                  },
                  "region": {
                    "type": "string",
                    "minLength": 1
                  },
                  "accessKeyId": {
                    "type": "string",
                    "minLength": 1
                  },
                  "secretAccessKey": {
                    "type": "string",
                    "minLength": 1
                  },
                  "endpoint": {
                    "description": "For S3-compatible stores such as R2 or MinIO",
                    "type": "string",
                    "format": "uri"
                  },
                  "prefix": {
                    "description": "Only sync keys under this prefix",
                    "type": "string"
                  }
                },
                "required": [
                  "bucket",
                  "region",
                  "accessKeyId",
                  "secretAccessKey"
                ],
                "additionalProperties": false,
                "description": "S3 bucket to sync. Credentials are stored encrypted and never returned."
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              }
            },
            "required": [
              "provider",
              "config"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "web-crawler"
              },
              "config": {
                "type": "object",
                "properties": {
                  "startUrl": {
                    "type": "string",
                    "format": "uri"
                  },
                  "crawlDepth": {
                    "description": "How many links deep to follow. Defaults to 3.",
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 5
                  }
                },
                "required": [
                  "startUrl"
                ],
                "additionalProperties": false,
                "description": "Website to crawl"
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              }
            },
            "required": [
              "provider",
              "config"
            ],
            "additionalProperties": false
          },
          {
            "type": "object",
            "properties": {
              "provider": {
                "type": "string",
                "const": "granola"
              },
              "config": {
                "type": "object",
                "properties": {
                  "apiKey": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "apiKey"
                ],
                "additionalProperties": false,
                "description": "Granola API key. Stored encrypted and never returned."
              },
              "documentLimit": {
                "description": "Maximum documents this connector imports",
                "type": "integer",
                "minimum": 1,
                "maximum": 10000
              }
            },
            "required": [
              "provider",
              "config"
            ],
            "additionalProperties": false
          }
        ],
        "discriminator": {
          "propertyName": "provider"
        }
      }
    }
  }
}
```

## Responses

### 201 — Connector created

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
          "authorization": {
            "anyOf": [
              {
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
              {
                "type": "null"
              }
            ],
            "description": "Null for providers that authenticate with config only"
          }
        },
        "required": [
          "id",
          "authorization"
        ]
      }
    }
  },
  "description": "Connector created"
}
```

### 400 — Invalid provider config

```json
{
  "description": "Invalid provider config",
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

setup = client.connectors.create(
    "user_123",
    request={"provider": "notion", "redirectUrl": "https://app.example.com/connected"},
)
# OAuth providers return authorization.url to send the user to; config providers return None
print(setup.id, setup.authorization.url if setup.authorization else None)
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
