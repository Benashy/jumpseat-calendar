const test = require("node:test");
const assert = require("node:assert/strict");
const { webcrypto } = require("node:crypto");
const cold = require("../cold-checklist-core");
const gps = require("../gps-checklist-core");
const { fixture } = require("./cold-fixture");

test("Cold-weather policy requires explicit references for every action", () => {
  assert.equal(cold.validatePolicy(fixture()), true);
  for (const mutate of [p => { delete p.sections[0].blocks[0].references; },
    p => { p.sections[0].blocks[0].references = []; },
    p => { p.sections[0].blocks[0].references = [null]; },
    p => { delete p.sections[0].blocks[0].referenceLabel; },
    p => { p.id = "another-tool"; }]) {
    const policy = fixture(); mutate(policy); assert.equal(cold.validatePolicy(policy), false);
  }
});

test("Cold-weather references and their labels are bound to the checklist digest", async () => {
  const policy = fixture(); const before = await cold.policyHash(policy, webcrypto);
  policy.sections[0].blocks[0].references[0] = "Changed locator";
  assert.notEqual(await cold.policyHash(policy, webcrypto), before);
  policy.sections[0].blocks[0].referenceLabel = "Changed label";
  assert.notEqual(await cold.policyHash(policy, webcrypto), before);
});

test("Cold-weather storage is separate from GPS and refuses another owner's cache", () => {
  assert.notEqual(cold.storageKey("policy", "one"), gps.storageKey("policy", "one"));
  const store = new Map([[cold.storageKey("policy", "one"), JSON.stringify({ userId: "two" })]]);
  assert.equal(cold.readSaved({getItem:key=>store.get(key)}, "policy", "one"), null);
});

test("Cold-weather state supports N/A, hidden warnings and six-hour expiry without affecting GPS", () => {
  const policy = fixture(); const first = cold.newState("one", "hash", "2026-10-20T00:00:00Z");
  let state = cold.setChecked(policy, first, "first", true, first.updatedAt);
  state = cold.setNotApplicable(policy, state, "second", true, first.updatedAt);
  state = cold.setSectionVisible(policy, state, "preparation", false, first.updatedAt);
  assert.deepEqual(cold.hiddenStatus(policy, state), {count:1,severity:"red"});
  assert.equal(cold.isInactive(state, Date.parse(first.updatedAt) + cold.INACTIVITY_TIMEOUT_MS), true);
  assert.deepEqual(first.completedIds, []);
  const fresh = cold.restoreState(policy, "one", "changed-wording", state);
  assert.deepEqual(fresh.completedIds, []);
  assert.deepEqual(fresh.notApplicableIds, []);
  assert.deepEqual(fresh.hiddenSectionIds, []);
});
