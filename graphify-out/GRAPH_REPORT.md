# Graph Report - dup-finder  (2026-11-07)

## Corpus Check
- 85 files · ~30,235 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 10 file(s) not represented in the graph (top: .mdc 2, (none) 1, .api 1)

## Summary
- 843 nodes · 1586 edges · 54 communities (40 shown, 14 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 54 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e679be45`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- package.json
- EngineError
- Safe Delete
- Serve Daemon
- serve.rs
- api
- Safe Delete 6
- Safe Delete 7
- Serve Daemon 8
- App Session
- App Session 10
- src-tauri/src/lib.rs
- write-deb.py
- default.json
- dup-finder-app
- api_smoke.sh
- App Session 16
- package-deb.sh
- package-rpm.sh
- README.md
- filters.rs
- scan.rs
- api.ts
- App
- locations.rs
- App.tsx
- path_caution.rs
- dup-finder-engine/src/lib.rs
- hash.rs
- policies/README.md
- Dup Finder — Design Spec
- react
- File map
- profiles.ts
- Delete Safety Spec (hard gate)
- exportReport.ts
- reviewView.ts
- Security & Compliance Spec
- Slice 1 — UI Design
- UAT Matrix
- HelpGuide.tsx
- Tasks
- build_record_cached
- Slice 3 — Packaging / signing matrix
- Compliance evidence pack (B+C track)
- SOC 2 / ISO 27001 Control Matrix (draft)
- package-appimage.sh
- 2026-11-07-slice2-daemon-packaging.md
- make-dist.sh
- sbom-syft.sh

## God Nodes (most connected - your core abstractions)
1. `App()` - 50 edges
2. `scan_with_options()` - 28 edges
3. `safe_delete()` - 26 edges
4. `check_auth()` - 21 edges
5. `EngineError` - 21 edges
6. `AppSession` - 20 edges
7. `AppState` - 19 edges
8. `compilerOptions` - 17 edges
9. `JobStore` - 16 edges
10. `DesktopState` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Finished locally (smoked)` --references--> `ScanFilters`  [INFERRED]
  docs/PENDING.md → ui/src/scanFilters.ts
- `Approach (recommended)` --references--> `api()`  [INFERRED]
  docs/superpowers/specs/2026-11-07-dup-finder-slice1-ui-design.md → ui/src/api.ts
- `Task 2: Path safety + delete engine (TDD T1–T10)` --references--> `ScanResult`  [INFERRED]
  docs/superpowers/plans/2026-11-07-slice0-engine-cli.md → ui/src/api.ts
- `Durable decisions` --references--> `ScanProgress`  [INFERRED]
  docs/DECISIONS.md → ui/src/api.ts
- `Durable decisions` --references--> `ScanFilters`  [INFERRED]
  docs/DECISIONS.md → ui/src/scanFilters.ts

## Import Cycles
- 2-file cycle: `crates/dup-finder-app/src/jobs.rs -> crates/dup-finder-app/src/lib.rs -> crates/dup-finder-app/src/jobs.rs`

## Communities (54 total, 14 thin omitted)

### Community 0 - "package.json"
Cohesion: 0.09
Nodes (28): react-dom, @tauri-apps/api, @tauri-apps/plugin-dialog, @types/react, @types/react-dom, typescript, vite, @vitejs/plugin-react (+20 more)

### Community 1 - "EngineError"
Cohesion: 0.18
Nodes (4): EngineError, Io, Message, ScanIndex

### Community 2 - "Safe Delete"
Cohesion: 0.07
Nodes (41): AuditEvent, from_outcome(), delete_one(), DeleteBackend, fixtures_scan_then_dry_run_drop_me(), fs_backend_trash_removes_original_os_or_quarantine(), FsDeleteBackend, quarantine_beside() (+33 more)

### Community 3 - "Serve Daemon"
Cohesion: 0.06
Nodes (24): create_run_list_job(), CreateJobRequest, JobStatus, Error, Idle, Ok, Running, JobStore (+16 more)

### Community 4 - "serve.rs"
Cohesion: 0.09
Nodes (34): AppState, bearer_token_required(), check_auth(), cors_layer(), create_job(), delete_job(), delete_paths(), ensure_bind_allowed() (+26 more)

### Community 5 - "api"
Cohesion: 0.06
Nodes (36): command, environment, image, ports, volumes, working_dir, context, dockerfile (+28 more)

### Community 6 - "Safe Delete 6"
Cohesion: 0.12
Nodes (20): DeleteMode, DryRun, Permanent, Trash, DeleteReport, DeleteRequest, DuplicateGroup, FileCaution (+12 more)

### Community 7 - "Safe Delete 7"
Cohesion: 0.08
Nodes (24): build_scan_filters(), Cli, CliCategory, Archives, Audio, Documents, Other, Photos (+16 more)

### Community 8 - "Serve Daemon 8"
Cohesion: 0.11
Nodes (20): jobs, release-smoke, test, name, on, pull_request, push, branches (+12 more)

### Community 9 - "App Session"
Cohesion: 0.11
Nodes (18): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+10 more)

