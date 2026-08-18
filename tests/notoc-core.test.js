const assert = require("node:assert/strict");
const test = require("node:test");
const { POLICY_PACK } = require("../notoc-policy");
const {
  EXPECTATIONS,
  STATES,
  evaluateEma,
  evaluateNotocIndicator,
  evaluateNotocSession,
  lookupHandlingCode,
  normaliseCode,
  validatePolicyPack,
} = require("../notoc-core");

const installedLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "INSTALLED",
  securelyAttached: "YES",
  isolatedAgainstInadvertentActivation: "YES",
  operatorApprovalConfirmed: "YES",
  location: { type: "HOLD", rawText: "CPT 5" },
  ...overrides,
});

const removedLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "REMOVED",
  wattHours: 299,
  terminalsProtected: "YES",
  operatorApprovalConfirmed: "YES",
  location: { type: "CABIN", rawText: "Cabin" },
  ...overrides,
});

const spareLithium = (overrides = {}) => ({
  id: "ema-1",
  mobilityAidConfirmed: "YES",
  batteryType: "LITHIUM",
  installedStatus: "SPARE",
  spareCount: 1,
  wattHours: 300,
  terminalsProtected: "YES",
  operatorApprovalConfirmed: "YES",
  location: { type: "CABIN", rawText: "Cabin" },
  ...overrides,
});

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

test("installed lithium above 300 Wh is not failed by the removed-battery limit", () => {
  const result = evaluateEma(installedLithium({ wattHours: 450 }), POLICY_PACK);
  assert.equal(result.logicState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(result.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
  assert.equal(result.expectation, EXPECTATIONS.CONDITIONAL);
});

test("installed lithium does not require Wh as a decisive input", () => {
  const result = evaluateEma(installedLithium({ wattHours: undefined }), POLICY_PACK);
  assert.equal(result.logicState, STATES.NO_OBVIOUS_INCONSISTENCY);
});

test("installed lithium with isolation confirmed no is a possible discrepancy", () => {
  const result = evaluateEma(installedLithium({ isolatedAgainstInadvertentActivation: "NO" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

test("installed lithium with isolation unknown requires information", () => {
  const result = evaluateEma(installedLithium({ isolatedAgainstInadvertentActivation: "UNKNOWN" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("removed lithium at 299 Wh follows the consistent branch", () => {
  const result = evaluateEma(removedLithium(), POLICY_PACK);
  assert.equal(result.logicState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(result.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
});

test("removed lithium at exactly 300 Wh passes the numerical threshold", () => {
  const result = evaluateEma(removedLithium({ wattHours: 300 }), POLICY_PACK);
  assert.equal(result.logicState, STATES.NO_OBVIOUS_INCONSISTENCY);
});

test("removed lithium above 300 Wh is a possible discrepancy without rounding down", () => {
  const result = evaluateEma(removedLithium({ wattHours: 300.01 }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

test("removed lithium with missing Wh requires information", () => {
  const result = evaluateEma(removedLithium({ wattHours: null }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("removed lithium without confirmed terminal protection requires action", () => {
  const result = evaluateEma(removedLithium({ terminalsProtected: "NO" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("removed lithium shown in the hold is a possible discrepancy", () => {
  const result = evaluateEma(removedLithium({ location: { type: "HOLD", rawText: "CPT 5" } }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

test("removed lithium with location not shown requires information", () => {
  const result = evaluateEma(removedLithium({ location: { type: "NOT_SHOWN", rawText: "" } }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
});

test("one protected 300 Wh spare in the cabin follows the consistent branch", () => {
  const result = evaluateEma(spareLithium(), POLICY_PACK);
  assert.equal(result.logicState, STATES.NO_OBVIOUS_INCONSISTENCY);
  assert.equal(result.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
});

test("two lithium spares are a possible discrepancy", () => {
  const result = evaluateEma(spareLithium({ spareCount: 2 }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

test("spare lithium shown in the hold is a possible discrepancy", () => {
  const result = evaluateEma(spareLithium({ location: { type: "HOLD", rawText: "CPT 5" } }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

test("unknown battery type stays amber and does not fire a lithium rule", () => {
  const result = evaluateEma(installedLithium({ batteryType: "UNKNOWN" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.ACTION_OR_INFORMATION_REQUIRED);
  assert.equal(result.findings[0].ruleId, "BA-CDGM-NOTOC-CODE-MAPPING-MISSING");
});

test("a spare spillable battery is a possible discrepancy", () => {
  const result = evaluateEma(installedLithium({ batteryType: "SPILLABLE", installedStatus: "SPARE" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

test("an installed spillable battery refers and never produces green", () => {
  const result = evaluateEma(installedLithium({ batteryType: "SPILLABLE" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
});

test("a non-spillable configuration refers and never produces green", () => {
  const result = evaluateEma(installedLithium({ batteryType: "NON_SPILLABLE" }), POLICY_PACK);
  assert.equal(result.overallState, STATES.UNABLE_TO_DETERMINE_REFER);
});

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

test("an item-level red result overrides indicator-level consistency", () => {
  const item = evaluateEma(removedLithium({ location: { type: "HOLD", rawText: "CPT 5" } }), POLICY_PACK);
  const result = evaluateNotocSession(
    { loadsheetNotocIndicator: "YES", rawCodes: [], allRelevantVisibleCodesEntered: true },
    [item],
    POLICY_PACK
  );
  assert.equal(result.overallState, STATES.POSSIBLE_DISCREPANCY_QUERY);
});

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
