# Dup Finder

[![CI](https://github.com/mrunalmn4/dup-finder/actions/workflows/ci.yml/badge.svg)](https://github.com/mrunalmn4/dup-finder/actions/workflows/ci.yml)
[![Release](https://github.com/mrunalmn4/dup-finder/actions/workflows/release.yml/badge.svg)](https://github.com/mrunalmn4/dup-finder/actions/workflows/release.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

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
| [AGENTS.md](AGENTS.md) | Notes for automated agents |

## Releases

Maintainers: `bash scripts/release/checklist.sh vX.Y.Z`, then push the tag.  
Pipeline: **quality gate → build once per platform → smoke → GitHub Release + GHCR** (see `.github/workflows/release.yml`).

## License

[MIT](LICENSE)
