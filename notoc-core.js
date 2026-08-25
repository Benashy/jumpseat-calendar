(function attachNotocCore(globalScope) {
  "use strict";

  const STATES = Object.freeze({
    NO_OBVIOUS_INCONSISTENCY: "NO_OBVIOUS_INCONSISTENCY",
    ACTION_OR_INFORMATION_REQUIRED: "ACTION_OR_INFORMATION_REQUIRED",
    UNABLE_TO_DETERMINE_REFER: "UNABLE_TO_DETERMINE_REFER",
    POSSIBLE_DISCREPANCY_QUERY: "POSSIBLE_DISCREPANCY_QUERY",
    STOP_THIS_CHECK: "STOP_THIS_CHECK",
  });
  const EXPECTATIONS = Object.freeze({
    REQUIRED: "REQUIRED",
    NOT_EXPECTED: "NOT_EXPECTED",
    CONDITIONAL: "CONDITIONAL",
    UNKNOWN: "UNKNOWN",
  });
  const STATE_HEADINGS = Object.freeze({
    [STATES.NO_OBVIOUS_INCONSISTENCY]: "No obvious inconsistency identified",
    [STATES.ACTION_OR_INFORMATION_REQUIRED]: "Confirm before signing",
    [STATES.UNABLE_TO_DETERMINE_REFER]: "Confirm before signing",
    [STATES.POSSIBLE_DISCREPANCY_QUERY]: "Possible discrepancy",
    [STATES.STOP_THIS_CHECK]: "Use a different acceptance route",
  });
  const SEVERITY = Object.freeze({
    [STATES.NO_OBVIOUS_INCONSISTENCY]: 0,
    [STATES.ACTION_OR_INFORMATION_REQUIRED]: 1,
    [STATES.UNABLE_TO_DETERMINE_REFER]: 2,
    [STATES.POSSIBLE_DISCREPANCY_QUERY]: 3,
    [STATES.STOP_THIS_CHECK]: 1,
  });
  const VERIFIED_RULE_STATUSES = new Set([
    "VERIFIED_CURRENT_MANUAL",
    "VERIFIED_CURRENT_PUBLIC_BA",
    "VERIFIED_CURRENT_OFFICIAL_GUIDANCE",
    "REVIEWED_BA_EVIDENCE",
  ]);
  const VERIFIED_SOURCE_STATUSES = new Set([
    "VERIFIED_CURRENT_MANUAL",
    "VERIFIED_SUPPLIED_MANUAL",
    "VERIFIED_CURRENT_PUBLIC_BA",
    "VERIFIED_CURRENT_OFFICIAL_GUIDANCE",
  ]);
  const VERIFIED_LOOKUP_EXPECTATIONS = new Set([
    EXPECTATIONS.REQUIRED,
    EXPECTATIONS.NOT_EXPECTED,
  ]);

  function normaliseCode(rawCode) {
    return String(rawCode || "").trim().toUpperCase().replace(/\s+/g, "");
  }

  function sourceMap(policyPack) {
    return new Map((policyPack?.sources || []).map((source) => [source.id, source]));
  }

  function ruleMap(policyPack) {
    return new Map((policyPack?.rules || []).map((rule) => [rule.id, rule]));
  }

  function isRuleVerified(rule, policyPack) {
    if (!rule || rule.releaseStatus !== "ACTIVE" || !VERIFIED_RULE_STATUSES.has(rule.verificationStatus)) return false;
    const sources = sourceMap(policyPack);
    return rule.sourceIds.every((sourceId) => VERIFIED_SOURCE_STATUSES.has(sources.get(sourceId)?.verificationStatus));
  }

  function isVerifiedHandlingCode(code, policyPack) {
    if (!code || code.releaseStatus !== "ACTIVE") return false;
    if (code.verificationStatus !== "VERIFIED_CURRENT_MANUAL") return false;
    if (!VERIFIED_LOOKUP_EXPECTATIONS.has(code.expectation)) return false;
    return isRuleVerified(ruleMap(policyPack).get(code.ruleId), policyPack);
  }

  function isExplicitHandlingDiscrepancy(code) {
    const evidenceText = `${code?.description || ""} ${code?.conditionSummary || ""}`.toLocaleLowerCase("en-GB");
    return evidenceText.includes("cargo aircraft only") ||
      evidenceText.includes("does not carry") ||
      evidenceText.includes("operational inconsistency");
  }

  function codeSpecificAction(rawAction) {
    const action = String(rawAction || "").trim();
    const normalised = action.toLocaleLowerCase("en-GB");
    if (!action) return undefined;
    if (
      normalised.includes("treat any mismatch as a suspected notoc error") ||
      normalised.includes("check notoc status on every final loadsheet")
    ) return undefined;
    return action;
  }

  function makeFinding(policyPack, options) {
    const rule = ruleMap(policyPack).get(options.ruleId);
    const fallbackSourceId = "BA-SHC-MAPPING-MISSING";
    const sourceIds = options.sourceIds || rule?.sourceIds || [fallbackSourceId];
    const sources = sourceMap(policyPack);
    const resolvedSources = sourceIds.map((sourceId) => sources.get(sourceId)).filter(Boolean);
    const verificationStatus = options.verificationStatus || rule?.verificationStatus ||
      resolvedSources[0]?.verificationStatus || "MISSING_SOURCE";
    const classification = options.classification || rule?.classification ||
      resolvedSources[0]?.classification || "UNSUPPORTED";

    return {
      id: options.id || `${options.ruleId}-${options.entryId || "session"}-${options.state}`,
      entryId: options.entryId,
      state: options.state,
      expectation: options.expectation,
      ruleId: options.ruleId,
      sourceIds,
      classification,
      verificationStatus,
      heading: options.heading || STATE_HEADINGS[options.state],
      explanation: options.explanation,
      action: options.action,
    };
  }

  function resultFromFinding(policyPack, finding, logicState = finding.state) {
    const sources = sourceMap(policyPack);
    return {
      overallState: finding.state,
      logicState,
      expectation: finding.expectation || EXPECTATIONS.UNKNOWN,
      findings: [finding],
      assumptions: [],
      missingInputs: [],
      sourcesApplied: finding.sourceIds.map((sourceId) => sources.get(sourceId)).filter(Boolean),
      policyPackVersion: policyPack?.version || "unknown",
    };
  }

  function developOrConfirm(policyPack, options) {
    const rule = ruleMap(policyPack).get(options.ruleId);
    const candidate = makeFinding(policyPack, {
      ...options,
      state: STATES.NO_OBVIOUS_INCONSISTENCY,
      heading: STATE_HEADINGS[STATES.NO_OBVIOUS_INCONSISTENCY],
    });

    if (isRuleVerified(rule, policyPack)) return resultFromFinding(policyPack, candidate);

    const developmentFinding = makeFinding(policyPack, {
      ...options,
      state: STATES.UNABLE_TO_DETERMINE_REFER,
      heading: STATE_HEADINGS[STATES.UNABLE_TO_DETERMINE_REFER],
      explanation: `${options.explanation} The branch logic is consistent, but the current BA source has not yet been reverified for operational use.`,
      action: "Check the current BA manual or refer through the normal operational channel.",
    });
    return resultFromFinding(policyPack, developmentFinding, STATES.NO_OBVIOUS_INCONSISTENCY);
  }

  function simpleResult(policyPack, options) {
    return resultFromFinding(policyPack, makeFinding(policyPack, options), options.logicState || options.state);
  }

  function unknownChoice(value) {
    return value === undefined || value === null || value === "" || value === "UNKNOWN";
  }

  function locationType(entry) {
    return entry?.location?.type || "NOT_SHOWN";
  }

  const BRANCH_LABELS = Object.freeze({
    "LI-I": "Installed lithium-ion battery",
    "LI-R-1-300": "One removed lithium-ion battery, up to 300 Wh",
    "LI-R-2-160": "Two removed lithium-ion batteries, up to 160 Wh each",
    "LI-S-1-300": "One spare lithium-ion battery, up to 300 Wh",
    "LI-S-2-160": "Two spare lithium-ion batteries, up to 160 Wh each",
    "DRY-I": "Installed dry-cell battery",
    "DRY-R": "Removed dry-cell battery",
    "DRY-S-1": "One spare dry-cell battery",
    "NSW-I": "Installed non-spillable wet battery",
    "NSW-R": "Removed non-spillable wet battery",
    "NSW-S-1": "One spare non-spillable wet battery",
    "WET-I-UP": "Installed spillable wet battery",
    "WET-R-UNSECURED": "Spillable wet battery removed because it was not secure",
    "WET-R-NOUPRIGHT": "Spillable wet battery removed because the aid could not remain upright",
    "WET-S": "Spare spillable wet battery",
  });

  function mobilityBranch(policyPack, branchId) {
    return (policyPack?.mobilityAidPolicy?.decision_branches || []).find((branch) => branch.id === branchId) || null;
  }

  function expectedLocation(branch) {
    const locations = branch?.location || [];
    if (locations.includes("CABIN")) return "CABIN";
    if (locations.some((location) => String(location).startsWith("HOLD"))) return "HOLD";
    return null;
  }

  function normaliseNotocExpectation(value) {
    if (value === true) return EXPECTATIONS.REQUIRED;
    if (value === false) return EXPECTATIONS.NOT_EXPECTED;
    if (value === "REQUIRED") return EXPECTATIONS.REQUIRED;
    if (value === "NOT_EXPECTED") return EXPECTATIONS.NOT_EXPECTED;
    if (value === "CONDITIONAL") return EXPECTATIONS.CONDITIONAL;
    return EXPECTATIONS.UNKNOWN;
  }

  function expectedNotocCode(branch) {
    const code = String(branch?.notoc?.dgsl_code || "").trim().toUpperCase();
    return /^[A-Z0-9]{2,8}$/.test(code) ? code : null;
  }

  function resolveEmaBranchId(entry) {
    const type = entry?.batteryType;
    const configuration = entry?.installedStatus;
    if (type === "LITHIUM") {
      if (configuration === "INSTALLED") return "LI-I";
      if (configuration === "REMOVED" && entry.lithiumLimitBand === "ONE_300") return "LI-R-1-300";
      if (configuration === "REMOVED" && ["TWO_160", "TWO_300_TOTAL", "TWO_301_320"].includes(entry.lithiumLimitBand)) return "LI-R-2-160";
      if (configuration === "SPARE" && entry.lithiumLimitBand === "ONE_300") return "LI-S-1-300";
      if (configuration === "SPARE" && ["TWO_160", "TWO_300_TOTAL", "TWO_301_320"].includes(entry.lithiumLimitBand)) return "LI-S-2-160";
    }
    if (type === "DRY_CELL") {
      if (configuration === "INSTALLED") return "DRY-I";
      if (configuration === "REMOVED") return "DRY-R";
      if (configuration === "SPARE") return "DRY-S-1";
    }
    if (type === "NON_SPILLABLE") {
      if (configuration === "INSTALLED") return "NSW-I";
      if (configuration === "REMOVED") return "NSW-R";
      if (configuration === "SPARE") return "NSW-S-1";
    }
    if (type === "SPILLABLE") {
      if (configuration === "INSTALLED") return "WET-I-UP";
      if (configuration === "REMOVED" && entry.spillableRemovalReason === "UNSECURED") return "WET-R-UNSECURED";
      if (configuration === "REMOVED") return "WET-R-NOUPRIGHT";
      if (configuration === "SPARE") return "WET-S";
    }
    return null;
  }

  function resolveEmaBranchIds(entry) {
    const primaryBranch = resolveEmaBranchId(entry);
    const branchIds = primaryBranch ? [primaryBranch] : [];
    if (entry?.batteryType === "LITHIUM") {
      if (entry.spareLithiumBand === "ONE_300") branchIds.push("LI-S-1-300");
      if (["TWO_300_TOTAL", "TWO_301_320"].includes(entry.spareLithiumBand)) branchIds.push("LI-S-2-160");
    } else if (["DRY_CELL", "NON_SPILLABLE"].includes(entry?.batteryType) && entry.spareCountBand === "ONE") {
      branchIds.push(entry.batteryType === "DRY_CELL" ? "DRY-S-1" : "NSW-S-1");
    } else if (entry?.batteryType === "SPILLABLE" && entry.spareCountBand === "ONE") {
      branchIds.push("WET-S");
    }
    return [...new Set(branchIds)];
  }

  const BATTERY_TYPE_LABELS = Object.freeze({
    LITHIUM: "Lithium-ion",
    DRY_CELL: "Dry cell (NiCd or NiMH)",
    NON_SPILLABLE: "Non-spillable wet",
    SPILLABLE: "Spillable wet",
  });
  const LITHIUM_BAND_LABELS = Object.freeze({
    NONE: "None",
    ONE_300: "One, up to 300 Wh",
    TWO_300_TOTAL: "Two, each up to 160 Wh and up to 300 Wh combined",
    TWO_301_320: "Two, each up to 160 Wh and 301-320 Wh combined",
    TWO_160: "Two, each up to 160 Wh; combined total not confirmed",
    EXCEEDS: "Outside the stated limits",
  });
  const SPARE_COUNT_LABELS = Object.freeze({
    NONE: "None",
    ONE: "One",
    MORE_THAN_ONE: "More than one",
  });

  function hasLithiumSpares(entry) {
    return !unknownChoice(entry?.spareLithiumBand) && entry.spareLithiumBand !== "NONE";
  }

  function hasOtherSpares(entry) {
    return !unknownChoice(entry?.spareCountBand) && entry.spareCountBand !== "NONE";
  }

  function lithiumBandCount(band) {
    if (band === "ONE_300") return 1;
    if (["TWO_160", "TWO_300_TOTAL", "TWO_301_320"].includes(band)) return 2;
    return null;
  }

  function operatingBatterySummary(entry) {
    const type = BATTERY_TYPE_LABELS[entry?.batteryType]?.toLocaleLowerCase("en-GB") || "battery";
    if (entry?.installedStatus === "INSTALLED") return `Installed in the mobility aid, hold`;
    if (entry?.batteryType !== "LITHIUM") return `Removed ${type} battery, hold`;
    const count = lithiumBandCount(entry?.lithiumLimitBand);
    const rating = LITHIUM_BAND_LABELS[entry?.lithiumLimitBand] || "Rating not confirmed";
    const quantity = count ? `${count} removed ${count === 1 ? "battery" : "batteries"}` : "Unconfirmed quantity";
    return `${quantity}, cabin, ${rating.replace(/^One,?\s*/i, "").replace(/^Two,?\s*/i, "")}`;
  }

  function spareBatterySummary(entry) {
    const type = BATTERY_TYPE_LABELS[entry?.batteryType]?.toLocaleLowerCase("en-GB") || "battery";
    if (entry?.batteryType === "LITHIUM") {
      if (!hasLithiumSpares(entry)) return "None";
      const count = lithiumBandCount(entry?.spareLithiumBand);
      const rating = LITHIUM_BAND_LABELS[entry?.spareLithiumBand] || "Rating not confirmed";
      const quantity = count ? `${count} ${type} ${count === 1 ? "battery" : "batteries"}` : "Unconfirmed quantity";
      return `${quantity}, cabin, ${rating.replace(/^One,?\s*/i, "").replace(/^Two,?\s*/i, "")}`;
    }
    if (!hasOtherSpares(entry)) return "None";
    const oneSpare = entry?.spareCountBand === "ONE";
    const count = oneSpare ? "1" : "More than one";
    return `${count} ${type} ${oneSpare ? "battery" : "batteries"}, hold`;
  }

  function mobilityNotocSummary(entry) {
    return [
      { label: "Mobility aid", value: "Hold" },
      { label: "Operating battery", value: operatingBatterySummary(entry) },
      { label: "Additional spares", value: spareBatterySummary(entry) },
    ];
  }

  function expectedMobilityNotoc(entry) {
    const type = BATTERY_TYPE_LABELS[entry?.batteryType]?.toLocaleLowerCase("en-GB") || "battery";
    const parts = [];
    if (entry?.installedStatus === "INSTALLED") {
      parts.push(`the mobility aid with its installed ${type} battery in the hold`);
    } else {
      parts.push("the mobility aid in the hold");
      const operatingCount = entry?.batteryType === "LITHIUM" ? lithiumBandCount(entry?.lithiumLimitBand) : 1;
      const operatingLabel = operatingCount === 2
        ? `both removed operating ${type} batteries`
        : `the removed operating ${type} battery`;
      parts.push(`${operatingLabel} in the ${entry?.batteryType === "LITHIUM" ? "cabin" : "hold"}`);
    }
    if (entry?.batteryType === "LITHIUM" ? hasLithiumSpares(entry) : hasOtherSpares(entry)) {
      const spareCount = entry?.batteryType === "LITHIUM"
        ? lithiumBandCount(entry?.spareLithiumBand)
        : entry?.spareCountBand === "ONE" ? 1 : null;
      const spareLabel = spareCount === 2
        ? `both additional spare ${type} batteries`
        : spareCount === 1
          ? `the additional spare ${type} battery`
          : `all additional spare ${type} batteries`;
      parts.push(`${spareLabel} in the ${entry?.batteryType === "LITHIUM" ? "cabin" : "hold"}`);
    }
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }

  function primaryConfigurationLabel(entry) {
    if (entry?.installedStatus === "INSTALLED") return "Installed in mobility aid";
    if (entry?.batteryType === "LITHIUM") return LITHIUM_BAND_LABELS[entry?.lithiumLimitBand] || "Not confirmed";
    return "Removed from mobility aid";
  }

  function spareConfigurationLabel(entry) {
    if (entry?.batteryType === "LITHIUM") return LITHIUM_BAND_LABELS[entry?.spareLithiumBand] || "Not confirmed";
    return SPARE_COUNT_LABELS[entry?.spareCountBand] || "Not confirmed";
  }

  function mobilityDetails(entry) {
    return [
      { label: "Battery", value: BATTERY_TYPE_LABELS[entry?.batteryType] || "Not confirmed" },
      { label: "Operating battery", value: primaryConfigurationLabel(entry) },
      { label: "Spare batteries", value: spareConfigurationLabel(entry) },
      { label: "Expected NOTOC", value: expectedMobilityNotoc(entry) },
    ];
  }

  function mobilityResult(policyPack, entry, branches, options) {
    const sourceIds = [...new Set(branches.flatMap((branch) => branch?.sourceIds || []))];
    const result = simpleResult(policyPack, {
      entryId: options.entryId,
      ruleId: branches[0]?.ruleId || "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
      sourceIds: sourceIds.length ? sourceIds : undefined,
      expectation: EXPECTATIONS.REQUIRED,
      ...options,
    });
    result.details = mobilityDetails(entry);
    return result;
  }

  function lithiumCapacityIssue(entry, entryId) {
    const sourceIds = [
      "UK-CAA-PASSENGER-MOBILITY-AID-PROVISION",
      "BA-PUBLIC-MOBILITY-AID-OWN-USE",
    ];
    const groups = [];
    if (entry.installedStatus === "REMOVED") groups.push(["removed operating batteries", entry.lithiumLimitBand]);
    groups.push(["spare batteries", entry.spareLithiumBand]);
    const outside = groups.filter(([, band]) => band === "EXCEEDS").map(([label]) => label);
    if (outside.length) {
      return {
        entryId,
        ruleId: "OPSDECK-BA-MOBILITY-AID-LITHIUM-LIMIT",
        sourceIds,
        state: STATES.POSSIBLE_DISCREPANCY_QUERY,
        expectation: EXPECTATIONS.REQUIRED,
        explanation: `The ${outside.join(" and ")} fall outside the stated lithium mobility-aid quantity or rating limits.`,
        action: "Query the battery quantity and stated Wh ratings with the ground team or Dangerous Goods specialist before signing.",
      };
    }
    const unresolved = groups.filter(([, band]) => band === "TWO_160").map(([label]) => label);
    if (unresolved.length) {
      return {
        entryId,
        ruleId: "OPSDECK-BA-MOBILITY-AID-LITHIUM-LIMIT",
        sourceIds,
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        expectation: EXPECTATIONS.REQUIRED,
        heading: "Confirm battery ratings",
        explanation: `The combined rating of the ${unresolved.join(" and ")} has not been entered. Current BA guidance permits two batteries up to 160 Wh each.`,
        action: "Confirm the stated Wh rating of each battery before signing.",
      };
    }
    return null;
  }

  function evaluateEma(entry, policyPack) {
    const entryId = entry?.id || "ema";
    if (entry?.mobilityAidConfirmed === "NO") {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "OPSDECK-MOBILITY-AID-PASSENGER-PROVISION",
        state: STATES.STOP_THIS_CHECK,
        heading: "Passenger mobility-aid route not applicable",
        explanation: "This item cannot be accepted under the passenger mobility-aid allowance because it is not for use by a passenger with reduced mobility travelling on this flight.",
        action: "Stop this check and ask the dispatcher or TRM to confirm the appropriate baggage or dangerous-goods cargo route.",
      });
    }
    if (entry?.mobilityAidConfirmed !== "YES") {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "Confirm that the item is a wheelchair or electric mobility aid before applying these rules.",
        action: "Confirm the item type.",
      });
    }
    if (!policyPack?.mobilityAidPolicy) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "The mobility-aid guidance has not loaded on this device.",
        action: "Refresh the app while online before using this check.",
      });
    }
    if (unknownChoice(entry?.batteryType)) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "The battery type must be confirmed before a configuration-specific check can be made.",
        action: "Confirm the battery type shown for the mobility aid.",
      });
    }
    if (!["INSTALLED", "REMOVED"].includes(entry?.installedStatus)) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "Confirm whether the operating battery is installed in or removed from the mobility aid.",
        action: "Confirm the operating-battery configuration.",
      });
    }

    if (entry.batteryType === "LITHIUM") {
      if (entry.installedStatus === "REMOVED" && unknownChoice(entry.lithiumLimitBand)) {
        return simpleResult(policyPack, {
          entryId,
          ruleId: "OPSDECK-BA-MOBILITY-AID-LITHIUM-LIMIT",
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "The removed operating-battery quantity and Wh category have not been confirmed.",
          action: "Confirm the stated quantity and Wh rating shown for each removed battery.",
        });
      }
      if (unknownChoice(entry.spareLithiumBand)) {
        return simpleResult(policyPack, {
          entryId,
          ruleId: "OPSDECK-BA-MOBILITY-AID-LITHIUM-LIMIT",
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "The presence and rating of any spare lithium batteries have not been confirmed.",
          action: "Confirm whether spare batteries are carried and their stated Wh ratings.",
        });
      }
    } else if (unknownChoice(entry.spareCountBand)) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "The presence of any spare battery has not been confirmed.",
        action: "Confirm whether a spare battery is carried.",
      });
    }

    if (["DRY_CELL", "NON_SPILLABLE"].includes(entry.batteryType) && entry.spareCountBand === "MORE_THAN_ONE") {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.POSSIBLE_DISCREPANCY_QUERY,
        expectation: EXPECTATIONS.REQUIRED,
        explanation: "More than one spare battery is shown, while the reviewed BA guidance permits one spare for this battery type.",
        action: "Query the spare-battery quantity with the ground team before signing.",
      });
    }
    if (entry.batteryType === "SPILLABLE" && entry.spareCountBand !== "NONE") {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.POSSIBLE_DISCREPANCY_QUERY,
        expectation: EXPECTATIONS.NOT_EXPECTED,
        explanation: "A spare spillable battery is shown, but spare spillable batteries are not permitted under the reviewed BA guidance.",
        action: "Query the item with the ground team before signing.",
      });
    }

    const capacityIssue = entry.batteryType === "LITHIUM" ? lithiumCapacityIssue(entry, entryId) : null;
    if (capacityIssue?.state === STATES.POSSIBLE_DISCREPANCY_QUERY) {
      return simpleResult(policyPack, capacityIssue);
    }

    const branchIds = resolveEmaBranchIds(entry);
    const branches = branchIds.map((branchId) => mobilityBranch(policyPack, branchId)).filter(Boolean);
    if (!branchIds.length || branches.length !== branchIds.length) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "The selected battery configuration is not available in the guidance loaded on this device.",
        action: "Refresh the app while online before using this check.",
      });
    }

    const expectedEntry = expectedMobilityNotoc(entry);
    if (entry.notocContentConfirmed !== "YES") {
      return mobilityResult(policyPack, entry, branches, {
        entryId,
        state: entry.notocContentConfirmed === "NO" ? STATES.POSSIBLE_DISCREPANCY_QUERY : STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: entry.notocContentConfirmed === "NO"
          ? `The NOTOC does not show ${expectedEntry}.`
          : "The required mobility-aid and battery locations have not been confirmed on the NOTOC.",
        action: "Ask the dispatcher or TRM to correct the NOTOC, then return to this answer and continue the check.",
      });
    }

    if (entry.loadsheetNotocIndicator !== "YES") {
      return mobilityResult(policyPack, entry, branches, {
        entryId,
        state: entry.loadsheetNotocIndicator === "NO" ? STATES.POSSIBLE_DISCREPANCY_QUERY : STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: entry.loadsheetNotocIndicator === "NO"
          ? "The current loadsheet shows NOTOC: NO, although this mobility aid requires a NOTOC."
          : "The current loadsheet NOTOC indicator has not been confirmed.",
        action: "Ask the dispatcher to correct the NOTOC and loadsheet before signing.",
      });
    }

    if (capacityIssue) {
      return mobilityResult(policyPack, entry, branches, capacityIssue);
    }

    const usesBaTwoBatteryLimit = [entry.lithiumLimitBand, entry.spareLithiumBand].includes("TWO_301_320");
    return mobilityResult(policyPack, entry, branches, {
      entryId,
      state: STATES.NO_OBVIOUS_INCONSISTENCY,
      explanation: usesBaTwoBatteryLimit
        ? "The two-battery configuration is within current BA guidance because each battery is no more than 160 Wh. The NOTOC locations and current loadsheet show no obvious inconsistency."
        : "The battery configuration, NOTOC locations and current loadsheet show no obvious inconsistency against the reviewed guidance.",
      action: "If this is not the final loadsheet, check that NOTOC: YES remains shown on the final loadsheet.",
    });
  }

  function lookupHandlingCode(rawCode, policyPack) {
    const normalised = normaliseCode(rawCode);
    const codes = policyPack?.handlingCodes || [];
    const candidate = codes.find((item) => {
      const values = [item.code, ...(item.aliases || [])].map(normaliseCode);
      return values.includes(normalised);
    });
    const code = isVerifiedHandlingCode(candidate, policyPack) ? candidate : null;

    if (!normalised || !code) {
      const finding = makeFinding(policyPack, {
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        expectation: EXPECTATIONS.UNKNOWN,
        heading: normalised ? "Verified guidance unavailable" : "Enter a code",
        explanation: normalised
          ? "Code not available in verified NOTOC guidance."
          : "Enter an SHC/DG or special-load code exactly as shown.",
        action: normalised ? undefined : "Enter a code to continue.",
      });
      return {
        rawCode: String(rawCode || ""),
        normalisedCode: normalised,
        description: "Code not available",
        expectation: EXPECTATIONS.UNKNOWN,
        finding,
        matched: false,
      };
    }

    const explicitDiscrepancy = isExplicitHandlingDiscrepancy(code);
    const state = explicitDiscrepancy
      ? STATES.POSSIBLE_DISCREPANCY_QUERY
      : code.expectation === EXPECTATIONS.NOT_EXPECTED
        ? STATES.NO_OBVIOUS_INCONSISTENCY
        : STATES.ACTION_OR_INFORMATION_REQUIRED;
    const heading = explicitDiscrepancy
      ? STATE_HEADINGS[STATES.POSSIBLE_DISCREPANCY_QUERY]
      : code.expectation === EXPECTATIONS.NOT_EXPECTED
        ? "NOTOC not expected"
        : "NOTOC required";
    const conditionSummary = String(code.conditionSummary || "").trim();
    const requirementSummary = code.expectation === EXPECTATIONS.NOT_EXPECTED
      ? "A NOTOC is not expected."
      : "A NOTOC is required.";
    const explanation = conditionSummary || requirementSummary;
    const finding = makeFinding(policyPack, {
      ruleId: code.ruleId,
      state,
      expectation: code.expectation,
      sourceIds: code.sourceIds,
      verificationStatus: code.verificationStatus,
      heading,
      explanation,
      action: explicitDiscrepancy ? "Query this code before acceptance." : codeSpecificAction(code.crewAction),
    });

    return {
      rawCode: String(rawCode || ""),
      normalisedCode: normalised,
      description: code.description,
      appearsOn: code.appearsOn,
      expectation: code.expectation,
      conditionSummary: code.conditionSummary,
      crewAction: code.crewAction,
      itemChecker: code.itemChecker,
      finding,
      matched: true,
    };
  }

  function searchHandlingCodes(rawQuery, policyPack, limit = 6) {
    const queryText = String(rawQuery || "").trim();
    const normalisedQuery = normaliseCode(queryText);
    if (!queryText || !normalisedQuery) return [];
    const descriptionQuery = queryText.toLocaleLowerCase("en-GB");
    const maximum = Number.isInteger(limit) && limit > 0 ? limit : 6;

    return (policyPack?.handlingCodes || [])
      .filter((candidate) => isVerifiedHandlingCode(candidate, policyPack))
      .map((candidate) => {
        const code = normaliseCode(candidate.code);
        const aliases = (candidate.aliases || []).map(normaliseCode);
        const description = String(candidate.description || "");
        let score = Number.POSITIVE_INFINITY;
        if (code === normalisedQuery || aliases.includes(normalisedQuery)) score = 0;
        else if (code.startsWith(normalisedQuery)) score = 1;
        else if (aliases.some((alias) => alias.startsWith(normalisedQuery))) score = 2;
        else if (description.toLocaleLowerCase("en-GB").startsWith(descriptionQuery)) score = 3;
        else if (description.toLocaleLowerCase("en-GB").includes(descriptionQuery)) score = 4;
        return { candidate, code, score };
      })
      .filter((item) => Number.isFinite(item.score))
      .sort((left, right) => left.score - right.score || left.code.localeCompare(right.code, "en-GB"))
      .slice(0, maximum)
      .map(({ candidate, code }) => ({
        code,
        description: candidate.description,
        expectation: candidate.expectation,
        verificationStatus: candidate.verificationStatus,
      }));
  }

  function listVerifiedHandlingCodes(policyPack) {
    return (policyPack?.handlingCodes || [])
      .filter((candidate) => isVerifiedHandlingCode(candidate, policyPack))
      .map((candidate) => ({
        code: normaliseCode(candidate.code),
        description: candidate.description,
        expectation: candidate.expectation,
        isExplicitDiscrepancy: isExplicitHandlingDiscrepancy(candidate),
      }))
      .sort((left, right) => left.code.localeCompare(right.code, "en-GB"));
  }

  function aggregateFindings(findings) {
    if (!findings.length) return STATES.UNABLE_TO_DETERMINE_REFER;
    return findings.reduce((current, finding) => (
      SEVERITY[finding.state] > SEVERITY[current] ? finding.state : current
    ), STATES.NO_OBVIOUS_INCONSISTENCY);
  }

  function evaluateNotocIndicator(session, expectations, policyPack) {
    const indicator = session?.loadsheetNotocIndicator || "UNCLEAR";
    const verifiedRequired = expectations.filter((item) => item.expectation === EXPECTATIONS.REQUIRED && item.verified);
    const anyRequired = expectations.filter((item) => item.expectation === EXPECTATIONS.REQUIRED);
    const anyConditionalOrUnknown = expectations.filter((item) => [EXPECTATIONS.CONDITIONAL, EXPECTATIONS.UNKNOWN].includes(item.expectation));
    const onlyNotExpected = expectations.length > 0 && expectations.every((item) => item.expectation === EXPECTATIONS.NOT_EXPECTED);
    const allVerified = expectations.length > 0 && expectations.every((item) => item.verified);
    const base = { ruleId: "OPSDECK-NOTOC-INDICATOR-CROSSCHECK" };

    if (indicator === "NO" && anyRequired.length) {
      return makeFinding(policyPack, {
        ...base,
        state: STATES.POSSIBLE_DISCREPANCY_QUERY,
        explanation: "The final loadsheet is entered as NOTOC: NO, but at least one entered item creates a NOTOC expectation in the policy logic applied.",
        action: "Query with the TRM/Coordinator or equivalent before signing.",
      });
    }
    if (indicator === "NO" && anyConditionalOrUnknown.length) {
      return makeFinding(policyPack, {
        ...base,
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        explanation: "The final loadsheet is entered as NOTOC: NO, but at least one item is conditional or unsupported.",
        action: "Clarify the item and NOTOC requirement.",
      });
    }
    if (indicator === "NO" && onlyNotExpected && session?.allRelevantVisibleCodesEntered === true && allVerified) {
      return makeFinding(policyPack, {
        ...base,
        state: STATES.NO_OBVIOUS_INCONSISTENCY,
        explanation: "All entered items use verified NOTOC-not-expected mappings, every relevant visible code is confirmed entered and the final loadsheet shows NOTOC: NO.",
      });
    }
    if (indicator === "NO" && onlyNotExpected) {
      return makeFinding(policyPack, {
        ...base,
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "A complete verified code set and confirmation that every relevant visible code was entered are required before this indicator-level check can be complete.",
        action: "Confirm completeness and the current code mappings.",
      });
    }
    if (indicator === "YES" && anyRequired.length) {
      return makeFinding(policyPack, {
        ...base,
        state: verifiedRequired.length === anyRequired.length ? STATES.NO_OBVIOUS_INCONSISTENCY : STATES.UNABLE_TO_DETERMINE_REFER,
        explanation: verifiedRequired.length === anyRequired.length
          ? "At indicator level, NOTOC: YES is consistent with the entered verified required item."
          : "NOTOC: YES aligns with an entered required-item branch, but the decisive source is not currently verified in this development policy pack.",
        action: verifiedRequired.length === anyRequired.length ? undefined : "Check the current BA source.",
      });
    }
    if (indicator === "YES") {
      return makeFinding(policyPack, {
        ...base,
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "NOTOC: YES may relate to another item or condition not entered here. It is not a discrepancy by itself.",
        action: "Ensure every relevant visible code has been considered.",
      });
    }
    if (["NOT_SHOWN", "UNCLEAR"].includes(indicator) && anyRequired.length) {
      return makeFinding(policyPack, {
        ...base,
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "An entered item creates a NOTOC expectation, but the final loadsheet NOTOC field is not shown clearly.",
        action: "Confirm the final loadsheet indicator.",
      });
    }
    return makeFinding(policyPack, {
      ...base,
      state: STATES.UNABLE_TO_DETERMINE_REFER,
      explanation: "The information entered is not sufficient for a reliable NOTOC indicator cross-check.",
      action: "Confirm the loadsheet field and every relevant visible item.",
    });
  }

  function evaluateNotocSession(session, itemResults, policyPack) {
    const codeLookups = (session?.rawCodes || []).filter((code) => String(code).trim()).map((code) => lookupHandlingCode(code, policyPack));
    const items = Array.isArray(itemResults) ? itemResults : [];
    const expectations = [
      ...codeLookups.map((lookup) => ({
        id: lookup.normalisedCode,
        expectation: lookup.expectation,
        verified: lookup.finding.verificationStatus === "VERIFIED_CURRENT_MANUAL" && lookup.finding.state !== STATES.UNABLE_TO_DETERMINE_REFER,
      })),
      ...items.map((item, index) => ({
        id: item.findings?.[0]?.entryId || `item-${index + 1}`,
        expectation: item.expectation,
        verified: item.findings?.every((finding) => finding.verificationStatus === "VERIFIED_CURRENT_MANUAL") && item.overallState !== STATES.UNABLE_TO_DETERMINE_REFER,
      })),
    ];
    const indicatorFinding = evaluateNotocIndicator(session, expectations, policyPack);
    const findings = [
      ...codeLookups.map((lookup) => lookup.finding),
      ...items.flatMap((item) => item.findings || []),
      indicatorFinding,
    ];
    const overallState = aggregateFindings(findings);
    const sources = sourceMap(policyPack);
    const sourceIds = [...new Set(findings.flatMap((finding) => finding.sourceIds))];

    return {
      overallState,
      findings,
      codeLookups,
      expectations,
      assumptions: [],
      missingInputs: [],
      sourcesApplied: sourceIds.map((sourceId) => sources.get(sourceId)).filter(Boolean),
      policyPackVersion: policyPack?.version || "unknown",
    };
  }

  function validatePolicyPack(policyPack) {
    const errors = [];
    const sources = sourceMap(policyPack);
    const rules = policyPack?.rules || [];
    const ruleIds = new Set(rules.map((rule) => rule.id));
    for (const rule of rules) {
      for (const sourceId of rule.sourceIds || []) {
        if (!sources.has(sourceId)) errors.push(`Rule ${rule.id} uses missing source ${sourceId}.`);
      }
      if (rule.releaseStatus === "ACTIVE" && rule.classification !== "APP_GUIDANCE" && !isRuleVerified(rule, policyPack)) {
        errors.push(`Active rule ${rule.id} is not supported by verified current sources.`);
      }
    }
    for (const code of policyPack?.handlingCodes || []) {
      if (!ruleIds.has(code.ruleId)) errors.push(`Code ${code.code} uses missing rule ${code.ruleId}.`);
      for (const sourceId of code.sourceIds || []) {
        if (!sources.has(sourceId)) errors.push(`Code ${code.code} uses missing source ${sourceId}.`);
      }
    }
    return { valid: errors.length === 0, errors };
  }

  const api = {
    EXPECTATIONS,
    STATES,
    STATE_HEADINGS,
    aggregateFindings,
    evaluateEma,
    evaluateNotocIndicator,
    evaluateNotocSession,
    expectedMobilityNotoc,
    mobilityNotocSummary,
    expectedLocation,
    expectedNotocCode,
    isRuleVerified,
    listVerifiedHandlingCodes,
    lookupHandlingCode,
    mobilityBranch,
    normaliseCode,
    normaliseNotocExpectation,
    resolveEmaBranchId,
    resolveEmaBranchIds,
    searchHandlingCodes,
    validatePolicyPack,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckNotoc = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
