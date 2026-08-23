(function attachNotocCore(globalScope) {
  "use strict";

  const STATES = Object.freeze({
    NOT_APPLICABLE: "NOT_APPLICABLE",
    NO_OBVIOUS_INCONSISTENCY: "NO_OBVIOUS_INCONSISTENCY",
    ACTION_OR_INFORMATION_REQUIRED: "ACTION_OR_INFORMATION_REQUIRED",
    UNABLE_TO_DETERMINE_REFER: "UNABLE_TO_DETERMINE_REFER",
    POSSIBLE_DISCREPANCY_QUERY: "POSSIBLE_DISCREPANCY_QUERY",
  });
  const EXPECTATIONS = Object.freeze({
    REQUIRED: "REQUIRED",
    NOT_EXPECTED: "NOT_EXPECTED",
    CONDITIONAL: "CONDITIONAL",
    UNKNOWN: "UNKNOWN",
  });
  const STATE_HEADINGS = Object.freeze({
    [STATES.NOT_APPLICABLE]: "This guidance does not apply",
    [STATES.NO_OBVIOUS_INCONSISTENCY]: "No obvious inconsistency identified",
    [STATES.ACTION_OR_INFORMATION_REQUIRED]: "More information or action required",
    [STATES.UNABLE_TO_DETERMINE_REFER]: "Unable to determine, refer",
    [STATES.POSSIBLE_DISCREPANCY_QUERY]: "Possible discrepancy, query before signing",
  });
  const SEVERITY = Object.freeze({
    [STATES.NOT_APPLICABLE]: 0,
    [STATES.NO_OBVIOUS_INCONSISTENCY]: 0,
    [STATES.ACTION_OR_INFORMATION_REQUIRED]: 1,
    [STATES.UNABLE_TO_DETERMINE_REFER]: 2,
    [STATES.POSSIBLE_DISCREPANCY_QUERY]: 3,
  });
  const VERIFIED_RULE_STATUSES = new Set(["VERIFIED_CURRENT_MANUAL", "REVIEWED_BA_EVIDENCE"]);
  const VERIFIED_SOURCE_STATUSES = new Set([
    "VERIFIED_CURRENT_MANUAL",
    "VERIFIED_SUPPLIED_MANUAL",
    "VERIFIED_CURRENT_PUBLIC_BA",
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
      if (configuration === "REMOVED" && entry.lithiumLimitBand === "TWO_160") return "LI-R-2-160";
      if (configuration === "SPARE" && entry.lithiumLimitBand === "ONE_300") return "LI-S-1-300";
      if (configuration === "SPARE" && entry.lithiumLimitBand === "TWO_160") return "LI-S-2-160";
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
      if (configuration === "INSTALLED" && entry.spillableInstalledStatus === "CONFIRMED") return "WET-I-UP";
      if (configuration === "REMOVED" && entry.spillableRemovalReason === "UNSECURED") return "WET-R-UNSECURED";
      if (configuration === "REMOVED" && ["NOT_UPRIGHT", "BOTH"].includes(entry.spillableRemovalReason)) return "WET-R-NOUPRIGHT";
      if (configuration === "SPARE") return "WET-S";
    }
    return null;
  }

  function expectedHandling(branch) {
    const id = branch?.id || "";
    if (id.endsWith("-I") || id === "WET-I-UP") {
      return id === "WET-I-UP"
        ? "Hold; securely attached, isolated and able to remain upright"
        : "Hold; securely attached and isolated against inadvertent activation";
    }
    if (id.startsWith("LI-")) return "Cabin; each battery protected against short circuit and damage";
    if (id.startsWith("WET-R")) return "Hold; leakproof package, absorbent material, labels and restraint";
    if (id.startsWith("DRY-") || id.startsWith("NSW-")) return "Hold; short-circuit protection and strong rigid packaging";
    return "Refer to the current BA procedure";
  }

  function expectedNotoc(branch) {
    const expectation = normaliseNotocExpectation(branch?.notoc?.required);
    const code = expectedNotocCode(branch);
    if (expectation === EXPECTATIONS.REQUIRED && code) return `${code}, correct location and final loadsheet NOTOC: YES`;
    if (expectation === EXPECTATIONS.REQUIRED) return "Required with the correct location; exact configuration code remains unverified";
    if (expectation === EXPECTATIONS.NOT_EXPECTED) return "Not expected";
    return "Internal NOTOC method or format is not fully verified";
  }

  function addMobilityDetails(result, branch) {
    if (!branch) return result;
    result.details = [
      { label: "Configuration", value: BRANCH_LABELS[branch.id] || branch.id },
      { label: "Expected handling", value: expectedHandling(branch) },
      { label: "Expected NOTOC", value: expectedNotoc(branch) },
    ];
    return result;
  }

  function mobilityResult(policyPack, branch, options) {
    const result = simpleResult(policyPack, {
      entryId: options.entryId,
      ruleId: branch?.ruleId || "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
      sourceIds: branch?.sourceIds,
      expectation: branch ? normaliseNotocExpectation(branch.notoc?.required) : EXPECTATIONS.UNKNOWN,
      ...options,
    });
    return addMobilityDetails(result, branch);
  }

  function evaluateEma(entry, policyPack) {
    const entryId = entry?.id || "ema";
    if (entry?.mobilityAidConfirmed === "NO") {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "OPSDECK-NOTOC-INDICATOR-CROSSCHECK",
        state: STATES.NOT_APPLICABLE,
        explanation: "The item is not a wheelchair or electric mobility aid used by a person with reduced mobility.",
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
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        explanation: "The controlled BA mobility-aid policy is not available on this device.",
        action: "Refresh while online or refer to the current BA procedure.",
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
    if (unknownChoice(entry?.installedStatus)) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "Confirm whether the battery is installed, removed or a spare.",
        action: "Confirm the battery configuration.",
      });
    }

    if (entry.batteryType === "LITHIUM" && ["REMOVED", "SPARE"].includes(entry.installedStatus)) {
      if (entry.lithiumLimitBand === "EXCEEDS") {
        return simpleResult(policyPack, {
          entryId,
          ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          expectation: EXPECTATIONS.REQUIRED,
          explanation: "The entered quantity or battery rating is outside the documented lithium mobility-aid limits.",
          action: "Query with the TRM/Coordinator or equivalent before signing.",
        });
      }
      if (unknownChoice(entry.lithiumLimitBand)) {
        return simpleResult(policyPack, {
          entryId,
          ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "The lithium battery quantity and Wh category have not been confirmed.",
          action: "Obtain the manufacturer's stated Wh rating. Do not calculate or round it in this tool.",
        });
      }
    }

    if (["DRY_CELL", "NON_SPILLABLE"].includes(entry.batteryType) && entry.installedStatus === "SPARE") {
      if (entry.spareCountBand === "MORE_THAN_ONE") {
        const branch = mobilityBranch(policyPack, entry.batteryType === "DRY_CELL" ? "DRY-S-1" : "NSW-S-1");
        return mobilityResult(policyPack, branch, {
          entryId,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: "More than one spare battery is entered, while the reviewed BA guidance permits one spare for this branch.",
          action: "Query with the TRM/Coordinator or equivalent before signing.",
        });
      }
      if (entry.spareCountBand !== "ONE") {
        return simpleResult(policyPack, {
          entryId,
          ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "The spare-battery quantity has not been confirmed.",
          action: "Confirm the number of spare batteries.",
        });
      }
    }

    if (entry.batteryType === "SPILLABLE" && entry.installedStatus === "INSTALLED") {
      if (["UNSECURED", "NOT_UPRIGHT"].includes(entry.spillableInstalledStatus)) {
        const branch = mobilityBranch(policyPack, "WET-I-UP");
        return mobilityResult(policyPack, branch, {
          entryId,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: entry.spillableInstalledStatus === "UNSECURED"
            ? "The spillable battery is shown as installed but is not securely attached."
            : "The spillable battery is shown as installed but the aid cannot remain upright.",
          action: "Query the configuration and removal requirements before signing.",
        });
      }
      if (entry.spillableInstalledStatus !== "CONFIRMED") {
        return simpleResult(policyPack, {
          entryId,
          ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Secure attachment and upright stowage have not been confirmed for the installed spillable battery.",
          action: "Confirm the configuration with the loading team.",
        });
      }
    }

    if (entry.batteryType === "SPILLABLE" && entry.installedStatus === "REMOVED" && unknownChoice(entry.spillableRemovalReason)) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "The reason for removing the spillable battery has not been confirmed.",
        action: "Confirm whether it was not securely attached, could not remain upright, or both.",
      });
    }

    const branchId = resolveEmaBranchId(entry);
    const branch = mobilityBranch(policyPack, branchId);
    if (!branch) {
      return simpleResult(policyPack, {
        entryId,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        explanation: "The entered configuration cannot be matched to a controlled mobility-aid branch.",
        action: "Refer to the current BA procedure or TRM/Coordinator.",
      });
    }

    if (branch.id === "WET-S") {
      return mobilityResult(policyPack, branch, {
        entryId,
        state: STATES.POSSIBLE_DISCREPANCY_QUERY,
        explanation: "Spare spillable batteries are not permitted under the reviewed BA guidance.",
        action: "Query with the TRM/Coordinator or equivalent before signing.",
      });
    }

    if (entry.handlingConfirmed !== "YES") {
      return mobilityResult(policyPack, branch, {
        entryId,
        state: entry.handlingConfirmed === "NO"
          ? STATES.POSSIBLE_DISCREPANCY_QUERY
          : STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: entry.handlingConfirmed === "NO"
          ? "The required secure handling, protection or packaging is not confirmed as complete."
          : "The required secure handling, protection or packaging has not been confirmed.",
        action: "Query or confirm the branch-specific handling with the loading team or TRM/Coordinator before signing.",
      });
    }

    const requiredLocation = expectedLocation(branch);
    const actualLocation = locationType(entry);
    if (["NOT_SHOWN", "UNCLEAR", "UNKNOWN"].includes(actualLocation)) {
      return mobilityResult(policyPack, branch, {
        entryId,
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "The carriage location is not shown clearly.",
        action: "Confirm the cabin or hold location before signing.",
      });
    }
    if (requiredLocation && actualLocation !== requiredLocation) {
      return mobilityResult(policyPack, branch, {
        entryId,
        state: STATES.POSSIBLE_DISCREPANCY_QUERY,
        explanation: `The item is entered in the ${actualLocation === "CABIN" ? "cabin" : "hold"}, but this branch requires ${requiredLocation === "CABIN" ? "cabin" : "hold"} carriage.`,
        action: "Query the location with the TRM/Coordinator or equivalent before signing.",
      });
    }

    const code = expectedNotocCode(branch);
    if (code && entry.notocContentConfirmed !== "YES") {
      return mobilityResult(policyPack, branch, {
        entryId,
        state: entry.notocContentConfirmed === "NO" ? STATES.POSSIBLE_DISCREPANCY_QUERY : STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: entry.notocContentConfirmed === "NO"
          ? `The NOTOC does not show both ${code} and the correct location.`
          : `The ${code} entry and location have not been confirmed on the NOTOC.`,
        action: "Query the NOTOC with the dispatcher or TRM/Coordinator before signing.",
      });
    }

    const expectation = normaliseNotocExpectation(branch.notoc?.required);
    if (expectation === EXPECTATIONS.REQUIRED && entry.loadsheetNotocIndicator !== "YES") {
      return mobilityResult(policyPack, branch, {
        entryId,
        state: entry.loadsheetNotocIndicator === "NO" ? STATES.POSSIBLE_DISCREPANCY_QUERY : STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: entry.loadsheetNotocIndicator === "NO"
          ? "The final loadsheet shows NOTOC: NO for a branch where a NOTOC is expected."
          : "The final loadsheet NOTOC indicator has not been confirmed.",
        action: "Ask the dispatcher to provide or correct the NOTOC before signing.",
      });
    }

    const rule = ruleMap(policyPack).get(branch.ruleId);
    if (!isRuleVerified(rule, policyPack)) {
      return mobilityResult(policyPack, branch, {
        entryId,
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        logicState: STATES.NO_OBVIOUS_INCONSISTENCY,
        explanation: "The entered information matches the available handling guidance, but the internal BA NOTOC rule or source coverage for this branch is incomplete.",
        action: "Cross-check the current BA documentation or query through the normal operational channel.",
      });
    }

    return mobilityResult(policyPack, branch, {
      entryId,
      state: STATES.NO_OBVIOUS_INCONSISTENCY,
      explanation: "The information entered shows no obvious inconsistency against the reviewed BA evidence for this branch.",
    });
  }

  function lookupHandlingCode(rawCode, policyPack) {
    const normalised = normaliseCode(rawCode);
    const codes = policyPack?.handlingCodes || [];
    const code = codes.find((candidate) => {
      const values = [candidate.code, ...(candidate.aliases || [])].map(normaliseCode);
      return values.includes(normalised);
    });

    if (!normalised || !code) {
      const finding = makeFinding(policyPack, {
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        expectation: EXPECTATIONS.UNKNOWN,
        explanation: normalised
          ? `${normalised} is not supported by the current verified BA code library. Do not infer the NOTOC requirement from the code description.`
          : "Enter an SHC/DG or special-load code exactly as shown.",
        action: normalised ? "Refer to the relevant BA procedure or TRM/Coordinator." : "Enter a code to continue.",
      });
      return {
        rawCode: String(rawCode || ""),
        normalisedCode: normalised,
        description: "Unknown code",
        expectation: EXPECTATIONS.UNKNOWN,
        finding,
        matched: false,
      };
    }

    const rule = ruleMap(policyPack).get(code.ruleId);
    const verified = code.releaseStatus === "ACTIVE" && code.verificationStatus === "VERIFIED_CURRENT_MANUAL" && isRuleVerified(rule, policyPack);
    let state = STATES.NO_OBVIOUS_INCONSISTENCY;
    if (code.expectation === EXPECTATIONS.CONDITIONAL) state = STATES.ACTION_OR_INFORMATION_REQUIRED;
    if (!verified) state = STATES.UNABLE_TO_DETERMINE_REFER;
    const label = {
      [EXPECTATIONS.REQUIRED]: "NOTOC expected",
      [EXPECTATIONS.NOT_EXPECTED]: "NOTOC not expected",
      [EXPECTATIONS.CONDITIONAL]: "Conditional, more information required",
      [EXPECTATIONS.UNKNOWN]: "Unable to determine, refer",
    }[code.expectation];
    const conditionSummary = String(code.conditionSummary || "").trim();
    const explanation = verified
      ? `${label}.${conditionSummary ? ` ${conditionSummary}` : ""}`
      : `${label}. The NOTOC expectation is not fully verified for operational use.${conditionSummary ? ` Available source information: ${conditionSummary}` : ""}`;
    const finding = makeFinding(policyPack, {
      ruleId: code.ruleId,
      state,
      expectation: code.expectation,
      sourceIds: code.sourceIds,
      verificationStatus: code.verificationStatus,
      explanation,
      action: code.crewAction || (state === STATES.NO_OBVIOUS_INCONSISTENCY ? undefined : "Check the current BA source or refer."),
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
    expectedLocation,
    expectedNotocCode,
    isRuleVerified,
    lookupHandlingCode,
    mobilityBranch,
    normaliseCode,
    normaliseNotocExpectation,
    resolveEmaBranchId,
    searchHandlingCodes,
    validatePolicyPack,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckNotoc = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
