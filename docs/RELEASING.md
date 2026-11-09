# Releasing & tags

## Rules

1. **A Git tag is the source of truth** for a version. Release assets must be built from that tagged commit — never from a newer `main` tip attached to an old tag.
2. **Never move / force-push an existing public tag** (`v0.1.0` stays forever). Ship fixes as `v0.1.1`, `v0.2.0`, etc.
3. **Prefer tag push** (`git push origin vX.Y.Z`) to start `.github/workflows/release.yml`.  
   `workflow_dispatch` is only for **rebuilding the same tagged commit** (flaky runner, lost assets). It checks out `ref: <tag>`, not `main`.
4. Run `bash scripts/release/checklist.sh vX.Y.Z` on a clean `main` before tagging.
5. CI job `test` must be green on the commit you tag.

## Cut a release

```bash
# 1. main up to date, checklist green
git checkout main && git pull
bash scripts/release/checklist.sh v0.1.1

# 2. annotated tag on the intended commit
git tag -a v0.1.1 -m "Dup Finder v0.1.1"
git push origin v0.1.1

# 3. Watch Actions → release (quality-gate → build once → smoke → GitHub Release + GHCR)
```

Bump before tagging (keep in sync):

- `CHANGELOG.md` — `## [X.Y.Z] - YYYY-MM-DD`
- `Cargo.toml` workspace `version`
- `src-tauri/Cargo.toml` + `src-tauri/tauri.conf.json` `version`
- `ui/package.json` `version` (informational)

## Republish the same tag

```text
Actions → release → Run workflow
  tag = v0.1.1          # must already exist
  include_desktop_hosts / include_tauri as needed
```

This rebuilds **that tag’s tree** and uploads/clobbers assets on the existing GitHub Release.

## Historical note

`v0.1.0` was created early (Linux-focused). Later GUI assets were briefly attached via dispatch from `main` without moving the tag. From `v0.1.1` onward, tag == bits.