### Community 10 - "App Session 10"
Cohesion: 0.11
Nodes (17): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 11 - "src-tauri/src/lib.rs"
Cohesion: 0.17
Nodes (17): delete(), DesktopState, get_scan(), jobs_create(), jobs_db_path(), jobs_delete(), jobs_list(), jobs_run() (+9 more)

### Community 12 - "write-deb.py"
Cohesion: 0.12
Nodes (7): main(), sha256(), detect(), main(), ar_member(), main(), tar_gz_bytes()

### Community 13 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 14 - "dup-finder-app"
Cohesion: 0.83
Nodes (4): dup-finder-app, dup-finder-cli, dup-finder-desktop, dup-finder-engine

### Community 22 - "README.md"
Cohesion: 0.04
Nodes (40): Compliance, Dup Finder — Agent Guide, Product invariants (do not violate), Slices (order), Stack (locked), Token efficiency, Desktop (Tauri) shell, Dev on a Mac with tooling installed (+32 more)

### Community 23 - "filters.rs"
Cohesion: 0.12
Nodes (14): default_exclude_names(), FileCategory, Archives, Audio, Documents, Other, Photos, Videos (+6 more)

### Community 24 - "scan.rs"
Cohesion: 0.14
Nodes (18): partial_fingerprint(), filter_category_photos_only(), filter_exclude_name_skips_node_modules(), filter_exclude_path_under_root(), filter_hidden_off_skips_dotfiles(), filter_max_depth(), filter_min_size_skips_small(), fixtures_root() (+10 more)

### Community 25 - "api.ts"
Cohesion: 0.11
Nodes (21): api(), baseUrl(), DeleteReport, FileCaution, FileRecord, folderLabel(), isTauri(), loadConnection() (+13 more)

### Community 26 - "App"
Cohesion: 0.11
Nodes (7): App(), addExcludePath(), maybeNotifyReclaimable(), runScan(), toggleCategory(), updateFilters(), saveFilters()

### Community 27 - "locations.rs"
Cohesion: 0.23
Nodes (19): dedupe_keep_order(), ENV_LOCK, home_dir(), list_suggested_locations(), lists_home_when_set(), LocationKind, Drive, Folder (+11 more)

### Community 28 - "App.tsx"
Cohesion: 0.18
Nodes (16): Durable decisions, ScanProgress, Step, STEPS, ALL_CATEGORIES, CATEGORY_LABELS, DEFAULT_EXCLUDE_NAMES, FileCategory (+8 more)

### Community 29 - "path_caution.rs"
Cohesion: 0.20
Nodes (15): app_bundle_critical(), assess_path(), CautionLevel, Critical, Elevated, None, PathCaution, ssh_key_critical() (+7 more)

### Community 30 - "dup-finder-engine/src/lib.rs"
Cohesion: 0.13
Nodes (8): emit(), ProgressCallback, ScanOptions, ScanPhase, Done, Hash, Walk, ScanProgress

### Community 31 - "hash.rs"
Cohesion: 0.20
Nodes (6): blake3_file(), different_bytes_different_hash(), identical_bytes_same_hash(), PARTIAL_CHUNK, plain_text_not_jpeg_by_extension(), sniff_mime()

### Community 32 - "policies/README.md"
Cohesion: 0.17
Nodes (6): Access control — repos & CI (stub), Incident response (stub), Policy stubs (compliance track B+C), Release signing & provenance (stub), Secure SDLC (stub), Vulnerability management (stub)

