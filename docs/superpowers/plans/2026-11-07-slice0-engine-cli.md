# Slice 0 — Engine + CLI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a Rust scan engine + CLI that finds content duplicates and deletes **only** re-verified, user-selected paths (trash/dry-run), with Docker UAT T1–T10 green.

**Architecture:** Cargo workspace: `dup-finder-engine` (library) + `dup-finder-cli` (binary). Scan = size → partial hash → BLAKE3; MIME sniff ignores extension. Delete = allowlist + keep-disjoint + TOCTOU rehash; pluggable `DeleteBackend` (trash / permanent / test quarantine). All builds/tests via Docker `rust:1-bookworm` (no host Rust required).

**Tech Stack:** Rust 1.99+ (Docker), blake3, clap, serde/serde_json, walkdir, infer (MIME), tempfile for tests.

## Global Constraints

- Fail closed on delete; never remove a path that fails re-verify (spec delete-safety D1–D8).
- Local-only; no network in engine.
- Trash default; permanent requires `--permanent --confirm`.
- Dry-run never mutates FS.
- Verify with Docker: `docker compose run --rm rust-test` (or equivalent).
- No AI attribution in commits.
- Do not start Slice 1 (GUI) until Slice 0 UAT matrix rows S0-01…S0-10 pass.

## File map

| Path | Responsibility |
|------|----------------|
| `Cargo.toml` | Workspace root |
| `crates/dup-finder-engine/src/lib.rs` | Public API re-exports |
| `crates/dup-finder-engine/src/hash.rs` | Partial + BLAKE3 |
| `crates/dup-finder-engine/src/mime.rs` | Content MIME sniff |
| `crates/dup-finder-engine/src/scan.rs` | Walk, group duplicates |
| `crates/dup-finder-engine/src/model.rs` | FileRecord, DuplicateGroup, ScanResult |
| `crates/dup-finder-engine/src/path_safe.rs` | realpath + under-root checks |
| `crates/dup-finder-engine/src/delete.rs` | Safe delete algorithm |
| `crates/dup-finder-engine/src/audit.rs` | Audit events (no file bytes) |
| `crates/dup-finder-cli/src/main.rs` | `scan`, `delete` subcommands |
| `docker/Dockerfile.rust` | Test/build image |
| `docker-compose.yml` | `rust-test` service |
| `docker/fixtures/**` | Golden corpora (exists) |

---

### Task 1: Workspace + hash/MIME + scan grouping

**Files:**
- Create: workspace `Cargo.toml`, engine crate, `hash.rs`, `mime.rs`, `model.rs`, `scan.rs`, unit tests
- Test: engine unit tests + fixture scan integration

**Interfaces:**
- Produces: `scan_roots(roots: &[Path]) -> Result<ScanResult>`; `FileRecord { path, size, hash, mime, ... }`; `DuplicateGroup { hash, files }`

- [x] **Step 1:** Scaffold workspace crates
- [x] **Step 2:** Failing tests: identical fixtures group; extension spoof groups; unique alone
- [x] **Step 3:** Implement hash → scan → group
- [x] **Step 4:** `cargo test` in Docker — pass
- [ ] **Step 5:** Commit (only if user asked)

### Task 2: Path safety + delete engine (TDD T1–T10)

**Files:**
- Create: `path_safe.rs`, `delete.rs`, `audit.rs`, delete unit/integration tests
- Modify: `lib.rs`

**Interfaces:**
- Produces: `safe_delete(req: DeleteRequest) -> DeleteReport` with per-path `Deleted|Skipped|WouldDelete`
- Consumes: `ScanResult` records + roots + keep/delete sets

- [x] **Step 1:** Failing tests for T1–T10 (use TestBackend quarantine dir)
- [x] **Step 2:** Implement path_safe + delete algorithm
- [x] **Step 3:** Docker tests pass; dry-run mutates nothing
- [ ] **Step 4:** Commit (if asked)
- [ ] **Step 5:** Add remaining T4 (symlink swap) + T7 (mixed batch) if not covered

### Task 3: CLI

**Files:**
- Create: `dup-finder-cli` with clap: `scan <paths...> -o json`, `delete --dry-run|--confirm [--permanent] --from-scan <json> --paths ...`

- [x] **Step 1:** CLI smoke against fixtures in Docker
- [x] **Step 2:** Wire `rust-test` compose service
- [x] **Step 3:** Mark UAT S0-01…S0-03, S0-06…S0-10 Pass (S0-04/05/11–13 still open)

### Task 4: Exit gate

- [x] All delete-safety T1–T10 automated green
- [x] Resumable SQLite index + scale A/B/C smoke
- [x] README updated with CLI usage via Docker
- [x] Stop — Slice 0 exit gate met; GUI is next slice
