# `convertCollection(collection)`

Converts a Postman Collection (v2.0/v2.1) to an OpenAPI 3.0.3 document with correlated request/response examples.

## Parameters

| Parameter | Type | Description |
|---|---|---|
| `collection` | `PostmanCollection` | The Postman Collection JSON object |

## Returns

`OpenAPIDocument` — A new OpenAPI 3.0.3 document.

## Example

```ts
import { convertCollection } from 'openapi-normalizer';
import type { PostmanCollection, OpenAPIDocument } from 'openapi-normalizer';

const collection: PostmanCollection = JSON.parse(rawJson);
const openapi: OpenAPIDocument = convertCollection(collection);
```

## Behavior

- Flattens nested Postman folders into operations with folder-based tags
- Extracts `originalRequest` from each saved response for correlation
- Groups responses by HTTP status code
- Infers schemas from all request/response payloads via `mergeSchemas`
- Deduplicates operationIds (appends numeric suffix on collision)
- Detects `{{VAR}}` server variables and creates annotated server entries
- Supports `raw` (JSON), `formdata`, and `urlencoded` body modes
