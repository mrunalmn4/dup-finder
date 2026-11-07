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

# Offline dependency inventory from Cargo.lock (no crates.io; syft covers binary SBOM)
python3 "${ROOT}/scripts/release/cargo-lock-packages.py" "${ROOT}/Cargo.lock" \
  > "${OUT}/sbom-cargo-lock.txt"

# Simple NOTICE for license compliance packaging
{
  echo "Dup Finder release artifact"
  echo "Binary: $(basename "${BIN}")"
  echo "See crates/*/Cargo.toml and Cargo.lock for third-party licenses."
  echo "Run scripts/release/sbom-syft.sh for SPDX/CycloneDX; cosign in org CI."
} > "${OUT}/NOTICE.txt"

echo "Release artifacts in ${OUT}"
ls -la "${OUT}"
echo "Next: bash scripts/release/sbom-syft.sh && package-deb.sh / package-rpm.sh"
