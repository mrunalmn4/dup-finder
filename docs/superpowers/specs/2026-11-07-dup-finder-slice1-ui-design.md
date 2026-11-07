# Slice 1 — UI Design

**Date:** 2026-11-07  
**Status:** Building (parent plan approved; Docker-first delivery)

## Goal

Let users pick roots, scan, review duplicate groups + metadata, see explainable keep suggestions, preview exact delete paths, confirm, then trash — with the same fail-closed engine as the CLI.

## Approach (recommended)

1. **`dup-finder serve`** — localhost-only HTTP API + bearer token (engine already proven).
2. **React + Vite UI** — talks to that API; two-phase delete confirm baked into UX.
3. **Docker Compose** — `api` + `ui` for UAT without host Node/Rust installs.
4. **Tauri shell** — wraps the same UI next (desktop portable binary); not required to validate UX/delete safety.

## Screens (one job each)

1. **Roots** — add/remove scan folders; optional index path.
2. **Results** — groups, reclaimable bytes, metadata; suggested keep highlighted with reason.
3. **Confirm delete** — exact path list + keep list; type/click confirm; dry-run then trash.

## Security

- Bind `127.0.0.1` only.
- Random token required on every mutating/read API call.
- Delete endpoints require explicit path lists; server re-runs `safe_delete` (never trust UI alone).
- No auto-delete; permanent still needs confirm flag.

## Out of scope this slice

- Daemon scheduler, multi-user auth, cloud.
- Full OS trash integration beyond engine’s `.dup-finder-trash` quarantine.
