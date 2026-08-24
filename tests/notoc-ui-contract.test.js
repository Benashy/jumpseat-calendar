const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "notoc-ui.js"), "utf8");
const core = fs.readFileSync(path.join(root, "notoc-core.js"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const raUi = fs.readFileSync(path.join(root, "radio-altimeter-ui.js"), "utf8");

test("the NOTOC interface does not expose internal evidence controls or unknown answer buttons", () => {
  const visibleInterface = `${index}\n${ui}`;

  assert.doesNotMatch(visibleInterface, /Why and source/i);
  assert.doesNotMatch(visibleInterface, /Unknown or unclear/i);
  assert.doesNotMatch(index, /Captain's cross-check/i);
  assert.doesNotMatch(index, /emaWizardUnknownButton/);
});

test("the mobility-aid NOTOC question checks observable content rather than an exact code", () => {
  assert.match(ui, /Does the NOTOC show/);
  assert.match(ui, /expectedMobilityNotoc/);
  assert.doesNotMatch(ui, /Does the NOTOC show.*expected code/);
});

test("the mobility-aid flow separates operating and spare batteries without repeating ground acceptance", () => {
  assert.match(ui, /Where is the operating battery/);
  assert.match(ui, /Are any separate spare lithium batteries carried/);
  assert.match(ui, /Are any separate spare batteries carried/);
  assert.doesNotMatch(ui, /secure attachment|short-circuit protection|leakproof packaging|handlingConfirmed/i);
  assert.match(ui, /Does the current loadsheet show NOTOC: YES/);
});

test("the opening question distinguishes a travelling passenger's mobility aid", () => {
  assert.match(ui, /passenger with reduced mobility travelling on this flight/);
});

test("the mobility-aid stop branch is distinct from a prohibition or generic confirmation", () => {
  assert.match(core, /STOP_THIS_CHECK/);
  assert.match(core, /Use a different acceptance route/);
  assert.match(ui, /Stop this check/);
});

test("touch devices do not receive a sticky hover fill on fresh mobility answers", () => {
  assert.match(styles, /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*\.ema-choice-button:hover/);
  assert.doesNotMatch(styles, /\.ema-choice-button:hover\s*\{[^}]*background:/);
});

test("the code lookup exposes a verified browser and hides normal success status visually", () => {
  assert.match(index, /Verified Codes/);
  assert.match(ui, /listVerifiedHandlingCodes/);
  assert.match(app, /\["ready", "saved", "loading"\]\.includes\(state\)/);
  assert.doesNotMatch(index, /BA guidance ready/);
});

test("the RA interface uses concise DME references and a visible threshold marker", () => {
  assert.doesNotMatch(index, /Development model/);
  assert.match(index, /<option value="BEFORE_THRESHOLD">Before threshold<\/option>/);
  assert.match(index, /<option value="BEYOND_THRESHOLD">Beyond threshold<\/option>/);
  assert.match(index, /ra-threshold-label[^>]*>THR<\/text>/);
  assert.doesNotMatch(raUi, /before the threshold on final/);
  assert.match(raUi, /is-offset-reference/);
  assert.match(raUi, /Temperature correction is less than/);
  assert.doesNotMatch(raUi, /Difference below/);
  assert.ok(index.indexOf('value="BEFORE_THRESHOLD"') < index.indexOf('value="THRESHOLD"'));
  assert.ok(index.indexOf('value="THRESHOLD"') < index.indexOf('value="BEYOND_THRESHOLD"'));
});
