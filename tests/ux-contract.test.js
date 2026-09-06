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
const gpsUi = fs.readFileSync(path.join(root, "gps-checklist-ui.js"), "utf8");
const lvtoUi = fs.readFileSync(path.join(root, "lvto-checklist-ui.js"), "utf8");

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
  assert.match(index, /<span>Maximum FDP for<\/span>/);
  assert.match(index, /<strong class="fdp-target-value hidden">All crew<\/strong>/);
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

test("joint limiting results keep the discretion note concise", () => {
  assert.match(app, /\? "Discretion: crew comparison\."/);
  assert.doesNotMatch(app, /Commander's discretion included\. See crew comparison\./);
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
  assert.match(index, /<summary class="ftl-disclosure">FTL Clarifications<\/summary>/);
  assert.match(index, /<h3 id="reportingTimeClarification" tabindex="-1">OMA 7\.6\.1 - Different reporting times<\/h3>/);
  assert.match(index, /calculate the FDP limit using the Flight crew report time/);
  assert.match(index, /giving Cabin crew the same latest end time as Flight crew/);
});

test("Revision 8 on-duty variations show the confirmed short-haul timings alphabetically", () => {
  assert.match(index, /<h3 id="onDutyVariationTitle">On-duty time variations<\/h3>/);
  assert.match(index, /<span>Revision 8<\/span>/);
  assert.match(index, /standard short-haul report time down route is 60 minutes before scheduled departure/);
  assert.match(index, /variation may apply only to particular flights/);
  assert.match(index, /Pick-up times are published separately in the station brief and are not included here/);
  const list = index.match(/<ul class="station-code-list"[^>]*>([^]*?)<\/ul>/)?.[1] || "";
  assert.deepEqual([...list.matchAll(/<li><strong>([A-Z]{3})<\/strong>/g)].map((match) => match[1]),
    ["AMM", "BCN", "IST", "LIS", "MAN", "MXP", "NAP", "ZRH"]);
  assert.equal((list.match(/>D-65<\/span>/g) || []).length, 1);
  assert.equal((list.match(/>D-70<\/span>/g) || []).length, 5);
  assert.equal((list.match(/>D-75<\/span>/g) || []).length, 2);
  assert.doesNotMatch(list, /Check brief/);
  for (const code of ["BKK", "BOM", "DXB", "JED", "KUL", "MLE"]) assert.doesNotMatch(list, new RegExp(`>${code}<`));
  assert.match(styles, /\.station-code-list\s*\{[^}]*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/);
});

test("FDP disclosures share one marker and the small OMA badge keeps a comfortable touch target", () => {
  assert.equal((index.match(/class="(?:ftl-section-toggle )?ftl-disclosure"/g) || []).length, 5);
  assert.match(styles, /summary\.ftl-disclosure::-webkit-details-marker\s*\{\s*display: none;/);
  assert.match(styles, /\.ftl-disclosure\[aria-expanded="true"\]::before,\s*details\[open\] > \.ftl-disclosure::before/);
  assert.match(index, /<small class="limit-note reporting-time-label">OMA 7\.6\.1<\/small>/);
  assert.match(styles, /\.reporting-time-reminder\s*\{[^}]*background: none;[^}]*min-height: 44px;/);
  const confirmation = index.match(/<button class="fdp-reference-return"[^]*?<\/button>/)?.[0];
  assert.ok(confirmation);
  assert.doesNotMatch(confirmation, /<svg/);
});

test("the reporting-time reminder and input disclosure controls have accessible destinations", () => {
  assert.match(index, /id="reportingTimeReminder"[^>]*aria-controls="ftlClarifications"/);
  assert.match(index, /id="fdpInputsToggle"[^>]*aria-expanded="true"[^>]*aria-controls="fdpInputsContent"/);
  assert.match(index, /id="sectorInputsToggle"[^>]*aria-expanded="true"[^>]*aria-controls="sectorInputsContent"/);
  assert.match(index, /id="fdpReferenceReturnButton" type="button"/);
  assert.match(app, /reportingTimeReminder\.addEventListener\("click", openReportingTimeClarification\)/);
  assert.match(app, /fdpReferenceReturnButton\.addEventListener\("click", returnToFdpInput\)/);
  assert.match(styles, /\.reporting-time-reminder\s*\{[^}]*min-height: 44px;/);
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

test("trusted devices can reopen validated private checklists without a cloud session", () => {
  assert.match(index, /offline-device\.js/);
  assert.match(index, /checklist-backup\.js/);
  assert.match(serviceWorker, /offline-device\.js/);
  assert.match(serviceWorker, /checklist-backup\.js/);
  assert.match(app, /function restoreTrustedOfflineDevice\(\)/);
  assert.match(app, /setPrivateChecklistContext\(profile\.userId\)/);
  assert.match(app, /Offline on this device\. Cloud sync is paused; saved checklists and guidance remain available\./);
  assert.match(app, /offlineDeviceApi\?\.forget\(localStorage\)/);
});

test("GPS and LVTO PDF backups remain private, version-matched online downloads", () => {
  assert.match(index, /id="gpsDownloadButton"[^>]+aria-label="Download GPS checklist PDF backup"/);
  assert.match(index, /id="lvtoDownloadButton"[^>]+aria-label="Download low visibility take-off checklist PDF backup"/);
  assert.match(gpsUi, /expectedKey: "gps", expectedContentHash: hash/);
  assert.match(lvtoUi, /expectedKey: "lvto", expectedContentHash: hash/);
  assert.match(app, /\.eq\("content_sha256", contentHash\)/);
  assert.doesNotMatch(serviceWorker, /\.pdf/);
  assert.doesNotMatch(index, /pdf_base64|OpsDeck-A320-GPS-Interference-Backup\.pdf/);
});

test("mobile navigation remains available and RA answers precede the diagram in a single column", () => {
  assert.match(styles, /\.tool-menu\s*\{[\s\S]*?position: sticky;[\s\S]*?top: 0;/);
  assert.match(styles, /@media \(max-width: 880px\)[\s\S]*?\.ra-result-grid\s*\{\s*order: 1;[\s\S]*?\.ra-geometry-card\s*\{\s*order: 2;/);
});
