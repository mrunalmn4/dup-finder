#!/usr/bin/env bash
# Build a CLI AppImage from artifacts/release/dup-finder-linux-* (no Tauri).
# Requires Docker for appimagetool; falls back to AppDir.tar.gz if the tool fails.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
REL="${ROOT}/artifacts/release"
VERSION="${VERSION:-0.1.0}"

mkdir -p "${REL}"

PLATFORM="${PLATFORM:-}"
ARCH_LABEL="$(uname -m)"
case "${PLATFORM}" in
  */amd64|*/x86_64) ARCH_LABEL=x86_64 ;;
  */arm64|*/aarch64) ARCH_LABEL=arm64 ;;
  "")
    case "$(uname -m)" in
      x86_64|amd64) ARCH_LABEL=x86_64 ;;
      aarch64|arm64) ARCH_LABEL=arm64 ;;
    esac
    ;;
esac

BIN=""
for candidate in \
  "${REL}/dup-finder-linux-${ARCH_LABEL}" \
  "${REL}/dup-finder-linux-arm64" \
  "${REL}/dup-finder-linux-x86_64" \
  "${REL}/dup-finder-linux-aarch64"; do
  if [[ -x "${candidate}" ]]; then
    BIN="${candidate}"
    break
  fi
done

if [[ -z "${BIN}" ]]; then
  echo "No Linux binary in ${REL}; run build-linux-docker.sh first" >&2
  exit 1
fi

DEB_ARCH="$(python3 "${ROOT}/scripts/release/elf-arch.py" "${BIN}" --format deb)"
case "${DEB_ARCH}" in
  amd64) AI_ARCH=x86_64; OUT_SUFFIX=x86_64 ;;
  arm64) AI_ARCH=aarch64; OUT_SUFFIX=aarch64 ;;
  *)
    echo "unsupported arch for AppImage: ${DEB_ARCH}" >&2
    exit 1
    ;;
esac

STAGE="${REL}/.appimage-stage"
APPDIR="${STAGE}/AppDir"
rm -rf "${STAGE}"
mkdir -p "${APPDIR}/usr/bin" "${APPDIR}/usr/share/applications" \
  "${APPDIR}/usr/share/icons/hicolor/256x256/apps"

cp "${BIN}" "${APPDIR}/usr/bin/dup-finder"
chmod +x "${APPDIR}/usr/bin/dup-finder"

cat > "${APPDIR}/dup-finder.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Dup Finder
Comment=Find content duplicates (CLI)
Exec=dup-finder
Icon=dup-finder
Categories=Utility;FileTools;
Terminal=true
EOF
cp "${APPDIR}/dup-finder.desktop" "${APPDIR}/usr/share/applications/"

python3 - "${APPDIR}" <<'PY'
import struct, sys, zlib
from pathlib import Path

def chunk(tag: bytes, data: bytes) -> bytes:
    return (
        struct.pack(">I", len(data))
        + tag
        + data
        + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    )

appdir = Path(sys.argv[1])
raw = b"\x00" + b"\x00\x00\x00"
ihdr = struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0)
png = (
    b"\x89PNG\r\n\x1a\n"
    + chunk(b"IHDR", ihdr)
    + chunk(b"IDAT", zlib.compress(raw))
    + chunk(b"IEND", b"")
)
(appdir / "dup-finder.png").write_bytes(png)
(appdir / "usr/share/icons/hicolor/256x256/apps/dup-finder.png").write_bytes(png)
(appdir / ".DirIcon").write_bytes(png)
PY

cat > "${APPDIR}/AppRun" <<'EOF'
#!/bin/sh
HERE="$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")"
exec "${HERE}/usr/bin/dup-finder" "$@"
EOF
chmod +x "${APPDIR}/AppRun"

OUT_NAME="dup-finder-${VERSION}-${OUT_SUFFIX}.AppImage"
OUT_PATH="${REL}/${OUT_NAME}"
rm -f "${OUT_PATH}"

# Try several known appimagetool images (override with APPIMAGE_TOOL_IMAGE).
TOOL_IMGS=()
if [[ -n "${APPIMAGE_TOOL_IMAGE:-}" ]]; then
  TOOL_IMGS+=("${APPIMAGE_TOOL_IMAGE}")
fi
TOOL_IMGS+=(
  "ghcr.io/appimage/appimagetool:1.9.0"
  "appimagecrafters/appimagetool:latest"
)

RC=1
: >"${STAGE}/appimagetool.err"
for TOOL_IMG in "${TOOL_IMGS[@]}"; do
  set +e
  docker run --rm \
    -e ARCH="${AI_ARCH}" \
    -v "${APPDIR}:/AppDir:ro" \
    -v "${REL}:/out" \
    --entrypoint /bin/sh \
    "${TOOL_IMG}" \
    -c "command -v appimagetool >/dev/null && cp -a /AppDir /tmp/AppDir && cd /tmp && ARCH=${AI_ARCH} appimagetool -n /tmp/AppDir /out/${OUT_NAME}" \
    >>"${STAGE}/appimagetool.err" 2>&1
  RC=$?
  set -e
  if [[ "${RC}" -eq 0 && -f "${OUT_PATH}" ]]; then
    break
  fi
done

smoke_bin() {
  # Run Linux ELF via Docker (host may be macOS).
  local plat_args=()
  if [[ -n "${PLATFORM}" ]]; then
    plat_args+=(--platform "${PLATFORM}")
  elif [[ "${DEB_ARCH}" == "amd64" ]]; then
    plat_args+=(--platform linux/amd64)
  elif [[ "${DEB_ARCH}" == "arm64" ]]; then
    plat_args+=(--platform linux/arm64)
  fi
  docker run --rm "${plat_args[@]}" -v "${APPDIR}/usr/bin:/b:ro" \
    --entrypoint /b/dup-finder debian:bookworm-slim --help >/dev/null
}

if [[ "${RC}" -ne 0 || ! -f "${OUT_PATH}" ]]; then
  echo "appimagetool unavailable or failed; writing AppDir tarball instead" >&2
  sed -n '1,40p' "${STAGE}/appimagetool.err" >&2 || true
  TAR="${REL}/dup-finder-${VERSION}-${OUT_SUFFIX}.AppDir.tar.gz"
  tar -C "${STAGE}" -czf "${TAR}" AppDir
  (
    cd "${REL}"
    if [[ -f SHA256SUMS ]]; then
      grep -v " $(basename "${TAR}")\$" SHA256SUMS > SHA256SUMS.tmp || true
      mv SHA256SUMS.tmp SHA256SUMS
      shasum -a 256 "$(basename "${TAR}")" >> SHA256SUMS
    else
      shasum -a 256 "$(basename "${TAR}")" > SHA256SUMS
    fi
  )
  echo "AppDir pack: ${TAR}"
  smoke_bin || true
  rm -rf "${STAGE}"
  exit 0
fi

chmod +x "${OUT_PATH}"
(
  cd "${REL}"
  if [[ -f SHA256SUMS ]]; then
    grep -v " ${OUT_NAME}\$" SHA256SUMS > SHA256SUMS.tmp || true
    mv SHA256SUMS.tmp SHA256SUMS
    shasum -a 256 "${OUT_NAME}" >> SHA256SUMS
  else
    shasum -a 256 "${OUT_NAME}" > SHA256SUMS
  fi
)

smoke_bin || true
rm -rf "${STAGE}"
echo "AppImage ready: ${OUT_PATH}"
ls -la "${OUT_PATH}"
