const assert = require("node:assert/strict");
const test = require("node:test");
const {
  POLICY_PACK,
  resetHandlingCodeMapping,
  resetMobilityAidPolicy,
  setHandlingCodeMapping,
  setMobilityAidPolicy,
} = require("../notoc-policy");
const {
  EXPECTATIONS,
  STATES,
  evaluateEma,
  evaluateNotocIndicator,
  evaluateNotocSession,
  listVerifiedHandlingCodes,
  lookupHandlingCode,
  normaliseCode,
  resolveEmaBranchId,
  resolveEmaBranchIds,
  searchHandlingCodes,
  validatePolicyPack,
} = require("../notoc-core");

const installedLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "INSTALLED",
  spareLithiumBand: "NONE",
  notocContentConfirmed: "YES",
  loadsheetNotocIndicator: "YES",
  ...overrides,
});

const removedLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "REMOVED",
  lithiumLimitBand: "ONE_300",
  spareLithiumBand: "NONE",
  notocContentConfirmed: "YES",
  loadsheetNotocIndicator: "YES",
  ...overrides,
});

const mobilityBranchFixture = (id, batteryType, configuration, location, notocRequired, dgslCode = null) => ({
  id,
  battery_type: batteryType,
  configuration,
  status: "TEST_FIXTURE",
  result_if_consistent: "Test result",
  conditions: ["Test handling condition"],
  location: [location],
  packaging: [],
  notoc: {
    required: notocRequired,
    dgsl_code: dgslCode,
  },
  sources: [{
    evidence_class: "INTERNAL_BA",
    document: "Synthetic BA test source",
    section: "Test section",
  }],
});

const mobilityPolicyFixture = {
  policy_version: "test-mobility-policy",
  decision_branches: [
    mobilityBranchFixture("LI-I", "LITHIUM_ION", "INSTALLED", "HOLD", true, "WBL"),
    mobilityBranchFixture("LI-R-1-300", "LITHIUM_ION", "REMOVED", "CABIN", true),
    mobilityBranchFixture("LI-R-2-160", "LITHIUM_ION", "REMOVED", "CABIN", true),
    mobilityBranchFixture("LI-S-1-300", "LITHIUM_ION", "SPARE", "CABIN", true),
    mobilityBranchFixture("LI-S-2-160", "LITHIUM_ION", "SPARE", "CABIN", "UNKNOWN"),
    mobilityBranchFixture("DRY-I", "DRY_CELL", "INSTALLED", "HOLD", true, "WBD"),
    mobilityBranchFixture("DRY-R", "DRY_CELL", "REMOVED", "HOLD", "UNKNOWN"),
    mobilityBranchFixture("DRY-S-1", "DRY_CELL", "SPARE", "HOLD", "UNKNOWN"),
    mobilityBranchFixture("NSW-I", "NON_SPILLABLE_WET", "INSTALLED", "HOLD", true, "WBD"),
    mobilityBranchFixture("NSW-R", "NON_SPILLABLE_WET", "REMOVED", "HOLD", "UNKNOWN"),
    mobilityBranchFixture("NSW-S-1", "NON_SPILLABLE_WET", "SPARE", "HOLD", "UNKNOWN"),
    mobilityBranchFixture("WET-I-UP", "SPILLABLE_WET", "INSTALLED", "HOLD", true, "WBW"),
    mobilityBranchFixture("WET-R-UNSECURED", "SPILLABLE_WET", "REMOVED", "HOLD", true, "WBW"),
    mobilityBranchFixture("WET-R-NOUPRIGHT", "SPILLABLE_WET", "REMOVED", "HOLD", true, "WBW"),
    mobilityBranchFixture("WET-S", "SPILLABLE_WET", "SPARE", "HOLD", false),
  ],
};

function withMobilityPolicy(callback) {
  setMobilityAidPolicy(mobilityPolicyFixture, { policyVersion: "test-mobility-policy" });
  try {
    return callback();
  } finally {
    resetMobilityAidPolicy();
  }
}

const handlingSourceFixture = {
  document: "BA manual",
  section: "Section 9",
  revision: "Current revision",
};

