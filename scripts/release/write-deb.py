#!/usr/bin/env python3
"""Write a minimal .deb (ar + tar.gz) without dpkg/apt. Portable on macOS."""
from __future__ import annotations

import argparse
import io
import os
import tarfile
from pathlib import Path


def tar_gz_bytes(files: dict[str, bytes], mode: int = 0o644) -> bytes:
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz", format=tarfile.GNU_FORMAT) as tf:
        for name, data in files.items():
            info = tarfile.TarInfo(name=name)
            info.size = len(data)
            info.mode = mode if not name.endswith("/") else 0o755
            info.uid = 0
            info.gid = 0
            info.uname = "root"
            info.gname = "root"
            tf.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def ar_member(name: str, data: bytes) -> bytes:
    # GNU ar header: 16s name, 12s mtime, 6s uid, 6s gid, 8s mode, 10s size, 2s magic
    header = (
        f"{name:<16}{0:<12}{0:<6}{0:<6}{0o100644:<8}{len(data):<10}`\n"
    ).encode("ascii")
    out = header + data
    if len(data) % 2 == 1:
        out += b"\n"
    return out


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--bin", required=True, type=Path)
    p.add_argument("--out", required=True, type=Path)
    p.add_argument("--arch", required=True)
    p.add_argument("--version", default="0.1.0")
    args = p.parse_args()

    binary = args.bin.read_bytes()
    size_kb = max(1, (len(binary) + 1023) // 1024)
    control = f"""Package: dup-finder
Version: {args.version}
Section: utils
Priority: optional
Architecture: {args.arch}
Maintainer: Dup Finder Contributors
Installed-Size: {size_kb}
Description: Content-duplicate finder with fail-closed safe delete
 Scan for content duplicates (BLAKE3) and delete only confirmed paths.
""".encode()

    control_tar = tar_gz_bytes({"control": control})
    # executable mode for the binary path inside data.tar.gz
    data_buf = io.BytesIO()
    with tarfile.open(fileobj=data_buf, mode="w:gz", format=tarfile.GNU_FORMAT) as tf:
        for d in ("usr/", "usr/local/", "usr/local/bin/"):
            info = tarfile.TarInfo(name=d)
            info.type = tarfile.DIRTYPE
            info.mode = 0o755
            info.uid = info.gid = 0
            info.uname = info.gname = "root"
            tf.addfile(info)
        info = tarfile.TarInfo(name="usr/local/bin/dup-finder")
        info.size = len(binary)
        info.mode = 0o755
        info.uid = info.gid = 0
        info.uname = info.gname = "root"
        tf.addfile(info, io.BytesIO(binary))
    data_tar = data_buf.getvalue()

    debian_binary = b"2.0\n"
    blob = (
        b"!<arch>\n"
        + ar_member("debian-binary", debian_binary)
        + ar_member("control.tar.gz", control_tar)
        + ar_member("data.tar.gz", data_tar)
    )
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_bytes(blob)
    os.chmod(args.out, 0o644)
    print(f"Wrote {args.out} ({len(blob)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
