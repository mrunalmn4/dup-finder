# Packaging & release

## Artifacts (Docker on Mac)

```bash
bash scripts/release/build-linux-docker.sh   # native arch binary + SHA256SUMS + NOTICE
# PLATFORM=linux/amd64 bash scripts/release/build-linux-docker.sh   # optional cross-build
bash scripts/release/sbom-syft.sh            # SPDX + CycloneDX (syft Docker image)
bash scripts/release/package-deb.sh          # .deb (no apt; Python ar writer)
bash scripts/release/package-rpm.sh          # .rpm (Rocky Linux container; needs network)
bash scripts/release/make-dist.sh            # tarball under artifacts/dist/
```

Outputs: `artifacts/release/` and `artifacts/dist/`

## Channels

| Channel | How |
|---------|-----|
| Portable binary | `build-linux-docker.sh` / Tauri `cargo tauri build` on host |
| Docker image | `docker build -f docker/Dockerfile.release -t dup-finder:release .` |
| Debian | `package-deb.sh` |
| RPM | `package-rpm.sh` |
| AppImage / MSI / macOS | Tauri bundles on OS hosts; cosign in org CI |
| SBOM / checksums | SHA256SUMS + NOTICE + `sbom-syft.sh`; cosign when secrets available |

## CI

`.github/workflows/ci.yml` — fixtures, rust tests, UI build; release smoke on main.
