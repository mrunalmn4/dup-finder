#!/usr/bin/env bash
# Build a simple .rpm from the Linux release binary using Docker + rpmbuild.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"
ARCH="$(uname -m)"
case "${ARCH}" in
  aarch64|arm64) RPM_ARCH=aarch64 ;;
  x86_64|amd64) RPM_ARCH=x86_64 ;;
  *) RPM_ARCH="${ARCH}" ;;
esac
BIN="${OUT}/dup-finder-linux-${ARCH}"
if [[ ! -x "${BIN}" ]]; then
  echo "missing ${BIN}; build the release binary first" >&2
  exit 1
fi

STAGE="${OUT}/rpmbuild"
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

docker run --rm -v "${STAGE}:/root/rpmbuild" rockylinux:9 \
  bash -lc 'dnf install -y rpm-build >/dev/null && rpmbuild -bb /root/rpmbuild/SPECS/dup-finder.spec'
cp "${STAGE}/RPMS/${RPM_ARCH}"/*.rpm "${OUT}/" 2>/dev/null || cp "${STAGE}/RPMS"/*/*.rpm "${OUT}/"
echo "RPM packages in ${OUT}:"
ls -la "${OUT}"/*.rpm
