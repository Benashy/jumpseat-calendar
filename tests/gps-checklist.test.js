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
        { id: "note-a", type: "note", text: "Context, not an action", forBlockId: "step-a" },
      ] },
      { id: "optional-a", title: "Optional A", phaseLabel: "Next phase", canHide: true, visibilityGroup: "linked", blocks: [
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
    (p) => { p.sections[0].blocks[3].forBlockId = "missing-step"; },
    (p) => { p.sections[0].blocks[3].presentation = "alert"; },
    (p) => { p.sections[1].phaseLabel = ""; },
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
  assert.deepEqual(state.notApplicableIds, []);
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

test("GPS not-applicable items are distinct from completed and can be restored", () => {
  const p = fixture();
  let state = core.setChecked(p, core.newState("one", "hash"), "step-a", true);
  state = core.setNotApplicable(p, state, "step-a", true, "2026-09-04T09:00:00Z");
  assert.deepEqual(state.completedIds, []);
  assert.deepEqual(state.notApplicableIds, ["step-a"]);
  assert.equal(state.updatedAt, "2026-09-04T09:00:00Z");
  assert.deepEqual(core.progress(p, state), { checked: 0, total: 4, hiddenSections: 0 });
  state = core.setNotApplicable(p, state, "step-a", false);
  assert.deepEqual(state.notApplicableIds, []);
  state = core.setChecked(p, state, "step-a", true);
  assert.deepEqual(state.completedIds, ["step-a"]);
});

test("GPS restore accepts legacy progress and resolves completed versus not-applicable overlap", () => {
  const p = fixture();
  const legacy = { ...core.newState("one", "hash"), completedIds: ["step-a"] };
  delete legacy.notApplicableIds;
  assert.deepEqual(core.restoreState(p, "one", "hash", legacy).notApplicableIds, []);
  const overlap = { ...legacy, completedIds: ["step-a", "step-b"], notApplicableIds: ["step-a", "unknown"] };
  const restored = core.restoreState(p, "one", "hash", overlap);
  assert.deepEqual(restored.completedIds, ["step-b"]);
  assert.deepEqual(restored.notApplicableIds, ["step-a"]);
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

test("GPS every section can be hidden, while partial linked groups restore visibly", () => {
  const p = fixture(); const state = core.newState("one", "hash");
  assert.deepEqual(core.setSectionVisible(p, state, "fixed", false).hiddenSectionIds, ["fixed"]);
  const stored = { ...state, hiddenSectionIds: ["fixed", "optional-a", "unknown"] };
  assert.deepEqual(core.restoreState(p, "one", "hash", stored).hiddenSectionIds, ["fixed"]);
});

test("GPS hidden alerts use amber only for the three nominated sections", () => {
  for (const id of ["preliminary-cockpit", "cockpit-preparation", "unexpected-interference"]) {
    assert.equal(core.hiddenSeverity(id), "amber");
  }
  for (const id of ["before-area", "within-area", "top-of-descent", "arrival-precautions",
    "every-approach", "after-area", "after-landing", "future-section"]) {
    assert.equal(core.hiddenSeverity(id), "red");
  }
});

test("GPS aggregate alert counts actual hidden sections and gives red precedence", () => {
  const p = fixture(); p.sections[0].id = "unexpected-interference";
  let state = core.newState("one", "hash");
  assert.deepEqual(core.hiddenStatus(p, state), { count: 0, severity: null });
  state = core.setSectionVisible(p, state, "unexpected-interference", false);
  assert.deepEqual(core.hiddenStatus(p, state), { count: 1, severity: "amber" });
  state = core.setSectionVisible(p, state, "optional-a", false);
  assert.deepEqual(core.hiddenStatus(p, state), { count: 3, severity: "red" });
  state = core.setSectionVisible(p, state, "optional-b", true);
  assert.deepEqual(core.hiddenStatus(p, state), { count: 1, severity: "amber" });
  state.hiddenSectionIds.push("unexpected-interference", "unknown");
  assert.deepEqual(core.hiddenStatus(p, state), { count: 1, severity: "amber" });
});

test("GPS visibility changes do not alter source content or lose existing ticks", async () => {
  const p = fixture(); const before = await core.policyHash(p, webcrypto);
  let state = core.setChecked(p, core.newState("one", before), "step-a", true);
  for (const section of p.sections) state = core.setSectionVisible(p, state, section.id, false);
  const restored = core.restoreState(p, "one", before, state);
  assert.equal(restored.hiddenSectionIds.length, p.sections.length);
  assert.deepEqual(restored.completedIds, ["step-a"]);
  assert.equal(await core.policyHash(p, webcrypto), before);
});

test("GPS updated label uses the recorded time in Zulu, including midnight and date rollover", () => {
  assert.equal(core.updatedLabel("2026-08-31T16:20:00Z"), "Updated 31 August at 16:20Z");
  assert.equal(core.updatedLabel("2026-09-01T01:20:00+03:00"), "Updated 31 August at 22:20Z");
  assert.equal(core.updatedLabel("2026-09-01T00:00:00Z"), "Updated 1 September at 00:00Z");
  assert.equal(core.updatedLabel("invalid"), "");
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
