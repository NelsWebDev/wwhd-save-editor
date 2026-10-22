#!/usr/bin/env python3
"""Mark a quest log in Wind Waker HD's cking.sav as a Second Quest (Hero's clothes) playthrough.

Each 0xA94-byte slot holds a dSv_player_info_c (tww decomp) at slot offset 0x143. Its
mClearCount byte (info + 0x58 = slot + 0x19B) is 0 for a normal game and >= 1 for a second quest.
After changing it, the slot's checksum pair (sum of bytes, sum of inverted bytes) is rewritten.

Usage:
  python3 wwhd_second_quest.py                      interactive
  python3 wwhd_second_quest.py path/to/cking.sav    (or the folder containing it)
  python3 wwhd_second_quest.py cking.sav -s 2       make Quest Log 2 a second quest
  python3 wwhd_second_quest.py cking.sav -s 2 --normal   revert it to a normal quest
  python3 wwhd_second_quest.py cking.sav --list
"""
import argparse
import shutil
import struct
import sys
import time
from pathlib import Path

from wwhd_rename import DATA_SIZE, MIN_SIZE, SLOT_COUNT, SLOT_SIZE, crc_ok, read_name, slots_ok

CLEAR_COUNT = 0x19B


def write_slot_checksum(buf, slot):
    o = slot * SLOT_SIZE
    s = sum(buf[o:o + DATA_SIZE]) & 0xFFFFFFFF
    c = sum(~b & 0xFFFFFFFF for b in buf[o:o + DATA_SIZE]) & 0xFFFFFFFF
    struct.pack_into(">II", buf, o + DATA_SIZE, s, c)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?", help="path to cking.sav")
    ap.add_argument("-s", "--slot", type=int, choices=range(1, SLOT_COUNT + 1), help="quest log 1-3")
    ap.add_argument("--normal", action="store_true", help="revert to a normal (first) quest instead")
    ap.add_argument("--list", action="store_true", help="only list the quest logs")
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
        kind = "second quest" if buf[i * SLOT_SIZE + CLEAR_COUNT] else "normal"
        print(f"  Quest Log {i + 1}: {read_name(buf, i)!r} ({kind})")
    if args.list:
        return

    slot = args.slot or int(input("Which quest log (1-3)? "))
    if not 1 <= slot <= SLOT_COUNT:
        sys.exit("Quest log must be 1-3.")

    backup = path.with_name(f"{path.name}.bak-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, backup)
    buf[(slot - 1) * SLOT_SIZE + CLEAR_COUNT] = 0 if args.normal else 1
    write_slot_checksum(buf, slot - 1)
    path.write_bytes(buf)
    print(f"Quest Log {slot} is now {'a normal' if args.normal else 'a second'} quest. Backup: {backup}")


if __name__ == "__main__":
    main()
