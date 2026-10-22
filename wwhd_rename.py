#!/usr/bin/env python3
"""Rename a save profile's character name in Wind Waker HD's cking.sav.

File layout (checked against a real cking.sav; offsets from the ZeldaWWHDDecomp/wwhd decomp):
  0x0000  3 save slots, 0xA94 bytes each (data + checksum pair)  -- not touched
  0x1FBC  per-slot records: 3x16 player, 3x4 status, 3x20 event   (0x78 bytes)
  0x2034  3 names, 18 bytes each: UTF-16BE, 9 code units incl. terminator
  ...     map data, then u32 version and a u32 CRC-32 at the very end
  The CRC covers the 0x342 bytes from 0x1FBC; each name is packed as only
  (length + 1) bytes of its UTF-16 text, the rest zero (see hdSaveHolders_c::calculateChecksum).

Usage:
  python3 wwhd_rename.py                      interactive
  python3 wwhd_rename.py path/to/cking.sav    (or the folder containing it)
  python3 wwhd_rename.py cking.sav -s 2 -n Aryll
  python3 wwhd_rename.py cking.sav --list
"""
import argparse
import shutil
import struct
import sys
import zlib
import time
from pathlib import Path

SLOT_SIZE = 0xA94
DATA_SIZE = 0xA8C
SLOT_COUNT = 3
NAME_TABLE = 0x2034
NAME_STRIDE = 0x12
NAME_UNITS = 9
MAX_NAME = NAME_UNITS - 1
BLOCK_START = 0x1FBC
BLOCK_SIZE = 0x342
NAMES_IN_BLOCK = NAME_TABLE - BLOCK_START
MIN_SIZE = NAME_TABLE + NAME_STRIDE * SLOT_COUNT


def read_name(buf, slot):
    o = NAME_TABLE + slot * NAME_STRIDE
    out = []
    for u in struct.unpack_from(">9H", buf, o):
        if u == 0:
            break
        out.append(chr(u))
    return "".join(out)


def write_name(buf, slot, name):
    o = NAME_TABLE + slot * NAME_STRIDE
    units = [ord(c) for c in name] + [0] * (NAME_UNITS - len(name))
    struct.pack_into(">9H", buf, o, *units)


def block_crc(buf):
    block = bytearray(buf[BLOCK_START:BLOCK_START + BLOCK_SIZE])
    for i in range(SLOT_COUNT):
        o = NAMES_IN_BLOCK + i * NAME_STRIDE
        raw = bytes(block[o:o + NAME_STRIDE])
        n = len(read_name(buf, i))
        block[o:o + NAME_STRIDE] = raw[:n + 1] + b"\0" * (NAME_STRIDE - n - 1)
    return zlib.crc32(bytes(block))


def crc_ok(buf):
    return struct.unpack_from(">I", buf, len(buf) - 4)[0] == block_crc(buf)


def slots_ok(buf):
    for i in range(SLOT_COUNT):
        o = i * SLOT_SIZE
        s = sum(buf[o:o + DATA_SIZE]) & 0xFFFFFFFF
        c = sum(~b & 0xFFFFFFFF for b in buf[o:o + DATA_SIZE]) & 0xFFFFFFFF
        if struct.unpack_from(">II", buf, o + DATA_SIZE) != (s, c):
            return False
    return True


def validate_name(name):
    if not 1 <= len(name) <= MAX_NAME:
        raise ValueError(f"name must be 1-{MAX_NAME} characters")
    if not all(32 <= ord(ch) < 127 for ch in name):
        raise ValueError("name must be printable ASCII")
    return name


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?", help="path to cking.sav")
    ap.add_argument("-s", "--slot", type=int, choices=range(1, SLOT_COUNT + 1), help="save profile 1-3")
    ap.add_argument("-n", "--name", help="new character name")
    ap.add_argument("--list", action="store_true", help="only list the names")
    args = ap.parse_args()

    path = Path(args.file or input("Path to cking.sav: ").strip().strip("'\"")).expanduser()
    if path.is_dir():
        path = path / "cking.sav"
    if not path.is_file():
        sys.exit(f"File not found: {path}")
    buf = bytearray(path.read_bytes())
    if len(buf) < MIN_SIZE or not slots_ok(buf) or not crc_ok(buf):
        sys.exit("This doesn't look like a WWHD cking.sav (size/checksum mismatch). Nothing changed.")

    for i in range(SLOT_COUNT):
        print(f"  Slot {i + 1}: {read_name(buf, i)!r}")
    if args.list:
        return

    slot = args.slot or int(input("Which slot to rename (1-3)? "))
    if not 1 <= slot <= SLOT_COUNT:
        sys.exit("Slot must be 1-3.")
    try:
        new = validate_name(args.name if args.name is not None else input(f"New name (max {MAX_NAME}): "))
    except ValueError as e:
        sys.exit(str(e))

    backup = path.with_name(f"{path.name}.bak-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, backup)
    write_name(buf, slot - 1, new)
    struct.pack_into(">I", buf, len(buf) - 4, block_crc(buf))
    path.write_bytes(buf)
    print(f"Slot {slot} renamed to {new!r}. Backup: {backup}")


if __name__ == "__main__":
    main()
