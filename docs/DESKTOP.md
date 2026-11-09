# Desktop (Tauri) shell

The React UI in `ui/` runs in two modes:

1. **Browser + `dup-finder serve`** (Docker UAT)
2. **Tauri desktop** — same UI, IPC into `dup-finder-app` (no HTTP token)

## Layout

- `src-tauri/` — Tauri 2 app (**excluded** from the Cargo workspace; empty `[workspace]` in its manifest — avoids WebKit deps in Docker `cargo test`)
- `crates/dup-finder-app` — shared session façade (tested in Docker)

## Dev on a Mac with tooling installed

```bash
# Terminal A
npm --prefix ui install
npm --prefix ui run dev

# Terminal B (requires Rust + Tauri system deps)
cargo install tauri-cli --version "^2"
cd src-tauri && cargo tauri dev
```

## Release binaries

Tagged releases build Tauri via `.github/workflows/release.yml` (same job as macOS/Windows CLI: build once → `scripts/desktop/smoke-bundle.sh` → upload; publish does not rebuild).

Local:

```bash
npm --prefix ui run build
cd src-tauri && cargo tauri build
```

Artifacts land under `src-tauri/target/release/bundle/`.

## Host workflows

| Workflow | Role |
|----------|------|
| `release.yml` on `v*` | Product path: CLI + Tauri + packages → GitHub Release |
| `desktop-host.yml` | Manual GUI-only re-run / debug (same smoke); not a second full publish |

Smoke checks installer shape (`.app`/Mach-O, `.msi`/PE). Full interactive GUI UAT still needs a human on a real desktop.

## Docker note

Full WebView builds need OS GUI libraries. Default CI verifies `dup-finder-app` + engine + API instead.

## Windows roots

On Windows, scan roots are **drive letters / folders** (`D:\Photos`), not Linux mounts. See [SCALE.md](SCALE.md).
