# Releasing & tags

## Rules

1. **A Git tag is the source of truth** for a version. Release assets must be built from that tagged commit — never from a newer `main` tip attached to an old tag.
2. **Never move / force-push an existing public tag**. Ship fixes as `v0.1.2`, `v0.2.0`, etc.
3. **Prefer automated Release PRs** via [release-please](https://github.com/googleapis/release-please) (Conventional Commits on `main`). Merging the Release PR creates the tag; Actions then dispatches `release.yml` for that tag.
4. Manual fallback: `bash scripts/release/checklist.sh vX.Y.Z`, then annotated tag + push (or `workflow_dispatch` to rebuild an existing tag).
5. `workflow_dispatch` only **rebuilds an existing tag** (checks out `ref: <tag>`, not `main`).
6. CI job `test` should be green on the commit you tag (release quality-gate skips when it already is).

## Conventional Commits (required for automation)

| Prefix | Effect |
|--------|--------|
| `feat:` | minor (0.x → bump minor while pre-1.0 with `bump-minor-pre-major`) |
| `fix:` | patch |
| `feat!:` / `BREAKING CHANGE:` | major |
| `docs:`, `chore:`, `ci:` | changelog only / no bump (unless configured otherwise) |

Examples: `feat: add HTML audit export`, `fix: restore SHA256SUMS on publish`.

## Automated path (preferred)

1. Land work on `main` with Conventional Commit titles (PR squash titles count).
2. `release-please` opens/updates PR `chore(main): release X.Y.Z` (versions + CHANGELOG).
3. Merge that PR → creates tag `vX.Y.Z` → dispatches `release.yml` (build once → smoke → GitHub Release + GHCR).

Config: `release-please-config.json`, `.release-please-manifest.json`, `.github/workflows/release-please.yml`.

## Manual path

```bash
git checkout main && git pull
bash scripts/release/checklist.sh v0.1.2
git tag -a v0.1.2 -m "Dup Finder v0.1.2"
git push origin v0.1.2
```

Version files kept in sync by release-please (or manually):

- `CHANGELOG.md`
- `Cargo.toml` → `[workspace.package].version`
- `src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json`
- `ui/package.json`

## Republish the same tag

```text
Actions → release → Run workflow
  tag = v0.1.1
  include_desktop_hosts / include_tauri as needed
```

## Historical note

`v0.1.0` is historical (early Linux tag). Prefer `v0.1.1+`. From `v0.1.1` onward, tag == bits.
