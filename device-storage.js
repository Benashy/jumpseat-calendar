(function attachDeviceStorage(scope) {
  "use strict";

  const PRIVATE_KEYS = new Set([
    "jumpseat-calendar-requests-v1", "opsdeck-jumpseat-state-v2",
    "opsdeck-jumpseat-draft-v1", "opsdeck-calculator-state-v1",
  ]);

  function create(getStorage, onChange = () => {}) {
    const memory = new Map();
    const failed = new Set();
    let owner = null;
    const physicalKey = (key) => PRIVATE_KEYS.has(key) ? `${key}:${owner || "guest"}` : key;
    const changed = () => onChange({ saved: failed.size === 0, failedKeys: [...failed] });

    function getItem(key) {
      const target = physicalKey(key);
      if (failed.has(target) || (PRIVATE_KEYS.has(key) && !owner)) return memory.get(target) ?? null;
      try { return getStorage().getItem(target); }
      catch (_) { return memory.get(target) ?? null; }
    }

    function setItem(key, value) {
      const target = physicalKey(key);
      memory.set(target, String(value));
      try {
        if (PRIVATE_KEYS.has(key) && !owner) throw new Error("No saved-data owner");
        getStorage().setItem(target, String(value));
        failed.delete(target);
        changed();
        return true;
      } catch (_) {
        failed.add(target);
        changed();
        return false;
      }
    }

    function removeItem(key) {
      const target = physicalKey(key);
      memory.set(target, null);
      try {
        getStorage().removeItem(target);
        failed.delete(target);
        changed();
        return true;
      } catch (_) {
        failed.add(target);
        changed();
        return false;
      }
    }

    function setOwner(nextOwner, migrateLegacy = false) {
      if (owner !== nextOwner) {
        memory.clear();
        failed.clear();
      }
      owner = nextOwner || null;
      // Legacy records are adopted only for the previously verified device owner.
      if (owner && migrateLegacy) {
        for (const key of PRIVATE_KEYS) {
          try {
            const storage = getStorage();
            const value = storage.getItem(key);
            if (value === null) continue;
            const existing = storage.getItem(physicalKey(key));
            if (existing !== null || setItem(key, value)) storage.removeItem(key);
          } catch (_) { /* Keep the original if migration cannot be persisted. */ }
        }
      }
      changed();
    }

    function forgetOwner() {
      let removed = true;
      for (const key of PRIVATE_KEYS) {
        if (!removeItem(key)) removed = false;
        try { getStorage().removeItem(key); } catch (_) { removed = false; }
      }
      setOwner(null);
      return removed;
    }

    function probe() {
      const key = "opsdeck-storage-probe-v1";
      try {
        const storage = getStorage();
        const value = String(Date.now());
        storage.setItem(key, value);
        if (storage.getItem(key) !== value) throw new Error("Storage did not retain value");
        storage.removeItem(key);
        failed.delete(key); changed(); return true;
      } catch (_) { failed.add(key); changed(); return false; }
    }

    return { getItem, setItem, removeItem, setOwner, forgetOwner, probe,
      get owner() { return owner; }, get saved() { return failed.size === 0; } };
  }

  const api = { PRIVATE_KEYS, create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else scope.OpsDeckStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
