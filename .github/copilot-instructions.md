# openapi-normalizer — Copilot Workspace Instructions

## Project Overview

`openapi-normalizer` is a **zero-dependency TypeScript library and CLI tool** that:

1. **`normalize(doc)`** — Cleans up Postman-exported OpenAPI 3.x documents: strips noise headers, collapses examples, infers missing schemas, removes redundant data.
2. **`convertCollection(collection)`** — Converts Postman Collection v2.0/v2.1 JSON to valid OpenAPI 3.0.3: correlates request/response examples, infers schemas, maps variables to `servers`.

**Key constraint: zero runtime dependencies.** Never suggest adding `dependencies` to `package.json`.

---

## Tech Stack

| Tool                            | Role                                            |
| ------------------------------- | ----------------------------------------------- |
| TypeScript 5.x, strict mode     | Language                                        |
| tsup                            | Build (CJS + ESM dual output)                   |
| Vitest 4.x                      | Testing (globals: true)                         |
| @vitest/coverage-v8             | Coverage (≥80% threshold)                       |
| pnpm 10                         | Package manager                                 |
| ESLint 10 + typescript-eslint   | Linting                                         |
| Prettier 3                      | Formatting                                      |
| Husky 9 + lint-staged           | Git hooks                                       |
| @commitlint/config-conventional | Commit enforcement                              |
| Changesets                      | Versioning + changelog                          |
| VitePress                       | Documentation site                              |
| GitHub Actions                  | CI (Node 18/20/22 matrix), release, docs deploy |

---

## Source Structure

```
src/
  cli.ts         — CLI entry point (bin: openapi-normalizer); NOT covered by tests
  converter.ts   — convertCollection() implementation
  normalizer.ts  — normalize() implementation
  schema.ts      — inferSchema(), mergeSchemas(), stripPropertyExamples()
  types.ts       — All TypeScript types/interfaces; NOT covered by tests
  utils.ts       — Shared pure utility functions
tests/
  converter.test.ts    — Unit tests for convertCollection()
  normalizer.test.ts   — Unit tests for normalize()
  schema.test.ts       — Unit tests for schema inference utilities
  utils.test.ts        — Unit tests for utils
  integration.test.ts  — Integration tests (skipped if fixtures absent)
```

---

## Coding Conventions

- **No runtime dependencies** — implement helpers from scratch
- **Strict TypeScript** — no `any` without a justifying comment; prefer explicit types over inference for public function signatures
- **Pure functions** — all logic in `src/` except `cli.ts` must be pure (no side effects, no I/O)
- **Consistent type imports** — use `import type { Foo }` for type-only imports (enforced by ESLint)
- **Single export** — all public API re-exports go through `src/index.ts`

---

## Commit Convention (Conventional Commits)

Every commit must match: `<type>(<optional scope>): <subject>`

| Type             | Purpose                    | Semver |
| ---------------- | -------------------------- | ------ |
| `feat`           | New feature / API addition | minor  |
| `fix`            | Bug fix                    | patch  |
| `feat!` / `fix!` | Breaking change            | major  |
| `docs`           | Docs only                  | —      |
| `test`           | Tests only                 | —      |
| `refactor`       | No behaviour change        | —      |
| `chore`          | Maintenance / deps         | —      |
| `ci`             | CI workflow changes        | —      |
| `build`          | Build system               | —      |

Subjects: lowercase, no period at end, imperative mood.  
Example: `feat(normalizer): add option to preserve x-extension fields`

---

## Testing Conventions

- Use `describe` + `it` blocks, `expect` assertions — Vitest globals (no import needed)
- Name tests: `it('should <verb> <outcome> when <condition>')`
- Unit tests: pass plain JS objects; no file I/O
- Keep test data inline (small JSON fixtures as `const` objects inside the test file)
- Coverage thresholds: 80% statements, branches, functions, lines — enforced in CI

---

## PR & Release Workflow

1. Branch: `<type>/<short-description>` from `main`
2. Code + tests + docs
3. `pnpm changeset` to record the version bump
4. Open PR → CI must pass → merge to `main`
5. Changesets bot creates a Release PR; merging it publishes to npm automatically

---

## Scripts Reference

```bash
pnpm test             # Run tests once
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report
pnpm lint             # tsc --noEmit + ESLint
pnpm format           # Prettier write
pnpm format:check     # Prettier check (used in CI)
pnpm build            # Build dist/
pnpm docs:dev         # VitePress dev server
pnpm changeset        # Add a changeset
pnpm release          # Build + publish (CI only)
```
