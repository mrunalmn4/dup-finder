#!/usr/bin/env python3
"""List name@version from Cargo.lock (offline dependency inventory)."""
from __future__ import annotations

import sys
from pathlib import Path


def main() -> int:
    lock = Path(sys.argv[1] if len(sys.argv) > 1 else "Cargo.lock")
    if not lock.is_file():
        print(f"missing {lock}", file=sys.stderr)
        return 1
    name = version = None
    packages: list[str] = []
    for line in lock.read_text(encoding="utf-8").splitlines():
        if line.startswith("name = "):
            name = line.split("=", 1)[1].strip().strip('"')
        elif line.startswith("version = ") and name is not None:
            version = line.split("=", 1)[1].strip().strip('"')
            packages.append(f"{name} {version}")
            name = version = None
        elif line.startswith("[[package]]"):
            name = version = None
    for pkg in packages:
        print(pkg)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
