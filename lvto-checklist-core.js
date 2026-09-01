(function attachLvtoChecklistCore(globalScope) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const ITEM_TYPES = new Set(["check", "decision", "field", "heading", "note", "reference"]);
  const INPUT_MODES = new Set(["text", "numeric", "decimal"]);
  const validId = (value) => typeof value === "string" && /^[a-z][a-z0-9.-]{0,119}$/.test(value);
  const validText = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 6000;
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

  function allItems(policy) {
    return policy.sections.flatMap((section) => section.items);
  }

  function validatePolicy(policy) {
    if (!isObject(policy) || policy.schemaVersion !== SCHEMA_VERSION || !validId(policy.id) ||
      !validText(policy.title) || !validText(policy.revision) || !validText(policy.status) ||
      !Array.isArray(policy.sections) || !policy.sections.length || policy.sections.length > 20 ||
      (policy.sourceHash !== undefined && !/^[a-f0-9]{64}$/.test(policy.sourceHash)) ||
      (policy.sources !== undefined && (!Array.isArray(policy.sources) || !policy.sources.every(isObject)))) return false;

    const ids = new Set();
    const decisionOptions = new Map();
    for (const section of policy.sections) {
      if (!isObject(section) || !validId(section.id) || ids.has(section.id) || !validText(section.title) ||
        !Array.isArray(section.items) || !section.items.length || section.items.length > 100 ||
        (section.openByDefault !== undefined && typeof section.openByDefault !== "boolean")) return false;
      ids.add(section.id);
      for (const item of section.items) {
        if (!isObject(item) || !validId(item.id) || ids.has(item.id) || !ITEM_TYPES.has(item.type) ||
          (item.layoutGroup !== undefined && !validId(item.layoutGroup)) ||
          (item.tone !== undefined && !validId(item.tone))) return false;
        ids.add(item.id);
        if (["check", "decision", "heading", "note"].includes(item.type) && !validText(item.text)) return false;
        if (item.type === "field" && (!validText(item.label) ||
          (item.inputMode !== undefined && !INPUT_MODES.has(item.inputMode)) ||
          (item.unit !== undefined && !validText(item.unit)) ||
          (item.maxLength !== undefined && (!Number.isInteger(item.maxLength) || item.maxLength < 1 || item.maxLength > 120)))) return false;
        if (item.type === "reference" && (!validText(item.label) || !validText(item.value))) return false;
        if (item.type === "decision") {
          if (!Array.isArray(item.options) || item.options.length < 2 || item.options.length > 4 ||
            !item.options.every((option) => isObject(option) && validId(option.id) && validText(option.label)) ||
            new Set(item.options.map((option) => option.id)).size !== item.options.length) return false;
          decisionOptions.set(item.id, new Set(item.options.map((option) => option.id)));
        }
      }
    }

    return allItems(policy).every((item) => item.condition === undefined ||
      (isObject(item.condition) && validId(item.condition.decisionId) && validId(item.condition.equals) &&
        decisionOptions.get(item.condition.decisionId)?.has(item.condition.equals)));
  }

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function policyHash(policy, cryptoApi) {
    const digest = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(policy)));
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  function newState(userId, hash, now = new Date().toISOString()) {
    return {
      schemaVersion: SCHEMA_VERSION,
      userId,
      policyHash: hash,
      startedAt: now,
      updatedAt: now,
      completedIds: [],
      values: {},
      decisions: {},
    };
  }

  function restoreState(policy, userId, hash, stored, now) {
    const fresh = newState(userId, hash, now);
    if (!isObject(stored) || stored.schemaVersion !== SCHEMA_VERSION || stored.userId !== userId ||
      stored.policyHash !== hash || !Array.isArray(stored.completedIds) || !isObject(stored.values) ||
      !isObject(stored.decisions)) return fresh;

    const policyItems = allItems(policy);
    const checks = new Set(policyItems.filter((item) => item.type === "check").map((item) => item.id));
    const fields = new Map(policyItems.filter((item) => item.type === "field").map((item) => [item.id, item]));
    const decisions = new Map(policyItems.filter((item) => item.type === "decision").map((item) =>
      [item.id, new Set(item.options.map((option) => option.id))]));
    const restoredValues = {};
    for (const [id, value] of Object.entries(stored.values)) {
      const field = fields.get(id);
      if (field && typeof value === "string") restoredValues[id] = value.slice(0, field.maxLength || 80);
    }
    const restoredDecisions = {};
    for (const [id, value] of Object.entries(stored.decisions)) {
      if (typeof value === "string" && decisions.get(id)?.has(value)) restoredDecisions[id] = value;
    }
    return {
      ...fresh,
      startedAt: Number.isFinite(Date.parse(stored.startedAt)) ? stored.startedAt : fresh.startedAt,
      updatedAt: Number.isFinite(Date.parse(stored.updatedAt)) ? stored.updatedAt : fresh.updatedAt,
      completedIds: [...new Set(stored.completedIds.filter((id) => checks.has(id)))],
      values: restoredValues,
      decisions: restoredDecisions,
    };
  }

  function isVisible(item, state) {
    return !item.condition || state.decisions[item.condition.decisionId] === item.condition.equals;
  }

  function setChecked(policy, state, itemId, checked, now = new Date().toISOString()) {
    const item = allItems(policy).find((entry) => entry.id === itemId && entry.type === "check");
    if (!item || !isVisible(item, state)) return state;
    const completed = new Set(state.completedIds);
    if (checked) completed.add(itemId);
    else completed.delete(itemId);
    return { ...state, completedIds: [...completed], updatedAt: now };
  }

  function setValue(policy, state, itemId, value, now = new Date().toISOString()) {
    const item = allItems(policy).find((entry) => entry.id === itemId && entry.type === "field");
    if (!item || !isVisible(item, state) || typeof value !== "string") return state;
    return {
      ...state,
      values: { ...state.values, [itemId]: value.slice(0, item.maxLength || 80) },
      updatedAt: now,
    };
  }

  function setDecision(policy, state, itemId, value, now = new Date().toISOString()) {
    const item = allItems(policy).find((entry) => entry.id === itemId && entry.type === "decision");
    if (!item || (value !== null && !item.options.some((option) => option.id === value))) return state;
    const decisions = { ...state.decisions };
    if (value === null) delete decisions[itemId];
    else decisions[itemId] = value;
    return { ...state, decisions, updatedAt: now };
  }

  function clearChecks(state, now = new Date().toISOString()) {
    return { ...state, completedIds: [], updatedAt: now };
  }

  function hasProgress(state) {
    return Boolean(state.completedIds.length || Object.keys(state.values).some((id) => state.values[id]) ||
      Object.keys(state.decisions).length);
  }

  function updatedLabel(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "";
    const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
    const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
    return `Updated ${day} at ${time}Z`;
  }

  function storageKey(kind, userId) {
    return `opsdeck-lvto-${kind}-v1:${userId}`;
  }

  function readSaved(storage, kind, userId) {
    if (!storage || !userId) return null;
    try {
      const value = JSON.parse(storage.getItem(storageKey(kind, userId)) || "null");
      return value?.userId === userId ? value : null;
    } catch (_) {
      return null;
    }
  }

  const api = {
    SCHEMA_VERSION,
    allItems,
    validatePolicy,
    canonicalJson,
    policyHash,
    newState,
    restoreState,
    isVisible,
    setChecked,
    setValue,
    setDecision,
    clearChecks,
    hasProgress,
    updatedLabel,
    storageKey,
    readSaved,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalScope.OpsDeckLvtoChecklist = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
