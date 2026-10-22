#!/usr/bin/env python3
"""Mark a quest log in Wind Waker HD's cking.sav as a Second Quest (Hero's clothes) playthrough.

Each 0xA94-byte slot holds a dSv_player_info_c (tww decomp) at slot offset 0x143. Its
mClearCount byte (slot + 0x19B) is 0 for a normal game and >= 1 for a second quest.
The slot's checksum pair is rewritten afterwards.

Usage:
  python3 wwhd_second_quest.py                      interactive
  python3 wwhd_second_quest.py path/to/cking.sav    (or the folder containing it)
  python3 wwhd_second_quest.py cking.sav -s 2       make Quest Log 2 a second quest
  python3 wwhd_second_quest.py cking.sav -s 2 --normal   revert it to a normal quest
  python3 wwhd_second_quest.py cking.sav --list
"""
import argparse
import sys

from wwhd_save import SLOT_COUNT, is_second_quest, load_save, read_name, set_second_quest, write_save


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?", help="path to cking.sav")
    ap.add_argument("-s", "--slot", type=int, choices=range(1, SLOT_COUNT + 1), help="quest log 1-3")
    ap.add_argument("--normal", action="store_true", help="revert to a normal (first) quest instead")
    ap.add_argument("--list", action="store_true", help="only list the quest logs")
    args = ap.parse_args()

    try:
        path, buf = load_save(args.file or input("Path to cking.sav: "))
    except ValueError as e:
        sys.exit(f"{e} Nothing changed.")

    for i in range(SLOT_COUNT):
        kind = "second quest" if is_second_quest(buf, i) else "normal"
        print(f"  Quest Log {i + 1}: {read_name(buf, i)!r} ({kind})")
    if args.list:
        return

    slot = args.slot or int(input("Which quest log (1-3)? "))
    if not 1 <= slot <= SLOT_COUNT:
        sys.exit("Quest log must be 1-3.")

    set_second_quest(buf, slot - 1, not args.normal)
    backup = write_save(path, buf)
    print(f"Quest Log {slot} is now {'a normal' if args.normal else 'a second'} quest. Backup: {backup}")


if __name__ == "__main__":
    main()
