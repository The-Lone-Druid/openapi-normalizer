# openapi-normalizer

[![npm version](https://img.shields.io/npm/v/openapi-normalizer.svg)](https://www.npmjs.com/package/openapi-normalizer)
[![CI](https://github.com/The-Lone-Druid/openapi-normalizer/actions/workflows/ci.yml/badge.svg)](https://github.com/The-Lone-Druid/openapi-normalizer/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen.svg)](https://github.com/The-Lone-Druid/openapi-normalizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Convert Postman Collections to OpenAPI 3.x and normalize bloated Postman-exported specs — correlated request/response examples, inferred schemas, zero dependencies.**

Postman is great for exploring APIs, but its exports are noisy and siloed. `openapi-normalizer` bridges the gap: one command turns your Postman Collection JSON into a clean, tool-friendly OpenAPI 3.0.3 document — ready for Swagger UI, Redocly, Stoplight, or any OpenAPI-based client code generator.

## Features

- **Convert** Postman Collections (v2.0/v2.1) to OpenAPI 3.0.3 with **correlated named examples** — the same example key appears in both `requestBody` and `responses`, letting tools like Swagger UI display full request ↔ response pairs
- **Normalize** Postman-exported OpenAPI files: strip noisy HTTP headers, collapse redundant `examples` to a clean inline `example`, infer and merge `schema` from example values, remove empty security/contact/component objects
- Generates human-readable `operationId`s from Postman request names
- Annotates `{{VARIABLE}}`-style Postman server URLs with `x-postman-variable`
- Reduces file size by **60–70%** on typical Postman exports
- Dual CJS/ESM build, full TypeScript types, **zero runtime dependencies**

## Install

```bash
# As a project dependency
npm install openapi-normalizer
pnpm add openapi-normalizer
yarn add openapi-normalizer

# Or run directly without installing
npx openapi-normalizer --help
```

## Quick Start

### CLI

```bash
# Convert a Postman Collection to OpenAPI 3.0.3
npx openapi-normalizer convert postman-collection.json
# → writes postman-collection.openapi.json

# Normalize a Postman-exported OpenAPI file
npx openapi-normalizer normalize postman-export.json
# → writes postman-export.normalized.json

# Specify a custom output path
npx openapi-normalizer convert postman-collection.json openapi.json
npx openapi-normalizer normalize postman-export.json openapi-clean.json
```

### Programmatic API

```ts
import { normalize, convertCollection } from 'openapi-normalizer';
import { readFileSync, writeFileSync } from 'fs';

// Convert a Postman Collection to OpenAPI
const collection = JSON.parse(readFileSync('postman-collection.json', 'utf-8'));
const openapi = convertCollection(collection);
writeFileSync('openapi.json', JSON.stringify(openapi, null, 2));

// Normalize a Postman-exported OpenAPI spec
const exported = JSON.parse(readFileSync('postman-export.json', 'utf-8'));
const clean = normalize(exported);
writeFileSync('openapi-clean.json', JSON.stringify(clean, null, 2));

// Chain both: convert a collection, then normalize the result
const collection2 = JSON.parse(readFileSync('postman-collection.json', 'utf-8'));
const normalized = normalize(convertCollection(collection2));
writeFileSync('openapi-normalized.json', JSON.stringify(normalized, null, 2));
```

## Real-World Use Case: Git-Versioned Postman Collection → Generated Client Code

If your team maintains a Postman Collection in version control, you can use `openapi-normalizer` as the bridge between your Postman workflow and any JS/TS code generator — for web, desktop, or mobile targets.

### The Problem

Postman is excellent for designing and testing APIs, but it silos your API definition in a GUI. Teams that commit their `postman-collection.json` to git gain:

- **Version history** — see exactly what changed in each endpoint across every commit
- **Code review** — catch breaking API changes before they merge
- **CI automation** — regenerate client SDKs automatically on every API change

The missing piece is converting that committed JSON into a clean, normalized OpenAPI spec that code generators can consume reliably.

### The Workflow

```
postman-collection.json  (committed to git)
         │
         ▼  openapi-normalizer convert
  openapi-raw.json
         │
         ▼  openapi-normalizer normalize
  openapi.json  (clean, normalized, committed to git)
         │
         ▼  code generator (openapi-generator-cli / @hey-api/openapi-ts / etc.)
  src/api/  (generated client — web, desktop, mobile)
```

### Step-by-Step Example

**1. Add a `generate` script to your `package.json`:**

```json
{
  "scripts": {
    "generate:api": "node scripts/generate-api.mjs"
  },
  "devDependencies": {
    "openapi-normalizer": "^1.0.0",
    "@hey-api/openapi-ts": "latest"
  }
}
```

**2. Create `scripts/generate-api.mjs`:**

```js
import { convertCollection, normalize } from 'openapi-normalizer';
import { readFileSync, writeFileSync } from 'fs';

// Step 1: Convert the committed Postman Collection to OpenAPI
const collection = JSON.parse(readFileSync('postman-collection.json', 'utf-8'));
const raw = convertCollection(collection);

// Step 2: Normalize the result (remove noise, infer schemas)
const clean = normalize(raw);

// Step 3: Write the clean spec (also commit this for diff visibility)
writeFileSync('openapi.json', JSON.stringify(clean, null, 2));

console.log('✓ openapi.json written — ready for code generation');
```

**3. Generate a TypeScript client (web/desktop):**

Using [`@hey-api/openapi-ts`](https://github.com/hey-api/openapi-ts) for a TypeScript-first fetch/axios client:

```bash
# Install
pnpm add -D @hey-api/openapi-ts

# Generate
npx @hey-api/openapi-ts \
  --input openapi.json \
  --output src/api \
  --client @hey-api/client-fetch
```

This produces a fully typed `src/api/` module usable in React, Vue, Angular, Next.js, Nuxt, SvelteKit, or any other JS/TS framework.

**4. Generate clients for mobile or desktop (optional):**

Using [`openapi-generator-cli`](https://github.com/OpenAPITools/openapi-generator-cli):

```bash
# Install (requires Java)
npm install -g @openapitools/openapi-generator-cli

# TypeScript/Axios for web
openapi-generator-cli generate -i openapi.json -g typescript-axios -o src/api

# Swift 5 for iOS
openapi-generator-cli generate -i openapi.json -g swift5 -o ios/Sources/API

# Kotlin for Android
openapi-generator-cli generate -i openapi.json -g kotlin -o android/src/main/java/api

# Dart for Flutter
openapi-generator-cli generate -i openapi.json -g dart -o lib/api
```

**5. Wire it into CI (GitHub Actions example):**

```yaml
# .github/workflows/generate-client.yml
name: Generate API Client

on:
  push:
    paths:
      - 'postman-collection.json'

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm run generate:api
      - run: npx @hey-api/openapi-ts --input openapi.json --output src/api --client @hey-api/client-fetch
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: regenerate API client'
          file_pattern: 'openapi.json src/api/**'
```

Every time `postman-collection.json` is updated in a PR, the CI regenerates `openapi.json` and the client SDK automatically.

### Why Normalize Before Generating?

Code generators like `openapi-generator-cli` and `@hey-api/openapi-ts` can fail or produce bloated output when the input spec contains Postman-style noise:

| Issue in raw Postman export | Effect on code generator |
|---|---|
| No `schema` on request bodies — only `example` | Generator produces `any` types |
| Dozens of noisy headers as parameters | Every generated function has 10+ extra params |
| Multiple named `examples` without correlation | Generated mocks are incomplete |
| `{{VARIABLE}}` in server URLs | Generator base URL config is broken |

`openapi-normalizer` fixes all of these before the generator ever sees the spec.

## API Reference

| Function | Description |
|---|---|
| `convertCollection(collection)` | Converts a Postman Collection (v2.0/v2.1) to an OpenAPI 3.0.3 document |
| `normalize(doc)` | Normalizes a Postman-exported OpenAPI document — strips noise, infers schemas |

Both functions are pure — they do not mutate their input and have no side effects.

```ts
import { normalize, convertCollection } from 'openapi-normalizer';
import type { PostmanCollection, OpenAPIDocument } from 'openapi-normalizer';
```

Full API reference and type definitions: **[the-lone-druid.github.io/openapi-normalizer/api](https://the-lone-druid.github.io/openapi-normalizer/api/)**

## CLI Reference

```
openapi-normalizer <command> <input> [output]

Commands:
  normalize <input> [output]   Normalize a Postman-exported OpenAPI file
  convert <input> [output]     Convert a Postman Collection to OpenAPI 3.0.3

Options:
  -v, --version   Show version
  -h, --help      Show help

Exit codes: 0 = success, 1 = error
```

## Documentation

Full documentation, guides, and examples: **[the-lone-druid.github.io/openapi-normalizer](https://the-lone-druid.github.io/openapi-normalizer/)**

- [Getting Started](https://the-lone-druid.github.io/openapi-normalizer/guide/getting-started)
- [Normalizer Guide](https://the-lone-druid.github.io/openapi-normalizer/guide/normalizer)
- [Converter Guide](https://the-lone-druid.github.io/openapi-normalizer/guide/converter)
- [CLI Reference](https://the-lone-druid.github.io/openapi-normalizer/guide/cli)
- [Use Cases: Git-Versioned Postman Workflow](https://the-lone-druid.github.io/openapi-normalizer/guide/use-cases)
- [API Reference](https://the-lone-druid.github.io/openapi-normalizer/api/)

## Contributing

1. Fork the repo and create a branch
2. Make your changes and add tests
3. Run `pnpm test && pnpm lint`
4. Add a changeset: `pnpm changeset`
5. Open a pull request

## License

[MIT](./LICENSE)
