#!/usr/bin/env bash
# Build Linux release binary + checksums + SPDX-ish SBOM stub inside Docker (no host Rust).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"
mkdir -p "${OUT}"

docker build -f "${ROOT}/docker/Dockerfile.release" -t dup-finder:release "${ROOT}"

# Extract binary from image
CID=$(docker create dup-finder:release)
docker cp "${CID}:/usr/local/bin/dup-finder" "${OUT}/dup-finder-linux-$(uname -m)"
docker rm "${CID}" >/dev/null

BIN="${OUT}/dup-finder-linux-$(uname -m)"
chmod +x "${BIN}"
(
  cd "${OUT}"
  shasum -a 256 "$(basename "${BIN}")" > SHA256SUMS
)

# Dependency SBOM via cargo tree (JSON lines)
docker run --rm -v "${ROOT}:/app" -w /app rust:1-bookworm \
  bash -lc 'export CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse CARGO_HTTP_TIMEOUT=600; cargo tree -p dup-finder-cli -e normal --format "{p}"' \
  > "${OUT}/sbom-cargo-tree.txt"

# Simple NOTICE for license compliance packaging
{
  echo "Dup Finder release artifact"
  echo "Binary: $(basename "${BIN}")"
  echo "See crates/*/Cargo.toml and Cargo.lock for third-party licenses."
  echo "Generate fuller SPDX with syft/grype in org CI when available."
} > "${OUT}/NOTICE.txt"

echo "Release artifacts in ${OUT}"
ls -la "${OUT}"
