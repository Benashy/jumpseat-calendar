const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ltot = require("../ltot-core.js");

const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");
const functionNames = [
  "createDefaultCrewLimitRecord", "createDefaultCalculatorState", "sanitizeStoredText",
  "sanitizeStoredTime", "sanitizeStoredNumber", "sanitizeStoredDuration", "sanitizeStoredCrewLimits",
  "sanitizeCalculatorState", "isIsoDate", "crewCategoryLabel", "isSharedCrewLimitMode",
  "crewLimitName", "crewLimitIsNamed", "crewLimitRoleLabel", "crewLimitDisplayLabel",
  "crewLimitTargetLabel", "crewLimitStatusLabel", "controllingCrewSourceLabel",
  "canAddIndividualCrewLimit", "addIndividualCrewLimit", "removeIndividualCrewLimit",
  "setFdpReferenceTarget", "setMaximumFdpFromReference", "currentMaximumFdpTableValue",
  "durationStringToParts", "durationStringToMinutes", "hasDurationValue", "hasPartialDurationValue",
  "getDurationMinutes", "buildCrewFtlInput", "serializeCalculatorState", "renderFtlCrewMode",
  "updateCrewComparison", "crewResultTime",
];

function appFunction(name) {
  const match = app.match(new RegExp(`^function ${name}\\([^]*?^}`, "m"));
  assert.ok(match, `Missing app function ${name}`);
  return match[0];
}

function element() {
  const classes = new Set();
  return {
    children: [], dataset: {}, attributes: {}, textContent: "",
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      add(name) { classes.add(name); },
      contains: (name) => classes.has(name),
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    getBoundingClientRect: () => ({ top: 100 }),
  };
}

function harness() {
  let nextId = 0;
  const context = {
    crewLimitRecords: [], ftlCrewControls: {}, activeFtlCrew: "flight", activeFdpTargetId: "flight",
    cabinCrewEnabled: true, ftlAnchorDate: "2026-08-31", fdpReferenceStatusTimer: 0,
    createId: () => `test-${++nextId}`,
    window: { requestAnimationFrame() {}, clearTimeout() {}, scrollBy() {}, confirm: () => true },
    document: { activeElement: null, createElement: () => element() },
    elements: Object.fromEntries([
      "crewTabsRow", "addCabinCrewButton", "flightCrewTab", "cabinCrewTab", "flightCrewInputs",
      "cabinCrewInputs", "addIndividualCrewButton", "fdpTargetBanner", "fdpReferenceStatus",
      "crewResults", "crewResultRows", "crewComparisonStatus",
    ].map((key) => [key, element()])),
    ftlDurationControls: {
      taxiOut: { minutes: { value: "15" } }, flightTime: { hours: { value: "1" }, minutes: { value: "0" } },
      holding: { minutes: { value: "15" } }, taxiIn: { minutes: { value: "15" } }, contingency: { minutes: { value: "0" } },
    },
    calculateFtl() {}, updateFdpTargetBanner() {}, updateFdpReferenceSelection() {},
    updateDurationIncompleteState() {}, showFdpReferenceStatus() {},
    crewLimitHasData: () => true,
    formatDurationWithZeroMinutes: (minutes) => `${Math.floor(minutes / 60)} hr ${minutes % 60} min`,
    formatZuluTime: ltot.formatZuluTime,
    setDurationControl(control, hours, minutes) { control.hours.value = String(hours); control.minutes.value = String(minutes); },
  };
  const constants = ["CALCULATOR_SCHEMA_VERSION", "CREW_LIMIT_CAPS", "DEFAULT_FLIGHT_CREW_NAME"]
    .map((name) => app.match(new RegExp(`^const ${name} = .+;`, "m"))[0]);
  vm.runInNewContext([...constants, ...functionNames.map(appFunction)].join("\n"), context);
  context.renderCrewLimitRecords = (records) => {
    context.crewLimitRecords = records;
    context.ftlCrewControls = Object.fromEntries(records.map((record) => [record.id, {
      ...record,
      nameInput: { value: record.name || "" }, dutyStart: { value: record.dutyStart || "" },
      maxFdp: { hours: { value: record.maximumFdp.hours }, minutes: { value: record.maximumFdp.minutes } },
      discretion: { hours: { value: record.discretion.hours }, minutes: { value: record.discretion.minutes } },
    }]));
  };
  context.hasDutyStartValue = (id) => Boolean(context.ftlCrewControls[id].dutyStart.value);
  context.getDutyStartMinutes = (id) => context.durationStringToMinutes(context.ftlCrewControls[id].dutyStart.value);
  return context;
}

