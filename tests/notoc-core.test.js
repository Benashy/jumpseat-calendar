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
  lookupHandlingCode,
  normaliseCode,
  resolveEmaBranchId,
  searchHandlingCodes,
  validatePolicyPack,
} = require("../notoc-core");

const installedLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "INSTALLED",
  handlingConfirmed: "YES",
  notocContentConfirmed: "YES",
  loadsheetNotocIndicator: "YES",
  location: { type: "HOLD", rawText: "CPT 5" },
  ...overrides,
});

const removedLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "REMOVED",
  lithiumLimitBand: "ONE_300",
  handlingConfirmed: "YES",
  loadsheetNotocIndicator: "YES",
  location: { type: "CABIN", rawText: "Cabin" },
  ...overrides,
});

const spareLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "SPARE",
  lithiumLimitBand: "ONE_300",
  handlingConfirmed: "YES",
  loadsheetNotocIndicator: "YES",
  location: { type: "CABIN", rawText: "Cabin" },
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

test("development policy pack is structurally valid and visibly development-only", () => {
  assert.equal(POLICY_PACK.status, "DEVELOPMENT");
  assert.match(POLICY_PACK.version, /development/i);
  assert.deepEqual(validatePolicyPack(POLICY_PACK), { valid: true, errors: [] });
});

test("normalises only case and harmless whitespace", () => {
  assert.equal(normaliseCode(" w clb \n"), "WCLB");
});

test("unknown code remains unknown and refers", () => {
  const lookup = lookupHandlingCode(" wclb ", POLICY_PACK);
  assert.equal(lookup.rawCode, " wclb ");
  assert.equal(lookup.normalisedCode, "WCLB");
  assert.equal(lookup.expectation, EXPECTATIONS.UNKNOWN);
  assert.equal(lookup.finding.state, STATES.UNABLE_TO_DETERMINE_REFER);
});

test("an empty verified code library offers no suggestions", () => {
  assert.deepEqual(searchHandlingCodes("wheelchair", POLICY_PACK), []);
});

test("search suggestions match code, alias and description in a useful order", () => {
  const pack = JSON.parse(JSON.stringify(POLICY_PACK));
  pack.handlingCodes.push(
    {
      code: "WCLB",
      aliases: ["WC-LB"],
      description: "Wheelchair with lithium battery",
      expectation: EXPECTATIONS.REQUIRED,
      verificationStatus: "VERIFIED_CURRENT_MANUAL",
    },
    {
      code: "DG01",
      aliases: ["BATTERY"],
      description: "Lithium battery test entry",
      expectation: EXPECTATIONS.CONDITIONAL,
      verificationStatus: "VERIFIED_CURRENT_MANUAL",
    }
  );

  assert.deepEqual(searchHandlingCodes("wcl", pack).map((entry) => entry.code), ["WCLB"]);
  assert.deepEqual(searchHandlingCodes("wc-lb", pack).map((entry) => entry.code), ["WCLB"]);
  assert.deepEqual(searchHandlingCodes("lithium", pack).map((entry) => entry.code), ["DG01", "WCLB"]);
});

test("search suggestions respect the result limit", () => {
  const pack = JSON.parse(JSON.stringify(POLICY_PACK));
  pack.handlingCodes.push(
    { code: "AAA1", aliases: [], description: "First fixture" },
    { code: "AAA2", aliases: [], description: "Second fixture" },
    { code: "AAA3", aliases: [], description: "Third fixture" }
  );

  assert.deepEqual(searchHandlingCodes("aaa", pack, 2).map((entry) => entry.code), ["AAA1", "AAA2"]);
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
  assert.equal(lookup.finding.state, STATES.NO_OBVIOUS_INCONSISTENCY);
});

