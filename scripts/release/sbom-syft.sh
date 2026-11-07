#!/usr/bin/env bash
# Generate SPDX + CycloneDX SBOMs for the Linux release binary via syft (Docker).
# No signing secrets required. Cosign remains an org-CI follow-on.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"
ARCH="$(uname -m)"
BIN="${OUT}/dup-finder-linux-${ARCH}"
if [[ ! -x "${BIN}" ]]; then
  echo "missing ${BIN}; run scripts/release/build-linux-docker.sh first" >&2
  exit 1
fi

docker pull anchore/syft:latest >/dev/null
docker run --rm -v "${OUT}:/out" anchore/syft:latest \
  "/out/$(basename "${BIN}")" -o spdx-json=/out/sbom.spdx.json -o cyclonedx-json=/out/sbom.cdx.json

echo "SBOM written:"
ls -la "${OUT}"/sbom.spdx.json "${OUT}"/sbom.cdx.json
