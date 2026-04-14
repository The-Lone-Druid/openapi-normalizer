---
description: 'Scaffold a new source module with matching unit tests. Use when: adding a new transformation, utility, or public API function to openapi-normalizer.'
argument-hint: "Describe the new feature (e.g. 'a deduplicateServers() function that removes duplicate server entries')"
applyTo: 'src/**'
---

You are adding a new feature to the `openapi-normalizer` npm package.

The feature to implement: **$ARGUMENTS**

## Rules

- **Zero runtime dependencies.** Implement everything in pure TypeScript — no npm packages.
- All logic must be **pure functions** (no side effects, no I/O).
- Use strict TypeScript — explicit return types on all exported functions.
- Use `import type` for type-only imports.
- Export new public API items through `src/index.ts`.

## Steps

### 1. Add types (if needed)

If new input/output types are needed, add them to `src/types.ts`.

### 2. Implement the feature

Decide where the code lives:

- New transformation on OpenAPI docs → `src/normalizer.ts` or `src/converter.ts`
- New schema utility → `src/schema.ts`
- New pure helper → `src/utils.ts`
- Completely new concern → create `src/<name>.ts`

Write the implementation with explicit TypeScript types and no `any`.

### 3. Export from index (if public API)

Add the new export to `src/index.ts`:

```ts
export { myNewFunction } from './my-new-module.js';
```

### 4. Write unit tests

Create or update the matching test file in `tests/`. Follow the pattern:

```ts
describe('myNewFunction()', () => {
  it('should <verb> <outcome> when <condition>', () => {
    const input = {
      /* minimal fixture */
    };
    const result = myNewFunction(input);
    expect(result).toEqual({
      /* expected */
    });
  });

  it('should handle edge case: <case>', () => {
    // ...
  });
});
```

Aim for ≥ 80% branch coverage on the new code.

### 5. Update docs

If the public API changed, update the relevant doc page in `docs/api/` or `docs/guide/`.

### 6. Add a changeset

Determine the semver bump:

- New exported function / option → `minor`
- Bug fix → `patch`
- Removed/renamed export → `major`

Run `pnpm changeset` or create `.changeset/<slug>.md` manually:

```md
---
'openapi-normalizer': minor
---

Add `myNewFunction()` that ...
```

### 7. Verify

```bash
pnpm lint          # tsc + ESLint must pass
pnpm format:check  # Prettier must be satisfied
pnpm test          # All tests must pass
pnpm build         # dist/ must build cleanly
```
