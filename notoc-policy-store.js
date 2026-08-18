(function attachNotocPolicyStore(globalScope) {
  "use strict";

  const CACHE_SCHEMA_VERSION = 1;
  const CACHE_KEY_PREFIX = "opsdeck-notoc-policy-v1";
  const EXPECTATIONS = new Set(["REQUIRED", "NOT_EXPECTED", "CONDITIONAL", "UNKNOWN"]);
  const VERIFICATION_STATUSES = new Set([
    "VERIFIED_CURRENT_MANUAL",
    "CODE_VERIFIED_NOTOC_UNVERIFIED",
    "UNVERIFIED_NOT_FOUND",
  ]);

  function cacheKey(userId) {
    return `${CACHE_KEY_PREFIX}:${String(userId || "")}`;
  }

  function validateMapping(mapping) {
    if (!Array.isArray(mapping) || mapping.length === 0) return false;

    const codes = new Set();
    return mapping.every((entry) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
      const code = String(entry.code || "").trim().toUpperCase();
      if (!code || codes.has(code)) return false;
      codes.add(code);

      return (
        Array.isArray(entry.aliases) &&
        entry.aliases.every((alias) => typeof alias === "string") &&
        typeof entry.description === "string" &&
        Array.isArray(entry.appearsOn) &&
        entry.appearsOn.every((location) => typeof location === "string") &&
        EXPECTATIONS.has(entry.expectation) &&
        typeof entry.conditions === "string" &&
        typeof entry.crewAction === "string" &&
        entry.source &&
        typeof entry.source.document === "string" &&
        typeof entry.source.section === "string" &&
        typeof entry.source.revision === "string" &&
        VERIFICATION_STATUSES.has(entry.verificationStatus)
      );
    });
  }

  function normaliseRecord(record, userId) {
    if (!record || typeof record !== "object") return null;
    if (!userId || !validateMapping(record.mapping)) return null;

    const policyVersion = String(record.policy_version || record.policyVersion || "").trim();
    const mappingSha256 = String(record.mapping_sha256 || record.mappingSha256 || "").trim();
    const updatedAt = String(record.updated_at || record.updatedAt || "").trim();
    if (!policyVersion || !/^[a-f0-9]{64}$/i.test(mappingSha256)) return null;
    if (updatedAt && Number.isNaN(Date.parse(updatedAt))) return null;

    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      userId: String(userId),
      policyVersion,
      mappingSha256,
      updatedAt: updatedAt || null,
      cachedAt: new Date().toISOString(),
      mapping: record.mapping,
    };
  }

  function save(storage, userId, record) {
    const envelope = normaliseRecord(record, userId);
    if (!envelope) throw new Error("The BA code library did not pass validation.");
    storage.setItem(cacheKey(userId), JSON.stringify(envelope));
    return envelope;
  }

  function load(storage, userId) {
    if (!storage || !userId) return null;

    try {
      const raw = storage.getItem(cacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.schemaVersion !== CACHE_SCHEMA_VERSION || parsed.userId !== String(userId)) return null;
      return normaliseRecord(parsed, userId);
    } catch (_error) {
      return null;
    }
  }

  function summarise(mapping) {
    const entries = Array.isArray(mapping) ? mapping : [];
    return {
      codeCount: entries.length,
      verifiedCount: entries.filter((entry) => entry.verificationStatus === "VERIFIED_CURRENT_MANUAL").length,
      unresolvedCodes: entries
        .filter((entry) => entry.verificationStatus === "UNVERIFIED_NOT_FOUND")
        .map((entry) => String(entry.code || "").toUpperCase()),
    };
  }

  const api = {
    CACHE_SCHEMA_VERSION,
    cacheKey,
    load,
    normaliseRecord,
    save,
    summarise,
    validateMapping,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckNotocPolicyStore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