test("a controlled private mapping creates verified and unresolved lookup branches", () => {
  const source = {
    document: "BA manual",
    section: "Section 9",
    revision: "Current revision",
  };
  setHandlingCodeMapping([
    {
      code: "ICE",
      aliases: ["RMD"],
      description: "Dry ice",
      appearsOn: ["LOADSHEET", "NOTOC"],
      expectation: EXPECTATIONS.REQUIRED,
      conditions: "Cross-check the documented quantity and stowage.",
      crewAction: "Query any mismatch.",
      source,
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
      source,
      verificationStatus: "UNVERIFIED_NOT_FOUND",
    },
  ], { policyVersion: "test-private-policy" });

  try {
    const ice = lookupHandlingCode("rmd", POLICY_PACK);
    const unresolved = lookupHandlingCode("ZZZ", POLICY_PACK);
    assert.equal(ice.finding.state, STATES.NO_OBVIOUS_INCONSISTENCY);
    assert.match(ice.finding.explanation, /documented quantity and stowage/i);
    assert.equal(unresolved.finding.state, STATES.UNABLE_TO_DETERMINE_REFER);
    assert.match(unresolved.finding.explanation, /not fully verified/i);
    assert.deepEqual(validatePolicyPack(POLICY_PACK), { valid: true, errors: [] });
  } finally {
    resetHandlingCodeMapping();
  }
});

test("a confirmed non-mobility aid ends as not applicable", () => {
  const result = evaluateEma({
    id: "ema-1",
    mobilityAidConfirmed: "NO",
  }, POLICY_PACK);

  assert.equal(result.overallState, STATES.NOT_APPLICABLE);
  assert.equal(result.findings[0].heading, "This guidance does not apply");
});

test("mobility-aid guidance refers when the private controlled policy is unavailable", () => {
  const result = evaluateEma(installedLithium(), POLICY_PACK);
  assert.equal(result.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
  assert.match(result.findings[0].explanation, /not available on this device/i);
});

test("all 15 documented configurations resolve to the intended branch", () => {
  const cases = [
    [installedLithium(), "LI-I"],
    [removedLithium(), "LI-R-1-300"],
    [removedLithium({ lithiumLimitBand: "TWO_160" }), "LI-R-2-160"],
    [spareLithium(), "LI-S-1-300"],
    [spareLithium({ lithiumLimitBand: "TWO_160" }), "LI-S-2-160"],
    [{ ...installedLithium(), batteryType: "DRY_CELL" }, "DRY-I"],
    [{ ...installedLithium(), batteryType: "DRY_CELL", installedStatus: "REMOVED" }, "DRY-R"],
    [{ ...installedLithium(), batteryType: "DRY_CELL", installedStatus: "SPARE", spareCountBand: "ONE" }, "DRY-S-1"],
    [{ ...installedLithium(), batteryType: "NON_SPILLABLE" }, "NSW-I"],
    [{ ...installedLithium(), batteryType: "NON_SPILLABLE", installedStatus: "REMOVED" }, "NSW-R"],
    [{ ...installedLithium(), batteryType: "NON_SPILLABLE", installedStatus: "SPARE", spareCountBand: "ONE" }, "NSW-S-1"],
    [{ ...installedLithium(), batteryType: "SPILLABLE", spillableInstalledStatus: "CONFIRMED" }, "WET-I-UP"],
    [{ ...installedLithium(), batteryType: "SPILLABLE", installedStatus: "REMOVED", spillableRemovalReason: "UNSECURED" }, "WET-R-UNSECURED"],
    [{ ...installedLithium(), batteryType: "SPILLABLE", installedStatus: "REMOVED", spillableRemovalReason: "NOT_UPRIGHT" }, "WET-R-NOUPRIGHT"],
    [{ ...installedLithium(), batteryType: "SPILLABLE", installedStatus: "SPARE" }, "WET-S"],
  ];

  cases.forEach(([entry, expectedBranch]) => assert.equal(resolveEmaBranchId(entry), expectedBranch));
});

test("installed lithium has no Wh limit in this cross-check and can complete green", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ wattHours: 450 }), POLICY_PACK);
  assert.equal(result.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(result.expectation, EXPECTATIONS.REQUIRED);
}));

