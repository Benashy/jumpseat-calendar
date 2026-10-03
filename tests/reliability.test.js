const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const storageApi = require("../device-storage");
const authApi = require("../auth-storage");
const { boundedFetch } = require("../network");
const app = fs.readFileSync(require.resolve("../app.js"), "utf8");
const fn = (name) => app.match(new RegExp("^(?:async )?function " + name + "\\([^]*?^}", "m"))[0];
function memoryStorage() {
  const map = new Map();
  return { map, getItem: (key) => map.get(key) ?? null, setItem: (key, value) => map.set(key, value), removeItem: (key) => map.delete(key) };
}

test("private device records are scoped by verified owner, never adopted by a guest", () => {
  const disk = memoryStorage();
  disk.setItem("opsdeck-jumpseat-state-v2", "legacy private data");
  const storage = storageApi.create(() => disk);
  assert.equal(storage.getItem("opsdeck-jumpseat-state-v2"), null);
  storage.setOwner("a", true);
  assert.equal(storage.getItem("opsdeck-jumpseat-state-v2"), "legacy private data");
  assert.equal(disk.getItem("opsdeck-jumpseat-state-v2"), null);
  storage.setOwner("b");
  assert.equal(storage.getItem("opsdeck-jumpseat-state-v2"), null);
  storage.setItem("opsdeck-jumpseat-state-v2", "b records");
  storage.setOwner("a");
  storage.forgetOwner();
  assert.equal(disk.getItem("opsdeck-jumpseat-state-v2:a"), null);
  assert.equal(disk.getItem("opsdeck-jumpseat-state-v2:b"), "b records");
});

test("quota failure preserves new input in memory without claiming persistence", () => {
  const disk = memoryStorage();
  const storage = storageApi.create(() => disk);
  storage.setOwner("a");
  storage.setItem("opsdeck-calculator-state-v1", "old");
  const save = disk.setItem;
  disk.setItem = () => { throw new Error("quota"); };
  assert.equal(storage.setItem("opsdeck-calculator-state-v1", "new"), false);
  assert.equal(storage.saved, false);
  assert.equal(storage.getItem("opsdeck-calculator-state-v1"), "new");
  disk.setItem = save;
  assert.equal(storage.setItem("opsdeck-calculator-state-v1", "new"), true);
  assert.equal(storage.saved, true);
});

test("legacy records survive a failed migration and storage getter failure cannot throw", () => {
  const disk = memoryStorage();
  disk.setItem("opsdeck-calculator-state-v1", "original");
  disk.setItem = () => { throw new Error("quota"); };
  const storage = storageApi.create(() => disk);
  storage.setOwner("a", true);
  assert.equal(disk.getItem("opsdeck-calculator-state-v1"), "original");
  assert.equal(storage.getItem("opsdeck-calculator-state-v1"), "original");
  const blocked = storageApi.create(() => { throw new Error("storage blocked"); });
  assert.equal(blocked.getItem("anything"), null);
  assert.equal(blocked.setItem("anything", "value"), false);
});

test("explicit sign-out blocks stale tokens and refresh writes across reload", () => {
  const disk = memoryStorage();
  const storage = storageApi.create(() => disk);
  const auth = authApi.create(storage);
  auth.setItem("token", "old");
  auth.block("token");
  auth.setItem("token", "late refresh");
  assert.equal(disk.getItem("token"), null);
  assert.equal(authApi.create(storage).getItem("token"), null);
  auth.allow();
  auth.setItem("token", "explicit login");
  assert.equal(auth.getItem("token"), "explicit login");
});

test("offline readiness probes actual storage and recovers only after a successful recheck", () => {
  const disk = memoryStorage();
  const storage = storageApi.create(() => disk);
  assert.equal(storage.probe(), true);
  assert.equal(disk.map.size, 0);
  const write = disk.setItem;
  disk.setItem = () => { throw new Error("quota"); };
  assert.equal(storage.probe(), false);
  assert.equal(storage.saved, false);
  disk.setItem = write;
  assert.equal(storage.probe(), true);
  assert.equal(storage.saved, true);
});

test("restricted Wi-Fi requests terminate and caller cancellation is preserved", async () => {
  const stalled = (url, { signal }) => new Promise((resolve, reject) => {
    if (signal.aborted) reject(new Error("aborted"));
    else signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  });
  await assert.rejects(boundedFetch(stalled, 15)("https://example.test"), /aborted/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(boundedFetch(stalled)("https://example.test", { signal: controller.signal }), /aborted/);
});

function cloudHarness() {
  let finish;
  const response = new Promise((resolve) => { finish = resolve; });
  const query = { select() { return this; }, eq() { return this; }, maybeSingle() { return response; } };
  const c = {
    supabaseClient: { from: () => query }, currentUser: { id: "a" }, navigator: { onLine: true },
    sessionGeneration: 1, calculatorLoadGeneration: 0, calculatorChangeRevision: 0,
    calculatorCloudLoaded: false, calculatorLocalDirty: false, calculatorCloudUpdatedAt: "base", calculatorLocalBaseUpdatedAt: "base",
    local: { state: { marker: "old local" }, dirty: false, baseUpdatedAt: "base" }, displayed: { marker: "old local" },
    loadCalculatorEnvelope() { return c.local; }, setSyncStatus() {},
    applyCalculatorState(value) { c.displayed = value; }, saveCalculatorEnvelope() {}, setCloudSuccessStatus() {},
    handleCalculatorCloudConflict() { c.conflict = true; }, async saveCloudCalculatorState() {},
  };
  vm.runInNewContext(fn("loadCloudCalculatorState"), c);
  return { c, finish };
}

for (const forceCloud of [false, true]) test(`late cloud reads preserve newer input (refresh=${forceCloud})`, async () => {
  const { c, finish } = cloudHarness();
  const loading = c.loadCloudCalculatorState({ forceCloud });
  c.calculatorChangeRevision++;
  c.displayed = { marker: "typed during load" };
  c.local = { state: c.displayed, dirty: true, baseUpdatedAt: "base" };
  finish({ data: { state: { marker: "older cloud" }, updated_at: "base" }, error: null });
  await loading;
  assert.equal(c.displayed.marker, "typed during load");
});

test("late cloud reads cannot cross account or session boundaries", async () => {
  const { c, finish } = cloudHarness();
  const loading = c.loadCloudCalculatorState();
  c.currentUser = { id: "b" }; c.sessionGeneration++;
  c.displayed = { marker: "account b" };
  finish({ data: { state: { marker: "account a" }, updated_at: "base" }, error: null });
  await loading;
  assert.equal(c.displayed.marker, "account b");
});

test("a genuinely divergent cloud copy raises a conflict and retains local inputs", async () => {
  const { c, finish } = cloudHarness();
  const loading = c.loadCloudCalculatorState();
  c.local.dirty = true; c.calculatorChangeRevision++;
  finish({ data: { state: { marker: "other device" }, updated_at: "later" }, error: null });
  await loading;
  assert.equal(c.conflict, true);
  assert.equal(c.displayed.marker, "old local");
});
