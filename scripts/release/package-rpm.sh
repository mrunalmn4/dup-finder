#!/usr/bin/env bash
# Build a .rpm from a Linux release binary using Docker + rpmbuild.
# Arch comes from the ELF header. Override BIN=...; PLATFORM follows ELF.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${ROOT}/artifacts/release"

BIN="${BIN:-}"
if [[ -z "${BIN}" ]]; then
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

RPM_ARCH="$(python3 "${ROOT}/scripts/release/elf-arch.py" "${BIN}" --format rpm)"
case "${RPM_ARCH}" in
  aarch64) PLATFORM="${PLATFORM:-linux/arm64}" ;;
  x86_64) PLATFORM="${PLATFORM:-linux/amd64}" ;;
  *) PLATFORM="${PLATFORM:-linux/${RPM_ARCH}}" ;;
esac

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
shopt -s nullglob
RPMS=("${STAGE}/RPMS/${RPM_ARCH}"/*.rpm)
if [[ ${#RPMS[@]} -eq 0 ]]; then
  echo "rpmbuild produced no packages under RPMS/${RPM_ARCH}" >&2
  exit 1
fi
cp "${RPMS[@]}" "${OUT}/"
rm -rf "${STAGE}"
echo "RPM packages in ${OUT}:"
ls -la "${OUT}"/*.rpm
