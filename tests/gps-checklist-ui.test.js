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
      { id: "first-note", type: "note", text: "Supporting note", forBlockId: "first" },
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
      this.classes = new Set();
      this.classList = {
        toggle: (name, force) => {
          const add = force ?? !this.classes.has(name);
          if (add) this.classes.add(name); else this.classes.delete(name);
          return add;
        },
        add: (...names) => names.forEach(name => this.classes.add(name)),
        remove: (...names) => names.forEach(name => this.classes.delete(name)),
        contains: name => this.classes.has(name),
      };
      created.push(this);
    }
    set className(value) { this.classes = new Set(value.split(/\s+/)); }
    get className() { return [...this.classes].join(" "); }
    append(...nodes) { nodes.forEach((n) => { n.parent = this; this.children.push(n); }); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    addEventListener(name, action) { this.listeners[name] = action; }
    closest() { return this.parent; }
    querySelectorAll(selector) {
      const match = selector.match(/^\[data-([a-z-]+)\]$/);
      if (!match) throw new Error(`Unsupported fixture selector: ${selector}`);
      const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      const descendants = (element) => element.children.flatMap(child => [child, ...descendants(child)]);
      return descendants(this).filter(element => element.dataset && key in element.dataset);
    }
  }
  const elements = new Map();
  const document = {
    querySelector: (id) => {
      if (!elements.has(id)) {
        const element = new Element();
        elements.set(id, element);
        if (id !== "#gpsView") elements.get("#gpsView").append(element);
      }
      return elements.get(id);
    },
    createElement: (tag) => new Element(tag),
    createTextNode: (text) => ({ textContent: text, children: [] }),
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
    markNotApplicable(id) { created.filter((e) => e.dataset.gpsMarkNotApplicable === id).at(-1).listeners.click(); },
    restoreItem(id) { created.filter((e) => e.dataset.gpsRestoreItem === id).at(-1).listeners.click(); },
    item(id) { return created.filter(e => e.dataset.gpsItem === id).at(-1); },
    itemRow(id) { return created.filter(e => e.dataset.gpsRow === id).at(-1); },
    visible(id, value) {
      const input = created.filter(e => e.dataset.gpsVisibility === id).at(-1);
      assert.notEqual(input.disabled, true);
      input.checked = value; input.listeners.change();
    },
  };
}

