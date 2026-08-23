const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "app.js"), "utf8");
const notocUi = fs.readFileSync(path.join(root, "notoc-ui.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "styles.css"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");

test("unfinished Jumpseat work has a device draft and explicit discard protection", () => {
  assert.match(app, /JUMPSEAT_DRAFT_KEY/);
  assert.match(app, /function persistJumpseatDraft/);
  assert.match(app, /function applyJumpseatDraft/);
  assert.match(app, /Discard this unfinished Jumpseat request\?/);
  assert.match(app, /clearJumpseatDraft\(\);\s*clearForm\(\);\s*setActiveTab\("home"\)/);
});

test("Jumpseat validation is attached to fields and mobile inputs avoid Safari zoom", () => {
  for (const id of ["requestDate", "flightNumber", "routeFrom", "routeTo", "departureTime"]) {
    assert.match(index, new RegExp(`id="${id}"[^>]+aria-describedby="${id}Error"[^>]+aria-invalid="false"`));
    assert.match(index, new RegExp(`id="${id}Error"`));
  }
  assert.match(styles, /#requestForm input:not\(\[type="checkbox"\]\),\s*#requestForm textarea\s*\{\s*font-size: 16px;/);
  assert.match(styles, /\.day-summary \.day-add-button span\s*\{\s*color: inherit;/);
});

test("FDP workflow routes and the mobile result return are present", () => {
  assert.match(index, /data-fdp-route-target="fdpTableTwoSection"/);
  assert.match(index, /data-fdp-route-target="fdpTableOneSection"/);
  assert.match(index, /id="ftlMobileResultStrip"/);
  assert.match(app, /function openFdpWorkflowSection/);
  assert.match(app, /function updateMobileFtlResults/);
  assert.match(styles, /scroll-margin-top: 128px;/);
  assert.match(styles, /\.fdp-reference-content h3\[tabindex="-1"\]:focus\s*\{\s*outline: none;/);
});

test("NOTOC uses one contextual Back control and hides an empty Clear session action", () => {
  assert.doesNotMatch(index, /notoc-back-button/);
  assert.match(index, /class="text-button secondary hidden" id="clearNotocSessionButton"/);
  assert.match(notocUi, /opsdeck:notoc-back-to-tools/);
  assert.match(notocUi, /function updateSessionControls/);
});

test("the pinned Supabase browser client is available in the offline shell", () => {
  const vendorPath = path.join(root, "vendor", "supabase-2.112.3.min.js");
  assert.ok(fs.statSync(vendorPath).size > 100_000);
  assert.match(index, /\.\/vendor\/supabase-2\.112\.3\.min\.js/);
  assert.match(serviceWorker, /\.\/vendor\/supabase-2\.112\.3\.min\.js/);
  assert.doesNotMatch(index, /cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js/);
});

test("mobile navigation remains available and RA answers precede the diagram in a single column", () => {
  assert.match(styles, /\.tool-menu\s*\{[\s\S]*?position: sticky;[\s\S]*?top: 0;/);
  assert.match(styles, /@media \(max-width: 880px\)[\s\S]*?\.ra-result-grid\s*\{\s*order: 1;[\s\S]*?\.ra-geometry-card\s*\{\s*order: 2;/);
});
