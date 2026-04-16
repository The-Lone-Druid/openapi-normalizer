---
'openapi-normalizer': minor
---

Add Options API for both `normalize()` and `convertCollection()`, Postman auth mapping, and converter improvements.

### `normalize()` — new `NormalizeOptions`

- `preserveHeaders`: keep specific response headers from being stripped
- `additionalNoisyHeaders`: extend the default noisy header list
- `stripXExtensions`: remove all `x-*` vendor extension keys
- `keepExamples`: preserve named `examples` instead of collapsing to `example`
- `inferSchemas`: toggle schema inference from examples (default: true)

### `convertCollection()` — new `ConvertOptions`

- `inferRequired`: determine required fields from multiple examples
- `inferFormats`: detect string formats (uuid, date-time, email, uri, etc.)
- `tagFromFolder`: toggle folder-to-tag mapping (default: true)
- `operationIdStyle`: choose `camelCase`, `snake_case`, or `kebab-case`
- `defaultContentType`: override the default media type

### Auth mapping

- Maps Postman `bearer`, `basic`, `apikey`, and `oauth2` auth to OpenAPI `securitySchemes`
- Inherits auth from collection → folder → request level

### Bug fixes

- Strip query strings from Postman URL paths
- Auto-detect JSON body when `raw.language` is not set
- Filter `Authorization`, `Content-Type`, `Accept` from header parameters
- Auto-parameterize hardcoded MongoDB ObjectIDs, UUIDs, and numeric IDs in paths
- Merge query/path parameters from duplicate method+path items

### CLI

- Add `convert` subcommand for Postman Collection → OpenAPI conversion