test("secure handling answered no is a possible discrepancy", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ handlingConfirmed: "NO" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("missing secure handling confirmation requests information", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ handlingConfirmed: "UNKNOWN" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
}));

test("a documented removed lithium configuration is accepted logically but refers where internal NOTOC detail is incomplete", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium(), POLICY_PACK);
  assert.equal(result.logicState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(result.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
}));

test("lithium quantities outside the documented bands are queried", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ lithiumLimitBand: "EXCEEDS" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("an unconfirmed lithium quantity requests the manufacturer's rating", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ lithiumLimitBand: "UNKNOWN" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.match(result.findings[0].action, /manufacturer/i);
}));

test("removed lithium shown in the hold is a possible discrepancy", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ location: { type: "HOLD", rawText: "CPT 5" } }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("a location not shown requests confirmation", () => withMobilityPolicy(() => {
  const result = evaluateEma(removedLithium({ location: { type: "NOT_SHOWN", rawText: "" } }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
}));

test("one dry-cell spare refers conservatively while more than one is queried", () => withMobilityPolicy(() => {
  const one = evaluateEma({
    ...installedLithium(),
    batteryType: "DRY_CELL",
    installedStatus: "SPARE",
    spareCountBand: "ONE",
  }, POLICY_PACK);
  const more = evaluateEma({
    ...installedLithium(),
    batteryType: "DRY_CELL",
    installedStatus: "SPARE",
    spareCountBand: "MORE_THAN_ONE",
  }, POLICY_PACK);
  assert.equal(one.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
  assert.equal(more.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("dry-cell and non-spillable installed branches remain distinct and verified", () => withMobilityPolicy(() => {
  const dry = evaluateEma({ ...installedLithium(), batteryType: "DRY_CELL" }, POLICY_PACK);
  const nonSpillable = evaluateEma({ ...installedLithium(), batteryType: "NON_SPILLABLE" }, POLICY_PACK);
  assert.equal(dry.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(nonSpillable.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.notEqual(dry.details[0].value, nonSpillable.details[0].value);
}));

test("spillable installed and no-upright removal branches can complete, while an unsecured removal refers", () => withMobilityPolicy(() => {
  const installed = evaluateEma({
    ...installedLithium(),
    batteryType: "SPILLABLE",
    spillableInstalledStatus: "CONFIRMED",
  }, POLICY_PACK);
  const noUpright = evaluateEma({
    ...installedLithium(),
    batteryType: "SPILLABLE",
    installedStatus: "REMOVED",
    spillableRemovalReason: "NOT_UPRIGHT",
  }, POLICY_PACK);
  const unsecured = evaluateEma({
    ...installedLithium(),
    batteryType: "SPILLABLE",
    installedStatus: "REMOVED",
    spillableRemovalReason: "UNSECURED",
  }, POLICY_PACK);
  assert.equal(installed.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(noUpright.overallState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(unsecured.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
}));

test("a spare spillable battery is a possible discrepancy", () => withMobilityPolicy(() => {
  const result = evaluateEma({
    ...installedLithium(),
    batteryType: "SPILLABLE",
    installedStatus: "SPARE",
  }, POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
}));

test("unknown battery type stays amber and does not fire a configuration rule", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ batteryType: "UNKNOWN" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.equal(result.findings[0].ruleId, "BA-CDGM-NOTOC-CODE-MAPPING-MISSING");
}));

test("a known NOTOC code mismatch is queried", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ notocContentConfirmed: "NO" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
  assert.match(result.findings[0].explanation, /WBL/);
}));

test("final loadsheet NOTOC NO is queried and directs the Captain to the dispatcher", () => withMobilityPolicy(() => {
  const result = evaluateEma(installedLithium({ loadsheetNotocIndicator: "NO" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
  assert.match(result.findings[0].action, /dispatcher/i);
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
  const item = evaluateEma(removedLithium({ location: { type: "HOLD", rawText: "CPT 5" } }), POLICY_PACK);
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
    evaluateEma(removedLithium({ location: { type: "HOLD" } }), POLICY_PACK),
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
