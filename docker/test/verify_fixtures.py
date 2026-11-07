#!/usr/bin/env python3
"""Validate golden fixtures used by later delete/scan UAT. No product binary required."""

from __future__ import annotations

import hashlib
import sys
from pathlib import Path

ROOT = Path("/fixtures") if Path("/fixtures").is_dir() else Path(__file__).resolve().parents[1] / "fixtures"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> int:
    errors: list[str] = []

    identical_a = ROOT / "identical" / "report.txt"
    identical_b = ROOT / "identical" / "copy" / "report_backup.txt"
    spoof = ROOT / "extension_spoof" / "photo.jpg"
    spoof_real = ROOT / "extension_spoof" / "photo.bin"
    unique = ROOT / "unique" / "only_once.dat"
    keep = ROOT / "delete_safety" / "keep_me.txt"
    drop = ROOT / "delete_safety" / "drop_me.txt"

    required = [identical_a, identical_b, spoof, spoof_real, unique, keep, drop]
    for p in required:
        if not p.is_file():
            errors.append(f"missing fixture: {p}")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1

    if sha256(identical_a) != sha256(identical_b):
        errors.append("identical fixtures must share content hash")
    if sha256(spoof) != sha256(spoof_real):
        errors.append("extension_spoof pair must share content hash")
    if sha256(keep) == sha256(drop):
        # same content is OK for duplicate group; both must exist as distinct paths
        pass
    if sha256(unique) == sha256(identical_a):
        errors.append("unique fixture must not match identical pair")

    # Spoofed name should not match sniffed type by extension alone (content is plain text).
    if spoof.suffix.lower() != ".jpg":
        errors.append("spoof fixture must use .jpg extension")
    head = spoof.read_bytes()[:16]
    if head.startswith(b"\xff\xd8\xff"):
        errors.append("spoof .jpg must NOT be real JPEG bytes (tests content identity)")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1

    print("OK fixtures verified at", ROOT)
    print(" pairs: identical, extension_spoof, delete_safety keep/drop")
    return 0


if __name__ == "__main__":
    sys.exit(main())
