const assert = require("node:assert/strict");
const test = require("node:test");
const WWHD = require("./wwhd-save.js");

function makeSave() {
  const save = new Uint8Array(0x2306);
  for (let slot = 0; slot < WWHD.SLOT_COUNT; slot++) WWHD.writeName(save, slot, "Link");
  WWHD.finalizeSave(save);
  return WWHD.parseSave(save.buffer);
}

test("round-trips health, wallet, magic, and ammunition edits with valid checksums", () => {
  const save = makeSave();
  WWHD.setHealth(save, 1, 7.75, 16);
  WWHD.setWallet(save, 1, 2, 4321);
  WWHD.setMagic(save, 1, 20, 32);
  WWHD.setAmmo(save, 1, 45, 60, 80, 99);

  const original = WWHD.readStats(save, 0);
  WWHD.finalizeSave(save);
  const parsed = WWHD.parseSave(save.buffer);

  assert.deepEqual(WWHD.readStats(parsed, 1), {
    currentHearts: 7.75,
    maxHearts: 16,
    rupees: 4321,
    wallet: 2,
    magic: 20,
    maxMagic: 32,
    arrows: 45,
    bombs: 80,
    maxArrows: 60,
    maxBombs: 99
  });
  assert.deepEqual(WWHD.readStats(parsed, 0), original);
  assert.equal(WWHD.slotsOk(parsed), true);
  assert.equal(WWHD.crcOk(parsed), true);
  assert.deepEqual(WWHD.MAX_RUPEES, [500, 1000, 5000]);
  WWHD.setWallet(parsed, 0, 0, 500);
  assert.equal(WWHD.readStats(parsed, 0).rupees, 500);
});

test("accepts maximum and current health in quarter-heart increments", () => {
  const save = makeSave();
  for (const fraction of [0.25, 0.5, 0.75]) {
    WWHD.setHealth(save, 0, 1 + fraction, 2 + fraction);
    assert.equal(WWHD.readStats(save, 0).currentHearts, 1 + fraction);
    assert.equal(WWHD.readStats(save, 0).maxHearts, 2 + fraction);
  }
  WWHD.setHealth(save, 0, 1.25, 1.25);
  assert.equal(WWHD.readStats(save, 0).currentHearts, 1.25);
  assert.equal(WWHD.readStats(save, 0).maxHearts, 1.25);
});

test("reads and changes visit and chart flags for all 49 islands", () => {
  const save = makeSave();
  assert.equal(WWHD.SEA_ISLANDS.length, 49);

  for (let island = 0; island < WWHD.SEA_ISLANDS.length; island++) {
    WWHD.setIslandVisited(save, 2, island, true);
    WWHD.setIslandCharted(save, 2, island, true);
  }
  assert.ok(WWHD.SEA_ISLANDS.every((_, island) =>
    WWHD.isIslandVisited(save, 2, island) && WWHD.isIslandCharted(save, 2, island)));

  WWHD.setIslandVisited(save, 2, 0, false);
  WWHD.setIslandCharted(save, 2, 0, false);
  assert.equal(WWHD.isIslandVisited(save, 2, 0), false);
  assert.equal(WWHD.isIslandCharted(save, 2, 0), false);
  assert.equal(WWHD.isIslandVisited(save, 2, 1), true);
  assert.equal(WWHD.isIslandCharted(save, 2, 1), true);
  WWHD.finalizeSave(save);
  assert.equal(WWHD.parseSave(save.buffer).length, save.length);
});

test("rejects inconsistent or out-of-range field edits", () => {
  const save = makeSave();
  assert.throws(() => WWHD.setHealth(save, 0, 16.25, 16), /between 0 and maximum/);
  assert.throws(() => WWHD.setHealth(save, 0, 8, 7), /between 0 and maximum/);
  assert.throws(() => WWHD.setHealth(save, 0, 0.25, 0.1), /Maximum health.*quarter-heart steps/);
  assert.throws(() => WWHD.setHealth(save, 0, 0.1, 1), /Current health.*quarter-heart steps/);
  assert.throws(() => WWHD.setWallet(save, 0, 0, 501), /Rupees/);
  assert.throws(() => WWHD.setMagic(save, 0, 17, 16), /Magic/);
  assert.throws(() => WWHD.setAmmo(save, 0, 31, 30, 0, 30), /Arrow and bomb/);
  assert.throws(() => WWHD.setIslandVisited(save, 0, 49, true), /Unknown sea island/);
});
