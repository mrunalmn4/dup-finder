#!/usr/bin/env bash
# Build a .deb from a Linux release binary (Python ar writer — no apt/dpkg).
# Architecture is taken from the ELF header (fail closed on mismatch).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"

BIN="${BIN:-}"
if [[ -z "${BIN}" ]]; then
  # Prefer host-matching binary, else any linux binary present
  CAND="${OUT}/dup-finder-linux-$(uname -m)"
  if [[ -x "${CAND}" ]]; then
    BIN="${CAND}"
  else
    BIN="$(ls -1 "${OUT}"/dup-finder-linux-* 2>/dev/null | head -1 || true)"
  fi
fi
if [[ -z "${BIN}" || ! -x "${BIN}" ]]; then
  echo "missing release binary under ${OUT}; run build-linux-docker.sh first" >&2
  exit 1
fi

DEB_ARCH="$(python3 "${ROOT}/scripts/release/elf-arch.py" "${BIN}" --format deb)"
DEB="${OUT}/dup-finder_0.1.0_${DEB_ARCH}.deb"
python3 "${ROOT}/scripts/release/write-deb.py" \
  --bin "${BIN}" --out "${DEB}" --arch "${DEB_ARCH}" --version 0.1.0
ls -la "${DEB}"
