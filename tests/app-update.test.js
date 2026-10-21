const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const app = fs.readFileSync(require.resolve("../app.js"), "utf8");
const fn = (name) => app.match(new RegExp("^(?:async )?function " + name + "\\([^]*?^}", "m"))[0];

function harness() {
  const nodes = new Map();
  const node = (id) => {
    if (!nodes.has(id)) nodes.set(id, { textContent: "", disabled: false, classList: { toggle() {} } });
    return nodes.get(id);
  };
  const c = {
    APP_VERSION: "2.94", appWorkerRegistration: null, updateRequested: false, appUpdateChecking: false,
    navigator: { onLine: true, serviceWorker: {} }, document: { querySelector: node },
    Date, Error, Promise,
    window: { setTimeout, clearTimeout, fetch: async () => new Response(JSON.stringify({ appVersion: "2.94" }), { headers: { "content-type": "application/json" } }),
      OpsDeckNetwork: { boundedFetch: (fetcher) => fetcher } },
  };
  c.navigator.serviceWorker.getRegistration = async () => c.registration;
  c.registration = { waiting: null, installing: null, addEventListener() {}, update: async () => {} };
  vm.runInNewContext(["updateAppUpdateControls", "watchAppUpdate", "downloadAppUpdate", "checkForAppUpdate"].map(fn).join("\n"), c);
  return { c, node };
}

test("manual update check confirms the current release against the server", async () => {
  const { c, node } = harness();
  await c.checkForAppUpdate();
  assert.match(node("#appUpdateStatus").textContent, /up to date: v2.94/);
  assert.equal(node("#checkAppUpdateButton").disabled, false);
});

test("offline and HTTP-200 captive portal checks never claim the app is current", async () => {
  const { c, node } = harness();
  c.navigator.onLine = false;
  await c.checkForAppUpdate();
  assert.match(node("#appUpdateStatus").textContent, /Offline/);
  c.navigator.onLine = true;
  c.window.fetch = async () => new Response("Sign in to Wi-Fi", { headers: { "content-type": "text/html" } });
  await c.checkForAppUpdate();
  assert.match(node("#appUpdateStatus").textContent, /Could not check/);
  assert.equal(node("#checkAppUpdateButton").disabled, false);
});

test("a newer release without a completed download is not reported as installed", async () => {
  const { c, node } = harness();
  c.window.fetch = async () => new Response(JSON.stringify({ appVersion: "2.95" }), { headers: { "content-type": "application/json" } });
  await c.checkForAppUpdate();
  assert.match(node("#appUpdateStatus").textContent, /download is not complete/);
});

test("a fully downloaded update is offered offline without automatic activation", async () => {
  const { c, node } = harness();
  c.appWorkerRegistration = { waiting: { postMessage: () => assert.fail("must wait for confirmation") } };
  c.navigator.onLine = false;
  await c.checkForAppUpdate();
  assert.match(node("#appUpdateStatus").textContent, /Update downloaded/);
});

test("a hung update check times out instead of disabling the control indefinitely", async () => {
  const { c } = harness();
  await assert.rejects(c.downloadAppUpdate({ update: () => new Promise(() => {}) }, 10), /timed out/);
});

test("an update already downloading at startup is observed until it is ready", async () => {
  const { c, node } = harness();
  const worker = new EventTarget();
  c.registration.installing = worker;
  c.watchAppUpdate(c.registration);
  c.registration.waiting = worker;
  worker.dispatchEvent(new Event("statechange"));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.match(node("#appUpdateStatus").textContent, /Update downloaded/);
});