function record(context, category, options = {}) {
  return { ...context.createDefaultCrewLimitRecord(category, options), dutyStart: "11:45", maximumFdp: { hours: "13", minutes: "0" } };
}

test("the shared entry is labelled All crew and only split pilots get personal labels", () => {
  const h = harness();
  const flight = record(h, "flight", { name: "Ben Ashurst" });
  h.renderCrewLimitRecords([flight]);
  assert.equal(h.controllingCrewSourceLabel(["flight"]), "All crew");
  const cabin = record(h, "cabin");
  h.renderCrewLimitRecords([flight, cabin]);
  assert.equal(h.crewLimitDisplayLabel(h.ftlCrewControls.flight), "Flight crew");
  const pilot = record(h, "flight", { baseline: false, name: "Alex Test" });
  const lead = record(h, "cabin", { baseline: false, name: "SCCM" });
  h.renderCrewLimitRecords([flight, pilot, cabin, lead]);
  assert.equal(h.crewLimitDisplayLabel(h.ftlCrewControls.flight), "Flight crew 1: Ben Ashurst");
  assert.equal(h.controllingCrewSourceLabel([pilot.id]), "Flight crew 2: Alex Test");
  assert.equal(h.controllingCrewSourceLabel([lead.id]), "Cabin crew 1: SCCM");
  assert.equal(h.controllingCrewSourceLabel([pilot.id, lead.id]), "Joint limit: Flight crew 2: Alex Test; Cabin crew 1: SCCM");
  h.removeIndividualCrewLimit(pilot.id);
  assert.equal(h.crewLimitDisplayLabel(h.ftlCrewControls.flight), "Flight crew");
  assert.equal(h.ftlCrewControls.flight.dutyStart.value, "11:45");
});

test("adding the first pilot names the original entry without copying timings to the new pilot", () => {
  const h = harness();
  h.renderCrewLimitRecords([record(h, "flight"), record(h, "cabin")]);
  h.addIndividualCrewLimit();
  assert.equal(h.ftlCrewControls.flight.nameInput.value, "Ben Ashurst");
  assert.equal(h.ftlCrewControls.flight.dutyStart.value, "11:45");
  const added = h.ftlCrewControls[h.activeFdpTargetId];
  assert.equal(added.nameInput.value, "");
  assert.equal(added.dutyStart.value, "");
  assert.equal(added.maxFdp.hours.value, "");
  assert.equal(added.discretion.hours.value, "");
  h.ftlCrewControls.flight.nameInput.value = "Ben";
  const saved = h.serializeCalculatorState();
  assert.equal(saved.crewLimits[0].name, "Ben");
  assert.equal(h.sanitizeCalculatorState(JSON.parse(JSON.stringify(saved))).crewLimits[0].name, "Ben");
});

test("old split-pilot saves migrate once and a deliberately cleared new name stays blank", () => {
  const h = harness();
  const crewLimits = [record(h, "flight"), record(h, "flight", { baseline: false })];
  const migrated = h.sanitizeCalculatorState({ schemaVersion: 3, crewLimits });
  assert.equal(migrated.schemaVersion, 4);
  assert.equal(migrated.crewLimits[0].name, "Ben Ashurst");
  migrated.crewLimits[0].name = "";
  assert.equal(h.sanitizeCalculatorState(migrated).crewLimits[0].name, "");
});

test("caps include the original entries, disable Add and release when an individual is removed", () => {
  const h = harness();
  h.renderCrewLimitRecords([record(h, "flight"), record(h, "cabin")]);
  for (const [category, cap] of [["flight", 3], ["cabin", 6]]) {
    h.activeFtlCrew = category;
    for (let i = 1; i <= cap; i += 1) h.addIndividualCrewLimit();
    assert.equal(h.crewLimitRecords.filter((item) => item.category === category).length, cap);
    assert.equal(h.crewLimitRoleLabel(h.ftlCrewControls[h.activeFdpTargetId]), category === "flight" ? "Flight crew 3" : "Cabin crew 5");
    h.renderFtlCrewMode();
    assert.equal(h.elements.addIndividualCrewButton.disabled, true);
    h.removeIndividualCrewLimit(h.activeFdpTargetId);
    h.renderFtlCrewMode();
    assert.equal(h.elements.addIndividualCrewButton.disabled, false);
    h.addIndividualCrewLimit();
    assert.equal(h.crewLimitRecords.filter((item) => item.category === category).length, cap);
  }
});

