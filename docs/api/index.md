# API Reference

## `normalize(document)`

Normalizes a Postman-exported OpenAPI document.

### Parameters

| Parameter  | Type              | Description                       |
| ---------- | ----------------- | --------------------------------- |
| `document` | `OpenAPIDocument` | The OpenAPI document to normalize |

### Returns

`OpenAPIDocument` — A new normalized document (input is not mutated).

### Example

```ts
import { normalize } from 'openapi-normalizer';
import type { OpenAPIDocument } from 'openapi-normalizer';

const doc: OpenAPIDocument = JSON.parse(rawJson);
const result: OpenAPIDocument = normalize(doc);
```

### Transforms applied

- Strips noisy HTTP transport response headers
- Collapses named `examples` → single `example`
- Infers schemas from example values when missing
- Strips per-property inline `example` values
- Removes `security: [{}]` (empty security)
- Removes `description` duplicating `summary`
- Deduplicates tags
- Annotates Postman `{{VAR}}` server URLs
- Removes empty `contact`, `components.securitySchemes`, etc.
