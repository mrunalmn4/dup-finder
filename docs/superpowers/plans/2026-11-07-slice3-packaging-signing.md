# Slice 3 — Packaging / signing matrix

**Goal:** Complete release channels that can run without a git remote; leave cosign/host Tauri to org CI / Mac host.

## Local (this Mac / Docker)

- [x] Linux portable binary + SHA256SUMS + NOTICE (`build-linux-docker.sh`)
- [x] Debian package script (`package-deb.sh`)
- [x] RPM package script (`package-rpm.sh`)
- [x] Syft SBOM (SPDX + CycloneDX) without secrets (`sbom-syft.sh`)
- [x] Docker release image (`docker/Dockerfile.release`)
- [x] Evidence pack index (`docs/evidence/`)
- [ ] Run deb/rpm/sbom once and attach artifacts to a release tag (when remote exists)

## Host / org follow-ons (blocked without secrets or OS toolchains)

- [ ] Cosign / sigstore signing of binary + container
- [ ] Tauri macOS `.app` / `.dmg` (`docs/DESKTOP.md`)
- [ ] Tauri Windows MSI on Windows runner
- [ ] AppImage (optional; Tauri Linux bundle or separate)
- [ ] Branch protection + required checks on `main`
- [ ] Auditor engagement for Type I → Type II
