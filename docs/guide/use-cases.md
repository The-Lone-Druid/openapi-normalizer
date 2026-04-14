# Use Cases

## Git-Versioned Postman Collection → Generated Client Code

This guide shows how to use `openapi-normalizer` as the bridge between a Postman-based API workflow and generated client SDKs for web, mobile, or desktop applications.

### The Problem

Postman is great for designing and testing APIs, but it has one significant drawback: your API definition is **locked inside the Postman GUI**. There's no easy diff, no code review, and no CI automation around API changes.

Teams that commit their Postman Collection JSON to git gain:

- **Version history** — every API change is a commit, reviewable in a pull request
- **Code review** — breaking changes are visible before they merge
- **CI automation** — client SDKs can be regenerated automatically whenever the collection changes

The missing piece is a reliable way to convert that committed JSON file into a clean, normalized OpenAPI spec that downstream code generators can consume without issue.

That's what `openapi-normalizer` is for.

---

### The Workflow

```
postman-collection.json   ← committed to git; updated by the team
         │
         ▼  convertCollection()
  openapi (raw, noisy)
         │
         ▼  normalize()
  openapi.json              ← also committed; diff-friendly, deterministic
         │
         ▼  code generator
  src/api/                  ← generated TypeScript/Swift/Kotlin client
```

All four artifacts can be committed to the same repository. The raw collection is the source of truth; the normalized `openapi.json` is the generated artifact that drives everything downstream.

---

### Step-by-Step Setup

#### 1. Commit your Postman Collection

Export your collection from Postman (**File → Export → Collection v2.1**) and commit it:

```bash
cp ~/Downloads/MyAPI.postman_collection.json postman-collection.json
git add postman-collection.json
git commit -m "chore: add Postman collection"
```

#### 2. Install `openapi-normalizer`

```bash
npm install -D openapi-normalizer
# or
pnpm add -D openapi-normalizer
```

#### 3. Create a generation script

Create `scripts/generate-api.mjs`:

```js
import { convertCollection, normalize } from 'openapi-normalizer';
import { readFileSync, writeFileSync } from 'fs';

// Convert the Postman Collection to a raw OpenAPI document
const collection = JSON.parse(readFileSync('postman-collection.json', 'utf-8'));
const raw = convertCollection(collection);

// Normalize: strip noise, infer schemas, clean up server URLs
const clean = normalize(raw);

// Write the result — commit this file for diff visibility
writeFileSync('openapi.json', JSON.stringify(clean, null, 2));

console.log('✓ openapi.json written');
```

#### 4. Add a script to `package.json`

```json
{
  "scripts": {
    "generate:openapi": "node scripts/generate-api.mjs",
    "generate:client": "openapi-ts --input openapi.json --output src/api --client @hey-api/client-fetch",
    "generate": "npm run generate:openapi && npm run generate:client"
  }
}
```

Run with:

```bash
npm run generate
```

---

### Generating Client Code

Once you have a clean `openapi.json`, you can point any OpenAPI-compatible code generator at it.

#### TypeScript — Web (React, Vue, Angular, Next.js, Nuxt, Svelte)

Using [`@hey-api/openapi-ts`](https://github.com/hey-api/openapi-ts) for a TypeScript-first generated client:

```bash
pnpm add -D @hey-api/openapi-ts @hey-api/client-fetch
npx @hey-api/openapi-ts \
  --input openapi.json \
  --output src/api \
  --client @hey-api/client-fetch
```

The generated `src/api/` module exports fully typed functions for every endpoint:

```ts
import { getUserById, createUser } from './api';

const user = await getUserById({ path: { id: '123' } });
const newUser = await createUser({ body: { name: 'Alice', email: 'alice@example.com' } });
```

#### TypeScript — Desktop (Electron)

The same `@hey-api/openapi-ts` client works in Electron's renderer or main process. Use `@hey-api/client-fetch` for the renderer or `@hey-api/client-axios` if you prefer axios in the main process.

#### Swift — iOS / macOS

Using [`openapi-generator-cli`](https://github.com/OpenAPITools/openapi-generator-cli) (requires Java):

```bash
npm install -g @openapitools/openapi-generator-cli

openapi-generator-cli generate \
  -i openapi.json \
  -g swift5 \
  -o ios/Sources/API
```

#### Kotlin — Android

```bash
openapi-generator-cli generate \
  -i openapi.json \
  -g kotlin \
  -o android/src/main/java/com/yourapp/api
```

#### Dart — Flutter (iOS + Android + Web)

```bash
openapi-generator-cli generate \
  -i openapi.json \
  -g dart \
  -o lib/api
```

---

### Why Normalize Before Generating?

A raw Postman export — whether from Postman's own "Export as OpenAPI" or from `convertCollection` without normalization — contains issues that break or degrade code generators:

| Problem in raw Postman output                                         | Effect on generated code                                    |
| --------------------------------------------------------------------- | ----------------------------------------------------------- |
| No `schema` on request/response bodies — only `example`               | Generator produces `any` / `object` types with no structure |
| Dozens of noisy HTTP headers (`Content-Length`, `X-Request-Id`, etc.) | Every generated function has 10+ unnecessary parameters     |
| Multiple named `examples` without a single canonical `example`        | Mocking tools and form auto-fill don't work                 |
| `{{VARIABLE}}`-style server URLs                                      | Generator can't resolve the base URL                        |
| Empty `components`, `security`, `contact` objects                     | Minor noise but can confuse strict validators               |

Running `normalize()` after `convertCollection()` fixes all of these before any generator sees the spec.

---

### CI Integration

Automate the entire pipeline with a GitHub Actions workflow that triggers whenever `postman-collection.json` changes:

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

      - run: npm ci

      # Step 1: Convert + normalize → openapi.json
      - run: npm run generate:openapi

      # Step 2: Generate TypeScript client
      - run: npm run generate:client

      # Step 3: Commit generated files back to the branch
      - uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: 'chore: regenerate API client from Postman collection'
          file_pattern: 'openapi.json src/api/**'
```

With this in place, any PR that updates `postman-collection.json` automatically regenerates `openapi.json` and the client SDK as part of the same PR — making API changes fully reviewable end-to-end.

---

### Shell Script Alternative

If you prefer a plain shell script over a Node.js script:

```bash
#!/usr/bin/env bash
# scripts/generate-api.sh
set -e

echo "→ Converting Postman Collection to OpenAPI..."
npx openapi-normalizer convert postman-collection.json openapi-raw.json

echo "→ Normalizing..."
npx openapi-normalizer normalize openapi-raw.json openapi.json

echo "→ Generating TypeScript client..."
npx @hey-api/openapi-ts \
  --input openapi.json \
  --output src/api \
  --client @hey-api/client-fetch

echo "✓ Done. Generated files in src/api/"
```

Add it to `package.json`:

```json
{
  "scripts": {
    "generate": "bash scripts/generate-api.sh"
  }
}
```
