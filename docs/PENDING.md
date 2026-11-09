# Pending (v0.1 → next)

See also: [SCALE.md](SCALE.md), [HOSTING.md](HOSTING.md), [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md).

**Rule:** do not claim a platform/channel “released” until that channel’s smoke test has passed.

## Finished (local + GitHub)

| Artifact / check | Evidence |
|------------------|----------|
| Linux arm64 + amd64 CLI / deb / rpm / AppDir | Local Docker + `release.yml` assets |
| macOS / Windows CLI on Releases | `release.yml` host jobs + `smoke-cli.sh` |
| GHCR image | `ghcr.io/mrunalmn4/dup-finder` |
| Engine/UI/API UAT (Docker) | `docker/test/*`, Playwright shots |
| OSS kit | LICENSE, SECURITY, CONTRIBUTING, CoC, SUPPORT, CHANGELOG, issue/PR templates, Dependabot, CODEOWNERS |
| Build-once release | `ci.yml` tests only; `release.yml` quality-gate → build → smoke → publish |

## Gated by maintainer settings

| Item | Needs |
|------|-------|
| Branch protection enforced | Maintainer applies [BRANCH_PROTECTION.md](BRANCH_PROTECTION.md) (require `ci` / `test`) |

## Host GUI on Releases (smoked)

| Item | Evidence |
|------|----------|
| macOS `.dmg` + `.app.zip` | [v0.1.0](https://github.com/mrunalmn4/dup-finder/releases/tag/v0.1.0) `Dup-Finder-macos-arm64.*` |
| Windows MSI + NSIS setup | `Dup-Finder-windows-x86_64.msi` / `-setup.exe` |

## Explicitly deferred

| Item | Needs |
|------|-------|
| Tauri GUI AppImage (Linux) | Linux GUI runner / Tauri bundle |
| Cosign / sigstore (P-06) | Signing secrets in CI |
| Interactive human GUI UAT | Physical Mac/PC (CI smoke ≠ full UX) |

## Free GitHub publishing (policy)

| Surface | Status | Notes |
|---------|--------|-------|
| Actions artifacts | Yes (CI) | Temporary (~14 days); not a release channel |
| **GitHub Releases + tags** | `release.yml` on `v*` | Build once → smoke → publish |
| **GHCR** | `release.yml` | Free for public packages |
| Wiki | **Not used** | Docs stay in-repo |
| Paid / larger runners | **Never** | Standard hosted only |

## Free runner policy (locked)

- Default CI: **`ubuntu-latest` only** (`.github/workflows/ci.yml`) — **tests only**
- Tag release: Linux + (public) macOS/Windows CLI + Tauri
- `desktop-host.yml`: manual GUI debug only

## Org / compliance (not code)

| Item | Blocker |
|------|---------|
| Policy owners in `docs/policies/` | Assign humans |
| Auditor SOC 2 / ISO Type I→II | Legal entity + observation window |
| “Certified” marketing claim | External report only |

## Out of v1

- Mobile full-disk scan
- Multi-million-file full-hash CI (Scale C = 100k resume smoke)
