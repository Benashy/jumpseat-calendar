const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");
const { webcrypto } = require("node:crypto");
const core = require("../gps-checklist-core");
const uiSource = fs.readFileSync(require.resolve("../gps-checklist-ui"), "utf8");

async function record() {
  const checklist = {
    schemaVersion: 1, id: "fixture", title: "Fixture", revision: "Test 1",
    introduction: [{ id: "intro", type: "note", text: "Synthetic introduction" }],
    sections: [{ id: "phase", title: "Test phase", canHide: true, blocks: [
      { id: "first", type: "action", text: "First test action" },
      { id: "second", type: "action", text: "Second test action" },
    ] }],
    sources: [{ document: "Test document", section: "Test section", revision: "Test revision", pages: "1" }],
  };
  return { checklist, content_sha256: await core.policyHash(checklist, webcrypto) };
}

function harness(storage = new Map()) {
  const created = [];
  class Element {
    constructor(tag = "div") {
      this.tagName = tag; this.dataset = {}; this.listeners = {}; this.children = [];
      this.classList = { toggle() {}, add() {}, remove() {} }; created.push(this);
    }
    append(...nodes) { nodes.forEach((n) => { n.parent = this; this.children.push(n); }); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    addEventListener(name, action) { this.listeners[name] = action; }
    closest() { return this.parent; }
    querySelectorAll() { return []; }
  }
  const elements = new Map();
  const document = {
    querySelector: (id) => {
      if (!elements.has(id)) elements.set(id, new Element());
      return elements.get(id);
    },
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => ({ textContent: text }),
  };
  let confirmResult = true;
  const window = {
    OpsDeckGpsChecklist: core, crypto: webcrypto,
    localStorage: { getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    confirm: () => confirmResult, addEventListener() {},
  };
  const navigator = { onLine: true };
  vm.runInNewContext(uiSource, { window, document, navigator });
  return { window, navigator, storage, elements, created, ui: window.OpsDeckGpsUi,
    setConfirm: (value) => { confirmResult = value; },
    async load(owner, loader) { window.OpsDeckGpsUi.setContext(owner, loader); await window.OpsDeckGpsUi.load(); },
    status: () => elements.get("#gpsStatus").textContent,
    progress: () => JSON.parse(storage.get(core.storageKey("progress", "one")) || "null"),
    tick(id) { const input = created.filter((e) => e.dataset.gpsItem === id).at(-1); input.checked = true; input.listeners.change(); },
  };
}

test("GPS UI loads authenticated content and restores device-local ticks after reopening", async () => {
  const data = await record(); const h = harness();
  await h.load("one", async () => data);
  h.tick("first");
  assert.deepEqual(h.progress().completedIds, ["first"]);
  const reopened = harness(h.storage);
  await reopened.load("one", async () => data);
  assert.match(reopened.elements.get("#gpsProgress").textContent, /^1 of 2/);
});

test("GPS UI uses a validated saved source offline without a network request", async () => {
  const h = harness(); const data = await record();
  await h.load("one", async () => data);
  const offline = harness(h.storage); offline.navigator.onLine = false;
  await offline.load("one", async () => { throw new Error("Must not request"); });
  assert.match(offline.status(), /saved checklist offline/);
  offline.tick("second");
  assert.deepEqual(offline.progress().completedIds, ["second"]);
});

test("GPS UI rejects a tampered offline source and a same-hash tampered refresh", async () => {
  const h = harness(); const data = await record();
  await h.load("one", async () => data);
  const originalCache = h.storage.get(core.storageKey("policy", "one"));
  data.checklist.sections[0].blocks[0].text = "Tampered";
  await h.ui.load({ force: true });
  assert.match(h.status(), /Could not refresh/);
  assert.equal(h.storage.get(core.storageKey("policy", "one")), originalCache);
  h.storage.set(core.storageKey("policy", "one"), JSON.stringify({ ...data, userId: "one" }));
  const offline = harness(h.storage); offline.navigator.onLine = false;
  await offline.load("one", async () => data);
  assert.match(offline.status(), /Connect and sign in/);
});

test("GPS UI rejects late responses after account change or sign-out", async () => {
  const data = await record(); const h = harness(); let resolve;
  const deferred = new Promise((r) => { resolve = r; });
  h.ui.setContext("one", () => deferred);
  const operation = h.ui.load();
  h.ui.setContext("two", async () => { throw new Error("No source"); });
  resolve(data); await operation; await h.ui.load();
  assert.equal(h.elements.get("#gpsChecklistContent").children.length, 0);
  assert.equal(h.storage.has(core.storageKey("policy", "two")), false);
  await h.load("one", async () => data);
  h.ui.forget();
  assert.equal(h.storage.has(core.storageKey("policy", "one")), false);
  assert.equal(h.elements.get("#gpsChecklistContent").children.length, 0);
});

test("GPS UI confirms resets and preserves current ticks if storage is unavailable", async () => {
  const h = harness(); await h.load("one", async () => await record());
  h.tick("first");
  h.setConfirm(false); h.elements.get("#gpsResetButton").listeners.click();
  assert.deepEqual(h.progress().completedIds, ["first"]);
  const setItem = h.window.localStorage.setItem;
  h.window.localStorage.setItem = () => { throw new Error("Quota"); };
  h.tick("second");
  assert.match(h.status(), /not saved/);
  h.window.localStorage.setItem = setItem;
  h.tick("first");
  assert.deepEqual(h.progress().completedIds, ["first", "second"]);
  h.setConfirm(true); h.elements.get("#gpsResetButton").listeners.click();
  assert.deepEqual(h.progress().completedIds, []);
});

test("GPS UI source updates discard ticks from old wording", async () => {
  const h = harness(); const data = await record();
  await h.load("one", async () => data); h.tick("first");
  data.checklist.revision = "Test 2";
  data.content_sha256 = await core.policyHash(data.checklist, webcrypto);
  await h.ui.load({ force: true });
  assert.match(h.status(), /Checklist revised/);
  assert.match(h.elements.get("#gpsProgress").textContent, /^0 of 2/);
});

test("GPS UI can postpone a source update without replacing the saved source or progress", async () => {
  const h = harness(); const data = await record();
  await h.load("one", async () => data); h.tick("first");
  const previous = h.storage.get(core.storageKey("policy", "one"));
  data.checklist.revision = "Test 2";
  data.content_sha256 = await core.policyHash(data.checklist, webcrypto);
  h.setConfirm(false); await h.ui.load({ force: true });
  assert.match(h.status(), /update postponed/);
  assert.deepEqual(h.progress().completedIds, ["first"]);
  assert.equal(h.storage.get(core.storageKey("policy", "one")), previous);
});

test("GPS UI asks before replacing an alternative outcome and keeps other marks", async () => {
  const data = await record();
  data.checklist.sections[0].blocks.forEach(b => { b.exclusiveGroup = "outcome"; });
  data.content_sha256 = await core.policyHash(data.checklist, webcrypto);
  const h = harness(); await h.load("one", async () => data);
  h.tick("first"); h.setConfirm(false); h.tick("second");
  assert.deepEqual(h.progress().completedIds, ["first"]);
  h.setConfirm(true); h.tick("second");
  assert.deepEqual(h.progress().completedIds, ["second"]);
});

test("GPS UI clears ticks separately from section visibility and restores both on New checklist", async () => {
  const h = harness(); await h.load("one", async () => await record());
  h.tick("first");
  const visibility = h.created.find(e => e.dataset.gpsVisibility === "phase");
  visibility.checked = false; visibility.listeners.change();
  assert.deepEqual(h.progress().hiddenSectionIds, ["phase"]);
  h.elements.get("#gpsClearTicksButton").listeners.click();
  assert.deepEqual(h.progress().completedIds, []);
  assert.deepEqual(h.progress().hiddenSectionIds, ["phase"]);
  h.elements.get("#gpsResetButton").listeners.click();
  assert.deepEqual(h.progress().hiddenSectionIds, []);
});

test("GPS public shell includes no private source payload and preview is localhost-only", () => {
  const app = fs.readFileSync(require.resolve("../app"), "utf8");
  const html = fs.readFileSync(new URL("../index.html", `file://${__filename}`), "utf8");
  assert.match(app, /\["127\.0\.0\.1", "localhost"\]\.includes\(window.location.hostname\)/);
  assert.match(app, /from\("opsdeck_gps_checklist"\)/);
  assert.doesNotMatch(html, /content_sha256|checklist-exact\.md/);
  assert.doesNotMatch(uiSource, /innerHTML/);
});
