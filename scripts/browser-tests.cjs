const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const { webcrypto } = require("node:crypto");
const { chromium, webkit } = require("playwright");
const gpsCore = require("../gps-checklist-core");
const lvtoCore = require("../lvto-checklist-core");
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
      for (const view of ["checks", "ftl", "gps", "lvto", "ra", "settings"]) {
        await page.goto(`${base}/?preview&view=${view}`);
        if (view === "gps") await page.locator("[data-gps-item]").first().waitFor();
        if (view === "lvto") await page.locator("[data-lvto-check]").first().waitFor();
        if (view === "settings") {
          await page.locator("#checkOfflineButton").click();
          await page.locator("#offlineReadinessList").waitFor();
          assert.equal(await page.locator("#offlineReadinessList li").count(), 7);
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
      for (const view of ["checks", "ftl", "gps", "lvto", "ra", "settings"]) {
        await page.goto(`${base}/?preview&view=${view}`);
        if (view === "gps") await page.locator("[data-gps-item]").first().waitFor();
        if (view === "lvto") await page.locator("[data-lvto-check]").first().waitFor();
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

    for (const key of ["gps", "lvto"]) {
      const c = await context(); const page = await c.newPage();
      await page.goto(`${base}/?preview&view=${key}`);
      await page.locator(key === "gps" ? "[data-gps-item]" : "[data-lvto-check]").first().waitFor();
      const bytes = Buffer.from("%PDF-1.4\nSynthetic private checklist backup\n%%EOF\n");
      const digest = Buffer.from(await webcrypto.subtle.digest("SHA-256", bytes)).toString("hex");
      const pdf = { checklist_key: key, content_sha256: fixtures[key].content_sha256,
        pdf_sha256: digest, filename: `OpsDeck-${key}-test.pdf`, pdf_base64: bytes.toString("base64") };
      await page.evaluate(async ({ key, pdf, source }) => {
        const ui = key === "gps" ? OpsDeckGpsUi : OpsDeckLvtoUi;
        ui.setContext(null);
        await OpsDeckChecklistBackup.prepare(localStorage, "pdf-test-owner", key, source.content_sha256, async () => pdf);
        Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
        // The source itself must also be prepared for offline reopening.
        const core = key === "gps" ? OpsDeckGpsChecklist : OpsDeckLvtoChecklist;
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
        (key === "gps" ? OpsDeckGpsUi : OpsDeckLvtoUi).forget();
      }, key);
      assert.equal(await page.evaluate(key => localStorage.getItem(OpsDeckChecklistBackup.storageKey("pdf-test-owner", key)), key), null);
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
    nextWorker = true;
    await offlinePage.evaluate(async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      watchAppUpdate(registration);
      await registration.update();
    });
    await offlinePage.waitForFunction(async () => Boolean((await navigator.serviceWorker.getRegistration()).waiting));
    await offlinePage.locator("#appUpdateReloadButton").waitFor();
    assert.equal(await offlinePage.locator('[data-gps-item="first"]').isChecked(), true);
    offlinePage.once("dialog", (dialog) => dialog.accept());
    await offlinePage.locator("#appUpdateReloadButton").click();
    await offlinePage.waitForFunction(async () => !(await navigator.serviceWorker.getRegistration()).waiting);
    results.push("a complete update waits for deliberate activation and preserves checklist progress");
    networkBlocked = true;
    await offlinePage.reload();
    await offlinePage.locator('[data-gps-item="first"]').waitFor();
    assert.equal(await offlinePage.locator('[data-gps-item="first"]').isChecked(), true);
    // Stop the origin itself: this also avoids WebKit's emulated-offline navigation error.
    await new Promise((resolve) => server.close(resolve));
    await offlinePage.reload();
    assert.equal(await offlinePage.locator('[data-gps-item="first"]').isChecked(), true);
    await offline.close(); networkBlocked = false;
    results.push("real service worker: blocked Wi-Fi and unreachable-origin reopening preserve progress");
    console.log(JSON.stringify({ passed: results.length, checks: results }, null, 2));
    fs.writeFileSync(path.join(output, "browser-results.json"), JSON.stringify(results, null, 2));
  } finally { await browser.close(); await new Promise((resolve) => server.close(resolve)); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
