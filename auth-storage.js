(function attachAuthStorage(scope) {
  "use strict";
  const SIGNED_OUT_KEY = "opsdeck-explicit-sign-out-v1";

  function create(storage) {
    let blocked = storage.getItem(SIGNED_OUT_KEY) === "true";
    return {
      get blocked() { return blocked || storage.getItem(SIGNED_OUT_KEY) === "true"; },
      getItem(key) { return this.blocked ? null : storage.getItem(key); },
      setItem(key, value) { if (!this.blocked) storage.setItem(key, value); },
      removeItem(key) { storage.removeItem(key); },
      allow() { blocked = false; storage.removeItem(SIGNED_OUT_KEY); },
      block(key) {
        blocked = true;
        const markerSaved = storage.setItem(SIGNED_OUT_KEY, "true") !== false;
        let removed = true;
        for (const suffix of ["", "-code-verifier", "-user"]) {
          if (storage.removeItem(`${key}${suffix}`) === false) removed = false;
        }
        return markerSaved && removed;
      },
    };
  }

  const api = { SIGNED_OUT_KEY, create };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else scope.OpsDeckAuthStorage = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
