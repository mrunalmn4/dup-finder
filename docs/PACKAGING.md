# Packaging & release

## Artifacts (Docker on Mac)

```bash
bash scripts/release/build-linux-docker.sh   # binary + SHA256SUMS + cargo-tree SBOM + NOTICE
bash scripts/release/package-deb.sh          # .deb from that binary
```

Outputs: `artifacts/release/`

## Channels

| Channel | How |
|---------|-----|
| Portable binary | `build-linux-docker.sh` / Tauri `cargo tauri build` on host |
| Docker image | `docker build -f docker/Dockerfile.release -t dup-finder:release .` |
| Debian | `package-deb.sh` |
| RPM / AppImage / MSI / macOS | Same binary/Tauri bundles; wire nfpm/cargo-dist in org CI (control matrix ready) |
| SBOM / checksums | SHA256SUMS + cargo-tree NOTICE; upgrade to syft/cosign when secrets available |

## CI

`.github/workflows/ci.yml` — fixtures, rust tests, UI build; release smoke on main.
