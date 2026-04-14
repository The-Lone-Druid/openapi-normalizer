---
description: 'Debug and fix a bug in openapi-normalizer + add a regression test. Use when: a function returns wrong output, throws unexpectedly, or a test is failing.'
argument-hint: "Describe the bug (e.g. 'normalize() crashes when the paths object is empty')"
applyTo: 'src/**,tests/**'
---

You are fixing a bug in the `openapi-normalizer` npm package.

The bug to fix: **$ARGUMENTS**

## Steps

### 1. Reproduce

Find the relevant source file(s) in `src/` and understand the current behaviour.
Write a minimal failing test (or describe the exact input that triggers the bug) to confirm reproduction before fixing.

### 2. Identify the root cause

Read the relevant function(s) carefully. Look for:

- Missing null/undefined guards
- Off-by-one or incorrect type assumptions
- Edge cases not handled (empty arrays, missing optional fields)
- Schema merging or inference corner cases

### 3. Implement the fix

Apply the minimal change that fixes the bug without altering unrelated behaviour.
Do **not** add new dependencies. Do **not** change public API signatures unless necessary (that's a breaking change).

### 4. Add a regression test

In the relevant `tests/*.test.ts` file, add a test that:

1. Uses the exact input that triggered the bug
2. Asserts the correct output
3. Will fail before the fix and pass after

```ts
it('should <correct behaviour description>', () => {
  // This was the crashing/wrong input
  const input = {
    /* minimal reproduction */
  };
  const result = myFunction(input);
  expect(result).toEqual({
    /* correct output */
  });
});
```

### 5. Verify

```bash
pnpm test          # All tests must pass (including the new regression test)
pnpm lint          # No new type errors or lint warnings
pnpm format:check  # Formatting clean
```

### 6. Add a changeset

```md
---
'openapi-normalizer': patch
---

Fix <describe the bug> in `functionName()`
```
