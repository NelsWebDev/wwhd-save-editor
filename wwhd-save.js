// Wind Waker HD cking.sav logic (port of wwhd_save.py). Works in browsers and Node.
(function (root) {
  const SLOT_SIZE = 0xa94, DATA_SIZE = 0xa8c, SLOT_COUNT = 3, CLEAR_COUNT = 0x19b;
  const NAME_TABLE = 0x2034, NAME_STRIDE = 0x12, NAME_UNITS = 9, MAX_NAME = NAME_UNITS - 1;
  const BLOCK_START = 0x1fbc, BLOCK_SIZE = 0x342, NAMES_IN_BLOCK = NAME_TABLE - BLOCK_START;
  const MIN_SIZE = NAME_TABLE + NAME_STRIDE * SLOT_COUNT;
  const HEALTH = 0, RUPEES = 4, WALLET = 0x12, MAX_MAGIC = 0x13, MAGIC = 0x14;
  const ARROWS = 0x69, BOMBS = 0x6a, MAX_ARROWS = 0x6f, MAX_BOMBS = 0x70;
  const MAP_COMPLETE = 0xef, MAP_ISLANDS = 0xff;
  const MAX_HEARTS = 20, MAX_RUPEES = [500, 1000, 5000];
  const SEA_ISLANDS = ["Forsaken Fortress", "Star Island", "Northern Fairy Island", "Gale Isle", "Crescent Moon Island",
    "Seven-Star Isles", "Overlook Island", "Four-Eye Reef", "Mother & Child Isles", "Spectacle Island",
    "Windfall Island", "Pawprint Isle", "Dragon Roost Island", "Flight Control Platform", "Western Fairy Island",
    "Rock Spire Isle", "Tingle Island", "Northern Triangle Island", "Eastern Fairy Island", "Fire Mountain",
    "Star Belt Archipelago", "Three-Eye Reef", "Greatfish Isle", "Cyclops Reef", "Six-Eye Reef", "Tower of the Gods",
    "Eastern Triangle Island", "Thorned Fairy Island", "Needle Rock Isle", "Islet of Steel", "Stone Watcher Island",
    "Southern Triangle Island", "Private Oasis", "Bomb Island", "Bird's Peak Rock", "Diamond Steppe Island",
    "Five-Eye Reef", "Shark Island", "Southern Fairy Island", "Ice Ring Isle", "Forest Haven", "Cliff Plateau Isles",
    "Horseshoe Island", "Outset Island", "Headstone Island", "Two-Eye Reef", "Angular Isles", "Boating Course",
    "Five-Star Isles"];

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
    if (stage === "sea" && room >= 1 && room <= SEA_ISLANDS.length) return SEA_ISLANDS[room - 1];
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

  function readStats(buf, slot) {
    const o = slot * SLOT_SIZE, dv = view(buf);
    return {
      currentHearts: dv.getUint16(o + HEALTH + 2) / 4,
      maxHearts: dv.getUint16(o + HEALTH) / 4,
      rupees: dv.getUint16(o + RUPEES),
      wallet: buf[o + WALLET],
      magic: buf[o + MAGIC],
      maxMagic: buf[o + MAX_MAGIC],
      arrows: buf[o + ARROWS],
      bombs: buf[o + BOMBS],
      maxArrows: buf[o + MAX_ARROWS],
      maxBombs: buf[o + MAX_BOMBS]
    };
  }

  function setHealth(buf, slot, currentHearts, maxHearts) {
    const current = Number(currentHearts), max = Number(maxHearts);
    if (!Number.isFinite(max) || max < 0 || max > MAX_HEARTS ||
        Math.abs(max * 4 - Math.round(max * 4)) > 1e-8)
      throw new Error(`Maximum health must be 0-${MAX_HEARTS} hearts in quarter-heart steps.`);
    if (!Number.isFinite(current) || current < 0 || current > max)
      throw new Error(`Current health must be between 0 and maximum hearts (${max}).`);
    if (Math.abs(current * 4 - Math.round(current * 4)) > 1e-8)
      throw new Error("Current health must use quarter-heart steps (0.25, 0.5, or 0.75).");
    const dv = view(buf), o = slot * SLOT_SIZE;
    dv.setUint16(o + HEALTH, Math.round(max * 4));
    dv.setUint16(o + HEALTH + 2, Math.round(current * 4));
  }

  function setWallet(buf, slot, wallet, rupees) {
    const tier = Number(wallet), amount = Number(rupees);
    if (!Number.isInteger(tier) || tier < 0 || tier >= MAX_RUPEES.length)
      throw new Error("Wallet tier must be 0, 1, or 2.");
    if (!Number.isInteger(amount) || amount < 0 || amount > MAX_RUPEES[tier])
      throw new Error(`Rupees must be between 0 and ${MAX_RUPEES[tier]} for this wallet.`);
    const o = slot * SLOT_SIZE;
    buf[o + WALLET] = tier;
    view(buf).setUint16(o + RUPEES, amount);
  }

  function setMagic(buf, slot, magic, maxMagic) {
    const current = Number(magic), max = Number(maxMagic);
    if (!Number.isInteger(current) || !Number.isInteger(max) || current < 0 || current > max || max > 32)
      throw new Error("Magic values must be whole numbers from 0 to 32, with current magic no greater than maximum.");
    const o = slot * SLOT_SIZE;
    buf[o + MAX_MAGIC] = max;
    buf[o + MAGIC] = current;
  }

  function setAmmo(buf, slot, arrows, maxArrows, bombs, maxBombs) {
    const values = [arrows, maxArrows, bombs, maxBombs].map(Number);
    if (values.some((value) => !Number.isInteger(value) || value < 0 || value > 99) ||
        values[0] > values[1] || values[2] > values[3])
      throw new Error("Arrow and bomb counts must be whole numbers from 0 to 99 and cannot exceed capacity.");
    const o = slot * SLOT_SIZE;
    buf[o + ARROWS] = values[0];
    buf[o + MAX_ARROWS] = values[1];
    buf[o + BOMBS] = values[2];
    buf[o + MAX_BOMBS] = values[3];
  }

  function assertIsland(island) {
    if (!Number.isInteger(island) || island < 0 || island >= SEA_ISLANDS.length)
      throw new Error("Unknown sea island.");
  }

  function isIslandVisited(buf, slot, island) {
    assertIsland(island);
    return (buf[slot * SLOT_SIZE + MAP_ISLANDS + island] & 1) !== 0;
  }

  function setIslandVisited(buf, slot, island, enabled) {
    assertIsland(island);
    const o = slot * SLOT_SIZE + MAP_ISLANDS + island;
    buf[o] = enabled ? buf[o] | 1 : buf[o] & 0xfe;
  }

  function isIslandCharted(buf, slot, island) {
    assertIsland(island);
    const wordOffset = MAP_COMPLETE + (island >>> 5) * 4;
    const word = view(buf).getUint32(slot * SLOT_SIZE + wordOffset);
    return (word & (1 << (island & 31))) !== 0;
  }

  function setIslandCharted(buf, slot, island, enabled) {
    assertIsland(island);
    const wordOffset = MAP_COMPLETE + (island >>> 5) * 4;
    const dv = view(buf), o = slot * SLOT_SIZE + wordOffset, mask = 1 << (island & 31);
    const word = dv.getUint32(o);
    dv.setUint32(o, enabled ? word | mask : word & ~mask);
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

  const api = { SLOT_COUNT, MAX_NAME, MAX_HEARTS, MAX_RUPEES, SEA_ISLANDS, readName, writeName, readLocation, nameError,
                isSecondQuest, setSecondQuest, readStats, setHealth, setWallet, setMagic, setAmmo,
                isIslandVisited, setIslandVisited, isIslandCharted, setIslandCharted,
                parseSave, finalizeSave, slotsOk, crcOk };
  if (typeof module !== "undefined") module.exports = api;
  else root.WWHD = api;
})(typeof self !== "undefined" ? self : this);
