"""Shared reading/writing logic for Wind Waker HD's cking.sav.

File layout (checked against a real cking.sav; offsets from the ZeldaWWHDDecomp/wwhd decomp):
  0x0000  3 save slots, 0xA94 bytes each (0xA8C data + two u32 checksums: byte sum, inverted byte sum)
          slot + 0x19B is mClearCount (0 = normal, >= 1 = second quest)
  0x1FBC  per-slot records: 3x16 player, 3x4 status, 3x20 event   (0x78 bytes)
  0x2034  3 names, 18 bytes each: UTF-16BE, 9 code units incl. terminator
  ...     map data, then u32 version and a u32 CRC-32 at the very end
  The CRC covers the 0x342 bytes from 0x1FBC; each name is packed as only
  (length + 1) bytes of its UTF-16 text, the rest zero (see hdSaveHolders_c::calculateChecksum).
"""
import shutil
import struct
import time
import zlib
from pathlib import Path

SAVE_NAME = "cking.sav"
SLOT_SIZE = 0xA94
DATA_SIZE = 0xA8C
SLOT_COUNT = 3
CLEAR_COUNT = 0x19B
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


def validate_name(name):
    if not 1 <= len(name) <= MAX_NAME:
        raise ValueError(f"name must be 1-{MAX_NAME} characters")
    if not all(32 <= ord(ch) < 127 for ch in name):
        raise ValueError("name must be printable ASCII")
    return name


def is_second_quest(buf, slot):
    return buf[slot * SLOT_SIZE + CLEAR_COUNT] != 0


def set_second_quest(buf, slot, enabled):
    o = slot * SLOT_SIZE + CLEAR_COUNT
    buf[o] = (buf[o] or 1) if enabled else 0


def _slot_checksums(buf, slot):
    o = slot * SLOT_SIZE
    data = buf[o:o + DATA_SIZE]
    return sum(data) & 0xFFFFFFFF, sum(~b & 0xFFFFFFFF for b in data) & 0xFFFFFFFF


def write_slot_checksum(buf, slot):
    struct.pack_into(">II", buf, slot * SLOT_SIZE + DATA_SIZE, *_slot_checksums(buf, slot))


def slots_ok(buf):
    return all(struct.unpack_from(">II", buf, i * SLOT_SIZE + DATA_SIZE) == _slot_checksums(buf, i)
               for i in range(SLOT_COUNT))


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


def write_block_crc(buf):
    struct.pack_into(">I", buf, len(buf) - 4, block_crc(buf))


def resolve_path(arg):
    """Accept either the cking.sav path or the folder containing it."""
    path = Path(str(arg).strip().strip("'\"")).expanduser()
    return path / SAVE_NAME if path.is_dir() else path


def load_save(arg):
    """Return (path, buf) for a validated save; raise ValueError with a user-facing message otherwise."""
    path = resolve_path(arg)
    if not path.is_file():
        raise ValueError(f"No {SAVE_NAME} found at:\n{path}")
    buf = bytearray(path.read_bytes())
    if len(buf) < MIN_SIZE or not slots_ok(buf) or not crc_ok(buf):
        raise ValueError(f"This doesn't look like a valid WWHD {SAVE_NAME} (size/checksum mismatch).")
    return path, buf


def write_save(path, buf):
    """Back up the existing file, fix all checksums, write the new data. Returns the backup path."""
    backup = path.with_name(f"{path.name}.bak-{time.strftime('%Y%m%d-%H%M%S')}")
    shutil.copy2(path, backup)
    for i in range(SLOT_COUNT):
        write_slot_checksum(buf, i)
    write_block_crc(buf)
    path.write_bytes(buf)
    return backup
