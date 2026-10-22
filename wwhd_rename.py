#!/usr/bin/env python3
"""Rename a save profile's character name in Wind Waker HD's cking.sav.

Usage:
  python3 wwhd_rename.py                      interactive
  python3 wwhd_rename.py path/to/cking.sav    (or the folder containing it)
  python3 wwhd_rename.py cking.sav -s 2 -n Aryll
  python3 wwhd_rename.py cking.sav --list
"""
import argparse
import sys

from wwhd_save import MAX_NAME, SLOT_COUNT, load_save, read_name, validate_name, write_name, write_save


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?", help="path to cking.sav")
    ap.add_argument("-s", "--slot", type=int, choices=range(1, SLOT_COUNT + 1), help="save profile 1-3")
    ap.add_argument("-n", "--name", help="new character name")
    ap.add_argument("--list", action="store_true", help="only list the names")
    args = ap.parse_args()

    try:
        path, buf = load_save(args.file or input("Path to cking.sav: "))
    except ValueError as e:
        sys.exit(f"{e} Nothing changed.")

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

    write_name(buf, slot - 1, new)
    backup = write_save(path, buf)
    print(f"Slot {slot} renamed to {new!r}. Backup: {backup}")


if __name__ == "__main__":
    main()