function handlingEntryFixture(code, overrides = {}) {
  return {
    code,
    aliases: [],
    description: `${code} test entry`,
    appearsOn: ["LOADSHEET"],
    expectation: EXPECTATIONS.REQUIRED,
    conditions: "A NOTOC is required for this verified test entry.",
    crewAction: "",
    source: handlingSourceFixture,
    verificationStatus: "VERIFIED_CURRENT_MANUAL",
    ...overrides,
  };
}

function withHandlingMapping(entries, callback) {
  setHandlingCodeMapping(entries, { policyVersion: "test-private-policy" });
  try {
    return callback();
  } finally {
    resetHandlingCodeMapping();
  }
}

test("development policy pack is structurally valid and visibly development-only", () => {
  assert.equal(POLICY_PACK.status, "DEVELOPMENT");
  assert.match(POLICY_PACK.version, /development/i);
  assert.deepEqual(validatePolicyPack(POLICY_PACK), { valid: true, errors: [] });
});

test("normalises only case and harmless whitespace", () => {
  assert.equal(normaliseCode(" w clb \n"), "WCLB");
});

test("a code outside verified guidance stays unavailable without exposing unresolved records", () => {
  const lookup = lookupHandlingCode(" wclb ", POLICY_PACK);
  assert.equal(lookup.rawCode, " wclb ");
  assert.equal(lookup.normalisedCode, "WCLB");
  assert.equal(lookup.expectation, EXPECTATIONS.UNKNOWN);
  assert.equal(lookup.finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.equal(lookup.matched, false);
  assert.equal(lookup.finding.explanation, "Code not available in verified NOTOC guidance.");
  assert.equal(lookup.finding.action, undefined);
});

test("an empty verified code library offers no suggestions", () => {
  assert.deepEqual(searchHandlingCodes("wheelchair", POLICY_PACK), []);
});

test("search suggestions match code, alias and description in a useful order", () => {
  withHandlingMapping([
    handlingEntryFixture("WCLB", {
      aliases: ["WC-LB"],
      description: "Wheelchair with lithium battery",
    }),
    handlingEntryFixture("DG01", {
      aliases: ["BATTERY"],
      description: "Lithium battery test entry",
      expectation: EXPECTATIONS.NOT_EXPECTED,
    }),
  ], () => {
    assert.deepEqual(searchHandlingCodes("wcl", POLICY_PACK).map((entry) => entry.code), ["WCLB"]);
    assert.deepEqual(searchHandlingCodes("wc-lb", POLICY_PACK).map((entry) => entry.code), ["WCLB"]);
    assert.deepEqual(searchHandlingCodes("lithium", POLICY_PACK).map((entry) => entry.code), ["DG01", "WCLB"]);
  });
});

test("search suggestions respect the result limit", () => {
  withHandlingMapping([
    handlingEntryFixture("AAA1", { description: "First fixture" }),
    handlingEntryFixture("AAA2", { description: "Second fixture" }),
    handlingEntryFixture("AAA3", { description: "Third fixture" }),
  ], () => {
    assert.deepEqual(searchHandlingCodes("aaa", POLICY_PACK, 2).map((entry) => entry.code), ["AAA1", "AAA2"]);
  });
});

test("an exact verified code fixture returns its mapped description and expectation", () => {
  const pack = JSON.parse(JSON.stringify(POLICY_PACK));
  pack.rules.push({
    id: "FIXTURE-CODE-RULE",
    title: "Verified test fixture",
    domain: "SHC_CODE",
    classification: "APP_GUIDANCE",
    verificationStatus: "VERIFIED_CURRENT_MANUAL",
    sourceIds: ["OPSDECK-NOTOC-APP-GUIDANCE"],
    requiredInputs: [],
    releaseStatus: "ACTIVE",
  });
  pack.handlingCodes.push({
    code: "TEST",
    aliases: [],
    description: "Verified fixture description",
    appearsOn: ["LOADSHEET"],
    expectation: EXPECTATIONS.REQUIRED,
    sourceIds: ["OPSDECK-NOTOC-APP-GUIDANCE"],
    ruleId: "FIXTURE-CODE-RULE",
    verificationStatus: "VERIFIED_CURRENT_MANUAL",
    releaseStatus: "ACTIVE",
  });

  const lookup = lookupHandlingCode("test", pack);
  assert.equal(lookup.matched, true);
  assert.equal(lookup.description, "Verified fixture description");
  assert.equal(lookup.expectation, EXPECTATIONS.REQUIRED);
  assert.equal(lookup.finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.equal(lookup.finding.heading, "NOTOC required");
});

test("a controlled private mapping creates verified and unresolved lookup branches", () => {
  setHandlingCodeMapping([
    {
      code: "ICE",
      aliases: ["RMD"],
      description: "Dry ice",
      appearsOn: ["LOADSHEET", "NOTOC"],
      expectation: EXPECTATIONS.REQUIRED,
      conditions: "Cross-check the documented quantity and stowage.",
      crewAction: "Query any mismatch.",
      source: handlingSourceFixture,
      verificationStatus: "VERIFIED_CURRENT_MANUAL",
    },
    {
      code: "ZZZ",
      aliases: [],
      description: "No authoritative mapping found",
      appearsOn: [],
      expectation: EXPECTATIONS.UNKNOWN,
      conditions: "Do not infer the meaning.",
      crewAction: "Refer.",
      source: handlingSourceFixture,
      verificationStatus: "UNVERIFIED_NOT_FOUND",
    },
  ], { policyVersion: "test-private-policy" });

  try {
    const ice = lookupHandlingCode("rmd", POLICY_PACK);
    const unresolved = lookupHandlingCode("ZZZ", POLICY_PACK);
    assert.equal(ice.finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
    assert.equal(ice.finding.heading, "NOTOC required");
    assert.match(ice.finding.explanation, /documented quantity and stowage/i);
    assert.equal(unresolved.finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
    assert.equal(unresolved.matched, false);
    assert.equal(unresolved.finding.explanation, "Code not available in verified NOTOC guidance.");
    assert.deepEqual(listVerifiedHandlingCodes(POLICY_PACK).map((entry) => entry.code), ["ICE"]);
    assert.deepEqual(validatePolicyPack(POLICY_PACK), { valid: true, errors: [] });
  } finally {
    resetHandlingCodeMapping();
  }
});

test("the visible library contains only verified yes or no outcomes", () => {
  withHandlingMapping([
    handlingEntryFixture("REQ"),
    handlingEntryFixture("NOPE", { expectation: EXPECTATIONS.NOT_EXPECTED }),
    handlingEntryFixture("COND", { expectation: EXPECTATIONS.CONDITIONAL }),
    handlingEntryFixture("OLD", { verificationStatus: "CODE_VERIFIED_NOTOC_UNVERIFIED" }),
  ], () => {
    assert.deepEqual(listVerifiedHandlingCodes(POLICY_PACK).map((entry) => entry.code), ["NOPE", "REQ"]);
    assert.deepEqual(searchHandlingCodes("cond", POLICY_PACK), []);
    assert.equal(lookupHandlingCode("COND", POLICY_PACK).matched, false);
    assert.equal(lookupHandlingCode("OLD", POLICY_PACK).matched, false);
  });
});

test("lookup uses amber for required, green for not expected and red for an explicit inconsistency", () => {
  withHandlingMapping([
    handlingEntryFixture("REQ"),
    handlingEntryFixture("NOPE", {
      expectation: EXPECTATIONS.NOT_EXPECTED,
      conditions: "The documented table states that no NOTOC entry is required.",
    }),
    handlingEntryFixture("CAO", {
      description: "Cargo aircraft only",
      conditions: "This is an operational inconsistency on the passenger aircraft.",
    }),
  ], () => {
    const required = lookupHandlingCode("REQ", POLICY_PACK);
    const notExpected = lookupHandlingCode("NOPE", POLICY_PACK);
    const discrepancy = lookupHandlingCode("CAO", POLICY_PACK);
    assert.equal(required.finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
    assert.equal(required.finding.heading, "NOTOC required");
    assert.equal(notExpected.finding.state, STATES.NO_OBVIOUS_INCONSISTENCY);
    assert.equal(notExpected.finding.heading, "NOTOC not expected");
    assert.equal(discrepancy.finding.state, STATES.POSSIBLE_DISCREPANCY_QUERY);
    assert.match(discrepancy.finding.action, /query this code/i);
  });
});

test("generic lookup boilerplate is hidden while code-specific action remains", () => {
  withHandlingMapping([
    handlingEntryFixture("GEN", {
      crewAction: "Treat any mismatch as a suspected NOTOC error. Check NOTOC status on every final loadsheet.",
    }),
    handlingEntryFixture("SPEC", {
      crewAction: "Confirm the documented quantity and stowage.",
    }),
  ], () => {
    assert.equal(lookupHandlingCode("GEN", POLICY_PACK).finding.action, undefined);
    assert.equal(
      lookupHandlingCode("SPEC", POLICY_PACK).finding.action,
      "Confirm the documented quantity and stowage."
    );
  });
});

test("a non-passenger mobility aid directs the user to the correct acceptance route", () => {
  const result = evaluateEma({
    id: "ema-1",
    mobilityAidConfirmed: "NO",
  }, POLICY_PACK);

  assert.equal(result.overallState, STATES.STOP_THIS_CHECK);
  assert.equal(result.findings[0].heading, "Use a different acceptance route");
  assert.match(result.findings[0].action, /stop this check/i);
});

test("mobility-aid guidance gives a direct refresh action when unavailable", () => {
  const result = evaluateEma(installedLithium(), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.match(result.findings[0].explanation, /not loaded on this device/i);
  assert.match(result.findings[0].action, /refresh the app while online/i);
});

test("operating batteries and independent spares resolve to the intended branches", () => {
  const cases = [
    [installedLithium(), "LI-I"],
    [removedLithium(), "LI-R-1-300"],
    [removedLithium({ lithiumLimitBand: "TWO_300_TOTAL" }), "LI-R-2-160"],
    [{ ...installedLithium(), batteryType: "DRY_CELL" }, "DRY-I"],
    [{ ...installedLithium(), batteryType: "DRY_CELL", installedStatus: "REMOVED" }, "DRY-R"],
    [{ ...installedLithium(), batteryType: "NON_SPILLABLE" }, "NSW-I"],
    [{ ...installedLithium(), batteryType: "NON_SPILLABLE", installedStatus: "REMOVED" }, "NSW-R"],
    [{ ...installedLithium(), batteryType: "SPILLABLE" }, "WET-I-UP"],
    [{ ...installedLithium(), batteryType: "SPILLABLE", installedStatus: "REMOVED" }, "WET-R-NOUPRIGHT"],
  ];

  cases.forEach(([entry, expectedBranch]) => assert.equal(resolveEmaBranchId(entry), expectedBranch));
  assert.deepEqual(
    resolveEmaBranchIds(removedLithium({ spareLithiumBand: "ONE_300" })),
    ["LI-R-1-300", "LI-S-1-300"]
  );
  assert.deepEqual(
    resolveEmaBranchIds({
      ...installedLithium(),
      batteryType: "DRY_CELL",
      spareCountBand: "ONE",
    }),
    ["DRY-I", "DRY-S-1"]
  );
});

test("installed lithium has no Wh limit in this cross-check and can complete green", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ wattHours: 450 }), POLICY_PACK);
  assert.equal(result.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(result.expectation, EXPECTATIONS.REQUIRED);
}));

test("a removed operating lithium battery in the cabin completes without an exact code gate", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium(), POLICY_PACK);
  assert.equal(result.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.match(result.details.find((item) => item.label === "Expected NOTOC").value, /mobility aid in the hold/i);
  assert.match(result.details.find((item) => item.label === "Expected NOTOC").value, /removed operating lithium-ion battery in the cabin/i);
  assert.doesNotMatch(result.findings[0].explanation, /source coverage|exact configuration code/i);
}));

