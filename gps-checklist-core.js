(function attachGpsChecklistCore(globalScope) {
  "use strict";

  const SCHEMA_VERSION = 1;
  const BLOCK_TYPES = new Set(["action", "acknowledgement", "note", "condition", "heading", "bullet"]);
  const CHECKABLE_TYPES = new Set(["action", "acknowledgement"]);
  const AMBER_SECTIONS = new Set(["preliminary-cockpit", "cockpit-preparation", "unexpected-interference"]);
  const validId = (value) => typeof value === "string" && /^[a-z][a-z0-9-]{0,79}$/.test(value);
  const validText = (value) => typeof value === "string" && value.trim().length > 0 && value.length <= 6000;
  const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

  function validatePolicy(policy) {
    if (!isObject(policy) || policy.schemaVersion !== SCHEMA_VERSION || !validId(policy.id) ||
      !validText(policy.title) || !validText(policy.revision) || !Array.isArray(policy.introduction) ||
      !Array.isArray(policy.sections) || !policy.sections.length || policy.sections.length > 40 ||
      !Array.isArray(policy.sources) || !policy.sources.length ||
      (policy.context !== undefined && (!Array.isArray(policy.context) || !policy.context.every((entry) =>
        isObject(entry) && validText(entry.title) && validText(entry.text))))) return false;
    const ids = new Set();
    function blockIsValid(block) {
      if (!isObject(block) || !validId(block.id) || ids.has(block.id) ||
        !BLOCK_TYPES.has(block.type) || !validText(block.text)) return false;
      ids.add(block.id);
      return (block.indent === undefined || [0, 1, 2].includes(block.indent)) &&
        (block.exclusiveGroup === undefined || (CHECKABLE_TYPES.has(block.type) && validId(block.exclusiveGroup))) &&
        (block.personalTechnique === undefined || typeof block.personalTechnique === "boolean");
    }
    if (!policy.introduction.every((block) => !CHECKABLE_TYPES.has(block.type) && blockIsValid(block))) return false;
    return policy.sections.every((section) => {
      if (!isObject(section) || !validId(section.id) || ids.has(section.id) || !validText(section.title) ||
        typeof section.canHide !== "boolean" || !Array.isArray(section.blocks) || !section.blocks.length || section.blocks.length > 100) return false;
      ids.add(section.id);
      return (section.visibilityGroup === undefined || validId(section.visibilityGroup)) &&
        section.blocks.every(blockIsValid);
    }) && policy.sources.every((source) => isObject(source) && validText(source.document) &&
      validText(source.section) && validText(source.revision) && validText(source.pages));
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

  function items(policy) {
    return policy.sections.flatMap((section) => section.blocks.filter((block) => CHECKABLE_TYPES.has(block.type))
      .map((block) => ({ ...block, sectionId: section.id })));
  }

  function newState(userId, hash, now = new Date().toISOString()) {
    return { schemaVersion: SCHEMA_VERSION, userId, policyHash: hash, startedAt: now, updatedAt: now,
      completedIds: [], hiddenSectionIds: [] };
  }

  function restoreState(policy, userId, hash, stored, now) {
    const fresh = newState(userId, hash, now);
    if (!isObject(stored) || stored.schemaVersion !== SCHEMA_VERSION || stored.userId !== userId ||
      stored.policyHash !== hash || !Array.isArray(stored.completedIds) || !Array.isArray(stored.hiddenSectionIds)) return fresh;
    const available = items(policy);
    const completed = new Set(stored.completedIds.filter((id) => available.some((item) => item.id === id)));
    const groups = new Set(available.map((item) => item.exclusiveGroup).filter(Boolean));
    for (const group of groups) {
      const members = available.filter((item) => item.exclusiveGroup === group && completed.has(item.id));
      if (members.length > 1) members.forEach((item) => completed.delete(item.id));
    }
    const hidden = new Set(stored.hiddenSectionIds.filter((id) => policy.sections.some((s) => s.id === id)));
    // A linked section group is either all visible or all hidden.
    for (const section of policy.sections.filter((s) => s.visibilityGroup)) {
      const members = policy.sections.filter((s) => s.visibilityGroup === section.visibilityGroup);
      if (members.some((s) => !hidden.has(s.id))) members.forEach((s) => hidden.delete(s.id));
    }
    return { ...fresh, startedAt: Number.isFinite(Date.parse(stored.startedAt)) ? stored.startedAt : fresh.startedAt,
      updatedAt: Number.isFinite(Date.parse(stored.updatedAt)) ? stored.updatedAt : fresh.updatedAt,
      completedIds: [...completed], hiddenSectionIds: [...hidden] };
  }

  function setChecked(policy, state, itemId, checked, now = new Date().toISOString()) {
    const available = items(policy);
    const item = available.find((entry) => entry.id === itemId);
    if (!item || state.hiddenSectionIds.includes(item.sectionId)) return state;
    const completed = new Set(state.completedIds);
    if (checked) {
      if (item.exclusiveGroup) available.filter((entry) => entry.exclusiveGroup === item.exclusiveGroup)
        .forEach((entry) => completed.delete(entry.id));
      completed.add(itemId);
    } else completed.delete(itemId);
    return { ...state, completedIds: [...completed], updatedAt: now };
  }

  function setSectionVisible(policy, state, sectionId, visible, now = new Date().toISOString()) {
    const section = policy.sections.find((entry) => entry.id === sectionId);
    if (!section) return state;
    const group = section.visibilityGroup ? policy.sections.filter((entry) => entry.visibilityGroup === section.visibilityGroup) : [section];
    const hidden = new Set(state.hiddenSectionIds);
    group.forEach((entry) => visible ? hidden.delete(entry.id) : hidden.add(entry.id));
    return { ...state, hiddenSectionIds: [...hidden], updatedAt: now };
  }

  function progress(policy, state, sectionId) {
    const visible = items(policy).filter((item) => !state.hiddenSectionIds.includes(item.sectionId) &&
      (!sectionId || item.sectionId === sectionId));
    return { checked: visible.filter((item) => state.completedIds.includes(item.id)).length,
      total: visible.length, hiddenSections: state.hiddenSectionIds.length };
  }

  function hiddenSeverity(sectionId) {
    return AMBER_SECTIONS.has(sectionId) ? "amber" : "red";
  }

  function hiddenStatus(policy, state) {
    const hidden = policy.sections.filter((section) => state.hiddenSectionIds.includes(section.id));
    return { count: hidden.length, severity: hidden.length ?
      (hidden.some((section) => hiddenSeverity(section.id) === "red") ? "red" : "amber") : null };
  }

  function updatedLabel(timestamp) {
    const date = new Date(timestamp);
    if (!Number.isFinite(date.getTime())) return "";
    const day = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", timeZone: "UTC" });
    const time = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "UTC" });
    return `Updated ${day} at ${time}Z`;
  }

  function storageKey(kind, userId) {
    return `opsdeck-gps-${kind}-v1:${userId}`;
  }

  function readSaved(storage, kind, userId) {
    if (!storage || !userId) return null;
    try {
      const value = JSON.parse(storage.getItem(storageKey(kind, userId)) || "null");
      return value?.userId === userId ? value : null;
    } catch (_) { return null; }
  }

  const api = { SCHEMA_VERSION, CHECKABLE_TYPES, validatePolicy, canonicalJson, policyHash, items,
    newState, restoreState, setChecked, setSectionVisible, progress, hiddenSeverity, hiddenStatus, updatedLabel, storageKey, readSaved };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else globalScope.OpsDeckGpsChecklist = api;
})(typeof globalThis !== "undefined" ? globalThis : window);