test("loading an older over-cap save never silently removes crew data", () => {
  const h = harness();
  const records = [record(h, "flight"), record(h, "cabin")];
  for (let i = 0; i < 8; i += 1) records.push(record(h, "cabin", { baseline: false, name: `Crew ${i}` }));
  const saved = h.sanitizeCalculatorState({ schemaVersion: 3, crewLimits: records });
  assert.equal(saved.crewLimits.length, records.length);
  h.renderCrewLimitRecords(saved.crewLimits);
  assert.equal(h.canAddIndividualCrewLimit("cabin"), false);
});

test("switching table target changes no inputs, preserves table position and clears stale feedback", () => {
  const h = harness();
  const individual = record(h, "cabin", { baseline: false, name: "SCCM" });
  h.renderCrewLimitRecords([record(h, "flight"), record(h, "cabin"), individual]);
  const saved = JSON.stringify(h.serializeCalculatorState());
  h.calculateFtl = () => assert.fail("Target selection must not save or recalculate");
  let scrolled = null;
  h.window.scrollBy = (options) => { scrolled = options; };
  h.elements.fdpReferenceStatus.textContent = "Previous crew set";
  h.setFdpReferenceTarget(individual.id, true);
  assert.equal(h.activeFdpTargetId, individual.id);
  assert.equal(h.activeFtlCrew, "cabin");
  assert.equal(h.elements.fdpReferenceStatus.textContent, "");
  assert.equal(scrolled.top, 0);
  assert.equal(JSON.stringify(h.serializeCalculatorState()), saved);
  h.setFdpReferenceTarget("flight", true);
  assert.equal(h.activeFdpTargetId, "flight");
});

test("table values and deselection affect exactly the chosen group or individual", () => {
  const h = harness();
  const individual = record(h, "flight", { baseline: false, name: "Alex Test" });
  h.renderCrewLimitRecords([record(h, "flight", { name: "Ben Ashurst" }), individual, record(h, "cabin")]);
  for (const id of [individual.id, "cabin", "flight"]) {
    h.setFdpReferenceTarget(id);
    const otherValues = Object.entries(h.ftlCrewControls).filter(([key]) => key !== id).map(([, item]) => item.maxFdp.hours.value + ":" + item.maxFdp.minutes.value);
    let status = "";
    h.showFdpReferenceStatus = (message) => { status = message; };
    h.setMaximumFdpFromReference("12:30", "06:00-13:29", "3 sectors", "Table 2", "test-cell");
    assert.equal(h.currentMaximumFdpTableValue(id), "12:30");
    assert.ok(status.startsWith(`${h.crewLimitDisplayLabel(h.ftlCrewControls[id])} limit set`));
    h.setMaximumFdpFromReference("12:30", "06:00-13:29", "3 sectors", "Table 2", "test-cell");
    assert.equal(h.currentMaximumFdpTableValue(id), "");
    assert.equal(h.ftlCrewControls[id].selectedFdpReferenceKey, null);
    assert.deepEqual(Object.entries(h.ftlCrewControls).filter(([key]) => key !== id).map(([, item]) => item.maxFdp.hours.value + ":" + item.maxFdp.minutes.value), otherValues);
  }
});

test("the corrected worked example keeps the individual pilot controlling at 18:15Z", () => {
  const h = harness();
  const pilot = { ...record(h, "flight", { baseline: false, name: "Alex Test" }), dutyStart: "05:45", maximumFdp: { hours: "12", minutes: "30" } };
  const cabin = { ...record(h, "cabin"), dutyStart: "11:40" };
  h.renderCrewLimitRecords([record(h, "flight", { name: "Ben Ashurst" }), pilot, cabin]);
  const result = ltot.calculateCrewLimits({ anchorId: "flight", crewLimits: h.crewLimitRecords.map((item) => h.buildCrewFtlInput(item.id)), sectorTiming: {} });
  assert.equal(result.controllingIds[0], pilot.id);
  assert.equal(result.controllingResult.latestOnChocksMinutes, 18 * 60 + 15);
  assert.equal(h.controllingCrewSourceLabel(result.controllingIds), "Flight crew 2: Alex Test");
  h.ftlCrewControls.flight.nameInput.value = "";
  assert.equal(h.buildCrewFtlInput("flight").maximumFdpMinutes, 13 * 60);
});

