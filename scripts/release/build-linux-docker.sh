#!/usr/bin/env bash
# Build Linux release binary + checksums inside Docker (no host Rust).
# Optional: PLATFORM=linux/amd64 bash scripts/release/build-linux-docker.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"
mkdir -p "${OUT}"

PLATFORM="${PLATFORM:-}"
TAG="dup-finder:release"
ARCH_LABEL="$(uname -m)"
BUILD_ARGS=(-f "${ROOT}/docker/Dockerfile.release" -t "${TAG}")
if [[ -n "${PLATFORM}" ]]; then
  BUILD_ARGS+=(--platform "${PLATFORM}")
  case "${PLATFORM}" in
    */amd64|*/x86_64) ARCH_LABEL=x86_64; TAG="dup-finder:release-amd64"; BUILD_ARGS+=(-t "${TAG}") ;;
    */arm64|*/aarch64) ARCH_LABEL=arm64; TAG="dup-finder:release-arm64"; BUILD_ARGS+=(-t "${TAG}") ;;
  esac
fi

docker build "${BUILD_ARGS[@]}" "${ROOT}"

CID=$(docker create --platform "${PLATFORM:-linux/$(uname -m)}" "${TAG}")
docker cp "${CID}:/usr/local/bin/dup-finder" "${OUT}/dup-finder-linux-${ARCH_LABEL}"
docker rm "${CID}" >/dev/null

BIN="${OUT}/dup-finder-linux-${ARCH_LABEL}"
chmod +x "${BIN}"
(
  cd "${OUT}"
  # Merge checksums for all linux binaries present
  shasum -a 256 dup-finder-linux-* > SHA256SUMS
)

python3 "${ROOT}/scripts/release/cargo-lock-packages.py" "${ROOT}/Cargo.lock" \
  > "${OUT}/sbom-cargo-lock.txt"

{
  echo "Dup Finder release artifact"
  echo "Binaries: $(cd "${OUT}" && echo dup-finder-linux-*)"
  echo "See crates/*/Cargo.toml and Cargo.lock for third-party licenses."
  echo "Run scripts/release/sbom-syft.sh for SPDX/CycloneDX; cosign in org CI."
} > "${OUT}/NOTICE.txt"

echo "Release artifacts in ${OUT}"
ls -la "${OUT}"/dup-finder-linux-* "${OUT}/SHA256SUMS" "${OUT}/NOTICE.txt"
echo "Next: bash scripts/release/sbom-syft.sh && package-deb.sh && make-dist.sh"
