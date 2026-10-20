(function attachColdChecklistCore(globalScope) {
  "use strict";
  const shared = typeof module !== "undefined" && module.exports
    ? require("./gps-checklist-core") : globalScope.OpsDeckGpsChecklist;
  const validText = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 6000;

  function validatePolicy(policy) {
    return shared.validatePolicy(policy) && policy.id === "cold-weather" &&
      policy.sections.every((section) => section.blocks.every((block) =>
        !shared.CHECKABLE_TYPES.has(block.type) || (validText(block.referenceLabel) &&
          Array.isArray(block.references) && block.references.length > 0 &&
          block.references.length <= 10 && block.references.every(validText))));
  }

  function storageKey(kind, userId) { return `opsdeck-cold-${kind}-v1:${userId}`; }
  function readSaved(storage, kind, userId) {
    if (!storage || !userId) return null;
    try {
      const value = JSON.parse(storage.getItem(storageKey(kind, userId)) || "null");
      return value?.userId === userId ? value : null;
    } catch (_) { return null; }
  }
  const api = { ...shared, validatePolicy, storageKey, readSaved };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalScope.OpsDeckColdChecklist = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
