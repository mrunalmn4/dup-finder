#!/usr/bin/env bash
# Build a simple .deb from the Linux release binary (Docker, fpm-free).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"
ARCH="$(uname -m)"
case "${ARCH}" in
  aarch64|arm64) DEB_ARCH=arm64 ;;
  x86_64|amd64) DEB_ARCH=amd64 ;;
  *) DEB_ARCH="${ARCH}" ;;
esac
BIN="${OUT}/dup-finder-linux-${ARCH}"
if [[ ! -x "${BIN}" ]]; then
  echo "missing ${BIN}; run scripts/release/build-linux-docker.sh first" >&2
  exit 1
fi

STAGE="${OUT}/deb-stage"
rm -rf "${STAGE}"
mkdir -p "${STAGE}/usr/local/bin" "${STAGE}/DEBIAN"
cp "${BIN}" "${STAGE}/usr/local/bin/dup-finder"
cat > "${STAGE}/DEBIAN/control" <<EOF
Package: dup-finder
Version: 0.1.0
Section: utils
Priority: optional
Architecture: ${DEB_ARCH}
Maintainer: Dup Finder Contributors
Description: Content-duplicate finder with fail-closed safe delete
EOF

docker run --rm -v "${OUT}:/out" -w /out debian:bookworm-slim \
  bash -lc 'apt-get update -qq && apt-get install -y -qq dpkg-dev >/dev/null && dpkg-deb --build deb-stage dup-finder_0.1.0_'"${DEB_ARCH}"'.deb && rm -rf deb-stage'

echo "Wrote ${OUT}/dup-finder_0.1.0_${DEB_ARCH}.deb"
