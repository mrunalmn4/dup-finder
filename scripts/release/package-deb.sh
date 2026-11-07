#!/usr/bin/env bash
# Build a .deb from the Linux release binary (Python ar writer — no apt/dpkg).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"
ARCH_RAW="$(uname -m)"
case "${ARCH_RAW}" in
  aarch64|arm64) DEB_ARCH=arm64; BIN_SUFFIX=arm64 ;;
  x86_64|amd64) DEB_ARCH=amd64; BIN_SUFFIX=x86_64 ;;
  *) DEB_ARCH="${ARCH_RAW}"; BIN_SUFFIX="${ARCH_RAW}" ;;
esac

BIN="${BIN:-${OUT}/dup-finder-linux-${BIN_SUFFIX}}"
if [[ ! -x "${BIN}" ]]; then
  BIN="${OUT}/dup-finder-linux-$(uname -m)"
fi
if [[ ! -x "${BIN}" ]]; then
  echo "missing release binary under ${OUT}; run build-linux-docker.sh first" >&2
  exit 1
fi

DEB="${OUT}/dup-finder_0.1.0_${DEB_ARCH}.deb"
python3 "${ROOT}/scripts/release/write-deb.py" \
  --bin "${BIN}" --out "${DEB}" --arch "${DEB_ARCH}" --version 0.1.0
ls -la "${DEB}"
