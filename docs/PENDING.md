# Pending (v0.1 → next)

Living backlog. Product code for slices 0–3 local path is done; items below need host, org, or a remote.

**Rule:** do not commit or claim a platform/channel “released” until that channel’s smoke test has passed (Docker suite for Linux CLI; host Tauri for macOS/Windows GUI).

## Built & smoked on this Mac

| Artifact | Location |
|----------|----------|
| Linux arm64 CLI | `artifacts/release/dup-finder-linux-arm64` |
| Linux amd64 CLI | `artifacts/release/dup-finder-linux-x86_64` |
| arm64 + amd64 `.deb` | `artifacts/release/dup-finder_0.1.0_{arm64,amd64}.deb` |
| Dist tarball (both arch) | `artifacts/dist/dup-finder-0.1.0-linux-*.tar.gz` |
| SBOMs / checksums | `artifacts/release/` |
| Docker images | `dup-finder:release`, `dup-finder:release-amd64` |

## Doable next (your Mac, no remote)

| Item | Why pending | How |
|------|-------------|-----|
| rpm once | Rocky/`rpmbuild` network pull | `bash scripts/release/package-rpm.sh` |
| S1-03 UI browser UAT | Manual | `docker compose up api ui` → scan fixtures → dry-run |
| S1-08 Tauri launch | No host Rust/WebKit | See `docs/DESKTOP.md` |
| OS trash (not quarantine dir) | Decision: GUI later | Platform trash APIs |

## Needs remote / org

| Item | Blocker |
|------|---------|
| Git remote + push | No `origin` configured |
| Release tag + attach artifacts | Needs remote |
| Cosign / sigstore (P-06) | Signing secrets + CI |
| Branch protection + required checks | GitHub/Origin admin |
| Policy owners (TBD in `docs/policies/`) | Assign humans + review cadence |
| Auditor SOC 2 / ISO Type I→II | Legal entity + observation window |
| “Certified” marketing claim | External report only |

## Host CI matrix (not Docker-on-Mac)

| Channel | Needs |
|---------|-------|
| macOS `.app` / `.dmg` | Tauri on macOS runner/host (+ install Rust) |
| Windows MSI | Tauri on Windows runner |
| AppImage | Tauri Linux bundle or separate packager |

## Explicitly out of v1

- Mobile full-disk scan
- Multi-million-file full-hash CI (Scale C is 100k resume smoke)