test("numbering includes the first pilot but never counts the cabin group as an individual", () => {
  const h = harness();
  const pilot2 = record(h, "flight", { baseline: false });
  const pilot3 = record(h, "flight", { baseline: false });
  const cabin1 = record(h, "cabin", { baseline: false });
  const cabin2 = record(h, "cabin", { baseline: false });
  h.renderCrewLimitRecords([record(h, "flight"), pilot2, pilot3, record(h, "cabin"), cabin1, cabin2]);
  const labels = h.crewLimitRecords.map((item) => h.crewLimitDisplayLabel(h.ftlCrewControls[item.id]));
  assert.deepEqual(labels, ["Flight crew 1", "Flight crew 2", "Flight crew 3", "Cabin crew group", "Cabin crew 1", "Cabin crew 2"]);
  const restored = h.sanitizeCalculatorState(JSON.parse(JSON.stringify(h.serializeCalculatorState())));
  h.renderCrewLimitRecords(restored.crewLimits);
  assert.deepEqual(Array.from(h.crewLimitRecords, (item) => h.crewLimitDisplayLabel(h.ftlCrewControls[item.id])), labels);
  h.removeIndividualCrewLimit(cabin1.id);
  h.removeIndividualCrewLimit(cabin2.id);
  assert.equal(h.crewLimitDisplayLabel(h.ftlCrewControls.cabin), "Cabin crew");
});

test("unnamed limits calculate and identify the controller while incomplete timings still block", () => {
  const h = harness();
  const individual = { ...record(h, "cabin", { baseline: false }), dutyStart: "05:45", maximumFdp: { hours: "12", minutes: "30" } };
  h.renderCrewLimitRecords([record(h, "flight"), record(h, "cabin"), individual]);
  const compare = () => ltot.calculateCrewLimits({ anchorId: "flight", crewLimits: h.crewLimitRecords.map((item) => h.buildCrewFtlInput(item.id)), sectorTiming: {} });
  assert.equal(compare().comparisonComplete, true);
  assert.equal(compare().controllingResult.latestOnChocksMinutes, 18 * 60 + 15);
  assert.equal(h.controllingCrewSourceLabel(compare().controllingIds), "Cabin crew 1");
  h.ftlCrewControls[individual.id].discretion.hours.value = "1";
  assert.equal(compare().comparisonComplete, false);
  h.ftlCrewControls[individual.id].discretion.minutes.value = "0";
  assert.equal(compare().comparisonComplete, true);
  h.ftlCrewControls[individual.id].maxFdp.minutes.value = "";
  assert.equal(compare().comparisonComplete, false);
});

test("comparison is role-first, highlights only used discretion and omits redundant controller text", () => {
  const h = harness();
  const individual = { ...record(h, "cabin", { baseline: false, name: "Alex Test" }), dutyStart: "05:45", discretion: { hours: "1", minutes: "0" } };
  h.renderCrewLimitRecords([record(h, "flight"), record(h, "cabin"), individual]);
  const compare = () => ltot.calculateCrewLimits({ anchorId: "flight", crewLimits: h.crewLimitRecords.map((item) => h.buildCrewFtlInput(item.id)), sectorTiming: {} });
  h.updateCrewComparison(compare());
  const rows = h.elements.crewResultRows.children;
  assert.equal(rows[1].children[0].textContent, "Cabin crew group");
  assert.equal(rows[2].children[0].textContent, "Cabin crew 1");
  assert.equal(rows[2].children[0].children[0].className, "crew-result-person");
  assert.equal(rows[2].children[0].children[0].textContent, "Alex Test");
  assert.equal(rows[2].children[0].children[1].textContent, "Limiting");
  assert.equal(rows[2].children[2].children[1].classList.contains("crew-discretion-active"), true);
  assert.equal(rows[0].children[2].children[1].classList.contains("crew-discretion-active"), false);
  assert.equal(h.elements.crewComparisonStatus.textContent, "");
  assert.equal(h.elements.crewComparisonStatus.classList.contains("hidden"), true);
  h.ftlCrewControls[individual.id].nameInput.value = "";
  h.updateCrewComparison(compare());
  assert.equal(h.elements.crewResultRows.children[2].children[0].children.length, 1);
  h.ftlCrewControls[individual.id].maxFdp.hours.value = "";
  h.updateCrewComparison(compare());
  assert.equal(h.elements.crewComparisonStatus.textContent, "Complete: Cabin crew 1");
  assert.equal(h.elements.crewComparisonStatus.classList.contains("hidden"), false);
});
