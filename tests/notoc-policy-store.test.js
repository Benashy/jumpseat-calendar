const assert = require("node:assert/strict");
const test = require("node:test");
const store = require("../notoc-policy-store");

function mappingEntry(overrides = {}) {
  return {
    code: "ICE",
    aliases: ["RMD"],
    description: "Dry ice",
    appearsOn: ["LOADSHEET", "NOTOC"],
    expectation: "REQUIRED",
    conditions: "Documented conditions.",
    crewAction: "Cross-check the entry.",
    source: {
      document: "BA manual",
      section: "Section 9",
      revision: "Current revision",
    },
    verificationStatus: "VERIFIED_CURRENT_MANUAL",
    ...overrides,
  };
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
  };
}

function mobilityPolicy() {
  const configurations = {
    "LI-I": "INSTALLED",
    "LI-R-1-300": "REMOVED",
    "LI-R-2-160": "REMOVED",
    "LI-S-1-300": "SPARE",
    "LI-S-2-160": "SPARE",
    "DRY-I": "INSTALLED",
    "DRY-R": "REMOVED",
    "DRY-S-1": "SPARE",
    "NSW-I": "INSTALLED",
    "NSW-R": "REMOVED",
    "NSW-S-1": "SPARE",
    "WET-I-UP": "INSTALLED",
    "WET-R-UNSECURED": "REMOVED",
    "WET-R-NOUPRIGHT": "REMOVED",
    "WET-S": "SPARE",
  };
  return {
    policy_version: "test-mobility-policy",
    decision_branches: Object.entries(configurations).map(([id, configuration]) => ({
      id,
      battery_type: "TEST",
      configuration,
      status: "TEST",
      result_if_consistent: "Test result",
      conditions: [],
      location: [configuration === "INSTALLED" ? "HOLD" : "CABIN"],
      notoc: { required: true },
      sources: [{ evidence_class: "INTERNAL_BA", document: "Test source", section: "Test section" }],
    })),
  };
}

function policyRecord(mapping, mobility = null) {
  return {
    policy_version: "2026-08-18.2",
    mapping_sha256: "a".repeat(64),
    updated_at: "2026-08-18T21:00:00.000Z",
    mapping,
    mobility_policy: mobility,
    mobility_policy_sha256: mobility ? "b".repeat(64) : null,
  };
}

test("accepts a complete controlled mapping entry", () => {
  assert.equal(store.validateMapping([mappingEntry()]), true);
});

test("rejects duplicate codes and unsupported verification states", () => {
  assert.equal(store.validateMapping([mappingEntry(), mappingEntry()]), false);
  assert.equal(store.validateMapping([mappingEntry({ verificationStatus: "GUESSED" })]), false);
});

test("cache is isolated by authenticated user id", () => {
  const storage = memoryStorage();
  store.save(storage, "user-a", policyRecord([mappingEntry()], mobilityPolicy()));

  assert.equal(store.load(storage, "user-a").mapping[0].code, "ICE");
  assert.equal(store.load(storage, "user-a").mobilityPolicy.decision_branches.length, 15);
  assert.equal(store.load(storage, "user-b"), null);
});

test("private mobility policy requires all controlled branches and a hash", () => {
  const complete = mobilityPolicy();
  assert.equal(store.validateMobilityAidPolicy(complete), true);
  assert.equal(store.validateMobilityAidPolicy({
    ...complete,
    decision_branches: complete.decision_branches.slice(1),
  }), false);

  const invalidHash = store.normaliseRecord({
    ...policyRecord([mappingEntry()], complete),
    mobility_policy_sha256: "invalid",
  }, "user-a");
  assert.equal(invalidHash.mobilityPolicy, null);
});

test("summary keeps unresolved codes explicit", () => {
  const summary = store.summarise([
    mappingEntry(),
    mappingEntry({ code: "ZZZ", verificationStatus: "UNVERIFIED_NOT_FOUND", expectation: "UNKNOWN" }),
  ]);

  assert.deepEqual(summary, {
    codeCount: 2,
    verifiedCount: 1,
    unresolvedCodes: ["ZZZ"],
  });
});
