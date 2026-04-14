# Contributing to openapi-normalizer

Thanks for your interest in contributing! This guide walks you through the development workflow.

## Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 10 — `npm install -g pnpm`

## Setup

```bash
git clone https://github.com/The-Lone-Druid/openapi-normalizer.git
cd openapi-normalizer
pnpm install         # also runs `husky` via the prepare script
```

## Development Workflow

| Command              | Description                                    |
| -------------------- | ---------------------------------------------- |
| `pnpm test`          | Run all unit + integration tests once          |
| `pnpm test:watch`    | Run tests in watch mode                        |
| `pnpm test:coverage` | Run tests with coverage report (≥80% required) |
| `pnpm lint`          | Type-check + ESLint                            |
| `pnpm format`        | Format all files with Prettier                 |
| `pnpm format:check`  | Check formatting without writing               |
| `pnpm build`         | Build dist/ with tsup                          |

## Commit Convention

This project uses **Conventional Commits** enforced by `commitlint`. Every commit must follow the pattern:

```
<type>(<scope>): <subject>
```

Allowed types:

| Type             | When to use                      | Semver bump |
| ---------------- | -------------------------------- | ----------- |
| `feat`           | New feature or API addition      | minor       |
| `fix`            | Bug fix                          | patch       |
| `feat!` / `fix!` | Breaking API change              | major       |
| `docs`           | Documentation only               | —           |
| `test`           | Tests only                       | —           |
| `refactor`       | Code change, no behaviour change | —           |
| `chore`          | Maintenance, deps, tooling       | —           |
| `ci`             | CI/CD workflow changes           | —           |
| `build`          | Build system changes             | —           |

Examples:

```
feat(normalizer): add option to preserve x-extension fields
fix(converter): handle empty collection folders gracefully
chore(deps): update typescript-eslint to v8
docs(guide): add CLI usage examples for convert command
```

The `commit-msg` git hook will reject any commit that doesn't match the format.

## Branching

Use the pattern `<type>/<short-description>`:

- `feat/json-schema-validation`
- `fix/empty-collection-crash`
- `chore/update-deps`
- `docs/converter-guide`

## Adding a Changeset

Every user-visible change needs a changeset file so the release workflow can version correctly:

```bash
pnpm changeset
```

Choose the semver bump and write a one-sentence description. This creates a `.changeset/<slug>.md` file — commit it with your changes.

Skip changesets for `docs:`, `chore:`, `test:`, `ci:`, and `refactor:` commits that don't affect the public API.

## Pull Requests

1. Fork or create a branch from `main`.
2. Make your changes.
3. Ensure `pnpm lint`, `pnpm format:check`, and `pnpm test` all pass.
4. Add a changeset if required.
5. Open a PR and fill in the PR template checklist.

The CI pipeline (GitHub Actions) will run lint, format check, tests on Node 18/20/22, and build on every PR. All checks must pass before merge.

## Project Structure

```
src/
  cli.ts          CLI entry point (excluded from coverage)
  converter.ts    convertCollection() implementation
  normalizer.ts   normalize() implementation
  schema.ts       JSON Schema inference utilities
  types.ts        TypeScript type definitions (excluded from coverage)
  utils.ts        Shared helpers
tests/
  *.test.ts       Unit and integration tests
docs/             VitePress documentation site
```

## No Runtime Dependencies

This package has **zero runtime dependencies** by design. Do not add `dependencies` to `package.json`. Any new helpers must be implemented from scratch or extracted from the existing source.

## License

By contributing, you agree that your changes will be licensed under the [MIT License](LICENSE).
