# Desktop (Tauri) shell

The React UI in `ui/` runs in two modes:

1. **Browser + `dup-finder serve`** (Docker UAT)
2. **Tauri desktop** — same UI, IPC into `dup-finder-app` (no HTTP token)

## Layout

- `src-tauri/` — Tauri 2 app (not a workspace member; avoids WebKit deps in CI `cargo test`)
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

```bash
npm --prefix ui run build
cd src-tauri && cargo tauri build
```

Artifacts land under `src-tauri/target/release/bundle/`.

## Docker note

Full WebView builds need OS GUI libraries. CI verifies `dup-finder-app` + engine + API instead; desktop packaging is a host/CI-image job with Tauri deps.

## Windows roots

On Windows, scan roots are **drive letters / folders** (`D:\Photos`), not Linux mounts. See [SCALE.md](SCALE.md).
