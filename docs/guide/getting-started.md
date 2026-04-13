# Getting Started

## Installation

::: code-group

```sh [npm]
npm install openapi-normalizer
```

```sh [pnpm]
pnpm add openapi-normalizer
```

```sh [yarn]
yarn add openapi-normalizer
```

:::

## Quick Start

### Normalize a Postman-exported OpenAPI file

```ts
import { normalize } from 'openapi-normalizer';
import fs from 'fs';

const raw = JSON.parse(fs.readFileSync('openapi-export.json', 'utf-8'));
const cleaned = normalize(raw);

fs.writeFileSync('openapi-clean.json', JSON.stringify(cleaned, null, 2));
```

### Convert a Postman Collection to OpenAPI

```ts
import { convertCollection } from 'openapi-normalizer';
import fs from 'fs';

const collection = JSON.parse(fs.readFileSync('postman-collection.json', 'utf-8'));
const openapi = convertCollection(collection);

fs.writeFileSync('openapi.json', JSON.stringify(openapi, null, 2));
```

### CLI

```sh
# Normalize
npx openapi-normalizer normalize openapi-export.json

# Convert Postman Collection
npx openapi-normalizer convert postman-collection.json
```

## What does it do?

### Normalizer

When you export an API from Postman as OpenAPI, the result is bloated with:

- **Noisy HTTP headers** — `X-Request-Id`, `Content-Length`, `Set-Cookie`, etc.
- **Redundant per-property examples** — every schema field has an inline `example`
- **Multiple named examples** — instead of a clean single `example`
- **Missing schemas** — only examples exist, no inferred `schema`
- **Empty security/contact objects**

The normalizer cleans all of this up, typically reducing file size by **60%+**.

### Converter

Postman's built-in "Export as OpenAPI" **loses request payloads** — you get one request body but all saved responses without correlation.

The converter reads the raw Postman Collection JSON and uses the `originalRequest` stored in each saved response to produce **correlated named examples** — the same key in `requestBody.examples` and `responses.examples` lets tooling show full request ↔ response pairs.

## Next Steps

- [Normalizer guide →](./normalizer)
- [Converter guide →](./converter)
- [CLI reference →](./cli)
- [API reference →](../api/)
