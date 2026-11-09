# Pending (v0.1 → next)

See also: [SCALE.md](SCALE.md), [HOSTING.md](HOSTING.md), [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md), [RELEASING.md](RELEASING.md).

**Rule:** do not claim a platform/channel “released” until that channel’s smoke test has passed.

## Finished

| Artifact / check | Evidence |
|------------------|----------|
| Linux / macOS / Windows CLI + Tauri installers | [v0.1.1](https://github.com/mrunalmn4/dup-finder/releases/tag/v0.1.1) |
| Build-once release + tag = bits | `release.yml` checks out `ref=<tag>` |
| release-please automation | Conventional Commits → Release PR → tag → dispatch `release.yml` |
| CI path filters + tauri-cli cache + SHA256SUMS fix | `.github/workflows/*` |
| HTML audit export | Review/Confirm → Export HTML |
| OSS kit | LICENSE, SECURITY, CONTRIBUTING, CoC, templates, Dependabot groups |

## Gated by maintainer settings

| Item | Needs |
|------|-------|
| Branch protection enforced | Apply [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) (require `ci` / `test`) |

## Next product candidates

| Item | Notes |
|------|-------|
| Hardlink / reflink reclaim | Safer space recovery without trash |
| Cosign / sigstore | Signing secrets |
| Linux Tauri AppImage | GUI Linux runner |
| Human GUI UAT | Physical Mac/PC smoke of `.dmg` / MSI |
| Engine-level keep-rules | Today mostly UI |

## Free runner policy (locked)

- Default CI: **`ubuntu-latest` only** — tests only
- Tag release: Linux + (public) macOS/Windows CLI + Tauri
- `desktop-host.yml`: manual GUI debug only
- No paid / larger runners

## Out of v1

- Mobile full-disk scan
- Multi-million-file full-hash CI (Scale C = 100k resume smoke)
