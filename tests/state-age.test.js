const assert = require("node:assert/strict");
const test = require("node:test");
const gps = require("../gps-checklist-core");
const lvto = require("../lvto-checklist-core");
const ltot = require("../ltot-core");

const firstEntry = "2026-10-03T08:00:00.000Z";
const start = Date.parse(firstEntry);

for (const [name, core] of [["GPS", gps], ["LVTO", lvto]]) {
  test(`${name} expiry uses six hours since the latest change, not the checklist start`, () => {
    const state = { ...core.newState("owner", "hash", firstEntry), completedIds: ["action"] };
    assert.equal(core.isInactive(state, start + core.INACTIVITY_TIMEOUT_MS - 1), false);
    assert.equal(core.isInactive(state, start + core.INACTIVITY_TIMEOUT_MS), true);
    const later = { ...state, updatedAt: "2026-10-03T13:00:00.000Z" };
    assert.equal(core.isInactive(later, start + core.INACTIVITY_TIMEOUT_MS), false);
    assert.equal(core.isInactive(later, start + 11 * 60 * 60 * 1000), true);
  });

  test(`${name} does not expire an empty checklist or one with a future/invalid timestamp`, () => {
    const state = core.newState("owner", "hash", firstEntry);
    assert.equal(core.isInactive(state, start + core.INACTIVITY_TIMEOUT_MS), false);
    assert.equal(core.isInactive({ ...state, completedIds: ["action"] }, start - 1), false);
    assert.equal(core.isInactive({ ...state, completedIds: ["action"], updatedAt: "invalid" }), false);
    assert.equal(core.isInactive({ ...state, completedIds: ["action"] }, NaN), false);
  });
}

test("FDP data age starts with the first entry and later edits do not restart it", () => {
  const age = ltot.beginDataAge(null, firstEntry);
  assert.deepEqual(age, { firstEntryAt: firstEntry, warningDismissed: false });
  assert.deepEqual(ltot.beginDataAge(age, "2026-10-03T20:00:00.000Z"), age);
  assert.equal(ltot.showDataAgeWarning(age, start + ltot.DATA_AGE_WARNING_MS - 1), false);
  assert.equal(ltot.showDataAgeWarning(age, start + ltot.DATA_AGE_WARNING_MS), true);
});

test("FDP warning dismissal persists without changing the original age", () => {
  const dismissed = { firstEntryAt: firstEntry, warningDismissed: true };
  assert.equal(ltot.showDataAgeWarning(dismissed, start + 24 * 60 * 60 * 1000), false);
  assert.deepEqual(ltot.beginDataAge(dismissed), dismissed);
  const reset = ltot.normaliseDataAge(null);
  assert.deepEqual(reset, { firstEntryAt: null, warningDismissed: false });
  assert.equal(ltot.showDataAgeWarning(reset, start + ltot.DATA_AGE_WARNING_MS), false);
});

test("FDP age tolerates older saves and rejects malformed or future age values", () => {
  for (const value of [undefined, {}, { firstEntryAt: "invalid", warningDismissed: true },
    { firstEntryAt: "2026-02-30T08:00:00.000Z" }, { firstEntryAt: 2026 }]) {
    assert.deepEqual(ltot.normaliseDataAge(value), { firstEntryAt: null, warningDismissed: false });
  }
  assert.equal(ltot.showDataAgeWarning({ firstEntryAt: firstEntry }, start - 1), false);
});
