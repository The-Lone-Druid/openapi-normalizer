# API Reference

## `normalize(document, options?)`

Normalizes a Postman-exported OpenAPI document.

### Parameters

| Parameter  | Type                | Description                       |
| ---------- | ------------------- | --------------------------------- |
| `document` | `OpenAPIDocument`   | The OpenAPI document to normalize |
| `options`  | `NormalizeOptions?` | Optional configuration            |

### `NormalizeOptions`

| Property                 | Type       | Default | Description                                            |
| ------------------------ | ---------- | ------- | ------------------------------------------------------ |
| `preserveHeaders`        | `string[]` | `[]`    | Header names to keep (bypass noisy-header stripping)   |
| `additionalNoisyHeaders` | `string[]` | `[]`    | Extra header names to treat as noisy and remove        |
| `stripXExtensions`       | `boolean`  | `false` | Remove all `x-*` vendor extension keys                 |
| `keepExamples`           | `boolean`  | `false` | Preserve named `examples` instead of collapsing        |
| `inferSchemas`           | `boolean`  | `true`  | Infer schemas from example values when schema is empty |

### Returns

`OpenAPIDocument` — A new normalized document (input is not mutated).

### Example

```ts
import { normalize } from 'openapi-normalizer';
import type { OpenAPIDocument } from 'openapi-normalizer';

const doc: OpenAPIDocument = JSON.parse(rawJson);
const result: OpenAPIDocument = normalize(doc);

// With options
const result2 = normalize(doc, {
  preserveHeaders: ['X-Request-Id'],
  stripXExtensions: true,
  keepExamples: true,
});
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
