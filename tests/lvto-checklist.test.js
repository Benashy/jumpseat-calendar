const assert = require("node:assert/strict");
const test = require("node:test");
const { webcrypto } = require("node:crypto");
const core = require("../lvto-checklist-core");
const { fixture } = require("./lvto-fixture");

test("LVTO policy validates the private structure and rejects unsafe schema changes", () => {
  assert.equal(core.validatePolicy(fixture()), true);
  for (const change of [
    (p) => { p.sections[0].items[1].type = "calculation"; },
    (p) => { p.sections[0].items[1].id = "minimum"; },
    (p) => { p.sections[0].items[2].inputIds = ["minimum", "missing"]; },
    (p) => { p.sections[0].items[5].condition.equals = "maybe"; },
    (p) => { p.sections[0].items[4].options = [{ id: "yes", label: "Yes" }]; },
    (p) => { p.sections[0].items = []; },
  ]) {
    const policy = fixture();
    change(policy);
    assert.equal(core.validatePolicy(policy), false);
  }
});

test("LVTO source hash is deterministic and detects changed wording", async () => {
  const policy = fixture();
  const hash = await core.policyHash(policy, webcrypto);
  assert.equal(hash, await core.policyHash(Object.fromEntries(Object.entries(policy).reverse()), webcrypto));
  policy.sections[0].items[3].text += " changed";
  assert.notEqual(hash, await core.policyHash(policy, webcrypto));
});

test("LVTO begins blank and only deliberate interactions change state", () => {
  const policy = fixture();
  const original = core.newState("owner", "hash", "2026-09-01T08:00:00Z");
  assert.deepEqual(original.completedIds, []);
  assert.deepEqual(original.values, {});
  assert.deepEqual(original.decisions, {});
  let state = core.setChecked(policy, original, "action", true);
  state = core.setValue(policy, state, "entered", "0125");
  state = core.setDecision(policy, state, "return-decision", "no");
  assert.deepEqual(state.completedIds, ["action"]);
  assert.equal(state.values.entered, "0125");
  assert.equal(state.decisions["return-decision"], "no");
  assert.deepEqual(original.completedIds, []);
});

test("LVTO conditional branch cannot be marked before it is selected", () => {
  const policy = fixture();
  let state = core.newState("owner", "hash");
  assert.equal(core.isVisible(policy.sections[0].items[6], state), false);
  assert.equal(core.setChecked(policy, state, "alternate-action", true), state);
  state = core.setDecision(policy, state, "return-decision", "no");
  state = core.setChecked(policy, state, "alternate-action", true);
  state = core.setValue(policy, state, "alternate", "TEST");
  assert.deepEqual(state.completedIds, ["alternate-action"]);
  assert.equal(state.values.alternate, "TEST");
  state = core.setDecision(policy, state, "return-decision", "yes");
  assert.equal(core.isVisible(policy.sections[0].items[6], state), false);
  assert.deepEqual(state.completedIds, ["alternate-action"]);
  assert.equal(state.values.alternate, "TEST");
});

test("LVTO calculates the higher planning minimum only after a valid manual entry", () => {
  const policy = fixture();
  let state = core.newState("owner", "hash");
  assert.equal(core.computedValue(policy, state, "higher"), null);
  state = core.setValue(policy, state, "entered", "75");
  assert.equal(core.computedValue(policy, state, "higher"), 100);
  state = core.setValue(policy, state, "entered", "125");
  assert.equal(core.computedValue(policy, state, "higher"), 125);
  state = core.setValue(policy, state, "entered", "not-a-number");
  assert.equal(core.computedValue(policy, state, "higher"), null);
});

test("LVTO section choices preserve ticks and do not reduce the applicable count", () => {
  const policy = fixture();
  let state = core.newState("owner", "hash");
  assert.deepEqual(core.progress(policy, state), { checked: 0, total: 1, hiddenSections: 0 });
  state = core.setChecked(policy, state, "action", true);
  state = core.setSectionVisible(policy, state, "planning", false);
  assert.deepEqual(core.progress(policy, state), { checked: 1, total: 1, hiddenSections: 1 });
  assert.equal(core.setChecked(policy, state, "action", false), state);
  state = core.setSectionVisible(policy, state, "planning", true);
  state = core.setDecision(policy, state, "return-decision", "no");
  assert.deepEqual(core.progress(policy, state), { checked: 1, total: 2, hiddenSections: 0 });
});

test("LVTO restore rejects other owners and revisions while preserving valid private progress", () => {
  const policy = fixture();
  let state = core.newState("owner", "hash");
  state = core.setChecked(policy, state, "action", true);
  state = core.setValue(policy, state, "entered", "123456");
  state = core.setDecision(policy, state, "return-decision", "no");
  const restored = core.restoreState(policy, "owner", "hash", state);
  assert.deepEqual(restored.completedIds, ["action"]);
  assert.deepEqual(restored.hiddenSectionIds, []);
  assert.equal(restored.values.entered, "1234");
  assert.equal(restored.decisions["return-decision"], "no");
  assert.deepEqual(core.restoreState(policy, "other", "hash", state).completedIds, []);
  assert.deepEqual(core.restoreState(policy, "owner", "new-hash", state).values, {});
});

test("LVTO restores older saved progress that predates section choices", () => {
  const policy = fixture();
  const stored = core.newState("owner", "hash");
  delete stored.hiddenSectionIds;
  stored.completedIds = ["action"];
  const restored = core.restoreState(policy, "owner", "hash", stored);
  assert.deepEqual(restored.completedIds, ["action"]);
  assert.deepEqual(restored.hiddenSectionIds, []);
});

test("LVTO clear ticks keeps manual planning values and decision", () => {
  const policy = fixture();
  let state = core.newState("owner", "hash");
  state = core.setChecked(policy, state, "action", true);
  state = core.setValue(policy, state, "entered", "125");
  state = core.setDecision(policy, state, "return-decision", "yes");
  state = core.clearChecks(state);
  assert.deepEqual(state.completedIds, []);
  assert.equal(state.values.entered, "125");
  assert.equal(state.decisions["return-decision"], "yes");
  assert.equal(core.hasProgress(state), true);
});

test("LVTO storage is owner-scoped and updated labels use Zulu", () => {
  const storage = { getItem: () => '{"userId":"other"}' };
  assert.equal(core.readSaved(storage, "progress", "owner"), null);
  storage.getItem = () => "invalid";
  assert.equal(core.readSaved(storage, "policy", "owner"), null);
  assert.notEqual(core.storageKey("policy", "owner"), core.storageKey("policy", "other"));
  assert.equal(core.updatedLabel("2026-09-01T01:20:00+03:00"), "Updated 31 August at 22:20Z");
});
