#!/usr/bin/env bash
# Build a simple .rpm from a Linux release binary using Docker + rpmbuild.
# Override: BIN=... RPM_ARCH=aarch64|x86_64 PLATFORM=linux/arm64|linux/amd64
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"
HOST_ARCH="$(uname -m)"
case "${HOST_ARCH}" in
  aarch64|arm64) DEFAULT_ARCH=aarch64; DEFAULT_BIN_SUFFIX=arm64; DEFAULT_PLATFORM=linux/arm64 ;;
  x86_64|amd64) DEFAULT_ARCH=x86_64; DEFAULT_BIN_SUFFIX=x86_64; DEFAULT_PLATFORM=linux/amd64 ;;
  *) DEFAULT_ARCH="${HOST_ARCH}"; DEFAULT_BIN_SUFFIX="${HOST_ARCH}"; DEFAULT_PLATFORM="linux/${HOST_ARCH}" ;;
esac
RPM_ARCH="${RPM_ARCH:-${DEFAULT_ARCH}}"
BIN_SUFFIX="${BIN_SUFFIX:-${DEFAULT_BIN_SUFFIX}}"
PLATFORM="${PLATFORM:-${DEFAULT_PLATFORM}}"
BIN="${BIN:-${OUT}/dup-finder-linux-${BIN_SUFFIX}}"
if [[ ! -x "${BIN}" ]]; then
  echo "missing ${BIN}; run build-linux-docker.sh first" >&2
  exit 1
fi

STAGE="${OUT}/rpmbuild-${RPM_ARCH}"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"/{BUILD,RPMS,SOURCES,SPECS,SRPMS}
cp "${BIN}" "${STAGE}/SOURCES/dup-finder"
cat > "${STAGE}/SPECS/dup-finder.spec" <<EOF
Name:           dup-finder
Version:        0.1.0
Release:        1%{?dist}
Summary:        Content-duplicate finder with fail-closed safe delete
License:        MIT
BuildArch:      ${RPM_ARCH}

%description
Scan for content duplicates and safely delete only confirmed paths.

%install
mkdir -p %{buildroot}/usr/local/bin
install -m 0755 %{_sourcedir}/dup-finder %{buildroot}/usr/local/bin/dup-finder

%files
/usr/local/bin/dup-finder
EOF

docker run --rm --platform "${PLATFORM}" -v "${STAGE}:/root/rpmbuild" rockylinux:9 \
  bash -lc 'dnf install -y rpm-build >/dev/null && rpmbuild -bb /root/rpmbuild/SPECS/dup-finder.spec'
cp "${STAGE}/RPMS/${RPM_ARCH}"/*.rpm "${OUT}/" 2>/dev/null || cp "${STAGE}/RPMS"/*/*.rpm "${OUT}/"
rm -rf "${STAGE}"
echo "RPM packages in ${OUT}:"
ls -la "${OUT}"/*.rpm