test("GPS UI loads authenticated content and restores device-local ticks after reopening", async () => {
  const data = await record(); const h = harness();
  await h.load("one", async () => data);
  h.tick("first");
  assert.deepEqual(h.progress().completedIds, ["first"]);
  const reopened = harness(h.storage);
  await reopened.load("one", async () => data);
  assert.equal(reopened.item("first").checked, true);
  assert.equal(reopened.item("second").checked, false);
  assert.equal(reopened.elements.get("#gpsRevision").textContent, core.updatedLabel(h.progress().updatedAt));
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

test("GPS UI persists not-applicable items, hides their supporting note and restores them", async () => {
  const data = await record(); const h = harness();
  await h.load("one", async () => data);
  h.tick("first");
  h.markNotApplicable("first");
  assert.deepEqual(h.progress().completedIds, []);
  assert.deepEqual(h.progress().notApplicableIds, ["first"]);
  assert.equal(h.itemRow("first").classList.contains("gps-is-not-applicable"), true);
  const supporting = h.created.filter((element) => element.dataset.gpsParentItem === "first").at(-1);
  assert.equal(supporting.classList.contains("hidden"), true);
  const summary = h.created.filter((element) => element.classList.contains("gps-na-summary")).at(-1);
  assert.equal(summary.classList.contains("hidden"), false);

  const reopened = harness(h.storage);
  await reopened.load("one", async () => data);
  assert.deepEqual(reopened.progress().notApplicableIds, ["first"]);
  reopened.restoreItem("first");
  assert.deepEqual(reopened.progress().notApplicableIds, []);
  assert.equal(reopened.itemRow("first").classList.contains("gps-is-not-applicable"), false);
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
  assert.equal(h.item("first").checked, false);
  assert.equal(h.item("second").checked, false);
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
  data.checklist.sections[0].blocks.filter((block) => core.CHECKABLE_TYPES.has(block.type))
    .forEach((block) => { block.exclusiveGroup = "outcome"; });
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
  h.markNotApplicable("second");
  const visibility = h.created.find(e => e.dataset.gpsVisibility === "phase");
  visibility.checked = false; visibility.listeners.change();
  assert.deepEqual(h.progress().hiddenSectionIds, ["phase"]);
  h.elements.get("#gpsClearTicksButton").listeners.click();
  assert.deepEqual(h.progress().completedIds, []);
  assert.deepEqual(h.progress().notApplicableIds, ["second"]);
  assert.deepEqual(h.progress().hiddenSectionIds, ["phase"]);
  h.elements.get("#gpsResetButton").listeners.click();
  assert.deepEqual(h.progress().notApplicableIds, []);
  assert.deepEqual(h.progress().hiddenSectionIds, []);
});

test("GPS UI treats not-applicable choices as progress before replacing revised wording", async () => {
  const h = harness(); const data = await record();
  await h.load("one", async () => data);
  h.markNotApplicable("first");
  data.checklist.revision = "Test 2";
  data.content_sha256 = await core.policyHash(data.checklist, webcrypto);
  h.setConfirm(false);
  await h.ui.load({ force: true });
  assert.match(h.status(), /update postponed/);
  assert.deepEqual(h.progress().notApplicableIds, ["first"]);
});

test("GPS public shell includes no private source payload and preview is localhost-only", () => {
  const app = fs.readFileSync(require.resolve("../app"), "utf8");
  const html = fs.readFileSync(new URL("../index.html", `file://${__filename}`), "utf8");
  assert.match(app, /\["127\.0\.0\.1", "localhost"\]\.includes\(window.location.hostname\)/);
  assert.match(app, /from\("opsdeck_gps_checklist"\)/);
  assert.doesNotMatch(html, /content_sha256|checklist-exact\.md/);
  assert.doesNotMatch(uiSource, /innerHTML/);
  assert.doesNotMatch(html, /gpsProgress|gpsSources|gps-references/);
  assert.doesNotMatch(uiSource, /visible items checked|section-count|Device-only progress|Started /);
  const styles = fs.readFileSync(new URL("../styles.css", `file://${__filename}`), "utf8");
  assert.match(styles, /\.gps-hidden-badge\.hidden\s*\{\s*display: none;/);
});

test("GPS UI permits hiding legacy fixed sections and updates the red/amber badge", async () => {
  const data = await record();
  data.checklist.sections.push({ id: "unexpected-interference", title: "Test amber phase", canHide: false,
    blocks: [{ id: "third", type: "action", text: "Third test action" }] });
  data.content_sha256 = await core.policyHash(data.checklist, webcrypto);
  const h = harness(); await h.load("one", async () => data);
  const badge = h.elements.get("#gpsHiddenStatus");
  assert.equal(badge.classList.contains("hidden"), true);
  h.visible("unexpected-interference", false);
  assert.equal(badge.textContent, "1 section hidden");
  assert.equal(badge.dataset.severity, "amber");
  assert.equal(badge.classList.contains("hidden"), false);
  h.visible("phase", false);
  assert.equal(badge.textContent, "2 sections hidden");
  assert.equal(badge.dataset.severity, "red");
  const hiddenPanel = h.created.find(e => e.dataset.gpsSection === "phase");
  assert.equal(hiddenPanel.open, false);
  const label = h.created.find(e => e.dataset.gpsSectionStatus === "phase");
  assert.equal(label.textContent, "Hidden · Show");
  assert.equal(label.dataset.severity, "red");
  hiddenPanel.children[0].listeners.click({ preventDefault() {} });
  assert.equal(hiddenPanel.open, true);
  assert.equal(badge.dataset.severity, "amber");
  h.elements.get("#gpsRestoreSectionsButton").listeners.click();
  assert.equal(badge.classList.contains("hidden"), true);
  assert.equal(badge.textContent, "");
  assert.equal(label.classList.contains("hidden"), true);
});

test("GPS UI hides source/context presentation without stripping it from the private offline copy", async () => {
  const data = await record();
  data.checklist.context = [{ title: "Private context", text: "Retained source explanation" }];
  data.content_sha256 = await core.policyHash(data.checklist, webcrypto);
  const h = harness(); await h.load("one", async () => data);
  const cached = JSON.parse(h.storage.get(core.storageKey("policy", "one")));
  assert.deepEqual(cached.checklist.sources, data.checklist.sources);
  assert.deepEqual(cached.checklist.context, data.checklist.context);
  assert.equal(cached.content_sha256, data.content_sha256);
  assert.equal(h.created.some(e => /Private context|Retained source explanation|Test document/.test(e.textContent || "")), false);
});
