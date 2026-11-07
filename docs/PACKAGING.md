# Packaging & release

## Artifacts (Docker on Mac)

```bash
bash scripts/release/build-linux-docker.sh   # binary + SHA256SUMS + NOTICE
bash scripts/release/package-deb.sh          # .deb from that binary
bash scripts/release/package-rpm.sh          # .rpm from that binary (Rocky Linux container)
```

Outputs: `artifacts/release/`

## Channels

| Channel | How |
|---------|-----|
| Portable binary | `build-linux-docker.sh` / Tauri `cargo tauri build` on host |
| Docker image | `docker build -f docker/Dockerfile.release -t dup-finder:release .` |
| Debian | `package-deb.sh` |
| RPM | `package-rpm.sh` |
| AppImage / MSI / macOS | Tauri bundles on OS hosts; cosign in org CI |
| SBOM / checksums | SHA256SUMS + NOTICE; upgrade to syft/cosign when secrets available |

## CI

`.github/workflows/ci.yml` — fixtures, rust tests, UI build; release smoke on main.
