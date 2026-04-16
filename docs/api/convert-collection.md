# `convertCollection(collection, options?)`

Converts a Postman Collection (v2.0/v2.1) to an OpenAPI 3.0.3 document with correlated request/response examples.

## Parameters

| Parameter    | Type                | Description                        |
| ------------ | ------------------- | ---------------------------------- |
| `collection` | `PostmanCollection` | The Postman Collection JSON object |
| `options`    | `ConvertOptions?`   | Optional configuration             |

## `ConvertOptions`

| Property             | Type                                          | Default              | Description                                           |
| -------------------- | --------------------------------------------- | -------------------- | ----------------------------------------------------- |
| `inferRequired`      | `boolean`                                     | `false`              | Mark properties present in ALL examples as `required` |
| `inferFormats`       | `boolean`                                     | `false`              | Detect string formats (uuid, date-time, email, etc.)  |
| `tagFromFolder`      | `boolean`                                     | `true`               | Use Postman folder names as OpenAPI tags              |
| `operationIdStyle`   | `'camelCase' \| 'snake_case' \| 'kebab-case'` | `'camelCase'`        | Style for generated operationIds                      |
| `defaultContentType` | `string`                                      | `'application/json'` | Fallback Content-Type when none can be detected       |

## Returns

`OpenAPIDocument` — A new OpenAPI 3.0.3 document.

## Example

```ts
import { convertCollection } from 'openapi-normalizer';
import type { PostmanCollection, OpenAPIDocument } from 'openapi-normalizer';

const collection: PostmanCollection = JSON.parse(rawJson);
const openapi: OpenAPIDocument = convertCollection(collection);

// With options
const openapi2 = convertCollection(collection, {
  inferRequired: true,
  inferFormats: true,
  operationIdStyle: 'kebab-case',
  tagFromFolder: false,
});
```

## Auth Mapping

Collection-level `auth` in Postman is automatically mapped to OpenAPI `securitySchemes`:

| Postman `auth.type` | OpenAPI Security Scheme                               |
| ------------------- | ----------------------------------------------------- |
| `bearer`            | `{ type: 'http', scheme: 'bearer' }`                  |
| `basic`             | `{ type: 'http', scheme: 'basic' }`                   |
| `apikey`            | `{ type: 'apiKey', in: 'header', name: 'X-API-Key' }` |
| `oauth2`            | `{ type: 'oauth2', flows: { implicit: { ... } } }`    |

## Behavior

- Flattens nested Postman folders into operations with folder-based tags
- Extracts `originalRequest` from each saved response for correlation
- Groups responses by HTTP status code
- Infers schemas from all request/response payloads via `mergeSchemas`
- Deduplicates operationIds (appends numeric suffix on collision)
- Detects `{{VAR}}` server variables and creates annotated server entries
- Supports `raw` (JSON), `formdata`, and `urlencoded` body modes
- Maps collection-level Postman auth to OpenAPI security schemes
