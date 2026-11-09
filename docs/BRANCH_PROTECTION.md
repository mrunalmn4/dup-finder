# Branch protection (maintainers)

Apply these settings on GitHub → **Settings → Branches → Branch protection rules** for `main`.

## Required

| Setting | Value |
|---------|--------|
| Require a pull request before merging | On (1 approval optional for solo maintainers) |
| Require status checks to pass | On |
| Status checks that are required | **`test`** (workflow `ci`, job name `test`) |
| Require branches to be up to date | On when practical |
| Do not allow bypassing the above settings | On for org policies; solo may leave off |
| Restrict who can push | Maintainers only |
| Allow force pushes | **Off** |
| Allow deletions | **Off** |

## After enabling

1. Open a no-op PR and confirm the `ci` / `test` check appears and is required.
2. Tag releases only from green `main` commits (`bash scripts/release/checklist.sh vX.Y.Z`).

## Related

- Packaging and publish: `.github/workflows/release.yml` (not a required PR check).
- GUI debug rebuild: `.github/workflows/desktop-host.yml`.
