#!/usr/bin/env bash
# Pre-tag release checklist. Exit non-zero if something looks wrong.
# Usage: bash scripts/release/checklist.sh [v0.1.1]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

TAG="${1:-}"
VERSION=""
if [ -n "$TAG" ]; then
  case "$TAG" in
    v*) VERSION="${TAG#v}" ;;
    *) echo "tag must look like v0.1.1" >&2; exit 1 ;;
  esac
fi

fail=0
ok() { echo "OK  $*"; }
bad() { echo "FAIL $*"; fail=1; }

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  if [ -z "$(git status --porcelain)" ]; then
    ok "working tree clean"
  else
    bad "working tree dirty — commit or stash before tagging"
  fi
  BRANCH="$(git rev-parse --abbrev-ref HEAD)"
  if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    ok "on $BRANCH"
  else
    bad "expected main/master, on $BRANCH"
  fi
else
  bad "not a git repo"
fi

if [ -f CHANGELOG.md ]; then
  if [ -n "$VERSION" ]; then
    if grep -q "## \\[${VERSION}\\]" CHANGELOG.md; then
      ok "CHANGELOG has ## [${VERSION}]"
    else
      bad "CHANGELOG.md missing ## [${VERSION}] section"
    fi
  else
    ok "CHANGELOG.md present (pass a tag to verify section)"
  fi
else
  bad "CHANGELOG.md missing"
fi

for f in LICENSE SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md SUPPORT.md README.md; do
  if [ -f "$f" ]; then ok "$f"; else bad "$f missing"; fi
done

if [ -f src-tauri/tauri.conf.json ] && [ -n "$VERSION" ]; then
  TV="$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])" 2>/dev/null || true)"
  if [ "$TV" = "$VERSION" ]; then
    ok "tauri.conf.json version=$TV"
  else
    bad "tauri.conf.json version='$TV' != '$VERSION'"
  fi
fi

echo
echo "Manual: confirm Actions CI (job 'test') is green on the commit you will tag."
echo "Tag + push: git tag -a ${TAG:-vX.Y.Z} -m 'Dup Finder ${TAG:-vX.Y.Z}' && git push origin ${TAG:-vX.Y.Z}"
echo "Pipeline: quality-gate → build once → smoke → GitHub Release + GHCR."

exit "$fail"
