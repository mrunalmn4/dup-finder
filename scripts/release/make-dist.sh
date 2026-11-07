#!/usr/bin/env bash
# Pack portable Linux binaries + checksums/SBOMs into a distributable tarball.
# Does not publish; only stages under artifacts/dist/.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REL="${ROOT}/artifacts/release"
DIST="${ROOT}/artifacts/dist"
VERSION="${VERSION:-0.1.0}"
STAMP="$(date -u +%Y%m%d)"
NAME="dup-finder-${VERSION}-linux"
STAGE="${DIST}/.stage-${NAME}"

mkdir -p "${DIST}"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"

copied=0
for bin in "${REL}"/dup-finder-linux-*; do
  [[ -e "${bin}" ]] || continue
  [[ -x "${bin}" ]] || continue
  cp "${bin}" "${STAGE}/"
  copied=1
done
if [[ "${copied}" -ne 1 ]]; then
  echo "no dup-finder-linux-* binaries in ${REL}; run build-linux-docker.sh first" >&2
  exit 1
fi

for f in SHA256SUMS NOTICE.txt sbom-cargo-lock.txt sbom.spdx.json sbom.cdx.json; do
  [[ -f "${REL}/${f}" ]] && cp "${REL}/${f}" "${STAGE}/"
done

# Refresh checksums for everything we ship in the tarball
(
  cd "${STAGE}"
  shasum -a 256 dup-finder-linux-* > SHA256SUMS
  [[ -f NOTICE.txt ]] && shasum -a 256 NOTICE.txt >> SHA256SUMS || true
  for s in sbom-cargo-lock.txt sbom.spdx.json sbom.cdx.json; do
    [[ -f "${s}" ]] && shasum -a 256 "${s}" >> SHA256SUMS
  done
)

TAR="${DIST}/${NAME}-${STAMP}.tar.gz"
tar -C "${STAGE}" -czf "${TAR}" .
rm -rf "${STAGE}"
(
  cd "${DIST}"
  shasum -a 256 "$(basename "${TAR}")" > "$(basename "${TAR}").sha256"
)

echo "Dist ready:"
ls -la "${TAR}" "${TAR}.sha256"
echo "Contents:"
tar -tzf "${TAR}"
