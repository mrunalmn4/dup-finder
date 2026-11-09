# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- release-please automation (Conventional Commits → Release PR → tag → `release.yml`)
- HTML audit export for keep/delete suggestions
- CI path filters; release quality-gate skip when CI already green; tauri-cli cache
- Dependabot grouped updates

### Fixed

- Publish always uploads a flat `SHA256SUMS` covering all release assets

## [0.1.1] - 2026-11-09

### Added

- macOS Tauri `.dmg` / `.app.zip` and Windows MSI / NSIS setup on GitHub Releases (build-once → smoke → publish).
- Full OSS surface: LICENSE, SECURITY, CONTRIBUTING, Code of Conduct, SUPPORT, issue/PR templates, Dependabot, CODEOWNERS.
- README badges and repository topics; [docs/RELEASING.md](docs/RELEASING.md) tag discipline.

### Fixed

- Release workflow checks out the **tagged commit** on `workflow_dispatch` (no longer builds `main` tip onto an old tag).
- Tauri npm hooks use repo-root `ui/` paths; RGBA icons + `icon.ico` for host bundlers.
- Publish only uniquely named installers (avoid GitHub asset name collisions from raw bundle trees).
- Workspace exclude for `src-tauri`; unreadable-file scan test exercises same-size hash skip.

### Changed

- CI is tests-only; packaging lives solely in `release.yml`.
- Dependency bumps via Dependabot (Actions, Cargo, Playwright, TypeScript).

## [0.1.0] - 2026-11-09

### Added

- Rust engine + CLI: size → partial → BLAKE3 identity; MIME sniff ignores extension.
- Fail-closed delete (select-only, TOCTOU re-verify, path allowlist, trash default).
- Resumable SQLite index; parallel hash within size buckets; async scan progress.
- Localhost `serve` API + React UI + Tauri desktop shell + scheduled jobs.
- Linux portable binaries, `.deb` / `.rpm`, AppDir pack, Docker/GHCR images.
- Early GitHub Release + GHCR path (tag points at the first Linux-focused publish commit).
- Scan filters, quarantine restore, keep-rules UX, similar-images (experimental), Help/tour.

### Security

- Delete-safety UAT cases covered in engine tests; local-only by default; no silent telemetry.
