const assert = require("node:assert/strict");
const test = require("node:test");
const { webcrypto } = require("node:crypto");
const core = require("../gps-checklist-core");

// Synthetic procedure text only. The real source stays outside this repository.
function fixture() {
  return {
    schemaVersion: 1, id: "test-checklist", title: "Test checklist", revision: "Test revision",
    introduction: [{ id: "intro", type: "note", text: "Test introduction" }],
    sections: [
      { id: "fixed", title: "Fixed section", canHide: false, blocks: [
        { id: "step-a", type: "action", text: "Step A" },
        { id: "branch-a", type: "action", text: "Choice A", exclusiveGroup: "choice" },
        { id: "branch-b", type: "action", text: "Choice B", exclusiveGroup: "choice" },
        { id: "note-a", type: "note", text: "Context, not an action" },
      ] },
      { id: "optional-a", title: "Optional A", canHide: true, visibilityGroup: "linked", blocks: [
        { id: "step-b", type: "action", text: "Step B" },
      ] },
      { id: "optional-b", title: "Optional B", canHide: true, visibilityGroup: "linked", blocks: [
        { id: "step-c", type: "action", text: "Step C" },
      ] },
    ],
    sources: [{ document: "Test document", section: "Test section", revision: "Test revision", pages: "1" }],
  };
}

test("GPS policy validates structure and rejects duplicate IDs, missing sources and invalid types", () => {
  assert.equal(core.validatePolicy(fixture()), true);
  for (const change of [
    (p) => { p.sources = []; },
    (p) => { p.sections[0].blocks[1].id = "step-a"; },
    (p) => { p.sections[0].blocks[0].type = "html"; },
    (p) => { p.sections[0].canHide = "yes"; },
    (p) => { p.sections[0].blocks = []; },
  ]) {
    const p = fixture(); change(p); assert.equal(core.validatePolicy(p), false);
  }
});

test("GPS source hash is key-order independent and detects a wording change", async () => {
  const p = fixture();
  const hash = await core.policyHash(p, webcrypto);
  assert.equal(hash, await core.policyHash(Object.fromEntries(Object.entries(p).reverse()), webcrypto));
  p.sections[0].blocks[0].text += " changed";
  assert.notEqual(hash, await core.policyHash(p, webcrypto));
});

test("GPS starts with every section visible and no completed actions", () => {
  const state = core.newState("one", "hash");
  assert.deepEqual(core.progress(fixture(), state), { checked: 0, total: 5, hiddenSections: 0 });
});

test("GPS ticks are deliberate and reversible, context cannot be ticked", () => {
  const p = fixture(); const original = core.newState("one", "hash");
  const checked = core.setChecked(p, original, "step-a", true);
  assert.deepEqual(checked.completedIds, ["step-a"]);
  assert.deepEqual(original.completedIds, []);
  assert.deepEqual(core.setChecked(p, checked, "step-a", false).completedIds, []);
  assert.equal(core.setChecked(p, original, "note-a", true), original);
});

test("GPS incompatible branch acknowledgements cannot both remain ticked", () => {
  const p = fixture(); let state = core.newState("one", "hash");
  state = core.setChecked(p, state, "branch-a", true);
  state = core.setChecked(p, state, "branch-b", true);
  assert.deepEqual(state.completedIds, ["branch-b"]);
  const corrupt = { ...state, completedIds: ["branch-a", "branch-b"] };
  assert.deepEqual(core.restoreState(p, "one", "hash", corrupt).completedIds, []);
});

test("GPS linked sections hide together without counting hidden checks as complete", () => {
  const p = fixture(); let state = core.setChecked(p, core.newState("one", "hash"), "step-b", true);
  state = core.setSectionVisible(p, state, "optional-a", false);
  assert.deepEqual(state.hiddenSectionIds, ["optional-a", "optional-b"]);
  assert.deepEqual(core.progress(p, state), { checked: 0, total: 3, hiddenSections: 2 });
  assert.equal(core.setChecked(p, state, "step-c", true), state);
  state = core.setSectionVisible(p, state, "optional-b", true);
  assert.deepEqual(state.completedIds, ["step-b"]);
  assert.equal(core.progress(p, state).checked, 1);
});

test("GPS required sections cannot be omitted and partial linked groups restore visibly", () => {
  const p = fixture(); const state = core.newState("one", "hash");
  assert.equal(core.setSectionVisible(p, state, "fixed", false), state);
  const stored = { ...state, hiddenSectionIds: ["fixed", "optional-a", "unknown"] };
  assert.deepEqual(core.restoreState(p, "one", "hash", stored).hiddenSectionIds, []);
});

test("GPS owner and source revision changes clear old progress", () => {
  const p = fixture(); const stored = core.setChecked(p, core.newState("one", "hash"), "step-a", true);
  assert.deepEqual(core.restoreState(p, "two", "hash", stored).completedIds, []);
  assert.deepEqual(core.restoreState(p, "one", "new-hash", stored).completedIds, []);
  assert.deepEqual(core.restoreState(p, "one", "hash", stored).completedIds, ["step-a"]);
});

test("GPS malformed or cross-account storage is rejected", () => {
  const storage = { getItem: () => '{"userId":"two"}' };
  assert.equal(core.readSaved(storage, "progress", "one"), null);
  storage.getItem = () => "invalid";
  assert.equal(core.readSaved(storage, "progress", "one"), null);
  storage.getItem = () => { throw new Error("Blocked"); };
  assert.equal(core.readSaved(storage, "policy", "one"), null);
  assert.notEqual(core.storageKey("policy", "one"), core.storageKey("policy", "two"));
});

module.exports = { fixture };
