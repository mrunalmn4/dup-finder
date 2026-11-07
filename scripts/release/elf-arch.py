#!/usr/bin/env python3
"""Detect Linux ELF machine → debian/rpm arch labels. Fail closed on mismatch."""
from __future__ import annotations

import argparse
import struct
import sys
from pathlib import Path

# e_machine values (little-endian ELF)
EM_X86_64 = 62
EM_AARCH64 = 183
EM_ARM = 40


def detect(path: Path) -> tuple[str, str]:
    """Return (deb_arch, rpm_arch)."""
    data = path.read_bytes()[:64]
    if len(data) < 20 or data[:4] != b"\x7fELF":
        raise SystemExit(f"not an ELF binary: {path}")
    ei_data = data[5]  # 1=little, 2=big
    if ei_data != 1:
        raise SystemExit(f"unsupported ELF endianness in {path}")
    e_machine = struct.unpack_from("<H", data, 18)[0]
    if e_machine == EM_X86_64:
        return "amd64", "x86_64"
    if e_machine == EM_AARCH64:
        return "arm64", "aarch64"
    if e_machine == EM_ARM:
        return "armhf", "armv7hl"
    raise SystemExit(f"unsupported e_machine={e_machine} in {path}")


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("bin", type=Path)
    p.add_argument("--format", choices=("deb", "rpm", "both"), default="both")
    p.add_argument("--expect-deb")
    p.add_argument("--expect-rpm")
    args = p.parse_args()
    deb, rpm = detect(args.bin)
    if args.expect_deb and args.expect_deb != deb:
        print(f"arch mismatch: ELF is {deb}, expected deb {args.expect_deb}", file=sys.stderr)
        return 1
    if args.expect_rpm and args.expect_rpm != rpm:
        print(f"arch mismatch: ELF is {rpm}, expected rpm {args.expect_rpm}", file=sys.stderr)
        return 1
    if args.format == "deb":
        print(deb)
    elif args.format == "rpm":
        print(rpm)
    else:
        print(f"{deb} {rpm}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
