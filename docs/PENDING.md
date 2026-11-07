# Pending (v0.1 → next)

**Local Mac/Docker path is finished** (including OS trash, permanent UI, CLI AppImage). Remaining work needs a git remote or GitHub runners/secrets.

See also: [SCALE.md](SCALE.md) (storage/perf honesty), [HOSTING.md](HOSTING.md) (**prefer GitHub**).

**Rule:** do not claim a platform/channel “released” until that channel’s smoke test has passed.

## Finished locally (smoked)

| Artifact / check | Evidence |
|------------------|----------|
| Linux arm64 + amd64 CLI | `artifacts/release/dup-finder-linux-{arm64,x86_64}` scan fixtures |
| `.deb` arm64 + amd64 | `dup-finder_0.1.0_{arm64,amd64}.deb` |
| `.rpm` aarch64 + x86_64 | `dup-finder-0.1.0-1.el9.{aarch64,x86_64}.rpm` |
| CLI AppImage / AppDir pack | `scripts/release/package-appimage.sh` → `artifacts/release/` |
| Dist tarball | `artifacts/dist/dup-finder-0.1.0-linux-*.tar.gz` |
| SBOMs / checksums | `artifacts/release/` |
| Docker images | `dup-finder:release`, `dup-finder:release-amd64` |
| API smoke | `docker/test/api_smoke.sh` |
| S1-03 UI browser UAT | connect → roots → scan → dry-run confirm |
| Layperson folder UX + onboarding/help | Choose folders / chips; first-run tour; Help guide |
| Where + What scan filters | Engine `ScanFilters`; UI presets/categories/size; CLI flags |
| OS trash + permanent UI | `trash` crate with `.dup-finder-trash` fallback; type DELETE for permanent |
| Async scan + progress | Job API/Tauri/UI bar; CLI `--progress` |
| Parallel hash | rayon within size buckets |
| Quarantine restore | list/restore `.dup-finder-trash` via API/UI |
| Export / profiles / review UX | JSON/CSV; localStorage profiles; sort/filter/view; image previews |
| Jobs UI + reclaimable notify | Settings jobs panel; Notification threshold in localStorage |

## Explicitly deferred to runners / CI (next phase)

| Item | Needs |
|------|-------|
| macOS `.app` / `.dmg` (S1-08) | macOS runner + Rust + Tauri |
| Windows MSI | Windows runner + Tauri |
| Tauri GUI AppImage | Linux GUI runner / Tauri bundle |
| Cosign / sigstore (P-06) | Signing secrets in CI |
| Git remote + release tag upload | `origin` + release workflow |
| Branch protection + required checks | Repo admin |

## Org / compliance (not code)

| Item | Blocker |
|------|---------|
| Policy owners in `docs/policies/` | Assign humans |
| Auditor SOC 2 / ISO Type I→II | Legal entity + observation window |
| “Certified” marketing claim | External report only |

## Out of v1

- Mobile full-disk scan
- Multi-million-file full-hash CI (Scale C = 100k resume smoke)
