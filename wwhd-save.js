// Wind Waker HD cking.sav logic (port of wwhd_save.py). Works in browsers and Node.
(function (root) {
  const SLOT_SIZE = 0xa94, DATA_SIZE = 0xa8c, SLOT_COUNT = 3, CLEAR_COUNT = 0x19b;
  const NAME_TABLE = 0x2034, NAME_STRIDE = 0x12, NAME_UNITS = 9, MAX_NAME = NAME_UNITS - 1;
  const BLOCK_START = 0x1fbc, BLOCK_SIZE = 0x342, NAMES_IN_BLOCK = NAME_TABLE - BLOCK_START;
  const MIN_SIZE = NAME_TABLE + NAME_STRIDE * SLOT_COUNT;

  const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  const view = (buf) => new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

  function readName(buf, slot) {
    const dv = view(buf), o = NAME_TABLE + slot * NAME_STRIDE;
    let out = "";
    for (let i = 0; i < NAME_UNITS; i++) {
      const u = dv.getUint16(o + i * 2);
      if (!u) break;
      out += String.fromCharCode(u);
    }
    return out;
  }

  function writeName(buf, slot, name) {
    const dv = view(buf), o = NAME_TABLE + slot * NAME_STRIDE;
    for (let i = 0; i < NAME_UNITS; i++) dv.setUint16(o + i * 2, i < name.length ? name.charCodeAt(i) : 0);
  }

  // Each slot stores its return place (dSv_player_return_place_c) at slot + 0x30: 8-byte stage name, then room number.
  const RETURN_PLACE = 0x30;
  const SEA_ROOMS = ["Forsaken Fortress", "Star Island", "Northern Fairy Island", "Gale Isle", "Crescent Moon Island",
    "Seven-Star Isles", "Overlook Island", "Four-Eye Reef", "Mother & Child Isles", "Spectacle Island",
    "Windfall Island", "Pawprint Isle", "Dragon Roost Island", "Flight Control Platform", "Western Fairy Island",
    "Rock Spire Isle", "Tingle Island", "Northern Triangle Island", "Eastern Fairy Island", "Fire Mountain",
    "Star Belt Archipelago", "Three-Eye Reef", "Greatfish Isle", "Cyclops Reef", "Six-Eye Reef", "Tower of the Gods",
    "Eastern Triangle Island", "Thorned Fairy Island", "Needle Rock Isle", "Islet of Steel", "Stone Watcher Island",
    "Southern Triangle Island", "Private Oasis", "Bomb Island", "Bird's Peak Rock", "Diamond Steppe Island",
    "Five-Eye Reef", "Shark Island", "Southern Fairy Island", "Ice Ring Isle", "Forest Haven", "Cliff Plateau Isles",
    "Horseshoe Island", "Outset Island", "Headstone Island", "Two-Eye Reef", "Angular Isles", "Boating Course",
    "Five-Star Isles"];
  const STAGES = { M_NewD2: "Dragon Roost Cavern", M_DragB: "Dragon Roost Cavern", kindan: "Forbidden Woods",
    kinBOSS: "Forbidden Woods", Siren: "Tower of the Gods", SirenB: "Tower of the Gods", M_Dai: "Earth Temple",
    M_DaiB: "Earth Temple", kaze: "Wind Temple", kazeB: "Wind Temple", Hyroom: "Hyrule Castle",
    Hyrule: "Hyrule Castle" };

  // Best-effort display name for where the slot will load; unknown stages fall back to the raw stage name.
  function readLocation(buf, slot) {
    const o = slot * SLOT_SIZE + RETURN_PLACE;
    let stage = "";
    for (let i = 0; i < 8 && buf[o + i]; i++) stage += String.fromCharCode(buf[o + i]);
    const room = buf[o + 8];
    if (stage === "sea" && room >= 1 && room <= SEA_ROOMS.length) return SEA_ROOMS[room - 1];
    return STAGES[stage] || (stage ? `${stage} (room ${room})` : "Unknown");
  }

  // Returns an error message, or null when valid.
  function nameError(name) {
    if (name.length < 1 || name.length > MAX_NAME) return `Name must be 1-${MAX_NAME} characters.`;
    if (![...name].every((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127))
      return "Name must be printable ASCII.";
    return null;
  }

  const isSecondQuest = (buf, slot) => buf[slot * SLOT_SIZE + CLEAR_COUNT] !== 0;

  function setSecondQuest(buf, slot, enabled) {
    const o = slot * SLOT_SIZE + CLEAR_COUNT;
    buf[o] = enabled ? buf[o] || 1 : 0;
  }

  function slotChecksums(buf, slot) {
    const o = slot * SLOT_SIZE;
    let sum = 0, inv = 0;
    for (let i = o; i < o + DATA_SIZE; i++) {
      sum = (sum + buf[i]) >>> 0;
      inv = (inv + (~buf[i] >>> 0)) >>> 0;
    }
    return [sum, inv];
  }

  function writeSlotChecksum(buf, slot) {
    const dv = view(buf), [s, c] = slotChecksums(buf, slot);
    dv.setUint32(slot * SLOT_SIZE + DATA_SIZE, s);
    dv.setUint32(slot * SLOT_SIZE + DATA_SIZE + 4, c);
  }

  function slotsOk(buf) {
    const dv = view(buf);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const [s, c] = slotChecksums(buf, i);
      if (dv.getUint32(i * SLOT_SIZE + DATA_SIZE) !== s || dv.getUint32(i * SLOT_SIZE + DATA_SIZE + 4) !== c)
        return false;
    }
    return true;
  }

  function blockCrc(buf) {
    const block = buf.slice(BLOCK_START, BLOCK_START + BLOCK_SIZE);
    for (let i = 0; i < SLOT_COUNT; i++) {
      const o = NAMES_IN_BLOCK + i * NAME_STRIDE, keep = readName(buf, i).length + 1;
      block.fill(0, o + keep, o + NAME_STRIDE);
    }
    return crc32(block);
  }

  const crcOk = (buf) => view(buf).getUint32(buf.length - 4) === blockCrc(buf);

  // Returns a fresh Uint8Array copy; throws Error with a user-facing message if invalid.
  function parseSave(arrayBuffer) {
    const buf = new Uint8Array(arrayBuffer.slice(0));
    if (buf.length < MIN_SIZE || !slotsOk(buf) || !crcOk(buf))
      throw new Error("This doesn't look like a valid Wind Waker HD cking.sav (size/checksum mismatch).");
    return buf;
  }

  function finalizeSave(buf) {
    for (let i = 0; i < SLOT_COUNT; i++) writeSlotChecksum(buf, i);
    view(buf).setUint32(buf.length - 4, blockCrc(buf));
    return buf;
  }

  const api = { SLOT_COUNT, MAX_NAME, readName, writeName, readLocation, nameError, isSecondQuest, setSecondQuest,
                parseSave, finalizeSave, slotsOk, crcOk };
  if (typeof module !== "undefined") module.exports = api;
  else root.WWHD = api;
})(typeof self !== "undefined" ? self : this);
