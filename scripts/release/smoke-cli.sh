#!/usr/bin/env bash
# Smoke a release CLI binary: --help and a tiny fixture scan.
# Usage: BIN=path/to/dup-finder bash scripts/release/smoke-cli.sh
set -euo pipefail

BIN="${BIN:?BIN=path/to/dup-finder required}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
FIX="${ROOT}/docker/fixtures"

die() { echo "::error::$*" >&2; exit 1; }

test -x "$BIN" || die "not executable: $BIN"
"$BIN" --help >/dev/null || die "--help failed"
test -d "$FIX" || die "fixtures missing: $FIX"

OUT="$(mktemp)"
trap 'rm -f "$OUT"' EXIT
"$BIN" scan "$FIX" -o "$OUT" >/dev/null
test -s "$OUT" || die "scan produced empty output"
echo "cli smoke OK ($BIN)"
