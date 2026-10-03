(function attachNotocPolicyStore(globalScope) {
  "use strict";

  const CACHE_SCHEMA_VERSION = 2;
  const CACHE_KEY_PREFIX = "opsdeck-notoc-policy-v2";
  const EXPECTATIONS = new Set(["REQUIRED", "NOT_EXPECTED", "CONDITIONAL", "UNKNOWN"]);
  const VERIFICATION_STATUSES = new Set([
    "VERIFIED_CURRENT_MANUAL",
    "CODE_VERIFIED_NOTOC_UNVERIFIED",
    "UNVERIFIED_NOT_FOUND",
  ]);
  const REQUIRED_MOBILITY_BRANCH_IDS = new Set([
    "LI-I",
    "LI-R-1-300",
    "LI-R-2-160",
    "LI-S-1-300",
    "LI-S-2-160",
    "DRY-I",
    "DRY-R",
    "DRY-S-1",
    "NSW-I",
    "NSW-R",
    "NSW-S-1",
    "WET-I-UP",
    "WET-R-UNSECURED",
    "WET-R-NOUPRIGHT",
    "WET-S",
  ]);
  const MOBILITY_CONFIGURATIONS = new Set(["INSTALLED", "REMOVED", "SPARE"]);
  // Exact historical export digests mapped to the verified canonical content digest.
  const LEGACY_DIGESTS = {
    a79ff82f805f758e70d28bd82d2ac080e98cf160bdac9844ab31de3d1b57e526: "8540f335d52d6d0ae7744873af283c9e5cd90ddfe0543c7af52f943dc90add72",
    "7e5cd18e2ca2f07d5f00007c04a709d1e15fcc1c1da38e56ed5ee088a5ac6e5f": "b5caf840d976b776fd4288dc80ef11900c92c67431fb3e783f99de3135936ac7",
  };

  function canonicalJson(value) {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    return JSON.stringify(value);
  }

  async function digest(value, cryptoApi = globalScope.crypto) {
    const bytes = await cryptoApi.subtle.digest("SHA-256", new TextEncoder().encode(canonicalJson(value)));
    return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function verifyRecord(record, userId, cryptoApi) {
    const envelope = normaliseRecord(record, userId);
    if (!envelope) return null;
    try {
      for (const [value, expected] of [[envelope.mapping, envelope.mappingSha256], [envelope.mobilityPolicy, envelope.mobilityPolicySha256]]) {
        if (value && await digest(value, cryptoApi) !== (LEGACY_DIGESTS[expected] || expected)) return null;
      }
      return envelope;
    } catch (_) { return null; }
  }

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

  function validSha256(value) {
    return /^[a-f0-9]{64}$/i.test(String(value || "").trim());
  }

  function validateMobilityAidPolicy(policy) {
    if (!policy || typeof policy !== "object" || Array.isArray(policy)) return false;
    if (typeof policy.policy_version !== "string" || !policy.policy_version.trim()) return false;
    if (!Array.isArray(policy.decision_branches)) return false;

    const branchIds = new Set();
    const branchesValid = policy.decision_branches.every((branch) => {
      if (!branch || typeof branch !== "object" || Array.isArray(branch)) return false;
      if (typeof branch.id !== "string" || !branch.id || branchIds.has(branch.id)) return false;
      branchIds.add(branch.id);
      return (
        typeof branch.battery_type === "string" &&
        MOBILITY_CONFIGURATIONS.has(branch.configuration) &&
        typeof branch.status === "string" &&
        typeof branch.result_if_consistent === "string" &&
        Array.isArray(branch.conditions) &&
        branch.conditions.every((condition) => typeof condition === "string") &&
        Array.isArray(branch.location) &&
        branch.location.every((location) => typeof location === "string") &&
        branch.notoc &&
        typeof branch.notoc === "object" &&
        !Array.isArray(branch.notoc) &&
        Array.isArray(branch.sources) &&
        branch.sources.length > 0 &&
        branch.sources.every((source) => (
          source &&
          typeof source.evidence_class === "string" &&
          typeof source.document === "string" &&
          typeof source.section === "string"
        ))
      );
    });

    return branchesValid && [...REQUIRED_MOBILITY_BRANCH_IDS].every((id) => branchIds.has(id));
  }

  function normaliseRecord(record, userId) {
    if (!record || typeof record !== "object") return null;
    if (!userId || !validateMapping(record.mapping)) return null;

    const policyVersion = String(record.policy_version || record.policyVersion || "").trim();
    const mappingSha256 = String(record.mapping_sha256 || record.mappingSha256 || "").trim();
    const mobilityPolicy = record.mobility_policy || record.mobilityPolicy || null;
    const mobilityPolicySha256 = String(record.mobility_policy_sha256 || record.mobilityPolicySha256 || "").trim();
    const updatedAt = String(record.updated_at || record.updatedAt || "").trim();
    if (!policyVersion || !validSha256(mappingSha256)) return null;
    if (updatedAt && Number.isNaN(Date.parse(updatedAt))) return null;
    const mobilityPolicyValid = validateMobilityAidPolicy(mobilityPolicy) && validSha256(mobilityPolicySha256);

    return {
      schemaVersion: CACHE_SCHEMA_VERSION,
      userId: String(userId),
      policyVersion,
      mappingSha256,
      mobilityPolicySha256: mobilityPolicyValid ? mobilityPolicySha256 : null,
      updatedAt: updatedAt || null,
      cachedAt: Number.isFinite(Date.parse(record.cachedAt)) ? record.cachedAt : new Date().toISOString(),
      mapping: record.mapping,
      mobilityPolicy: mobilityPolicyValid ? mobilityPolicy : null,
    };
  }

  async function save(storage, userId, record) {
    const envelope = await verifyRecord(record, userId);
    if (!envelope) throw new Error("The BA policy did not pass validation.");
    if (storage.setItem(cacheKey(userId), JSON.stringify(envelope)) === false) throw new Error("Offline copy not saved");
    return envelope;
  }

  async function load(storage, userId) {
    if (!storage || !userId) return null;

    try {
      const raw = storage.getItem(cacheKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed.schemaVersion !== CACHE_SCHEMA_VERSION || parsed.userId !== String(userId)) return null;
      return await verifyRecord(parsed, userId);
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
    canonicalJson, digest, verifyRecord,
    CACHE_SCHEMA_VERSION,
    cacheKey,
    load,
    normaliseRecord,
    save,
    summarise,
    validateMapping,
    validateMobilityAidPolicy,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckNotocPolicyStore = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
