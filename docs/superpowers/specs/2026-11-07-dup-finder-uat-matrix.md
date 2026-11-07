# UAT Matrix

**Date:** 2026-11-07  
**Rule:** A slice is not done until its rows are Pass.

## Legend

- **P** = Pass, **F** = Fail, **B** = Blocked, **N/A** = not in this slice

## Slice 0 — Engine + CLI

| ID | Scenario | Expect | Status |
|----|----------|--------|--------|
| S0-01 | Identical content different names | One duplicate group | P (unit + CLI) |
| S0-02 | Same bytes, `.jpg` vs `.bin` | Same group (extension ignored) | P |
| S0-03 | Unique file | Not in any duplicate group | P |
| S0-04 | Unreadable file | Skipped with reason; scan completes | P (non-root); root notes chmod ineffective |
| S0-05 | Symlink retarget after scan (T4) | Skip HASH/SIZE/INODE | P |
| S0-06 | Delete dry-run | No FS mutation | P (T6 + CLI) |
| S0-07 | Delete selected only (T1) | Only selected path removed | P |
| S0-08 | Refuse keep candidate (T2) | No delete | P |
| S0-09 | Hash mismatch after scan (T3) | Skip, report | P |
| S0-10 | Permanent without confirm (T10) | Refuse | P |
| S0-10b | Mixed batch (T7) | Good deleted; bad skipped | P |
| S0-11 | Scale A synthetic (1k files) | Completes; groups correct | P |
| S0-12 | Scale B synthetic (10k) | Completes; index resume 10k reused | P |
| S0-13 | Scale C smoke (100k + resume) | 100k scanned; 2nd pass 0 rehash | P |
| S0-14 | Suggest keeps explainable | newest_mtime / shortest_path | P |
| S0-15 | Resumable SQLite index | reuse on unchanged; rehash on change | P |

## Slice 1 — GUI / API

| ID | Scenario | Expect | Status |
|----|----------|--------|--------|
| S1-01 | API scan fixtures + suggest | groups ≥ 1 | P (api_smoke) |
| S1-02 | API delete dry-run selected | would_delete only | P (api_smoke) |
| S1-03 | UI connect → roots → results → confirm | Manual / browser | B (host browser) |
| S1-04 | Bearer required | 401 without token | P (api_smoke + unit) |
| S1-05 | Non-loopback bind refused without env | Fail closed | P (unit) |
| S1-06 | Shared app session scan→suggest→dry-run | Unit in `dup-finder-app` | P |
| S1-07 | UI builds for Tauri frontendDist | `npm run build` | P |
| S1-08 | Tauri desktop launch on macOS host | Manual (`cargo tauri dev`) | B (host Tauri) |

## Slice 2 — Daemon

| ID | Scenario | Expect | Status |
|----|----------|--------|--------|
| S2-01 | Create job + `/run` | status ok + last_scan_id | P (api_smoke) |
| S2-02 | List/delete jobs | list ≥1; DELETE 204 | P |
| S2-03 | Scheduler due_jobs | Unit + 5s tick in serve | P (code) |
| S2-04 | API without token | 401 | P (api_smoke) |

## Packaging smoke

| ID | Scenario | Expect | Status |
|----|----------|--------|--------|
| P-01 | Docker release image `scan` fixtures | groups ≥ 1 | P |
| P-02 | SHA256SUMS + NOTICE produced | Present in artifacts/release | P |
| P-03 | deb package script | `package-deb.sh` ready | P (script) |
| P-04 | rpm package script | `package-rpm.sh` ready | P (script) |
| P-05 | Syft SBOM (SPDX + CycloneDX) | `sbom-syft.sh` ready | P (script) |
| P-06 | Cosign / notarize | Signed artifacts | B (org secrets) |