test("a removed operating battery and an independent spare are checked together", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ spareLithiumBand: "ONE_300" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.deepEqual(resolveEmaBranchIds(removedLithium({ spareLithiumBand: "ONE_300" })), ["LI-R-1-300", "LI-S-1-300"]);
  assert.match(result.details.find((item) => item.label === "Expected NOTOC").value, /spare lithium-ion battery in the cabin/i);
}));

test("two-battery groups between 301 and 320 Wh require confirmation", () => withMobilityPolicy(() => {
  const removed = evaluateEma(removedLithium({ lithiumLimitBand: "TWO_301_320" }), POLICY_PACK);
  const spare = evaluateEma(installedLithium({ spareLithiumBand: "TWO_301_320" }), POLICY_PACK);
  for (const result of [removed, spare]) {
    assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
    assert.equal(result.findings[0].heading, "Confirm combined battery limit");
    assert.match(result.findings[0].explanation, /IATA 2026 guidance limits each group to 300 Wh combined/i);
  }
}));

test("lithium quantities outside the stated limits are queried", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ lithiumLimitBand: "EXCEEDS" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("an unconfirmed lithium quantity requests the stated rating", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ lithiumLimitBand: "UNKNOWN" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.match(result.findings[0].action, /stated quantity and Wh rating/i);
}));

