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

function policyRecord(mapping) {
  return {
    policy_version: "2026-08-18.1",
    mapping_sha256: "a".repeat(64),
    updated_at: "2026-08-18T21:00:00.000Z",
    mapping,
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
  store.save(storage, "user-a", policyRecord([mappingEntry()]));

  assert.equal(store.load(storage, "user-a").mapping[0].code, "ICE");
  assert.equal(store.load(storage, "user-b"), null);
});

test("summary keeps unresolved codes explicit", () => {
  const summary = store.summarise([
    mappingEntry(),
    mappingEntry({ code: "AVP", verificationStatus: "UNVERIFIED_NOT_FOUND", expectation: "UNKNOWN" }),
  ]);

  assert.deepEqual(summary, {
    codeCount: 2,
    verifiedCount: 1,
    unresolvedCodes: ["AVP"],
  });
});
