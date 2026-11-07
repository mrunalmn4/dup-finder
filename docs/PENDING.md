# Pending (v0.1 → next)

Living backlog. Product code for slices 0–3 local path is done; items below need host, org, or a remote.

**Rule:** do not commit or claim a platform/channel “released” until that channel’s smoke test has passed (Docker suite for Linux CLI; host Tauri for macOS/Windows GUI).

## Doable next (your Mac, no remote)

| Item | Why pending | How |
|------|-------------|-----|
| S1-03 UI browser UAT | Manual | `docker compose up api ui` → connect token → scan `/app/docker/fixtures` → dry-run delete |
| S1-08 Tauri launch | Needs host Rust + WebKit | See `docs/DESKTOP.md` |
| Run `package-deb.sh` / `package-rpm.sh` once | Network/apt slow in Docker today; scripts ready | After binary: `bash scripts/release/package-*.sh` |
| OS trash (not quarantine dir) | Decision: GUI later | Replace `.dup-finder-trash` with platform trash APIs |

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
| macOS `.app` / `.dmg` | Tauri on macOS runner/host |
| Windows MSI | Tauri on Windows runner |
| AppImage | Tauri Linux bundle or separate packager |

## Explicitly out of v1

- Mobile full-disk scan
- Multi-million-file full-hash CI (Scale C is 100k resume smoke)

## Done locally (do not re-open without bug)

Engine/CLI delete-safety UAT, suggest, resumable index, Scale A/B/C smoke, `serve` + jobs, React UI build, Tauri shell sources, Docker release image, SHA256SUMS/NOTICE, syft SBOM scripts, Cargo.lock inventory, evidence pack index, bind/auth unit tests.
