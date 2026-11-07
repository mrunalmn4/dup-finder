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
| 2026-11-07 | Trash backend v1 | Quarantine dir `.dup-finder-trash` (not OS Trash/Recycle yet); mutating modes need `--confirm` / `confirm:true` |
| 2026-11-07 | API keep set | Server unions client `keep` with `suggest_from_scan` keeps — never trust empty client keep |
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
