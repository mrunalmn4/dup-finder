# Graph Report - dup-finder  (2026-11-07)

## Corpus Check
- Corpus is ~14,521 words - fits in a single context window. You may not need a graph.

## Summary
- 430 nodes · 812 edges · 22 communities (14 shown, 8 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 27 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Community 0
- Hashing
- Safe Delete
- Serve Daemon
- Serve Daemon 4
- Community 5
- Safe Delete 6
- Safe Delete 7
- Serve Daemon 8
- App Session
- App Session 10
- Safe Delete 11
- Hashing 12
- Community 13
- Community 14
- Community 15
- App Session 16
- Community 17
- Community 18

## God Nodes (most connected - your core abstractions)
1. `safe_delete()` - 24 edges
2. `scan_with_options()` - 20 edges
3. `EngineError` - 18 edges
4. `compilerOptions` - 17 edges
5. `ScheduledJob` - 15 edges
6. `JobStore` - 14 edges
7. `AppSession` - 14 edges
8. `AppState` - 13 edges
9. `check_auth()` - 13 edges
10. `delete_one()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `DesktopState` --references--> `AppSession`  [EXTRACTED]
  src-tauri/src/lib.rs → crates/dup-finder-app/src/lib.rs
- `dup-finder-desktop` --depends_on--> `dup-finder-app`  [EXTRACTED]
  src-tauri/Cargo.toml → crates/dup-finder-app/Cargo.toml
- `run()` --calls--> `safe_delete()`  [INFERRED]
  crates/dup-finder-cli/src/main.rs → crates/dup-finder-engine/src/delete.rs
- `run()` --calls--> `scan_with_options()`  [INFERRED]
  crates/dup-finder-cli/src/main.rs → crates/dup-finder-engine/src/scan.rs
- `run()` --calls--> `suggest_from_scan()`  [INFERRED]
  crates/dup-finder-cli/src/main.rs → crates/dup-finder-engine/src/suggest.rs

## Import Cycles
- 2-file cycle: `crates/dup-finder-app/src/jobs.rs -> crates/dup-finder-app/src/lib.rs -> crates/dup-finder-app/src/jobs.rs`

## Communities (22 total, 8 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.05
Nodes (48): react, react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, @types/react, @types/react-dom, typescript, vite (+40 more)

### Community 1 - "Hashing"
Cohesion: 0.08
Nodes (29): EngineError, Io, Message, blake3_file(), different_bytes_different_hash(), identical_bytes_same_hash(), PARTIAL_CHUNK, partial_fingerprint() (+21 more)

### Community 2 - "Safe Delete"
Cohesion: 0.08
Nodes (32): AuditEvent, from_outcome(), delete_one(), DeleteBackend, fixtures_scan_then_dry_run_drop_me(), FsDeleteBackend, QuarantineBackend, record_for() (+24 more)

### Community 3 - "Serve Daemon"
Cohesion: 0.08
Nodes (15): create_run_list_job(), JobStatus, Error, Idle, Ok, Running, JobStore, now_unix() (+7 more)

### Community 4 - "Serve Daemon 4"
Cohesion: 0.16
Nodes (18): CreateJobRequest, ScheduledJob, AppState, check_auth(), create_job(), delete_job(), delete_paths(), get_job() (+10 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (36): command, environment, image, ports, volumes, working_dir, context, dockerfile (+28 more)

### Community 6 - "Safe Delete 6"
Cohesion: 0.14
Nodes (17): DeleteMode, DryRun, Permanent, Trash, DeleteRequest, DuplicateGroup, FileRecord, GroupSuggestion (+9 more)

### Community 7 - "Safe Delete 7"
Cohesion: 0.13
Nodes (15): Cli, CliDeleteMode, DryRun, Permanent, Trash, Commands, Delete, Scan (+7 more)

### Community 8 - "Serve Daemon 8"
Cohesion: 0.11
Nodes (20): jobs, release-smoke, test, name, on, pull_request, push, branches (+12 more)

### Community 9 - "App Session"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 10 - "App Session 10"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 11 - "Safe Delete 11"
Cohesion: 0.30
Nodes (4): delete(), DesktopState, scan(), suggest()

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 14 - "Community 14"
Cohesion: 0.83
Nodes (4): dup-finder-app, dup-finder-cli, dup-finder-desktop, dup-finder-engine

## Knowledge Gaps
- **20 isolated node(s):** `Idle`, `Running`, `Ok`, `Error`, `Scan` (+15 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 160 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `scan_with_options()` connect `Hashing` to `Serve Daemon`, `Safe Delete 7`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `safe_delete()` (e.g. with `.delete()` and `run()`) actually correct?**
  _`safe_delete()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Idle`, `Running`, `Ok` to the rest of the system?**
  _20 weakly-connected nodes found - possible missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.05367231638418079 - nodes in this community are weakly interconnected._
- **Why does `safe_delete()` connect `Safe Delete` to `Hashing`, `Serve Daemon`, `Safe Delete 6`, `Safe Delete 7`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `scan_with_options()` (e.g. with `.scan()` and `run()`) actually correct?**
  _`scan_with_options()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Hashing` be split into smaller, more focused modules?**
  _Cohesion score 0.07676767676767676 - nodes in this community are weakly interconnected._