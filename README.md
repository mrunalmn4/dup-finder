# Dup Finder

[![CI](https://github.com/mrunalmn4/dup-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/mrunalmn4/dup-finder/actions/workflows/ci.yml)
[![Release](https://github.com/mrunalmn4/dup-finder/actions/workflows/release.yml/badge.svg)](https://github.com/mrunalmn4/dup-finder/actions/workflows/release.yml)
[![GitHub Release](https://img.shields.io/github/v/release/mrunalmn4/dup-finder?display_name=tag)](https://github.com/mrunalmn4/dup-finder/releases/latest)
[![GitHub Downloads](https://img.shields.io/github/downloads/mrunalmn4/dup-finder/total)](https://github.com/mrunalmn4/dup-finder/releases)
[![License: MIT](https://img.shields.io/github/license/mrunalmn4/dup-finder)](LICENSE)
[![GHCR](https://img.shields.io/badge/GHCR-dup--finder-blue?logo=github)](https://github.com/mrunalmn4/dup-finder/pkgs/container/dup-finder)
[![Platforms](https://img.shields.io/badge/platform-Linux%20%7C%20macOS%20%7C%20Windows-lightgrey)](https://github.com/mrunalmn4/dup-finder/releases)
[![Rust](https://img.shields.io/badge/Rust-engine-orange?logo=rust)](https://www.rust-lang.org/)
[![Tauri](https://img.shields.io/badge/Tauri-2-blue?logo=tauri)](https://tauri.app/)
[![React](https://img.shields.io/badge/React-UI-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Issues](https://img.shields.io/github/issues/mrunalmn4/dup-finder)](https://github.com/mrunalmn4/dup-finder/issues)
[![PRs](https://img.shields.io/github/issues-pr/mrunalmn4/dup-finder)](https://github.com/mrunalmn4/dup-finder/pulls)
[![Last commit](https://img.shields.io/github/last-commit/mrunalmn4/dup-finder)](https://github.com/mrunalmn4/dup-finder/commits/main)
[![Contributors](https://img.shields.io/github/contributors/mrunalmn4/dup-finder)](https://github.com/mrunalmn4/dup-finder/graphs/contributors)
[![Code of Conduct](https://img.shields.io/badge/Contributor%20Covenant-2.1-4baaaa.svg)](CODE_OF_CONDUCT.md)
[![Security Policy](https://img.shields.io/badge/Security-policy-red.svg)](SECURITY.md)
[![Local only](https://img.shields.io/badge/privacy-local--only-success)](SECURITY.md)

Find duplicate files by **content** (BLAKE3), not by name or extension. Scan only the folders you choose, review groups, and remove extras safely (OS trash by default).

## Install

Download platform packages from the latest [GitHub Release](https://github.com/mrunalmn4/dup-finder/releases):

| Platform | Assets |
|----------|--------|
| Linux | `dup-finder-linux-{x86_64,arm64}`, `.deb`, `.rpm`, AppDir/dist tarball |
| macOS | `dup-finder-macos-*` CLI; Tauri `.app` / `.dmg` under release bundle paths when published |
| Windows | `dup-finder-windows-x86_64.exe`; MSI/NSIS under release bundle paths when published |
| Docker | `ghcr.io/mrunalmn4/dup-finder:latest` |

Verify top-level checksums with `SHA256SUMS` in the release.

```bash
# Example: Linux CLI
chmod +x dup-finder-linux-x86_64
./dup-finder-linux-x86_64 scan ~/Pictures -o scan.json
./dup-finder-linux-x86_64 suggest --from-scan scan.json
```

## Features

- **Content identity** — size → partial hash → BLAKE3; MIME sniff ignores extension
- **Safety** — delete only selected paths; re-verify before remove; trash default; permanent needs extra confirm
- **Surfaces** — CLI, local `serve` API + React UI, Tauri desktop, scheduled jobs
- **Scale** — streaming walk, resumable on-disk index, parallel workers

## Quick start (Docker / source)

No host Rust required for engine/UI tests:

```bash
docker compose run --rm fixtures
docker compose run --rm rust-test
docker compose up api   # http://127.0.0.1:7420
docker compose up ui    # http://127.0.0.1:5173
```

Desktop shell: [docs/DESKTOP.md](docs/DESKTOP.md). Packaging: [docs/PACKAGING.md](docs/PACKAGING.md).

## Docs

| Doc | Topic |
|-----|--------|
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to develop and open PRs |
| [SECURITY.md](SECURITY.md) | Vulnerability reporting |
| [SUPPORT.md](SUPPORT.md) | Where to ask for help |
| [CHANGELOG.md](CHANGELOG.md) | Release notes |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Durable product decisions |
| [docs/PENDING.md](docs/PENDING.md) | What’s left |
| [docs/BRANCH_PROTECTION.md](docs/BRANCH_PROTECTION.md) | Required CI checks for `main` |
| [docs/RELEASING.md](docs/RELEASING.md) | Tags, checklist, republish rules |
| [AGENTS.md](AGENTS.md) | Notes for automated agents |

## Releases

See **[docs/RELEASING.md](docs/RELEASING.md)** (tag = source of truth).  
Short path: `bash scripts/release/checklist.sh vX.Y.Z`, then annotated tag + push.  
Pipeline: **quality gate → build once per platform → smoke → GitHub Release + GHCR**.

## License

[MIT](LICENSE)
