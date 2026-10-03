const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { webcrypto } = require("node:crypto");
const worker = fs.readFileSync(require.resolve("../service-worker"), "utf8");

function harness() {
  const handlers = {};
  const cached = new Map();
  const cache = { match: async (key) => cached.get(key), put: async (key, value) => cached.set(key, value) };
  const c = {
    self: { registration: { scope: "https://example.test/app/" }, location: { origin: "https://example.test" },
      addEventListener: (name, handler) => { handlers[name] = handler; }, skipWaiting() { c.activated = true; },
      clients: { matchAll: async () => [], claim: async () => {} } },
    crypto: webcrypto, Request, Response, URL, Uint8Array, AbortSignal,
    caches: { open: async () => cache, match: async (key) => cached.get(key), keys: async () => [], delete: async () => {} },
    fetch: async () => new Response("Blocked page", { status: 403, headers: { "content-type": "text/html" } }),
  };
  vm.runInNewContext(worker, c);
  const navigate = () => new Promise((resolve) => handlers.fetch({
    request: new Request("https://example.test/app/?code=callback", { headers: { accept: "text/html" } }), respondWith: resolve,
  }));
  return { c, cached, handlers, navigate };
}

test("verified offline shell is returned without waiting for a blocked network", async () => {
  const { c, cached, navigate } = harness();
  cached.set("./index.html", new Response("verified shell"));
  c.fetch = () => { throw new Error("network must not be used"); };
  assert.equal(await (await navigate()).text(), "verified shell");
});

test("blocked HTTP pages are never stored as an offline shell", async () => {
  const { cached, navigate } = harness();
  assert.equal((await navigate()).status, 503);
  assert.equal(cached.size, 0);
});

test("even HTTP 200 captive-portal content fails the shell digest before any cache writes", async () => {
  const { c, cached, handlers } = harness();
  c.fetch = async () => new Response("Login to Wi-Fi", { status: 200 });
  let installation;
  handlers.install({ waitUntil: (promise) => { installation = promise; } });
  await assert.rejects(installation, /Incomplete app update/);
  assert.equal(cached.size, 0);
  assert.equal(c.activated, undefined);
});

test("installed updates wait for deliberate activation", () => {
  const { c, handlers } = harness();
  assert.equal(c.activated, undefined);
  handlers.message({ data: { type: "ACTIVATE_UPDATE" } });
  assert.equal(c.activated, true);
});
