# Converter

The converter transforms a raw Postman Collection (v2.0/v2.1) into a clean OpenAPI 3.0.3 document with correlated request/response examples.

## Why not Postman's built-in export?

When Postman exports to OpenAPI, it **loses the correlation** between requests and responses. You get one request body and multiple responses, but there's no way to tell which request produced which response.

The converter solves this by reading the `originalRequest` stored inside each saved response in the raw collection JSON.

## Usage

```ts
import { convertCollection } from 'openapi-normalizer';

const openapi = convertCollection(postmanCollection);
```

## Options

Pass a `ConvertOptions` object as the second argument:

```ts
import { convertCollection } from 'openapi-normalizer';

const openapi = convertCollection(collection, {
  inferRequired: true,
  inferFormats: true,
  operationIdStyle: 'kebab-case',
  tagFromFolder: false,
  defaultContentType: 'application/json',
});
```

| Option               | Type                                          | Default              | Description                                               |
| -------------------- | --------------------------------------------- | -------------------- | --------------------------------------------------------- |
| `inferRequired`      | `boolean`                                     | `false`              | Mark properties present in ALL examples as `required`     |
| `inferFormats`       | `boolean`                                     | `false`              | Detect string formats (uuid, date-time, email, uri, etc.) |
| `tagFromFolder`      | `boolean`                                     | `true`               | Use Postman folder names as OpenAPI tags                  |
| `operationIdStyle`   | `'camelCase' \| 'snake_case' \| 'kebab-case'` | `'camelCase'`        | Style for generated operationIds                          |
| `defaultContentType` | `string`                                      | `'application/json'` | Fallback Content-Type when none can be detected           |

## Auth Mapping

If the Postman Collection has a top-level `auth` object, the converter maps it to an OpenAPI `securitySchemes` entry and applies it globally:

| Postman `auth.type` | OpenAPI Security Scheme                               |
| ------------------- | ----------------------------------------------------- |
| `bearer`            | `{ type: 'http', scheme: 'bearer' }`                  |
| `basic`             | `{ type: 'http', scheme: 'basic' }`                   |
| `apikey`            | `{ type: 'apiKey', in: 'header', name: 'X-API-Key' }` |
| `oauth2`            | `{ type: 'oauth2', flows: { implicit: { ... } } }`    |

## What it produces

- **OpenAPI 3.0.3** compliant output
- **Correlated named examples** — same key in `requestBody.examples` and `response.examples`
- **Inferred schemas** from all request/response payloads (merged across examples)
- **Tags from folder structure** — Postman folders become OpenAPI tags
- **OperationIds from request names** — e.g. `master/getState` → `masterGetstate`
- **Server variables** — `{{API_GATEWAY}}` becomes annotated server entry

## Correlated examples

This is the key feature. Given a Postman request with two saved responses:

| Saved Response | Request Body  | Response Body            |
| -------------- | ------------- | ------------------------ |
| "Success"      | `{"id": 1}`   | `{"status": "ok"}`       |
| "Not Found"    | `{"id": 999}` | `{"error": "not found"}` |

The converter produces:

```json
{
  "requestBody": {
    "content": {
      "application/json": {
        "schema": { "type": "object", "properties": { "id": { "type": "integer" } } },
        "examples": {
          "Success": { "value": { "id": 1 } },
          "Not_Found": { "value": { "id": 999 } }
        }
      }
    }
  },
  "responses": {
    "200": {
      "content": {
        "application/json": {
          "schema": { "...": "..." },
          "examples": {
            "Success": { "value": { "status": "ok" } },
            "Not_Found": { "value": { "error": "not found" } }
          }
        }
      }
    }
  }
}
```

Tools like **Swagger UI**, **Stoplight**, and **Redocly** can use the matching keys to display the full request ↔ response pair for each scenario.

## Supported body modes

| Postman mode | OpenAPI media type                  |
| ------------ | ----------------------------------- |
| `raw` (JSON) | `application/json`                  |
| `formdata`   | `multipart/form-data`               |
| `urlencoded` | `application/x-www-form-urlencoded` |

## Folder → Tag mapping

Postman collection folders map directly to OpenAPI tags:

```
📁 Users/
  📄 createUser    → tags: ["Users"]
  📄 getUser       → tags: ["Users"]
📁 Orders/
  📁 Admin/
    📄 listOrders  → tags: ["Orders", "Admin"]
```
