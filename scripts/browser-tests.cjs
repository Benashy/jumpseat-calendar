const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webcrypto } = require("node:crypto");
const { chromium, webkit } = require("playwright");
const gpsCore = require("../gps-checklist-core");
const lvtoCore = require("../lvto-checklist-core");
const coldCore = require("../cold-checklist-core");
const root = path.resolve(__dirname, "..");
const output = process.env.BROWSER_OUTPUT || path.join(root, "test-results");
const gpsPolicy = {
  schemaVersion: 1, id: "synthetic-gps", title: "Synthetic checklist", revision: "Test revision", introduction: [],
  sections: [{ id: "preparation", title: "Preparation", canHide: true, blocks: [
    { id: "first", type: "action", text: "First test action" },
    { id: "second", type: "action", text: "Second test action" },
  ] }], sources: [{ document: "Synthetic source", section: "Test", revision: "Test", pages: "1" }],
};
const lvtoPolicy = require("../tests/lvto-fixture").fixture();
const mime = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".png": "image/png" };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const fixtures = {
    gps: { checklist: gpsPolicy, content_sha256: await gpsCore.policyHash(gpsPolicy, webcrypto) },
    lvto: { checklist: lvtoPolicy, content_sha256: await lvtoCore.policyHash(lvtoPolicy, webcrypto) },
    cold: { checklist: require("../tests/cold-fixture").fixture(), content_sha256: await coldCore.policyHash(require("../tests/cold-fixture").fixture(), webcrypto) },
  };
  let networkBlocked = false;
  let nextWorker = false;
  const server = http.createServer((req, res) => {
    if (networkBlocked) { res.writeHead(403, { "content-type": "text/html" }); res.end("Restricted Wi-Fi"); return; }
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const fixture = pathname.match(/^\/__([a-z]+)-checklist-preview.json$/)?.[1];
    if (fixtures[fixture]) { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify(fixtures[fixture])); return; }
    const file = path.resolve(root, "." + (pathname === "/" ? "/index.html" : pathname));
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": mime[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    let body = fs.readFileSync(file);
    if (nextWorker && pathname === "/service-worker.js") body = Buffer.from(body.toString().replace(/(const CACHE_NAME = "[^"]+)"/, '$1-test-update"'));
    res.end(body);
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const engine = process.env.BROWSER_ENGINE === "webkit" ? webkit : chromium;
  const browser = await engine.launch({ headless: true, ...(process.env.BROWSER_EXECUTABLE ? { executablePath: process.env.BROWSER_EXECUTABLE } : {}) });
  const results = [];
  const context = async (options = {}) => {
    const c = await browser.newContext({ serviceWorkers: "block", ...options });
    await c.route("**/*", (route) => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    return c;
  };
  try {
    for (const [name, viewport] of [["ipad-landscape", { width: 1194, height: 834 }], ["ipad-portrait", { width: 834, height: 1194 }], ["ipad-split", { width: 507, height: 834 }], ["iphone", { width: 390, height: 844 }]]) {
      const c = await context({ viewport }); const page = await c.newPage(); const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.auditCspErrors = [];
        document.addEventListener("securitypolicyviolation", (event) => window.auditCspErrors.push(event.violatedDirective));
      });
      for (const view of ["checks", "ftl", "gps", "lvto", "cold", "ra", "settings"]) {
        await page.goto(`${base}/?preview&view=${view}`);
        if (view === "gps") await page.locator("[data-gps-item]").first().waitFor();
        if (view === "lvto") await page.locator("[data-lvto-check]").first().waitFor();
        if (view === "cold") await page.locator("#coldView [data-gps-item]").first().waitFor();
        if (view === "settings") {
          await page.locator("#checkOfflineButton").click();
          await page.locator("#offlineReadinessList").waitFor();
          assert.equal(await page.locator("#offlineReadinessList li").count(), 9);
        }
        if (view === "ftl") {
          await page.locator("#ftlClarifications").evaluate((element) => { element.open = true; });
          const cph = page.locator(".station-code-list li").filter({ hasText: "CPH" });
          assert.match(await cph.innerText(), /CPH\s+Check station brief/);
          const fits = await cph.evaluate((element) => {
            const row = element.getBoundingClientRect();
            const note = element.querySelector("span").getBoundingClientRect();
            return note.right <= row.right + 1 && note.bottom <= row.bottom + 1;
          });
          assert.equal(fits, true, `${name}: CPH reporting note overflows`);
          await page.locator(".on-duty-variation-reference").screenshot({ path: path.join(output, `${name}-on-duty-variations.png`) });
          await page.locator("#ftlClarifications").evaluate((element) => { element.open = false; });
          results.push(`${name}: CPH reference uses a readable station-brief referral, not an assumed time`);
        }
        const width = await page.evaluate(() => ({ view: innerWidth, document: document.documentElement.scrollWidth }));
        assert.ok(width.document <= width.view + 1, `${name} ${view}: horizontal page overflow`);
        assert.deepEqual(await page.evaluate(() => window.auditCspErrors), [], "Application violates its own CSP");
        await page.screenshot({ path: path.join(output, `${name}-${view}.png`), fullPage: true });
        results.push(`${name}: ${view}`);
      }
      assert.deepEqual(errors, []);
      await c.close();
    }
    for (const colorScheme of ["light", "dark"]) {
      const c = await context({ viewport: { width: 834, height: 1194 }, colorScheme }); const page = await c.newPage();
      for (const view of ["checks", "ftl", "gps", "lvto", "cold", "ra", "settings"]) {
        await page.goto(`${base}/?preview&view=${view}`);
        if (view === "gps") await page.locator("[data-gps-item]").first().waitFor();
        if (view === "lvto") await page.locator("[data-lvto-check]").first().waitFor();
        if (view === "cold") await page.locator("#coldView [data-gps-item]").first().waitFor();
        if (view === "settings") {
          await page.locator("#checkOfflineButton").click();
          await page.locator("#offlineReadinessList").waitFor();
        }
        // Test instrumentation is evaluated separately; never weaken the shipped CSP for axe.
        await page.evaluate(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
        const violations = await page.evaluate(async () => (await axe.run(document, {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
        })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map((n) => n.target) })));
        assert.deepEqual(violations, [], `${colorScheme} ${view}: accessibility issues`);
        results.push(`accessibility ${colorScheme}: ${view}`);
      }
      await c.close();
    }
    const c = await context(); const page = await c.newPage();
    await page.goto(`${base}/?preview&view=lvto`);
    await page.locator('[data-lvto-check="action"]').check();
    assert.equal(await page.locator("#lvtoCompletionStatus").innerText(), "CHECKLIST INCOMPLETE");
    assert.equal(await page.locator(".lvto-completion-hint").innerText(), "Return decision required");
    await page.locator('[data-lvto-decision][data-lvto-option="yes"]').click();
    assert.equal(await page.locator("#lvtoCompletionStatus").innerText(), "CHECKLIST INCOMPLETE");
    await page.locator('[data-lvto-field="entered"]').fill("200");
    assert.equal(await page.locator("#lvtoCompletionStatus").innerText(), "CHECKLIST COMPLETE");
    await page.locator('[data-lvto-decision][data-lvto-option="no"]').click();
    assert.equal(await page.locator("#lvtoCompletionStatus").innerText(), "CHECKLIST INCOMPLETE");
    await page.goto(`${base}/?preview&view=ftl`);
    await page.evaluate(() => openElapsedInfo({ currentTarget: document.querySelector("#elapsedInfoButton") }));
    for (let i = 0; i < 4; i++) {
      await page.keyboard.press("Tab");
      assert.ok(await page.evaluate(() => Boolean(document.activeElement.closest("#elapsedInfoDialog"))));
    }
    await page.locator("#elapsedInfoCloseButton").click();
    await page.locator("#ftlToolTab").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await page.locator("#checksToolTab").getAttribute("aria-selected"), "true");
    await c.close(); results.push("completion, focus containment and tab keyboard controls");

    const failedStorage = await context();
    await failedStorage.addInitScript(() => { Storage.prototype.setItem = function () { throw new Error("QuotaExceededError"); }; });
    const failingPage = await failedStorage.newPage(); const failureErrors = [];
    failingPage.on("pageerror", (error) => failureErrors.push(error.message));
    await failingPage.goto(`${base}/?preview&view=ftl`);
    assert.ok(await failingPage.locator("#ftlView").isVisible());
    assert.deepEqual(failureErrors, []);
    await failedStorage.close(); results.push("storage failure leaves FDP usable");

    const signedOut = await context(); const signedOutPage = await signedOut.newPage();
    await signedOutPage.goto(`${base}/?preview&view=checks`);
    await signedOutPage.evaluate(async () => {
      setSignedInState({ id: "11111111-1111-4111-8111-111111111111", email: "synthetic@example.test" });
      requests = [{ id: "private-test", date: todayIso(), flightNumber: "BA123", departureTime: "12:00", routeFrom: "LHR", routeTo: "LCA", staff: [{ name: "PRIVATE TEST NAME", baid: false }], notes: "", availableSeats: 1 }];
      saveRequestEnvelope();
      Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
      window.sdkSignOutCalls = 0;
      const original = supabaseClient.auth.signOut.bind(supabaseClient.auth);
      supabaseClient.auth.signOut = (...args) => { window.sdkSignOutCalls++; return original(...args); };
      await signOut();
    });
    assert.equal(await signedOutPage.evaluate(() => window.sdkSignOutCalls), 1);
    await signedOut.addInitScript(() => Object.defineProperty(navigator, "onLine", { get: () => false }));
    await signedOutPage.goto(`${base}/`);
    assert.equal((await signedOutPage.locator("body").innerText()).includes("PRIVATE TEST NAME"), false);
    assert.equal(await signedOutPage.evaluate(() => authStorage.blocked), true);
    assert.equal(await signedOutPage.evaluate(() => offlineDeviceApi.read(deviceStorage)), null);
    await signedOut.close(); results.push("offline sign-out clears session and prevents private data reopening");

    for (const key of ["gps", "lvto", "cold"]) {
      if (key === "cold") {
        const coldContext = await context(); const coldPage = await coldContext.newPage();
        await coldPage.goto(`${base}/?preview&view=cold`);
        const first = coldPage.locator('#coldView [data-gps-item="first"]');
        await first.check();
        const reference = coldPage.locator("#coldView .checklist-item-reference").first();
        assert.equal(await reference.getAttribute("open"), null);
        await reference.locator("summary").click();
        assert.equal(await reference.locator("p").first().isVisible(), true);
        assert.equal(await first.isChecked(), true);
        await coldPage.locator('#coldView [data-gps-row="first"] summary').click();
        await coldPage.locator('#coldView [data-gps-mark-not-applicable="first"]').click();
        assert.equal(await coldPage.locator('#coldView [data-gps-na-status]').innerText(), "1 N/A");
        assert.equal(await reference.isVisible(), false);
        await coldPage.reload();
        await coldPage.locator('#coldView [data-gps-restore-item="first"]').waitFor({state:"attached"});
        await coldPage.locator('#coldView .gps-na-summary > summary').click();
        await coldPage.locator('#coldView [data-gps-restore-item="first"]').click();
        assert.equal(await first.isChecked(), false);
        await coldPage.locator('#coldSectionsControl > summary').click();
        await coldPage.locator('#coldView [data-gps-visibility="preparation"]').uncheck();
        assert.equal(await coldPage.locator('#coldHiddenStatus').innerText(), "1 section hidden");
        assert.equal(await coldPage.locator('#coldHiddenStatus').getAttribute('data-severity'), "red");
        coldPage.once('dialog', dialog=>dialog.accept());
        await coldPage.locator('#coldResetButton').click();
        assert.equal(await coldPage.locator('#coldView [data-gps-visibility="preparation"]').isChecked(), true);
        await first.check();
        await coldPage.evaluate(() => {
          const key = OpsDeckColdChecklist.storageKey('progress','local-preview');
          const state = JSON.parse(localStorage.getItem(key));
          state.updatedAt = new Date(Date.now() - OpsDeckColdChecklist.INACTIVITY_TIMEOUT_MS - 1000).toISOString();
          localStorage.setItem(key,JSON.stringify(state));
        });
        await coldPage.reload();
        await first.waitFor();
        assert.equal(await first.isChecked(), false);
        assert.equal(await coldPage.locator('#coldExpiryNotice').isVisible(), true);
        await coldContext.close();
        results.push("cold: references, N/A restoration, section warnings, full reset and six-hour expiry");
        continue;
      }
      const ageContext = await context(); const page = await ageContext.newPage();
      await page.goto(`${base}/?preview&view=${key}`);
      const action = page.locator(key === "gps" ? '[data-gps-item="first"]' : '[data-lvto-check="action"]');
      await action.check();
      if (key === "lvto") {
        await page.locator('[data-lvto-field="entered"]').fill("200");
        await page.locator('[data-lvto-decision][data-lvto-option="no"]').click();
      }
      const otherKey = key === "gps" ? "lvto" : "gps";
      const otherProgress = JSON.stringify({ unaffected: true });
      await page.evaluate(({ key, otherKey, otherProgress }) => {
        const core = key === "gps" ? OpsDeckGpsChecklist : OpsDeckLvtoChecklist;
        const storageKey = core.storageKey("progress", "local-preview");
        const state = JSON.parse(localStorage.getItem(storageKey));
        state.updatedAt = new Date(Date.now() - core.INACTIVITY_TIMEOUT_MS - 1000).toISOString();
        localStorage.setItem(storageKey, JSON.stringify(state));
        const otherCore = otherKey === "gps" ? OpsDeckGpsChecklist : OpsDeckLvtoChecklist;
        localStorage.setItem(otherCore.storageKey("progress", "local-preview"), otherProgress);
      }, { key, otherKey, otherProgress });
      // No wall-clock timer may silently clear the currently displayed procedure.
      assert.equal(await action.isChecked(), true);
      await page.locator(`#${key}BackToChecks`).click();
      await page.locator(key === "gps" ? "#openGpsButton" : "#openLvtoButton").click();
      assert.equal(await action.isChecked(), false);
      assert.equal(await page.locator(`#${key}ExpiryNotice`).isVisible(), true);
      const state = await page.evaluate(key => {
        const core = key === "gps" ? OpsDeckGpsChecklist : OpsDeckLvtoChecklist;
        return JSON.parse(localStorage.getItem(core.storageKey("progress", "local-preview")));
      }, key);
      assert.deepEqual(state.completedIds, []);
      assert.deepEqual(state.hiddenSectionIds, []);
      if (key === "gps") assert.deepEqual(state.notApplicableIds, []);
      else { assert.deepEqual(state.values, {}); assert.deepEqual(state.decisions, {}); }
      assert.equal(await page.evaluate(otherKey => {
        const core = otherKey === "gps" ? OpsDeckGpsChecklist : OpsDeckLvtoChecklist;
        return localStorage.getItem(core.storageKey("progress", "local-preview"));
      }, otherKey), otherProgress);
      await page.reload();
      assert.equal(await page.locator(`#${key}ExpiryNotice`).isVisible(), true);
      await action.check();
      assert.equal(await page.locator(`#${key}ExpiryNotice`).isVisible(), false);
      await ageContext.close();
      results.push(`${key}: full six-hour reset on return, independent progress and persistent notice`);
    }

    const fdpAgeContext = await context(); const agePage = await fdpAgeContext.newPage();
    await agePage.goto(`${base}/?preview&view=ftl`);
    assert.equal(await agePage.evaluate(() => calculatorDataAge.firstEntryAt), null);
    assert.equal(await agePage.locator('#ftlDataAgeWarning').isVisible(), false);
    await agePage.locator('.crew-limit-duty-start').first().fill("08:00");
    const enteredAt = await agePage.evaluate(() => calculatorDataAge.firstEntryAt);
    assert.ok(enteredAt);
    assert.equal(await agePage.locator('#ftlDataAgeWarning').isVisible(), false);
    await agePage.locator('.crew-limit-max-hours').first().selectOption("13");
    assert.equal(await agePage.evaluate(() => calculatorDataAge.firstEntryAt), enteredAt);
    await agePage.reload();
    assert.equal(await agePage.evaluate(() => calculatorDataAge.firstEntryAt), enteredAt);
    await agePage.evaluate(() => {
      const state = serializeCalculatorState();
      state.dataAge = { firstEntryAt: new Date(Date.now() - OpsDeckLtot.DATA_AGE_WARNING_MS - 1000).toISOString(), warningDismissed: false };
      applyCalculatorState(state); saveCalculatorEnvelope();
    });
    assert.equal(await agePage.locator('#ftlDataAgeWarning').isVisible(), true);
    const ageBeforeDismiss = await agePage.evaluate(() => calculatorDataAge.firstEntryAt);
    await agePage.locator('#ftlDataAgeDismissButton').click();
    assert.equal(await agePage.locator('#ftlDataAgeWarning').isVisible(), false);
    assert.equal(await agePage.evaluate(() => loadCalculatorEnvelope().state.dataAge.warningDismissed), true);
    assert.equal(await agePage.locator('.crew-limit-duty-start').first().inputValue(), "08:00");
    await agePage.reload();
    assert.equal(await agePage.locator('#ftlDataAgeWarning').isVisible(), false,
      JSON.stringify(await agePage.evaluate(() => ({ current: calculatorDataAge, saved: loadCalculatorEnvelope().state.dataAge }))));
    assert.equal(await agePage.evaluate(() => calculatorDataAge.firstEntryAt), ageBeforeDismiss);
    assert.equal(await agePage.evaluate(() => calculatorDataAge.warningDismissed), true);
    agePage.once('dialog', dialog => dialog.accept());
    await agePage.locator('#clearFtlButton').click();
    assert.equal(await agePage.evaluate(() => calculatorDataAge.firstEntryAt), null);
    assert.equal(await agePage.evaluate(() => calculatorDataAge.warningDismissed), false);
    await agePage.locator('.crew-limit-duty-start').first().fill("09:00");
    assert.notEqual(await agePage.evaluate(() => calculatorDataAge.firstEntryAt), ageBeforeDismiss);

    await agePage.evaluate(() => {
      calculatorDataAge = { firstEntryAt: new Date(Date.now() - OpsDeckLtot.DATA_EXPIRY_MS + 60000).toISOString(), warningDismissed: true };
      saveCalculatorEnvelope();
    });
    await agePage.reload();
    assert.equal(await agePage.locator('.crew-limit-duty-start').first().inputValue(), "09:00");
    await agePage.evaluate(() => {
      calculatorDataAge.firstEntryAt = new Date(Date.now() - OpsDeckLtot.DATA_EXPIRY_MS - 1000).toISOString();
      document.dispatchEvent(new Event("visibilitychange"));
    });
    assert.equal(await agePage.locator('.crew-limit-duty-start').first().inputValue(), "");
    assert.equal(await agePage.locator('#ftlExpiryNotice').isVisible(), true);
    assert.equal(await agePage.locator('#latestOnChocks').innerText(), "--:--Z");
    assert.equal(await agePage.evaluate(() => loadCalculatorEnvelope().dirty), true);
    await agePage.reload();
    assert.equal(await agePage.locator('.crew-limit-duty-start').first().inputValue(), "");
    await agePage.locator('.crew-limit-duty-start').first().fill("10:00");
    assert.equal(await agePage.locator('#ftlExpiryNotice').isVisible(), false);
    await agePage.evaluate(() => {
      const state = serializeCalculatorState();
      delete state.dataAge;
      state.crewLimits[0].dutyDate = "2026-01-01";
      deviceStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify({ state, dirty: false, baseUpdatedAt: new Date().toISOString() }));
    });
    await agePage.reload();
    assert.equal(await agePage.locator('.crew-limit-duty-start').first().inputValue(), "");
    assert.equal(await agePage.locator('#ftlExpiryNotice').isVisible(), true);
    await fdpAgeContext.close();
    results.push("FDP: first-entry clock, 15-hour dismissal, 72-hour expiry on reopen/return and legacy-duty migration");

    for (const [name, viewport] of [["ipad-landscape", { width: 1194, height: 834 }], ["ipad-portrait", { width: 834, height: 1194 }], ["ipad-split", { width: 507, height: 834 }], ["iphone", { width: 390, height: 844 }]]) {
      for (const colorScheme of ["light", "dark"]) {
        const warningContext = await context({ viewport, colorScheme });
        const warningPage = await warningContext.newPage();
        for (const view of ["ftl", "gps", "lvto"]) {
          await warningPage.goto(`${base}/?preview&view=${view}`);
          if (view === "ftl") {
            await warningPage.evaluate(() => {
              const state = serializeCalculatorState();
              state.crewLimits[0].dutyStart = "08:00";
              state.dataAge = { firstEntryAt: new Date(Date.now() - OpsDeckLtot.DATA_AGE_WARNING_MS - 1000).toISOString(), warningDismissed: false };
              applyCalculatorState(state);
            });
          } else {
            await warningPage.locator(view === "gps" ? '[data-gps-item="first"]' : '[data-lvto-check="action"]').check();
            await warningPage.evaluate(view => {
              const core = view === "gps" ? OpsDeckGpsChecklist : OpsDeckLvtoChecklist;
              const key = core.storageKey("progress", "local-preview");
              const state = JSON.parse(localStorage.getItem(key));
              state.updatedAt = new Date(Date.now() - core.INACTIVITY_TIMEOUT_MS - 1000).toISOString();
              localStorage.setItem(key, JSON.stringify(state));
              (view === "gps" ? OpsDeckGpsUi : OpsDeckLvtoUi).resume();
            }, view);
          }
          assert.equal(await warningPage.locator(view === "ftl" ? '#ftlDataAgeWarning' : `#${view}ExpiryNotice`).isVisible(), true);
          assert.ok(await warningPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
          await warningPage.evaluate(fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8"));
          const violations = await warningPage.evaluate(async () => (await axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"] },
          })).violations.map(({ id, nodes }) => ({ id, targets: nodes.map(node => node.target) })));
          assert.deepEqual(violations, [], `${name} ${colorScheme} ${view}: warning accessibility`);
          await warningPage.screenshot({ path: path.join(output, `${name}-${colorScheme}-${view}-age-notice.png`), fullPage: true });
          results.push(`${name} ${colorScheme}: ${view} age notice layout and accessibility`);
        }
        await warningContext.close();
      }
    }

    for (const key of ["gps", "lvto", "cold"]) {
      const c = await context(); const page = await c.newPage();
      await page.goto(`${base}/?preview&view=${key}`);
      await page.locator(key === "lvto" ? "[data-lvto-check]" : `#${key}View [data-gps-item]`).first().waitFor();
      const bytes = Buffer.from("%PDF-1.4\nSynthetic private checklist backup\n%%EOF\n");
      const digest = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
      const pdf = { checklist_key: key === "cold" ? "cold-weather" : key, content_sha256: fixtures[key].content_sha256,
        pdf_sha256: digest, filename: `OpsDeck-${key}-test.pdf`, pdf_base64: bytes.toString("base64") };
      await page.evaluate(async ({ key, pdf, source }) => {
        const ui = key === "gps" ? OpsDeckGpsUi : key === "cold" ? OpsDeckColdUi : OpsDeckLvtoUi;
        ui.setContext(null);
        await OpsDeckChecklistBackup.prepare(localStorage, "pdf-test-owner", pdf.checklist_key, source.content_sha256, async () => pdf);
        Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
        // The source itself must also be prepared for offline reopening.
        const core = key === "gps" ? OpsDeckGpsChecklist : key === "cold" ? OpsDeckColdChecklist : OpsDeckLvtoChecklist;
        localStorage.setItem(core.storageKey("policy", "pdf-test-owner"), JSON.stringify({ ...source, userId: "pdf-test-owner" }));
        ui.setContext("pdf-test-owner", async () => source);
        await ui.load();
      }, { key, pdf, source: fixtures[key] });
      const button = page.locator(`#${key}DownloadButton`);
      await button.waitFor();
      assert.equal(await button.isEnabled(), true);
      const downloadPromise = page.waitForEvent("download");
      await button.click();
      const download = await downloadPromise;
      assert.deepEqual(fs.readFileSync(await download.path()), bytes);
      await page.evaluate(key => {
        (key === "gps" ? OpsDeckGpsUi : key === "cold" ? OpsDeckColdUi : OpsDeckLvtoUi).forget();
      }, key);
      assert.equal(await page.evaluate(key => localStorage.getItem(OpsDeckChecklistBackup.storageKey("pdf-test-owner", key === "cold" ? "cold-weather" : key)), key), null);
      await c.close(); results.push(`${key}: verified PDF downloads offline and is removed on sign-out`);
    }

    const offline = await browser.newContext(); const offlinePage = await offline.newPage();
    await offlinePage.goto(`${base}/?preview&view=gps`);
    await offlinePage.locator('[data-gps-item="first"]').check();
    await offlinePage.evaluate(async () => {
      await navigator.serviceWorker.register("./service-worker.js");
      await Promise.race([navigator.serviceWorker.ready, new Promise((resolve, reject) => setTimeout(() => reject(new Error("Offline shell installation did not complete")), 15000))]);
    });
    await offlinePage.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
    await offlinePage.evaluate(async () => watchAppUpdate(await navigator.serviceWorker.getRegistration()));
    await offlinePage.evaluate(() => openSettings());
    await offlinePage.locator("#checkAppUpdateButton").click();
    await offlinePage.waitForFunction(() => document.querySelector("#appUpdateStatus").textContent.includes("up to date"));
    nextWorker = true;
    await offlinePage.locator("#checkAppUpdateButton").click();
    await offlinePage.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
    await offlinePage.locator("#appUpdateReloadButton").waitFor();
    await offlinePage.evaluate(() => setActiveTool("gps"));
    assert.equal(await offlinePage.locator('[data-gps-item="first"]').isChecked(), true);
    offlinePage.once("dialog", (dialog) => dialog.accept());
    await offlinePage.locator("#appUpdateReloadButton").click();
    await offlinePage.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
    results.push("Settings checks the live release and downloads a verified update; deliberate activation preserves checklist progress");
    networkBlocked = true;
    await offlinePage.reload();
    await offlinePage.locator('[data-gps-item="first"]').waitFor();
    assert.equal(await offlinePage.locator('[data-gps-item="first"]').isChecked(), true);
    // Stop the origin itself: this also avoids WebKit's emulated-offline navigation error.
    await new Promise((resolve) => server.close(resolve));
    await offlinePage.reload();
    assert.equal(await offlinePage.locator('[data-gps-item="first"]').isChecked(), true);
    await offlinePage.evaluate(() => {
      const key = OpsDeckGpsChecklist.storageKey("progress", "local-preview");
      const state = JSON.parse(localStorage.getItem(key));
      state.updatedAt = new Date(Date.now() - OpsDeckGpsChecklist.INACTIVITY_TIMEOUT_MS - 1000).toISOString();
      localStorage.setItem(key, JSON.stringify(state));
    });
    await offlinePage.reload();
    assert.equal(await offlinePage.locator('[data-gps-item="first"]').isChecked(), false);
    assert.equal(await offlinePage.locator('#gpsExpiryNotice').isVisible(), true);
    await offline.close(); networkBlocked = false;
    results.push("real service worker: blocked Wi-Fi preserves recent progress; expired progress resets offline with cached guidance");
    console.log(JSON.stringify({ passed: results.length, checks: results }, null, 2));
    fs.writeFileSync(path.join(output, "browser-results.json"), JSON.stringify(results, null, 2));
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
