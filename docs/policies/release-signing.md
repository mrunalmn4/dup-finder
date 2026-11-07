# Release signing & provenance (stub)

**Owner:** TBD  

1. Publish `SHA256SUMS` with every binary artifact (done in release script).
2. Prefer cosign/sigstore for container and blob signing when org keys exist.
3. Code-sign macOS/Windows Tauri bundles on release hosts.
4. Attach SBOM (cargo-tree minimum; SPDX via syft when available).
