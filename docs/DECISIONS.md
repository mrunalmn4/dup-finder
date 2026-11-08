# Durable decisions

Keep this short. Agents should read it instead of re-litigating chat history.

| Date | Decision | Notes |
|------|----------|-------|
| 2026-11-07 | Delivery: portable binary + deb/rpm/AppImage/Windows/macOS + Docker | Docker also for Mac-side testing; not required on old end-user PCs |
| 2026-11-07 | Surfaces: CLI → GUI → daemon | One Rust engine; UAT each slice before next |
| 2026-11-07 | Stack: Rust + Tauri 2 + React/Vite/TS | Rejected Electron for old/low-resource PCs |
| 2026-11-07 | Identity: size → partial → BLAKE3; MIME sniff ignores extension | Catches renamed extensions |
| 2026-11-07 | Scale: all tiers; arch for multi-TB | Prove A → B → C in benchmarks |
| 2026-11-07 | Compliance: B+C enterprise-ready + cert path | No “certified” marketing until auditor report |
| 2026-11-07 | Delete safety hard gate | Select-only, TOCTOU rehash, path allowlist, trash default, fail closed |
| 2026-11-07 | Mobile full-disk scan out of v1 | Revisit as limited client later |
| 2026-11-07 | “ponylatil” unresolved | Using personal/agent stores + graphify for memory |
| 2026-11-07 | Slice 0 engine in Rust via Docker | No host rustc; `docker compose run --rm rust-test` |
| 2026-11-07 | Trash backend | Prefer OS Trash/Recycle (`trash` crate); fall back to `.dup-finder-trash`; permanent needs typed UI confirm + `confirm:true` |
| 2026-11-07 | CLI AppImage | Packaged from portable Linux binary via Docker (`package-appimage.sh`); GUI AppImage stays Tauri/CI |
| 2026-11-07 | API keep set | Empty `keep` → server derives from suggest; non-empty → client override (UI swap-keep) |
| 2026-11-07 | Suggest heuristic | newest_mtime → shortest_path → lexicographic; never auto-delete |
| 2026-11-07 | Resumable index | SQLite (`--index`); skip DB/WAL/trash dirs in walk; invalidate on size/mtime/inode change |
| 2026-11-07 | Scale C smoke | 100k files + resume (not multi-million full hash in CI); proves cardinality + cache |
| 2026-11-07 | Slice 1 delivery | `serve` localhost API + React UI; Tauri IPC into shared `dup-finder-app` |
| 2026-11-07 | Tauri not in workspace | Avoids WebKit link deps breaking Docker `cargo test --workspace` |
| 2026-11-07 | Daemon jobs | SQLite JobStore; interval_secs; `/v1/jobs` + background scheduler tick |
| 2026-11-07 | v0.1 delivery complete | Engine/CLI/UI/Tauri/daemon/Docker release path landed; RPM/MSI/cosign = org CI follow-ons |
| 2026-11-07 | Docker API bind | Non-loopback only with `DUP_FINDER_ALLOW_NON_LOOPBACK=1` |
| 2026-11-07 | Slice 3 local packaging | deb/rpm/syft SBOM in Docker; cosign + Tauri host bundles deferred |
| 2026-11-07 | Evidence pack | `docs/evidence/` indexes auditor artifacts; no “certified” claim yet |
| 2026-11-07 | Linux binaries on Mac | arm64 native Docker + amd64 via `PLATFORM=linux/amd64`; deb via Python ar (no apt); dist tarball |
| 2026-11-07 | macOS/Windows GUI | Still host Tauri only — no Rust on this Mac by policy |
| 2026-11-07 | Local finish gate | Linux CLI/deb/rpm/dist + API/UI smoke done; next = runners/CI + remote |
| 2026-11-07 | UI safer flow | Folders→Review→Confirm; candidates unchecked; Settings for token; trash only dry-run would_delete |
| 2026-11-07 | Suggest UX | Human keep labels; per-group Accept suggestion; Keep this instead (user_choice) |
| 2026-11-07 | Hash pipeline live | Unique sizes skip hash; same-size partial then full BLAKE3 only on collisions |
| 2026-11-07 | Delete path caution | Flag system/app/credential paths in suggest; UI warns on critical selection |
| 2026-11-07 | Git host | Prefer GitHub for free Windows/macOS runners; GitLab Free weak on macOS hosted |
| 2026-11-07 | Windows storage | Roots = drive letters / UNC (`D:\`, `\\server\share`), not Unix mounts |
| 2026-11-07 | Scan location UX | Toggleable drive/folder tiles from `list_suggested_locations` (API + Tauri); Browse multi-select desktop-only; browser lists API host FS |
| 2026-11-07 | Scan filters | `ScanFilters` on engine/API/CLI/jobs; sensible defaults (skip node_modules/.git, hide dotfiles); UI Where+What with localStorage |
| 2026-11-07 | Async scan progress | `ScanProgress` callback; `POST /v1/scan/start` + poll job; sync `POST /v1/scan` kept; CLI `--progress`; rayon parallel hash in size buckets |
| 2026-11-07 | Quarantine restore | List/restore only under `.dup-finder-trash` within approved roots; OS Trash restore out of scope |
| 2026-11-07 | Folders setup modes | Chooser Simple/Smart/Guided/Advanced when idle; resume Review/Confirm/mid-scan wins; `dup.setupMode.v1` |
| 2026-11-07 | UI session resume | `dup.session.v1` persists Review/Confirm; expired server scan → clear + message |
| 2026-11-07 | Force quarantine | `DUP_FINDER_FORCE_QUARANTINE=1` skips OS Trash (Docker API / restore tests) |
| 2026-11-07 | Scan cancel | `cancel_flag` on engine; `POST /v1/scan/jobs/{id}/cancel`; job status `cancelled` |
| 2026-11-07 | Content identity UX | Groups show BLAKE3 verify strip; Compare modal; delete still TOCTOU re-hashes |
| 2026-11-07 | Live re-verify | `POST /v1/verify` re-hashes a group vs stored BLAKE3 |
| 2026-11-07 | Similar images | Experimental dHash via `POST /v1/similar`; exact BLAKE3 remains primary |
| 2026-11-07 | Appearance | Theme light/dark/system + density in Settings (`dup.theme.v1` / `dup.density.v1`) |
| 2026-11-08 | Keep rules (UI) | Client re-pick keep: newest_mtime / shortest_path / prefer_folder; does not change engine default suggest |
| 2026-11-08 | Review keyboard | j/k groups, ↑/↓ candidates, Space toggle, Enter Compare (when not in inputs) |
| 2026-11-08 | Similar images UX | Confidence from dHash distance; optional select into delete set; fixtures under `similar_photos/` |
