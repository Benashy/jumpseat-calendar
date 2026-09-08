const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const source = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(script => script.includes("const openedAt = performance.now()"));
assert.ok(source, "The real inline launch controller must be exercised");

function harness({ standalone = true, reducedMotion = false } = {}) {
  const classes = new Set(standalone ? ["opsdeck-home-screen", "opsdeck-launching"] : []);
  const shell = { inert: false };
  const timers = new Map();
  const listeners = { window: new Map(), document: new Map() };
  let now = 0;
  let nextTimer = 0;
  const schedule = (callback, delay = 0) => {
    const id = ++nextTimer;
    timers.set(id, { callback, at: now + delay });
    return id;
  };
  const document = {
    visibilityState: "visible", readyState: "interactive",
    documentElement: { classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
    } },
    querySelector: selector => {
      assert.equal(selector, ".app-shell");
      return shell;
    },
    addEventListener: (name, callback) => listeners.document.set(name, callback),
  };
  const window = {
    setTimeout: schedule, clearTimeout: id => timers.delete(id),
    matchMedia: () => ({ matches: reducedMotion }),
    addEventListener: (name, callback) => listeners.window.set(name, callback),
  };
  vm.runInNewContext(source, {
    document, window, performance: { now: () => now },
    requestAnimationFrame: callback => schedule(callback, 16),
  });
  return {
    shell, classes,
    advance(ms) {
      const end = now + ms;
      while (timers.size) {
        const [id, timer] = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
        if (timer.at > end) break;
        now = timer.at;
        timers.delete(id);
        timer.callback();
      }
      now = end;
    },
    load() { document.readyState = "complete"; listeners.window.get("load")?.(); },
    visibility(state) { document.visibilityState = state; listeners.document.get("visibilitychange")?.(); },
    pageHide() { listeners.window.get("pagehide")?.(); },
    pageShow() { listeners.window.get("pageshow")?.({ persisted: true }); },
  };
}

test("launch blocks controls until the unchanged minimum display and fade complete", () => {
  const h = harness();
  assert.equal(h.shell.inert, true);
  assert.equal(h.classes.has("opsdeck-launch-blocked"), true);
  h.load();
  h.advance(1100);
  assert.equal(h.classes.has("opsdeck-launching"), true);
  h.advance(32);
  assert.equal(h.classes.has("opsdeck-launching"), false);
  assert.equal(h.shell.inert, true);
  h.advance(319);
  assert.equal(h.shell.inert, true);
  h.advance(1);
  assert.equal(h.shell.inert, false);
  assert.equal(h.classes.has("opsdeck-launch-blocked"), false);
});

test("launch has no effect on an ordinary browser tab", () => {
  const h = harness({ standalone: false });
  h.load();
  h.visibility("hidden");
  h.visibility("visible");
  h.advance(5000);
  assert.equal(h.shell.inert, false);
  assert.equal(h.classes.size, 0);
});

test("reduced motion releases controls without waiting for a disabled CSS fade", () => {
  const h = harness({ reducedMotion: true });
  h.load();
  h.advance(1132);
  assert.equal(h.shell.inert, false);
  assert.equal(h.classes.has("opsdeck-launching"), false);
});

test("returning during an unfinished load restores the fallback deadline", () => {
  const h = harness();
  h.advance(100);
  h.visibility("hidden");
  h.advance(8000);
  assert.equal(h.classes.has("opsdeck-launching"), true);
  h.visibility("visible");
  h.advance(3999);
  assert.equal(h.classes.has("opsdeck-launching"), true);
  h.advance(33);
  assert.equal(h.classes.has("opsdeck-launching"), false);
  h.advance(320);
  assert.equal(h.shell.inert, false);
});

test("a load that finishes while hidden retains the snapshot and dismisses on return", () => {
  const h = harness();
  h.visibility("hidden");
  h.load();
  h.advance(5000);
  assert.equal(h.classes.has("opsdeck-launch-snapshot"), true);
  assert.equal(h.classes.has("opsdeck-launching"), true);
  h.visibility("visible");
  h.advance(912);
  assert.equal(h.shell.inert, false);
  assert.equal(h.classes.has("opsdeck-launching"), false);
});

test("a stale animation frame cannot dismiss a newly prepared background snapshot", () => {
  const h = harness();
  h.load();
  h.advance(1116);
  h.visibility("hidden");
  h.advance(1000);
  assert.equal(h.classes.has("opsdeck-launching"), true);
  assert.equal(h.shell.inert, true);
  h.visibility("visible");
  h.advance(912);
  assert.equal(h.shell.inert, false);
});

test("rapid app switching during the fade cannot unlock invisible controls", () => {
  const h = harness();
  h.load();
  h.advance(1200);
  h.visibility("hidden");
  h.visibility("visible");
  h.advance(252);
  assert.equal(h.shell.inert, true);
  assert.equal(h.classes.has("opsdeck-launching"), true);
  h.advance(660);
  assert.equal(h.shell.inert, false);
});

test("a restored browser history page releases the snapshot even with an unfinished load", () => {
  const h = harness();
  h.pageHide();
  h.advance(6000);
  h.pageShow();
  h.advance(4352);
  assert.equal(h.shell.inert, false);
  assert.equal(h.classes.has("opsdeck-launching"), false);
});
