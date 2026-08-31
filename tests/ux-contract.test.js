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

test("FDP table selections follow the active crew tab and report the correct target", () => {
  assert.match(app, /function setActiveFtlCrew\(crewKey\)[\s\S]*?activeFdpTargetId = ftlCrewControls\[crewKey\]/);
  assert.match(app, /function crewLimitStatusLabel\(control\)[\s\S]*?return "Crew limit";/);
  assert.match(app, /return `\$\{crewLimitDisplayLabel\(control\)\} limit`;/);
  assert.match(app, /setMaximumFdpFromReference[\s\S]*?const targetId = activeFdpTargetId;/);
});

test("optional named crew limits are addable, removable, saved and compared", () => {
  assert.match(index, /id="addIndividualCrewButton"/);
  assert.match(index, /class="crew-limit-name"/);
  assert.match(index, /class="icon-button crew-limit-remove"/);
  assert.match(app, /const CALCULATOR_SCHEMA_VERSION = 5;/);
  assert.match(app, /baseline: record\.baseline !== false/);
  assert.match(app, /name: crewLimitName\(control\)/);
  assert.match(app, /function addIndividualCrewLimit\(\)/);
  assert.match(app, /function removeIndividualCrewLimit\(crewId\)/);
  assert.match(app, /const showComparison = comparison\.results\.length > 1;/);
  assert.match(styles, /\.crew-result-row\.is-limiting/);
  assert.match(styles, /\.crew-limiting-badge/);
});

test("each Maximum FDP label is the table shortcut and the table can change its target", () => {
  assert.match(index, /<label for="fdpTargetSelect">Maximum FDP for<\/label>/);
  assert.match(index, /<select id="fdpTargetSelect"/);
  assert.match(index, /<button class="fdp-lookup-button" type="button">Maximum FDP<\/button>/);
  assert.doesNotMatch(index, /text-button secondary fdp-lookup-button/);
  assert.doesNotMatch(index, /Select from FDP table/);
  assert.match(app, /setFdpReferenceTarget\(elements\.fdpTargetSelect\.value, true\)/);
  assert.match(styles, /#fdpTargetSelect\s*\{[^}]*font-size: 16px;/);
  assert.match(styles, /\.fdp-lookup-button\s*\{[^}]*min-height: 44px;/);
  assert.match(styles, /\.fdp-lookup-button\s*\{[^}]*padding: 0;/);
  assert.match(styles, /\.fdp-lookup-button\s*\{[^}]*background: none;/);
});

test("crew names are optional and active discretion has a distinct red treatment", () => {
  assert.doesNotMatch(app, /nameInput\.required|hasRequiredName|updateIndividualCrewNameState/);
  assert.doesNotMatch(index, /crew-limit-name-error/);
  assert.match(styles, /\.crew-result-fdp \.crew-discretion-active\s*\{\s*color: var\(--warn\);/);
  assert.match(styles, /\.crew-result-name \.crew-result-person\s*\{\s*color: var\(--muted\);/);
  assert.match(styles, /\.crew-result-name\s*\{[^}]*overflow-wrap: anywhere;/);
});

test("renaming the original pilot cannot reset the calculation's saved duty date", () => {
  assert.match(app, /if \(record\.id === "flight" && event\.currentTarget === dutyDate\)\s*\{\s*ftlAnchorDate =/);
  assert.doesNotMatch(app, /resolveNearestUtcDateIso/);
});

test("FDP table context remains visible without losing the real accessible headings", () => {
  assert.match(app, /toolbar\.className = "fdp-table-toolbar"/);
  assert.match(app, /select\.addEventListener\("change", \(\) => setFdpReferenceTarget\(select\.value, true\)\)/);
  assert.match(app, /headingsViewport\.setAttribute\("aria-hidden", "true"\)/);
  assert.match(app, /headingsViewport\.scrollLeft = scroll\.scrollLeft/);
  assert.match(styles, /\.fdp-table-toolbar\s*\{[^}]*position: sticky;/);
  assert.match(styles, /\.fdp-table-toolbar\s*\{[^}]*top: calc\(var\(--ftl-nav-height/);
  assert.match(styles, /\.fdp-column-headings span:first-child\s*\{[^}]*white-space: normal;/);
  assert.match(styles, /\.fdp-reference-content\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\);/);
  assert.match(styles, /\.fdp-reference-table\.fdp-value-table tbody th\s*\{[^}]*white-space: normal;/);
});

test("report dates are explicit and mobile deadline colours follow the selected theme", () => {
  assert.match(index, /class="crew-limit-duty-date" type="date"/);
  assert.match(index, /class="crew-limit-heading"/);
  assert.match(styles, /\.crew-report-control input\s*\{[^}]*font-size: 16px;/);
  assert.match(styles, /\.ftl-mobile-result-strip \[data-state="warning"\]\s*\{\s*background: var\(--amber-soft\);/);
  assert.match(styles, /\.ftl-mobile-result-strip \[data-state="expired"\]\s*\{\s*background: var\(--warn-soft\);/);
});

test("the short-haul reporting-time clarification is available beside the FDP tables", () => {
  assert.match(index, /<summary>FTL Clarifications<\/summary>/);
  assert.match(index, /<h3>OMA 7\.6\.1 - Different reporting times<\/h3>/);
  assert.match(index, /calculate the FDP limit using the Flight crew report time/);
  assert.match(index, /giving Cabin crew the same latest end time as Flight crew/);
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
