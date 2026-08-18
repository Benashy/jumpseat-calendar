(function attachNotocCore(globalScope) {
  "use strict";

  const STATES = Object.freeze({
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
    [STATES.NO_OBVIOUS_INCONSISTENCY]: "No obvious inconsistency identified",
    [STATES.ACTION_OR_INFORMATION_REQUIRED]: "More information or action required",
    [STATES.UNABLE_TO_DETERMINE_REFER]: "Unable to determine, refer",
    [STATES.POSSIBLE_DISCREPANCY_QUERY]: "Possible discrepancy, query before signing",
  });
  const SEVERITY = Object.freeze({
    [STATES.NO_OBVIOUS_INCONSISTENCY]: 0,
    [STATES.ACTION_OR_INFORMATION_REQUIRED]: 1,
    [STATES.UNABLE_TO_DETERMINE_REFER]: 2,
    [STATES.POSSIBLE_DISCREPANCY_QUERY]: 3,
  });

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
    if (!rule || rule.releaseStatus !== "ACTIVE" || rule.verificationStatus !== "VERIFIED_CURRENT_MANUAL") return false;
    const sources = sourceMap(policyPack);
    return rule.sourceIds.every((sourceId) => sources.get(sourceId)?.verificationStatus === "VERIFIED_CURRENT_MANUAL");
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

  function evaluateEma(entry, policyPack) {
    const entryId = entry?.id || "ema";
    const shared = { entryId };
    if (entry?.mobilityAidConfirmed !== "YES") {
      return simpleResult(policyPack, {
        ...shared,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        explanation: "Confirm that the item is a wheelchair or electric mobility aid used by a person with reduced mobility. The EMA rules must not be applied to another type of vehicle by analogy.",
        action: "Refer to the current BA procedure or TRM/Coordinator.",
      });
    }

    const batteryType = entry?.batteryType || "UNKNOWN";
    const installedStatus = entry?.installedStatus || "UNKNOWN";
    if (batteryType === "UNKNOWN") {
      return simpleResult(policyPack, {
        ...shared,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "Confirm the battery type before applying a configuration-specific rule.",
        action: "Obtain the battery type shown or confirmed for the mobility aid.",
      });
    }

    if (installedStatus === "UNKNOWN") {
      return simpleResult(policyPack, {
        ...shared,
        ruleId: batteryType === "LITHIUM" ? "BA-OMA-EMA-LI-INSTALLED" : "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.ACTION_OR_INFORMATION_REQUIRED,
        explanation: "Confirm whether the battery is installed, removed or a spare. Different limits and locations apply to each branch.",
        action: "Confirm the battery configuration.",
      });
    }

    if (batteryType === "NON_SPILLABLE") {
      return simpleResult(policyPack, {
        ...shared,
        ruleId: "BA-OMA-EMA-NONSPILLABLE",
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        expectation: EXPECTATIONS.UNKNOWN,
        explanation: "The policy pack contains only the high-level non-spillable battery points. The detailed BA/CDGM handling rule is unavailable, so this configuration cannot be fully cross-checked.",
        action: "Refer to the current BA/CDGM handling procedure.",
      });
    }

    if (batteryType === "SPILLABLE") {
      if (installedStatus === "SPARE") {
        return simpleResult(policyPack, {
          ...shared,
          ruleId: "BA-OMA-EMA-SPILLABLE",
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          expectation: EXPECTATIONS.UNKNOWN,
          explanation: "The recovered BA category rule does not permit a spare spillable battery for this mobility-aid branch.",
          action: "Query with the TRM/Coordinator or equivalent.",
        });
      }
      return simpleResult(policyPack, {
        ...shared,
        ruleId: "BA-OMA-EMA-SPILLABLE",
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        expectation: EXPECTATIONS.UNKNOWN,
        explanation: "Detailed BA/CDGM handling requirements for this spillable-battery configuration are unavailable in the development policy pack.",
        action: "Refer to the current BA/CDGM handling procedure.",
      });
    }

    if (batteryType !== "LITHIUM") {
      return simpleResult(policyPack, {
        ...shared,
        ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
        state: STATES.UNABLE_TO_DETERMINE_REFER,
        expectation: EXPECTATIONS.UNKNOWN,
        explanation: "The selected battery type is not supported by this policy pack.",
        action: "Refer to the current BA procedure.",
      });
    }

    if (installedStatus === "INSTALLED") {
      const base = {
        ...shared,
        ruleId: "BA-OMA-EMA-LI-INSTALLED",
        expectation: EXPECTATIONS.CONDITIONAL,
      };
      if (entry.securelyAttached !== "YES") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: entry.securelyAttached === "NO"
            ? "The battery is recorded as installed but not securely attached."
            : "Secure attachment has not been confirmed for the installed battery.",
          action: "Query the configuration with the TRM/Coordinator or equivalent.",
        });
      }
      if (entry.isolatedAgainstInadvertentActivation === "UNKNOWN" || unknownChoice(entry.isolatedAgainstInadvertentActivation)) {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Confirm that the mobility aid is isolated against inadvertent activation.",
          action: "Obtain confirmation of isolation.",
        });
      }
      if (entry.isolatedAgainstInadvertentActivation === "NO") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: "The installed battery is recorded as not isolated against inadvertent activation.",
          action: "Query the configuration with the TRM/Coordinator or equivalent.",
        });
      }
      if (entry.operatorApprovalConfirmed !== "YES") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Operator approval has not been confirmed.",
          action: "Confirm operator approval.",
        });
      }
      if (["NOT_SHOWN", "UNCLEAR"].includes(locationType(entry))) {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "The battery location is not clearly shown.",
          action: "Confirm the location notified to the PIC.",
        });
      }
      return developOrConfirm(policyPack, {
        ...base,
        explanation: "The installed lithium battery is recorded as securely attached, isolated, approved and located. The recovered rule does not impose the removed-battery 300 Wh limit on this branch.",
      });
    }

    if (installedStatus === "REMOVED") {
      const base = {
        ...shared,
        ruleId: "BA-OMA-EMA-LI-REMOVED",
        expectation: EXPECTATIONS.REQUIRED,
      };
      if (!Number.isFinite(entry.wattHours) || entry.wattHours <= 0) {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Enter and confirm the removed battery's watt-hour rating.",
          action: "Confirm the Wh rating without rounding it down.",
        });
      }
      if (entry.wattHours > 300) {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: `The removed lithium battery is entered as ${entry.wattHours} Wh, above the recovered 300 Wh limit for this branch.`,
          action: "Query this with the TRM/Coordinator or equivalent and verify whether another supported configuration is available.",
        });
      }
      if (entry.terminalsProtected !== "YES") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Terminal protection against short circuit has not been confirmed.",
          action: "Confirm terminal protection.",
        });
      }
      if (locationType(entry) === "HOLD") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: "The removed lithium EMA battery is entered in the hold. The recovered rule requires cabin carriage for this branch.",
          action: "Query this with the TRM/Coordinator or equivalent.",
        });
      }
      if (["NOT_SHOWN", "UNCLEAR"].includes(locationType(entry))) {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "The removed battery location is not clearly shown.",
          action: "Confirm the cabin location.",
        });
      }
      if (locationType(entry) !== "CABIN") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.UNABLE_TO_DETERMINE_REFER,
          explanation: "The entered location is neither a confirmed cabin nor hold location, so the branch cannot be determined reliably.",
          action: "Refer for clarification.",
        });
      }
      if (entry.operatorApprovalConfirmed !== "YES") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Operator approval has not been confirmed.",
          action: "Confirm operator approval.",
        });
      }
      return developOrConfirm(policyPack, {
        ...base,
        explanation: "The removed lithium battery is at or below 300 Wh, protected against short circuit, approved and shown in the cabin.",
      });
    }

    if (installedStatus === "SPARE") {
      const base = {
        ...shared,
        ruleId: "BA-OMA-EMA-LI-SPARE",
        expectation: EXPECTATIONS.REQUIRED,
      };
      if (!Number.isInteger(entry.spareCount) || entry.spareCount < 1 || !Number.isFinite(entry.wattHours) || entry.wattHours <= 0) {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Confirm the spare count and watt-hour rating.",
          action: "Enter the exact spare count and Wh rating.",
        });
      }
      if (entry.spareCount > 1 || entry.wattHours > 300) {
        const reasons = [];
        if (entry.spareCount > 1) reasons.push(`${entry.spareCount} spares`);
        if (entry.wattHours > 300) reasons.push(`${entry.wattHours} Wh`);
        return simpleResult(policyPack, {
          ...base,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: `The spare lithium battery entry shows ${reasons.join(" and ")}, outside the recovered maximum of one spare at no more than 300 Wh.`,
          action: "Query this with the TRM/Coordinator or equivalent.",
        });
      }
      if (entry.terminalsProtected !== "YES") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Individual terminal protection against short circuit has not been confirmed.",
          action: "Confirm terminal protection.",
        });
      }
      if (locationType(entry) === "HOLD") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.POSSIBLE_DISCREPANCY_QUERY,
          explanation: "The spare lithium EMA battery is entered in the hold. The recovered rule requires cabin carriage.",
          action: "Query this with the TRM/Coordinator or equivalent.",
        });
      }
      if (["NOT_SHOWN", "UNCLEAR"].includes(locationType(entry))) {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "The spare battery location is not clearly shown.",
          action: "Confirm the cabin location.",
        });
      }
      if (locationType(entry) !== "CABIN") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.UNABLE_TO_DETERMINE_REFER,
          explanation: "The entered location cannot be matched reliably to the cabin-carriage branch.",
          action: "Refer for clarification.",
        });
      }
      if (entry.operatorApprovalConfirmed !== "YES") {
        return simpleResult(policyPack, {
          ...base,
          state: STATES.ACTION_OR_INFORMATION_REQUIRED,
          explanation: "Operator approval has not been confirmed.",
          action: "Confirm operator approval.",
        });
      }
      return developOrConfirm(policyPack, {
        ...base,
        explanation: "One spare lithium battery is entered at or below 300 Wh, individually protected, approved and shown in the cabin.",
      });
    }

    return simpleResult(policyPack, {
      ...shared,
      ruleId: "BA-CDGM-NOTOC-CODE-MAPPING-MISSING",
      state: STATES.UNABLE_TO_DETERMINE_REFER,
      expectation: EXPECTATIONS.UNKNOWN,
      explanation: "The battery configuration is not supported by this policy pack.",
      action: "Refer to the current BA procedure.",
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
    const finding = makeFinding(policyPack, {
      ruleId: code.ruleId,
      state,
      expectation: code.expectation,
      sourceIds: code.sourceIds,
      verificationStatus: code.verificationStatus,
      explanation: verified ? label : `${label}. The source or mapping is not currently verified for operational use.`,
      action: state === STATES.NO_OBVIOUS_INCONSISTENCY ? undefined : "Check the current BA source or refer.",
    });

    return {
      rawCode: String(rawCode || ""),
      normalisedCode: normalised,
      description: code.description,
      appearsOn: code.appearsOn,
      expectation: code.expectation,
      conditionSummary: code.conditionSummary,
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
    isRuleVerified,
    lookupHandlingCode,
    normaliseCode,
    searchHandlingCodes,
    validatePolicyPack,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckNotoc = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
