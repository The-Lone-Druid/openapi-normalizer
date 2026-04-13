# openapi-normalizer

[![npm version](https://img.shields.io/npm/v/openapi-normalizer.svg)](https://www.npmjs.com/package/openapi-normalizer)
[![CI](https://github.com/The-Lone-Druid/openapi-normalizer/actions/workflows/ci.yml/badge.svg)](https://github.com/The-Lone-Druid/openapi-normalizer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Normalize Postman-exported OpenAPI specs and convert Postman Collections to clean, standard-compliant OpenAPI 3.x — with correlated request/response examples, inferred schemas, and stripped noise.**

- Removes redundant headers (`Content-Type`, `Accept`, `Authorization`, etc.)
- Collapses duplicate inline examples into `$ref` components
- Infers and merges JSON body schemas across examples
- Converts Postman Collections (v2.0/v2.1) to OpenAPI 3.0.3 with correlated named examples
- Generates human-readable `operationId`s from Postman request names
- Dual CJS/ESM build, full TypeScript types, zero runtime dependencies

## Install

```bash
npm install openapi-normalizer
# or
pnpm add openapi-normalizer
```

## CLI

```bash
# Normalize a Postman-exported OpenAPI file
npx openapi-normalizer normalize input.json -o output.json

# Convert a Postman Collection to OpenAPI
npx openapi-normalizer convert collection.json -o openapi.json
```

## Programmatic API

```ts
import { normalize, convertCollection } from 'openapi-normalizer';
import { readFileSync, writeFileSync } from 'fs';

// Normalize a Postman-exported OpenAPI spec
const raw = JSON.parse(readFileSync('postman-export.json', 'utf-8'));
const clean = normalize(raw);
writeFileSync('openapi.json', JSON.stringify(clean, null, 2));

// Convert a Postman Collection to OpenAPI
const collection = JSON.parse(readFileSync('collection.json', 'utf-8'));
const openapi = convertCollection(collection);
writeFileSync('openapi.json', JSON.stringify(openapi, null, 2));
```

## Documentation

Full documentation at **[The-Lone-Druid.github.io/openapi-normalizer](https://The-Lone-Druid.github.io/openapi-normalizer)**

## Contributing

1. Fork the repo and create a branch
2. Make your changes and add tests
3. Run `pnpm test && pnpm lint`
4. Add a changeset: `pnpm changeset`
5. Open a pull request

## License

[MIT](./LICENSE)
