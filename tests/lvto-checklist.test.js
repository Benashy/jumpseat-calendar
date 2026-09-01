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
    (p) => { p.sections[0].items[4].condition.equals = "maybe"; },
    (p) => { p.sections[0].items[3].options = [{ id: "yes", label: "Yes" }]; },
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
  policy.sections[0].items[2].text += " changed";
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
  assert.equal(core.isVisible(policy.sections[0].items[5], state), false);
  assert.equal(core.setChecked(policy, state, "alternate-action", true), state);
  state = core.setDecision(policy, state, "return-decision", "no");
  state = core.setChecked(policy, state, "alternate-action", true);
  state = core.setValue(policy, state, "alternate", "TEST");
  assert.deepEqual(state.completedIds, ["alternate-action"]);
  assert.equal(state.values.alternate, "TEST");
  state = core.setDecision(policy, state, "return-decision", "yes");
  assert.equal(core.isVisible(policy.sections[0].items[5], state), false);
  assert.deepEqual(state.completedIds, ["alternate-action"]);
  assert.equal(state.values.alternate, "TEST");
});

test("LVTO restore rejects other owners and revisions while preserving valid private progress", () => {
  const policy = fixture();
  let state = core.newState("owner", "hash");
  state = core.setChecked(policy, state, "action", true);
  state = core.setValue(policy, state, "entered", "123456");
  state = core.setDecision(policy, state, "return-decision", "no");
  const restored = core.restoreState(policy, "owner", "hash", state);
  assert.deepEqual(restored.completedIds, ["action"]);
  assert.equal(restored.values.entered, "1234");
  assert.equal(restored.decisions["return-decision"], "no");
  assert.deepEqual(core.restoreState(policy, "other", "hash", state).completedIds, []);
  assert.deepEqual(core.restoreState(policy, "owner", "new-hash", state).values, {});
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
