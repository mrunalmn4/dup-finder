#!/usr/bin/env bash
# Post-Tauri-build smoke: prove host bundles exist and look like real installers.
# Usage: PLATFORM=macos|windows BUNDLE_DIR=src-tauri/target/release/bundle bash scripts/desktop/smoke-bundle.sh
set -euo pipefail

PLATFORM="${PLATFORM:?PLATFORM=macos|windows required}"
BUNDLE_DIR="${BUNDLE_DIR:-src-tauri/target/release/bundle}"
RELEASE_DIR="${RELEASE_DIR:-src-tauri/target/release}"

die() { echo "::error::$*" >&2; exit 1; }

test -d "$BUNDLE_DIR" || die "bundle dir missing: $BUNDLE_DIR"
echo "=== bundle tree ==="
find "$BUNDLE_DIR" -maxdepth 4 -type f | head -n 200 || true

case "$PLATFORM" in
  macos)
    APP="$(find "$BUNDLE_DIR" -type d -name '*.app' | head -n 1 || true)"
    test -n "$APP" || die "no .app under $BUNDLE_DIR"
    echo "found app: $APP"
    # Inner Mach-O binary
    BIN="$(find "$APP/Contents/MacOS" -type f | head -n 1 || true)"
    test -n "$BIN" || die "no MacOS binary inside $APP"
    test -x "$BIN" || die "app binary not executable: $BIN"
    file "$BIN" | grep -qi 'Mach-O' || die "expected Mach-O binary, got: $(file "$BIN")"
    if command -v codesign >/dev/null 2>&1; then
      codesign -dv --verbose=2 "$APP" 2>&1 | head -n 20 || true
    fi
    # Optional dmg (targets=all)
    DMG="$(find "$BUNDLE_DIR" -type f -name '*.dmg' | head -n 1 || true)"
    if [ -n "$DMG" ]; then
      echo "found dmg: $DMG ($(wc -c <"$DMG") bytes)"
      test -s "$DMG" || die "dmg is empty"
    else
      echo "::warning::no .dmg produced (app bundle still OK)"
    fi
    ;;
  windows)
    MSI="$(find "$BUNDLE_DIR" -type f -name '*.msi' | head -n 1 || true)"
    NSIS="$(find "$BUNDLE_DIR" -type f \( -name '*setup*.exe' -o -name '*.exe' \) | head -n 1 || true)"
    if [ -z "$MSI" ] && [ -z "$NSIS" ]; then
      die "no .msi or installer .exe under $BUNDLE_DIR"
    fi
    [ -n "$MSI" ] && echo "found msi: $MSI ($(wc -c <"$MSI") bytes)" && test -s "$MSI"
    [ -n "$NSIS" ] && echo "found exe: $NSIS ($(wc -c <"$NSIS") bytes)" && test -s "$NSIS"
    # Release PE binary (space in product name)
    WIN_BIN="$(find "$RELEASE_DIR" -maxdepth 1 -type f -name '*.exe' | head -n 1 || true)"
    test -n "$WIN_BIN" || die "no release .exe in $RELEASE_DIR"
    echo "found release exe: $WIN_BIN"
    test -s "$WIN_BIN" || die "release exe is empty"
    if command -v file >/dev/null 2>&1; then
      file "$WIN_BIN" | grep -Eqi 'PE32|MS Windows|executable' \
        || die "expected Windows PE, got: $(file "$WIN_BIN")"
    else
      # Git Bash without file(1): MZ header = PE
      head -c 2 "$WIN_BIN" | grep -q 'MZ' || die "exe missing MZ header"
    fi
    ;;
  *)
    die "unknown PLATFORM=$PLATFORM"
    ;;
esac

echo "desktop smoke OK ($PLATFORM)"
