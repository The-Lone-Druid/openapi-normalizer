---
applyTo: 'tests/**'
---

# Testing Instructions — openapi-normalizer

## Framework

Vitest 4.x with `globals: true`. No import needed for `describe`, `it`, `expect`, `beforeEach`, `afterEach`, `vi`.

## Test File Layout

Each `src/*.ts` module has a matching `tests/*.test.ts` file:

| Source              | Test file                  |
| ------------------- | -------------------------- |
| `src/normalizer.ts` | `tests/normalizer.test.ts` |
| `src/converter.ts`  | `tests/converter.test.ts`  |
| `src/schema.ts`     | `tests/schema.test.ts`     |
| `src/utils.ts`      | `tests/utils.test.ts`      |

`src/cli.ts` and `src/types.ts` are excluded from coverage and do not have test files.

## Naming Convention

```ts
describe('functionName()', () => {
  it('should <verb> <expected outcome> when <condition>', () => { ... });
});
```

Examples:

- `it('should strip X-Request-Id from all response headers', () => ...)`
- `it('should return an empty object when paths is undefined', () => ...)`
- `it('should not mutate the original input document', () => ...)`

## Fixtures

Keep test data **inline** as `const` objects inside the test file. Do not read from disk in unit tests.

```ts
const minimalSpec = {
  openapi: '3.0.3',
  info: { title: 'Test', version: '1.0.0' },
  paths: {},
};
```

For integration tests in `tests/integration.test.ts`, fixtures are read from the filesystem and tests are automatically skipped when fixture files are absent.

## Coverage Thresholds

Enforced in CI via `vitest.config.mts`:

- **80%** statements, branches, functions, lines

Always aim to cover all branches of an `if` / ternary / optional chain in new tests.

## Immutability

Always verify that functions don't mutate their input:

```ts
it('should not mutate the input', () => {
  const input = Object.freeze(structuredClone(someFixture));
  expect(() => myFunction(input as any)).not.toThrow();
});
```

## Running Tests

```bash
pnpm test             # Run all tests once
pnpm test:watch       # Watch mode
pnpm test:coverage    # Coverage report (check coverage/index.html)
```
