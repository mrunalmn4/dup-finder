# Dup Finder — Design Spec

**Date:** 2026-11-07  
**Status:** Approved direction (plan); awaiting implementation plans per slice  
**Related:** security-compliance, delete-safety, uat-matrix specs

## Problem

Users accumulate duplicate files across disks and renames. They need a trustworthy way to find duplicates by **content**, review metadata, and delete **only** what they intend — on old PCs and servers alike — without sending data to the cloud.

## Goals

1. Scan user-selected roots on major desktop/server OSes.
2. Group exact content duplicates (MIME sniffed; extension ignored).
3. Display metadata and explain keep/delete suggestions.
4. Delete only explicitly selected, re-verified paths (trash default).
5. Ship portable binary + packages + Docker; test via Docker from Mac.
6. Scale from personal libraries to multi-TB NAS (streaming, resumable).
7. Enterprise-ready security/compliance evidence; certification path for SOC 2 / ISO 27001.

## Non-goals (v1)

- Full Android/iOS filesystem scanners.
- Cloud upload / SaaS scan.
- Perceptual “similar photo” matching.
- Claiming “SOC 2 / ISO certified” before an auditor report.

## Architecture

```text
┌─────────────────────────────────────────────────────────┐
│ Surfaces (phased)                                       │
│  CLI  →  Tauri GUI  →  Daemon (serve + schedule)        │
└──────────────────────────┬──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────┐
│ Rust engine crate                                       │
│  walk → size buckets → partial hash → BLAKE3            │
│  MIME sniff · resumable on-disk index · progress/cancel │
│  suggest · delete (TOCTOU + allowlist) · audit log      │
└─────────────────────────────────────────────────────────┘
```

### Components

| Unit | Responsibility | Depends on |
|------|----------------|------------|
| `engine` | Walk, hash, group, suggest, safe delete | OS FS APIs |
| `cli` | Commands: scan, suggest, delete, serve | engine |
| `gui` | Browse, review, confirm | engine via Tauri IPC |
| `daemon` | Schedules, localhost status API | engine |
| `packaging` | Binary, deb/rpm/AppImage, MSI/app, Docker | release CI |

### Duplicate pipeline

1. Enumerate files under approved roots (skip specials / unreadable with report).
2. Bucket by size (size 0 policy: configurable; default group only if identical empty allowed).
3. Partial hash (first/last chunks) to eliminate mismatches cheaply.
4. Full BLAKE3 for remaining candidates.
5. Emit groups with metadata: path, size, mtime, sniffed MIME, hash, device/inode when available.

### Delete pipeline (see delete-safety spec)

Preview → confirm → per-path re-verify → trash/remove → per-path result + audit.

## Error handling

- Unreadable paths: skip + count in report; do not abort entire scan unless `--strict`.
- Delete mismatch: skip that path; never invent a substitute path.
- Cancel: leave index resumable; no partial deletes without results file.

## Testing strategy

- Unit: hash/MIME/path resolve.
- Integration: Docker fixtures (identical, spoofed extension, symlink trap).
- Scale: synthetic A/B/C benchmarks with memory caps.
- Security/delete UAT: must be 100% green before GUI slice.
- UAT matrix: dedicated spec.

## Open items

- Certification legal entity + Type I/II dates (parallel track).
- Exact on-disk index crate (SQLite vs sled) — choose in Slice 0 plan.
- “ponylatil” tooling name still unknown; using agent stores + graphify.
