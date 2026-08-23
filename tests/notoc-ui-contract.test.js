const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const ui = fs.readFileSync(path.join(root, "notoc-ui.js"), "utf8");

test("the NOTOC interface does not expose internal evidence controls or unknown answer buttons", () => {
  const visibleInterface = `${index}\n${ui}`;

  assert.doesNotMatch(visibleInterface, /Why and source/i);
  assert.doesNotMatch(visibleInterface, /Unknown or unclear/i);
  assert.doesNotMatch(index, /Captain's cross-check/i);
  assert.doesNotMatch(index, /emaWizardUnknownButton/);
});

test("the mobility-aid NOTOC question checks observable content rather than an exact code", () => {
  assert.match(ui, /Does the NOTOC identify/);
  assert.match(ui, /correct stowage location/);
  assert.doesNotMatch(ui, /Does the NOTOC show.*expected code/);
});

test("the opening question distinguishes a travelling passenger's mobility aid", () => {
  assert.match(ui, /passenger with reduced mobility travelling on this flight/);
});
