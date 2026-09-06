(function attachOfflineDevice(globalScope) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const STORAGE_KEY = "opsdeck-trusted-offline-device-v1";
  const USER_ID_PATTERN = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

  function validProfile(value) {
    return Boolean(value) && value.schemaVersion === SCHEMA_VERSION &&
      typeof value.userId === "string" && USER_ID_PATTERN.test(value.userId) &&
      Number.isFinite(Date.parse(value.verifiedAt));
  }

  function remember(storage, userId, now = new Date().toISOString()) {
    if (!storage || !USER_ID_PATTERN.test(userId || "") || !Number.isFinite(Date.parse(now))) return null;
    const profile = { schemaVersion: SCHEMA_VERSION, userId, verifiedAt: now };
    storage.setItem(STORAGE_KEY, JSON.stringify(profile));
    return profile;
  }

  function read(storage) {
    if (!storage) return null;
    try {
      const profile = JSON.parse(storage.getItem(STORAGE_KEY) || "null");
      return validProfile(profile) ? profile : null;
    } catch (_) {
      return null;
    }
  }

  function forget(storage) {
    try {
      storage?.removeItem(STORAGE_KEY);
    } catch (_) {
      // Signing out must still continue when browser storage is unavailable.
    }
  }

  const api = { SCHEMA_VERSION, STORAGE_KEY, validProfile, remember, read, forget };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalScope.OpsDeckOfflineDevice = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
