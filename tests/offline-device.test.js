const assert = require("node:assert/strict");
const test = require("node:test");
const offlineDevice = require("../offline-device");

const USER_ID = "72a66d00-daf8-4d3c-b682-2d20aac967aa";

function storage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test("trusted offline device records only a validated account identity", () => {
  const device = storage();
  const profile = offlineDevice.remember(device, USER_ID, "2026-09-06T07:00:00Z");
  assert.deepEqual(profile, {
    schemaVersion: 1,
    userId: USER_ID,
    verifiedAt: "2026-09-06T07:00:00Z",
  });
  assert.deepEqual(offlineDevice.read(device), profile);
  assert.equal(offlineDevice.remember(device, "not-an-account"), null);
});

test("trusted offline device rejects damaged or altered profiles and clears on sign-out", () => {
  const device = storage();
  device.setItem(offlineDevice.STORAGE_KEY, "not-json");
  assert.equal(offlineDevice.read(device), null);
  device.setItem(offlineDevice.STORAGE_KEY, JSON.stringify({ schemaVersion: 2, userId: USER_ID, verifiedAt: "2026-09-06T07:00:00Z" }));
  assert.equal(offlineDevice.read(device), null);
  offlineDevice.remember(device, USER_ID);
  offlineDevice.forget(device);
  assert.equal(offlineDevice.read(device), null);
});