test("one dry-cell spare completes while more than one is queried", () => withMobilityPolicy(() => {
  const one = evaluateEma({
    ...installedLithium(),
    batteryType: "DRY_CELL",
    spareCountBand: "ONE",
  }, POLICY_PACK);
  const more = evaluateEma({
    ...installedLithium(),
    batteryType: "DRY_CELL",
    spareCountBand: "MORE_THAN_ONE",
  }, POLICY_PACK);
  assert.equal(one.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(more.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("every accepted mobility-aid branch requires observable NOTOC content", () => withMobilityPolicy(() => {
  const result = evaluateEma({
    ...installedLithium(),
    batteryType: "DRY_CELL",
    spareCountBand: "ONE",
    notocContentConfirmed: "NO",
  }, POLICY_PACK);

  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
  assert.equal(result.expectation, EXPECTATIONS.REQUIRED);
  assert.match(result.findings[0].action, /dispatcher or TRM/i);
}));

test("every accepted mobility-aid branch requires the current loadsheet NOTOC indicator", () => withMobilityPolicy(() => {
  const result = evaluateEma({
    ...installedLithium(),
    batteryType: "NON_SPILLABLE",
    installedStatus: "REMOVED",
    spareCountBand: "NONE",
    loadsheetNotocIndicator: "NO",
  }, POLICY_PACK);

  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
  assert.equal(result.expectation, EXPECTATIONS.REQUIRED);
  assert.match(result.findings[0].explanation, /current loadsheet shows NOTOC: NO/i);
}));

test("dry-cell and non-spillable installed branches remain distinct and verified", () => withMobilityPolicy(() => {
  const dry = evaluateEma({ ...installedLithium(), batteryType: "DRY_CELL", spareCountBand: "NONE" }, POLICY_PACK);
  const nonSpillable = evaluateEma({ ...installedLithium(), batteryType: "NON_SPILLABLE", spareCountBand: "NONE" }, POLICY_PACK);
  assert.equal(dry.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(nonSpillable.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.notEqual(dry.details[0].value, nonSpillable.details[0].value);
}));

test("documented spillable installed and removed branches can complete", () => withMobilityPolicy(() => {
  const installed = evaluateEma({
    ...installedLithium(),
    batteryType: "SPILLABLE",
    spareCountBand: "NONE",
  }, POLICY_PACK);
  const removed = evaluateEma({
    ...installedLithium(),
    batteryType: "SPILLABLE",
    installedStatus: "REMOVED",
    spareCountBand: "NONE",
  }, POLICY_PACK);
  assert.equal(installed.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(removed.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
}));

test("a spare spillable battery is a possible discrepancy", () => withMobilityPolicy(() => {
  const result = evaluateEma({
    ...installedLithium(),
    batteryType: "SPILLABLE",
    spareCountBand: "ONE",
  }, POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("unknown battery type stays amber and does not fire a configuration rule", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ batteryType: "UNKNOWN" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.equal(result.findings[0].ruleId, "BA-CDGM-NOTOC-CODE-MAPPING-MISSING");
}));

test("a NOTOC content or location mismatch is queried without requiring an exact code", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ notocContentConfirmed: "NO" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
  assert.match(result.findings[0].explanation, /mobility aid in the hold/i);
  assert.match(result.findings[0].explanation, /removed operating lithium-ion battery in the cabin/i);
  assert.doesNotMatch(result.findings[0].explanation, /WBL/);
  assert.match(result.findings[0].action, /return to this answer and continue/i);
}));

test("final loadsheet NOTOC NO is queried and directs the Captain to the dispatcher", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ loadsheetNotocIndicator: "NO" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
  assert.match(result.findings[0].action, /dispatcher/i);
}));

test("a complete current-loadsheet check reminds the user to verify the final loadsheet", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium(), POLICY_PACK);
  assert.equal(result.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.match(result.findings[0].action, /check that NOTOC: YES remains shown on the final loadsheet/i);
}));

test("NOTOC NO plus required is a possible discrepancy", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "NO", allRelevantVisibleCodesEntered: true },
    [{ expectation: EXPECTATIONS.REQUIRED, verified: true }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

test("NOTOC NO plus unknown refers", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "NO" },
    [{ expectation: EXPECTATIONS.UNKNOWN, verified: false }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.UNABLE_TO_DETERMINE_REFER);
});

test("NOTOC NO plus only verified not-expected entries can be indicator-level green when complete", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "NO", allRelevantVisibleCodesEntered: true },
    [{ expectation: EXPECTATIONS.NOT_EXPECTED, verified: true }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.NO_OBVIOUS_INCONSISTENCY);
});

test("NOTOC NO plus not-expected entries remains amber when completeness is not confirmed", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "NO", allRelevantVisibleCodesEntered: null },
    [{ expectation: EXPECTATIONS.NOT_EXPECTED, verified: true }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("NOTOC YES plus verified required is indicator-level consistent", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "YES" },
    [{ expectation: EXPECTATIONS.REQUIRED, verified: true }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.NO_OBVIOUS_INCONSISTENCY);
});

test("NOTOC YES plus only not-expected entries is amber rather than red", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "YES" },
    [{ expectation: EXPECTATIONS.NOT_EXPECTED, verified: true }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("NOTOC YES plus an unknown code is amber", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "YES" },
    [{ expectation: EXPECTATIONS.UNKNOWN, verified: false }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("a missing indicator plus required item is amber", () => {
  const finding = evaluateNotocIndicator(
    { loadsheetNotocIndicator: "NOT_SHOWN" },
    [{ expectation: EXPECTATIONS.REQUIRED, verified: true }],
    POLICY_PACK
  );
  assert.equal(finding.state, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("an item-level red result overrides indicator-level consistency", () => withMobilityPolicy(() => {
  const item = evaluateEma(removedLithium({ notocContentConfirmed: "NO" }), POLICY_PACK);
  const result = evaluateNotocSession(
    { loadsheetNotocIndicator: "YES", rawCodes: [], allRelevantVisibleCodesEntered: true },
    [item],
    POLICY_PACK
  );
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("every development result retains source traceability", () => {
  const results = [
    evaluateEma(installedLithium(), POLICY_PACK),
    evaluateEma(removedLithium({ notocContentConfirmed: "NO" }), POLICY_PACK),
    evaluateNotocSession({ loadsheetNotocIndicator: "NO", rawCodes: ["UNKNOWN"] }, [], POLICY_PACK),
  ];
  const sourceIds = new Set(POLICY_PACK.sources.map((source) => source.id));

  for (const result of results) {
    for (const finding of result.findings) {
      assert.ok(finding.sourceIds.length > 0);
      assert.ok(finding.sourceIds.every((sourceId) => sourceIds.has(sourceId)));
    }
  }
});

test("protected product-boundary phrases remain exact", () => {
  const sourceText = POLICY_PACK.sources.map((source) => source.supportedText).join("\n");
  assert.match(sourceText, /This tool is a Captain's cross-check\./);
  assert.equal(
    POLICY_PACK.sources.find((source) => source.id === "BA-OMA-NOTOC-SIGNATURE").exactQuote,
    "By signing the NOTOC the aircraft Commander is only acknowledging receipt of written notification of all Dangerous Goods and their location aboard the aircraft."
  );
});
