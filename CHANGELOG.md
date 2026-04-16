# openapi-normalizer

## 1.1.0

### Minor Changes

- [#14](https://github.com/The-Lone-Druid/openapi-normalizer/pull/14) [`855047a`](https://github.com/The-Lone-Druid/openapi-normalizer/commit/855047a5c86eae5496be866bf95213990b8ed0bd) Thanks [@The-Lone-Druid](https://github.com/The-Lone-Druid)! - Add Options API for both `normalize()` and `convertCollection()`, Postman auth mapping, and converter improvements.

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

### Patch Changes

- [#3](https://github.com/The-Lone-Druid/openapi-normalizer/pull/3) [`661f470`](https://github.com/The-Lone-Druid/openapi-normalizer/commit/661f470ae98b9b55e197b88c64fbbb21f2b110be) Thanks [@The-Lone-Druid](https://github.com/The-Lone-Druid)! - Add enterprise-grade developer tooling: ESLint 10 (typescript-eslint flat config), Prettier 3, Husky 9 git hooks, lint-staged, and Commitlint with Conventional Commits enforcement. Add GitHub repository health files: structured issue templates, PR template, Dependabot config, CODEOWNERS, CodeQL workflow, and Copilot workspace instructions with prompts.

## 1.0.1

### Patch Changes

- [#1](https://github.com/The-Lone-Druid/openapi-normalizer/pull/1) [`f271af9`](https://github.com/The-Lone-Druid/openapi-normalizer/commit/f271af9938bf9f0921d534aef837e7ab028becf7) Thanks [@The-Lone-Druid](https://github.com/The-Lone-Druid)! - Add author field to package.json for npm registry discoverability