### Community 33 - "Dup Finder — Design Spec"
Cohesion: 0.17
Nodes (11): Architecture, Components, Delete pipeline (see delete-safety spec), Dup Finder — Design Spec, Duplicate pipeline, Error handling, Goals, Non-goals (v1) (+3 more)

### Community 34 - "react"
Cohesion: 0.17
Nodes (7): react, client, Onboarding(), Props, Rect, Step, Thumb()

### Community 35 - "File map"
Cohesion: 0.22
Nodes (8): File map, Global Constraints, Slice 0 — Engine + CLI Implementation Plan, Task 1: Workspace + hash/MIME + scan grouping, Task 2: Path safety + delete engine (TDD T1–T10), Task 3: CLI, Task 4: Exit gate, ScanResult

### Community 36 - "profiles.ts"
Cohesion: 0.42
Nodes (8): defaultProfileFilters(), deleteProfile(), loadProfiles(), saveProfiles(), ScanProfile, upsertProfile(), loadFilters(), sensibleFilters()

### Community 37 - "Delete Safety Spec (hard gate)"
Cohesion: 0.25
Nodes (7): Algorithm, Delete Safety Spec (hard gate), Exit criteria for Slice 0, Invariants, Principle, Test cases (must all pass), UX requirements

### Community 38 - "exportReport.ts"
Cohesion: 0.46
Nodes (7): formatBytes(), csvEscape(), dateStamp(), download(), exportSuggestCsv(), exportSuggestJson(), reclaimableLabel()

### Community 39 - "reviewView.ts"
Cohesion: 0.32
Nodes (7): SuggestReport, CautionFilter, filterSortGroups(), isSameFolderGroup(), parentDir(), SortBy, ViewMode

### Community 40 - "Security & Compliance Spec"
Cohesion: 0.29
Nodes (6): Data map, Policy stubs (owners TBD), Release gates, Security & Compliance Spec, SOC 2 / ISO path, Threat model (STRIDE-lite)

### Community 41 - "Slice 1 — UI Design"
Cohesion: 0.29
Nodes (6): Approach (recommended), Goal, Out of scope this slice, Screens (one job each), Security, Slice 1 — UI Design

### Community 42 - "UAT Matrix"
Cohesion: 0.29
Nodes (6): Legend, Packaging smoke, Slice 0 — Engine + CLI, Slice 1 — GUI / API, Slice 2 — Daemon, UAT Matrix

### Community 43 - "HelpGuide.tsx"
Cohesion: 0.57
Nodes (5): HelpGuide(), Props, ConfirmDemo(), FoldersDemo(), ReviewDemo()

### Community 44 - "Tasks"
Cohesion: 0.33
Nodes (5): Slice 1 — Serve API + React UI, Task 1: HTTP serve API, Task 2: React UI, Task 3: Compose + UAT, Tasks

### Community 45 - "build_record_cached"
Cohesion: 0.60
Nodes (3): build_record_cached(), device_inode(), mtime_secs()

### Community 46 - "Slice 3 — Packaging / signing matrix"
Cohesion: 0.50
Nodes (3): Host / org follow-ons (blocked without secrets or OS toolchains), Local (this Mac / Docker), Slice 3 — Packaging / signing matrix

## Knowledge Gaps
- **44 isolated node(s):** `Idle`, `Running`, `Ok`, `Error`, `Running` (+39 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 312 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Durable decisions` connect `App.tsx` to `README.md`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Are the 6 inferred relationships involving `scan_with_options()` (e.g. with `.scan()` and `.scan_start()`) actually correct?**
  _`scan_with_options()` has 6 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Idle`, `Running`, `Ok` to the rest of the system?**
  _44 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08735632183908046 - nodes in this community are weakly interconnected._
- **Why does `ScanFilters` connect `App.tsx` to `api.ts`, `profiles.ts`, `README.md`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `safe_delete()` (e.g. with `.delete()` and `run()`) actually correct?**
  _`safe_delete()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Should `Safe Delete` be split into smaller, more focused modules?**
  _Cohesion score 0.07288135593220339 - nodes in this community are weakly interconnected._