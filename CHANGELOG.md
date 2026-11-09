# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- CI is test-only; packaging moved to a single build-once → smoke → publish release pipeline.
- Tag releases include macOS/Windows CLI and Tauri GUI bundles (with hard timeouts and artifact smoke).

## [0.1.0] - 2026-11-09

### Added

- Rust engine + CLI: size → partial → BLAKE3 identity; MIME sniff ignores extension.
- Fail-closed delete (select-only, TOCTOU re-verify, path allowlist, trash default).
- Resumable SQLite index; parallel hash within size buckets; async scan progress.
- Localhost `serve` API + React UI + Tauri desktop shell + scheduled jobs.
- Linux portable binaries, `.deb` / `.rpm`, AppDir pack, Docker/GHCR images.
- macOS and Windows CLI assets on GitHub Releases.
- Scan filters, quarantine restore, keep-rules UX, similar-images (experimental), Help/tour.

### Security

- Delete-safety UAT cases covered in engine tests; local-only by default; no silent telemetry.
