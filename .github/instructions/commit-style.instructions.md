---
applyTo: '**'
---

# Commit Style Guide — openapi-normalizer

This project enforces **Conventional Commits** via `commitlint` on every `git commit`.

## Format

```
<type>(<optional scope>): <subject>
```

- Subject: lowercase, imperative mood, no trailing period
- Body (optional): separated by a blank line, ≤100 chars per line
- Footer (optional): `BREAKING CHANGE:` or `Closes #<issue>`

## Allowed Types

| Type             | When                                 | Semver bump |
| ---------------- | ------------------------------------ | ----------- |
| `feat`           | New feature or exported function     | minor       |
| `fix`            | Bug fix                              | patch       |
| `feat!` / `fix!` | Breaking API or CLI change           | major       |
| `docs`           | Documentation only                   | —           |
| `test`           | Tests only                           | —           |
| `refactor`       | Code change, no behaviour change     | —           |
| `chore`          | Maintenance, dep updates, tooling    | —           |
| `ci`             | CI workflow changes                  | —           |
| `build`          | Build system (tsup config, tsconfig) | —           |

## Common Scopes

- `normalizer` — changes to `normalize()`
- `converter` — changes to `convertCollection()`
- `schema` — changes to `inferSchema()`, `mergeSchemas()`, `stripPropertyExamples()`
- `utils` — changes to shared utilities
- `cli` — CLI changes
- `deps` — dependency updates (use with `chore`)
- `ci` — workflow/action changes (use with `ci` type)

## Examples

```
feat(normalizer): add stripXFields option to remove x-extension keys
fix(converter): handle empty folder items without crashing
refactor(schema): extract mergeSchemas into its own helper
test(normalizer): add coverage for empty paths edge case
chore(deps): update typescript-eslint to v8.58
docs(guide): add example showing convertCollection with auth headers
ci: add pnpm audit step to CI pipeline
feat!: rename normalizeDoc() to normalize() — update all call sites
```

## Breaking Changes

Use `!` after the type or include a `BREAKING CHANGE:` footer:

```
feat!(converter)!: rename postmanCollection param to collection

BREAKING CHANGE: The first parameter of convertCollection() has been
renamed from `postmanCollection` to `collection`.
```

## Rejected Examples (will fail commitlint)

```
Updated the normalizer         ← missing type
Feat: Add new feature          ← type must be lowercase
fix: Fixed the bug.            ← trailing period not allowed
WIP                            ← no type/subject
```
