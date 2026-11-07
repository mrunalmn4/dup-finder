# Dup Finder — Agent Guide

Cross-platform duplicate file finder. Prefer this file + `docs/superpowers/specs/` + `graphify-out/` over re-deriving decisions from chat.

## Product invariants (do not violate)

- **Local-only by default** — file contents/hashes never leave the machine.
- **Explicit scan roots only** — never walk the whole disk unless the user selected those roots.
- **Delete is a hard safety gate** — only user-selected paths may be removed; fail closed on any doubt. See `.cursor/rules/delete-safety.mdc`.
- **Trash by default** — permanent delete requires extra confirmation.
- **No silent telemetry**; no AI/Cursor attribution in git/GitHub.
- **Test-before-next-slice** — finish UAT (functional + security + scale) for the current slice before starting the next.

## Stack (locked)

| Layer | Choice |
|-------|--------|
| Engine | Rust library crate |
| Surfaces | CLI → Tauri GUI → daemon (`serve`) — one engine |
| UI | Tauri 2 + React + Vite + TypeScript |
| Hash pipeline | size → partial hash → BLAKE3; MIME via content sniff (ignore extension) |
| Scale | Streaming walk, on-disk resumable index, parallel workers |
| Delivery | Portable binary + deb/rpm/AppImage/MSI/macOS + Docker |
| Dev/test | Docker on this Mac (no host toolchain sprawl) |

## Slices (order)

0. Engine + CLI (+ delete-safety UAT must be 100% green)
1. GUI review/delete UX
2. Daemon/scheduler
3. Packaging (deb/rpm/SBOM local; cosign + host Tauri = org/host)

## Token efficiency

- If `graphify-out/graph.json` exists: `graphify query/path/explain` before broad Grep.
- After substantial code changes: `graphify update .` (AST-only).
- One task per chat; read `docs/DECISIONS.md` for durable choices.
- Prefer Auto/cheaper models for routine edits.

## Compliance

Enterprise-ready (B) + certification path (C). Public “SOC 2 / ISO certified” only after an auditor report; until then: aligned + evidence pack. Details in specs under `docs/superpowers/specs/`.
