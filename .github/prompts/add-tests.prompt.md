---
description: 'Add or improve unit tests for a specific function in openapi-normalizer. Use when: coverage is low, edge cases are missing, or a new function has no tests yet.'
argument-hint: "Name the function to test (e.g. 'inferSchema in src/schema.ts')"
applyTo: 'tests/**'
---

You are adding unit tests to the `openapi-normalizer` package.

Function / area to cover: **$ARGUMENTS**

## Context

- Test framework: **Vitest** with `globals: true` — no import needed for `describe`, `it`, `expect`, `beforeEach`, etc.
- All tests live in `tests/*.test.ts`
- No file I/O in unit tests — pass plain JS objects as fixtures
- Coverage threshold: **80%** statements, branches, functions, lines

## Test Pattern

```ts
describe('functionName()', () => {
  // Happy path
  it('should <verb> <outcome> when <condition>', () => {
    const input = { /* minimal fixture */ };
    const result = functionName(input);
    expect(result).toEqual({ /* expected */ });
  });

  // Edge cases — cover ALL branches
  it('should handle empty input gracefully', () => { ... });
  it('should return unchanged output when <condition not met>', () => { ... });
  it('should handle nested structure correctly', () => { ... });
  it('should not mutate the input', () => {
    const input = { ... };
    const frozen = Object.freeze(structuredClone(input));
    expect(() => functionName(frozen)).not.toThrow();
  });
});
```

## Steps

1. Read the function implementation in `src/` to understand all branches.
2. For each branch (`if`, `&&`, `||`, ternary, `?.`, `??`), write at least one test covering the truthy AND falsy path.
3. Include at least one test for:
   - Empty / null / undefined fields that could plausibly appear
   - Arrays with 0 items, 1 item, and multiple items
   - Objects missing optional properties
4. Verify coverage with `pnpm test:coverage` and check that the new tests push the relevant file above 80%.

## Running Tests

```bash
pnpm test             # All tests, one shot
pnpm test:watch       # Watch mode during development
pnpm test:coverage    # Full coverage report
```
