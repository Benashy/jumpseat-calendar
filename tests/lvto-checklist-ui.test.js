const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");
const { webcrypto } = require("node:crypto");
const core = require("../lvto-checklist-core");
const { fixture } = require("./lvto-fixture");
const uiSource = fs.readFileSync(require.resolve("../lvto-checklist-ui"), "utf8");

async function record(policy = fixture()) {
  return { checklist: policy, content_sha256: await core.policyHash(policy, webcrypto) };
}

function harness(storage = new Map(), backupApi = null) {
  const created = [];
  class Element {
    constructor(tag = "div") {
      this.tagName = tag.toUpperCase();
      this.dataset = {};
      this.listeners = {};
      this.children = [];
      this.value = "";
      this.disabled = false;
      this.classes = new Set();
      this.classList = {
        toggle: (name, force) => {
          const add = force ?? !this.classes.has(name);
          if (add) this.classes.add(name); else this.classes.delete(name);
          return add;
        },
        add: (...names) => names.forEach((name) => this.classes.add(name)),
        remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        contains: (name) => this.classes.has(name),
      };
      created.push(this);
    }
    set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
    get className() { return [...this.classes].join(" "); }
    setAttribute(name, value) { this[name] = String(value); }
    append(...nodes) { nodes.forEach((entry) => { entry.parent = this; this.children.push(entry); }); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    addEventListener(name, action) { this.listeners[name] = action; }
    closest(selector) {
      if (!selector) return this.parent;
      const className = selector.startsWith(".") ? selector.slice(1) : null;
      let current = this.parent;
      while (current && (!className || !current.classList.contains(className))) current = current.parent;
      return current;
    }
    querySelectorAll(selector) {
      const descendants = (element) => element.children.flatMap((child) => [child, ...descendants(child)]);
      const entries = descendants(this);
      if (selector === "input, button") return entries.filter((element) => ["INPUT", "BUTTON"].includes(element.tagName));
      if (/^[a-z]+$/.test(selector)) return entries.filter((element) => element.tagName === selector.toUpperCase());
      const match = selector.match(/^\[data-([a-z-]+)\]$/);
      if (!match) throw new Error(`Unsupported fixture selector: ${selector}`);
      const key = match[1].replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
      return entries.filter((element) => element.dataset && key in element.dataset);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  }
  const elements = new Map();
  const document = {
    querySelector: (id) => {
      if (!elements.has("#lvtoView")) elements.set("#lvtoView", new Element());
      if (!elements.has(id)) {
        const element = new Element();
        elements.set(id, element);
        if (id !== "#lvtoView") elements.get("#lvtoView").append(element);
      }
      return elements.get(id);
    },
    createElement: (tag) => new Element(tag),
  };
  let confirmResult = true;
  const window = {
    OpsDeckLvtoChecklist: core,
    OpsDeckChecklistBackup: backupApi,
    crypto: webcrypto,
    localStorage: {
      getItem: (key) => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
    confirm: () => confirmResult,
    addEventListener() {},
  };
  const navigator = { onLine: true };
  vm.runInNewContext(uiSource, { window, document, navigator });
  return {
    window,
    navigator,
    storage,
    elements,
    created,
    ui: window.OpsDeckLvtoUi,
    setConfirm: (value) => { confirmResult = value; },
    async load(owner, loader, backupLoader) { window.OpsDeckLvtoUi.setContext(owner, loader, backupLoader); await window.OpsDeckLvtoUi.load(); },
    status: () => elements.get("#lvtoStatus").textContent,
    progress: () => JSON.parse(storage.get(core.storageKey("progress", "owner")) || "null"),
    check(id, checked = true) {
      const input = created.filter((element) => element.dataset.lvtoCheck === id).at(-1);
      input.checked = checked;
      input.listeners.change();
    },
    field(id, value) {
      const input = created.filter((element) => element.dataset.lvtoField === id).at(-1);
      input.value = value;
      input.listeners.input();
    },
    choose(id, option) {
      const button = created.filter((element) => element.dataset.lvtoDecision === id && element.dataset.lvtoOption === option).at(-1);
      button.listeners.click();
    },
    visibility(id, visible) {
      const input = created.filter((element) => element.dataset.lvtoVisibility === id).at(-1);
      input.checked = visible;
      input.listeners.change();
    },
    item(id, key) { return created.filter((element) => element.dataset[key] === id).at(-1); },
  };
}

test("LVTO UI loads authenticated content and restores entries after reopening", async () => {
  const data = await record();
  const first = harness();
  await first.load("owner", async () => data);
  first.check("action");
  first.field("entered", "125");
  first.choose("return-decision", "yes");
  assert.deepEqual(first.progress().completedIds, ["action"]);
  const reopened = harness(first.storage);
  await reopened.load("owner", async () => data);
  assert.equal(reopened.item("action", "lvtoCheck").checked, true);
  assert.equal(reopened.item("entered", "lvtoField").value, "125");
  assert.equal(reopened.item("higher", "lvtoComputed").querySelector("output").textContent, "125");
  assert.equal(reopened.created.find((element) => element.dataset.lvtoDecision === "return-decision" && element.dataset.lvtoOption === "yes")["aria-pressed"], "true");
});

test("LVTO UI shows an applicable-action count and section choices without shrinking the denominator", async () => {
  const page = harness();
  await page.load("owner", async () => await record());
  assert.equal(page.elements.get("#lvtoProgress").textContent, "0 of 1 actions checked");
  page.check("action");
  assert.equal(page.elements.get("#lvtoProgress").textContent, "1 of 1 actions checked");
  page.visibility("planning", false);
  assert.equal(page.elements.get("#lvtoProgress").textContent, "1 of 1 actions checked");
  assert.equal(page.elements.get("#lvtoHiddenStatus").textContent, "1 section hidden");
  assert.equal(page.created.find((element) => element.dataset.lvtoSection === "planning").classList.contains("lvto-is-hidden"), true);
  page.choose("return-decision", "no");
  assert.equal(page.progress().decisions["return-decision"], undefined);
  page.visibility("planning", true);
  page.choose("return-decision", "no");
  assert.equal(page.elements.get("#lvtoProgress").textContent, "1 of 2 actions checked");
});

test("LVTO UI shows incomplete after the first tick and complete only when every applicable action is checked", async () => {
  const page = harness();
  await page.load("owner", async () => await record());
  const completion = page.elements.get("#lvtoCompletionStatus");
  const content = page.elements.get("#lvtoChecklistContent");
  const references = page.created.find((element) => element.dataset.lvtoSection === "references");
  assert.ok(content.children.indexOf(completion) < content.children.indexOf(references));
  assert.equal(completion.classList.contains("hidden"), true);

  page.choose("return-decision", "no");
  page.check("action");
  assert.equal(completion.textContent, "CHECKLIST INCOMPLETE");
  assert.equal(completion.classList.contains("is-incomplete"), true);
  assert.equal(completion.classList.contains("is-complete"), false);

  page.check("alternate-action");
  assert.equal(completion.textContent, "CHECKLIST COMPLETE");
  assert.equal(completion.classList.contains("is-complete"), true);
  assert.equal(completion.classList.contains("is-incomplete"), false);

  page.check("action", false);
  assert.equal(completion.textContent, "CHECKLIST INCOMPLETE");
  page.elements.get("#lvtoClearTicksButton").listeners.click();
  assert.equal(completion.textContent, "");
  assert.equal(completion.classList.contains("hidden"), true);
});

test("LVTO UI starts with no answer selected and reveals the alternate branch only after No", async () => {
  const data = await record();
  const page = harness();
  await page.load("owner", async () => data);
  const yes = page.created.find((element) => element.dataset.lvtoDecision === "return-decision" && element.dataset.lvtoOption === "yes");
  const no = page.created.find((element) => element.dataset.lvtoDecision === "return-decision" && element.dataset.lvtoOption === "no");
  const alternate = page.item("alternate", "lvtoField");
  assert.equal(yes["aria-pressed"], "false");
  assert.equal(no["aria-pressed"], "false");
  assert.equal(alternate.closest(".lvto-field").classList.contains("hidden"), true);
  page.choose("return-decision", "no");
  assert.equal(no["aria-pressed"], "true");
  assert.equal(alternate.closest(".lvto-field").classList.contains("hidden"), false);
  page.check("alternate-action");
  page.field("alternate", "EGLL");
  page.choose("return-decision", "yes");
  assert.equal(alternate.closest(".lvto-field").classList.contains("hidden"), true);
  assert.deepEqual(page.progress().completedIds, ["alternate-action"]);
  assert.equal(page.progress().values.alternate, "EGLL");
  page.choose("return-decision", "yes");
  assert.deepEqual(page.progress().decisions, {});
});

test("LVTO UI uses the validated private cache offline and permits offline progress", async () => {
  const data = await record();
  const online = harness();
  await online.load("owner", async () => data);
  const offline = harness(online.storage);
  offline.navigator.onLine = false;
  await offline.load("owner", async () => { throw new Error("No network request expected"); });
  assert.match(offline.status(), /saved checklist offline/);
  offline.check("action");
  assert.deepEqual(offline.progress().completedIds, ["action"]);
});

test("LVTO UI reset clears the whole working state while Clear ticks keeps entries", async () => {
  const page = harness();
  await page.load("owner", async () => await record());
  page.check("action");
  page.field("entered", "150");
  page.choose("return-decision", "no");
  page.elements.get("#lvtoClearTicksButton").listeners.click();
  assert.deepEqual(page.progress().completedIds, []);
  assert.equal(page.progress().values.entered, "150");
  assert.equal(page.progress().decisions["return-decision"], "no");
  page.elements.get("#lvtoResetButton").listeners.click();
  assert.deepEqual(page.progress().values, {});
  assert.deepEqual(page.progress().decisions, {});
  assert.deepEqual(page.progress().hiddenSectionIds, []);
});

test("LVTO UI can postpone changed private wording without losing in-progress work", async () => {
  const policy = fixture();
  const data = await record(policy);
  const page = harness();
  await page.load("owner", async () => data);
  page.field("entered", "200");
  const previous = page.storage.get(core.storageKey("policy", "owner"));
  policy.revision = "Test 2";
  data.content_sha256 = await core.policyHash(policy, webcrypto);
  page.setConfirm(false);
  await page.ui.load({ force: true });
  assert.match(page.status(), /update postponed/);
  assert.equal(page.progress().values.entered, "200");
  assert.equal(page.storage.get(core.storageKey("policy", "owner")), previous);
});

test("LVTO public shell contains the interface but none of the private operational payload", () => {
  const app = fs.readFileSync(require.resolve("../app"), "utf8");
  const html = fs.readFileSync(new URL("../index.html", `file://${__filename}`), "utf8");
  const serviceWorker = fs.readFileSync(new URL("../service-worker.js", `file://${__filename}`), "utf8");
  assert.match(app, /checklistRecordLoader\("opsdeck_lvto_checklist"/);
  assert.match(html, /id="openLvtoButton"/);
  assert.match(html, /id="openGpsButton"[\s\S]*?GPS interference procedures[\s\S]*?Under test[\s\S]*?Phase-based actions for jamming and spoofing/);
  assert.match(html, /id="lvtoProgress"[\s\S]*?id="lvtoSectionsControl"/);
  assert.match(serviceWorker, /lvto-checklist-core\.js/);
  assert.match(serviceWorker, /lvto-checklist-ui\.js/);
  const publicAssets = `${html}\n${uiSource}\n${app}\n${serviceWorker}`;
  assert.doesNotMatch(publicAssets, /Synthetic checklist|First deliberate action|Private source note/);
  assert.doesNotMatch(publicAssets, /checklist-exact|opsdeck-gps-handover|handovers\/lvto/i);
  assert.doesNotMatch(uiSource, /innerHTML/);
  assert.doesNotMatch(uiSource, /safe to take off|approved for take-off|take-off permitted|ready for take-off/i);
});
