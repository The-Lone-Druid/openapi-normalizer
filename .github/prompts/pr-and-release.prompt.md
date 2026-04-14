---
description: 'Create a branch, add a changeset, open a PR, and trigger the Changesets release workflow for openapi-normalizer. Use when: shipping a feature, bug fix, or chore through a pull request with automated versioning.'
argument-hint: "Describe the change (e.g. 'add JSON Schema validation support - minor feature')"
agent: agent
---

You are helping ship a change to the `openapi-normalizer` npm package hosted at https://github.com/The-Lone-Druid/openapi-normalizer.

The project uses:

- **pnpm** as the package manager
- **Changesets** for versioning (`pnpm changeset` generates `.changeset/*.md` files)
- **GitHub Actions** for CI (tests on Node 18/20/22) and automated release on merge
- **VitePress** for docs at https://the-lone-druid.github.io/openapi-normalizer/

## Your task

The change to ship: **$ARGUMENTS**

Follow these steps in order:

### 1. Create a branch

Name it using the pattern: `<type>/<short-description>`

- `feat/` — new feature
- `fix/` — bug fix
- `chore/` — maintenance, docs, deps

```bash
git checkout -b <branch-name>
```

### 2. Make the code changes

- Edit source files in `src/`
- Add or update tests in `tests/` if behaviour changed
- Update docs in `docs/` if the public API or CLI changed
- Run `pnpm test` and `pnpm lint` to verify locally

### 3. Add a changeset

Create `.changeset/<slug>.md` manually or run `pnpm changeset` interactively.

Semver rules:
| Type | Bump | When |
|---|---|---|
| Breaking API change | `major` | Removed/renamed exports, incompatible CLI flags |
| New feature | `minor` | New export, new CLI command, new option |
| Bug fix / docs / chore | `patch` | Everything else |

Changeset file format:

```md
---
'openapi-normalizer': patch
---

Short description of what changed and why.
```

### 4. Commit and push

```bash
git add -A
git commit -m "<type>: <description>"
git push -u origin <branch-name>
```

### 5. Open a PR

Use `gh pr create` with:

- A clear title matching the commit message
- Body covering: what changed, why, and the semver bump type
- Checklist: tests pass, changeset added, docs updated if needed

```bash
gh pr create \
  --title "<type>: <description>" \
  --body "## Changes\n\n<what and why>\n\n## Semver\n\n`patch` / `minor` / `major` — reason\n\n## Checklist\n- [ ] Tests pass\n- [ ] Changeset added\n- [ ] Docs updated" \
  --base main
```

### 6. After CI passes — merge and release

Once CI is green and the PR is reviewed:

1. Merge the PR into `main`
2. The **Release GitHub Action** automatically opens a "Version Packages" PR that bumps `package.json` version and updates `CHANGELOG.md`
3. Review and merge that PR
4. The Release Action then runs `pnpm release` → `npm publish` automatically

> No manual `npm publish` needed after the first release. Just merge the version PR.

## Notes

- The `NPM_TOKEN` secret must be set in repo Settings → Secrets → Actions for step 6 to publish
- Coverage only runs on Node 20+ (node:inspector/promises limitation on Node 18)
- Docs deploy automatically to GitHub Pages on every push to `main`
