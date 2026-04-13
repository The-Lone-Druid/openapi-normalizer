# Normalizer

The normalizer takes a Postman-exported OpenAPI document and cleans it up into a lean, standard-compliant spec.

## Usage

```ts
import { normalize } from 'openapi-normalizer';

const result = normalize(openapiDocument);
```

## What it does

| Transform | Before | After |
|---|---|---|
| Noisy response headers | `X-Request-Id`, `Content-Length`, `Set-Cookie`, … | Removed |
| Named examples | `examples: { ex1: {...}, ex2: {...} }` | Single `example` with first value |
| Missing schemas | Only `examples` exist | Schema inferred from example values |
| Per-property examples | `{ type: "string", example: "John" }` | `{ type: "string" }` |
| Duplicate description | `summary` and `description` identical | `description` removed |
| Empty security | `security: [{}]` | Removed |
| Postman `{{VAR}}` servers | `url: "{{API_GW}}"` | `url: "/"` with descriptive annotation |
| Duplicate tags | Same tag name repeated | Deduplicated |
| Empty components | `securitySchemes: {}` | Removed |

## File size reduction

On a typical Postman export, expect **60–70% reduction** in file size. The largest contributors to bloat are:

1. Per-property `example` values (thousands of instances)
2. Noisy HTTP transport headers on every response
3. Redundant named `examples` objects

## Example

**Input** (simplified):
```json
{
  "paths": {
    "/users": {
      "get": {
        "summary": "Get users",
        "description": "Get users",
        "security": [{}],
        "responses": {
          "200": {
            "description": "OK",
            "headers": {
              "X-Request-Id": { "schema": { "type": "string" } },
              "Content-Length": { "schema": { "type": "string" } }
            },
            "content": {
              "application/json": {
                "schema": {},
                "examples": {
                  "ex1": { "value": { "id": 1, "name": "John" } },
                  "ex2": { "value": { "id": 2, "name": "Jane" } }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

**Output:**
```json
{
  "paths": {
    "/users": {
      "get": {
        "summary": "Get users",
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": { "type": "integer" },
                    "name": { "type": "string" }
                  }
                },
                "example": { "id": 1, "name": "John" }
              }
            }
          }
        }
      }
    }
  }
}
```
