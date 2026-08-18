(function initialiseNotocUi(globalScope) {
  "use strict";

  const core = globalScope.OpsDeckNotoc;
  const policyPack = globalScope.OpsDeckNotocPolicy?.POLICY_PACK;
  const view = document.querySelector("#notocView");
  if (!core || !policyPack || !view) return;

  const elements = {
    clearSession: document.querySelector("#clearNotocSessionButton"),
    home: document.querySelector("#notocHomeScreen"),
    lookup: document.querySelector("#notocLookupScreen"),
    ema: document.querySelector("#notocEmaScreen"),
    actionButtons: document.querySelectorAll("[data-notoc-screen]"),
    backButtons: document.querySelectorAll(".notoc-back-button"),
    lookupForm: document.querySelector("#notocLookupForm"),
    lookupCode: document.querySelector("#notocLookupCode"),
    lookupResult: document.querySelector("#notocLookupResult"),
    emaForm: document.querySelector("#notocEmaForm"),
    mobilityAidConfirmed: document.querySelector("#emaMobilityAidConfirmed"),
    batteryType: document.querySelector("#emaBatteryType"),
    installedStatus: document.querySelector("#emaInstalledStatus"),
    securelyAttached: document.querySelector("#emaSecurelyAttached"),
    isolated: document.querySelector("#emaIsolated"),
    wattHours: document.querySelector("#emaWattHours"),
    spareCount: document.querySelector("#emaSpareCount"),
    terminalsProtected: document.querySelector("#emaTerminalsProtected"),
    operatorApproval: document.querySelector("#emaOperatorApproval"),
    locationType: document.querySelector("#emaLocationType"),
    locationText: document.querySelector("#emaLocationText"),
    branchFields: document.querySelectorAll(".ema-branch-field"),
    clearEma: document.querySelector("#clearEmaButton"),
    emaResult: document.querySelector("#notocEmaResult"),
  };
  const screens = {
    home: elements.home,
    lookup: elements.lookup,
    ema: elements.ema,
  };

  function showScreen(name, focus = true) {
    Object.entries(screens).forEach(([screenName, screen]) => {
      screen.classList.toggle("hidden", screenName !== name);
    });
    if (focus) {
      const heading = screens[name].querySelector("h3, button, input, select");
      window.requestAnimationFrame(() => heading?.focus?.({ preventScroll: true }));
    }
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function textElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = text;
    return element;
  }

  function stateClass(state) {
    return {
      [core.STATES.NO_OBVIOUS_INCONSISTENCY]: "is-clear",
      [core.STATES.ACTION_OR_INFORMATION_REQUIRED]: "is-action",
      [core.STATES.UNABLE_TO_DETERMINE_REFER]: "is-refer",
      [core.STATES.POSSIBLE_DISCREPANCY_QUERY]: "is-query",
    }[state] || "is-refer";
  }

  function stateLabel(state) {
    return {
      [core.STATES.NO_OBVIOUS_INCONSISTENCY]: "Cross-check complete",
      [core.STATES.ACTION_OR_INFORMATION_REQUIRED]: "Action or information",
      [core.STATES.UNABLE_TO_DETERMINE_REFER]: "Referral required",
      [core.STATES.POSSIBLE_DISCREPANCY_QUERY]: "Possible discrepancy",
    }[state] || "Referral required";
  }

  function expectationLabel(expectation) {
    return {
      [core.EXPECTATIONS.REQUIRED]: "NOTOC expected",
      [core.EXPECTATIONS.NOT_EXPECTED]: "NOTOC not expected",
      [core.EXPECTATIONS.CONDITIONAL]: "Conditional NOTOC expectation",
      [core.EXPECTATIONS.UNKNOWN]: "NOTOC expectation unknown",
    }[expectation] || "NOTOC expectation unknown";
  }

  function verificationLabel(status) {
    return {
      VERIFIED_CURRENT_MANUAL: "Verified current manual",
      CARRIED_FORWARD_REQUIRES_CURRENT_MANUAL_CHECK: "Carried forward, current manual check required",
      MISSING_SOURCE: "Source missing",
      RETIRED: "Retired source",
    }[status] || status;
  }

  function classificationLabel(classification) {
    return {
      DOCUMENTED_BA: "BA documented",
      INFERENCE_FROM_BA: "Inference from BA",
      APP_GUIDANCE: "App guidance",
      UNSUPPORTED: "Unsupported",
    }[classification] || classification;
  }

  function sourceDrawer(finding) {
    const details = document.createElement("details");
    details.className = "source-drawer";
    details.append(textElement("summary", "", "Why and source"));
    const sources = finding.sourceIds.map((sourceId) => policyPack.sources.find((source) => source.id === sourceId)).filter(Boolean);

    details.append(textElement("p", "source-classification", `${classificationLabel(finding.classification)}. ${verificationLabel(finding.verificationStatus)}.`));
    for (const source of sources) {
      const article = document.createElement("div");
      article.className = "source-record";
      article.append(textElement("strong", "", source.documentTitle));
      article.append(textElement("span", "", source.sectionPath.join(" > ")));
      article.append(textElement("p", "", source.supportedText));
      details.append(article);
    }
    return details;
  }

  function renderEvaluation(region, evaluation, options = {}) {
    clearNode(region);
    const card = document.createElement("article");
    card.className = `notoc-result-card ${stateClass(evaluation.overallState)}`;
    card.setAttribute("role", "status");
    card.append(textElement("span", "result-state-label", stateLabel(evaluation.overallState)));
    card.append(textElement("h3", "", core.STATE_HEADINGS[evaluation.overallState]));
    if (options.summary) card.append(textElement("p", "result-summary", options.summary));

    const findings = document.createElement("div");
    findings.className = "notoc-findings";
    evaluation.findings.forEach((finding, index) => {
      const item = document.createElement("section");
      item.className = "notoc-finding";
      const itemTitle = options.findingTitles?.[index] || (evaluation.findings.length > 1 ? `Check ${index + 1}` : null);
      if (itemTitle) item.append(textElement("h4", "", itemTitle));
      if (finding.expectation) item.append(textElement("span", "expectation-badge", expectationLabel(finding.expectation)));
      item.append(textElement("p", "", finding.explanation));
      if (finding.action) item.append(textElement("p", "finding-action", finding.action));
      item.append(sourceDrawer(finding));
      findings.append(item);
    });
    card.append(findings);
    region.append(card);
  }

  function updateEmaFields() {
    const branch = elements.installedStatus.value;
    const lithium = elements.batteryType.value === "LITHIUM";
    elements.branchFields.forEach((field) => {
      const supportedBranches = field.dataset.emaBranches.split(/\s+/);
      field.classList.toggle("hidden", !lithium || !supportedBranches.includes(branch));
    });
  }

  function numberFrom(field) {
    if (!field.value.trim()) return null;
    const value = Number(field.value);
    return Number.isFinite(value) ? value : null;
  }

  function buildEmaEntry() {
    return {
      id: "ema-session-item",
      mobilityAidConfirmed: elements.mobilityAidConfirmed.value,
      batteryType: elements.batteryType.value,
      installedStatus: elements.installedStatus.value,
      securelyAttached: elements.securelyAttached.value,
      isolatedAgainstInadvertentActivation: elements.isolated.value,
      wattHours: numberFrom(elements.wattHours),
      spareCount: numberFrom(elements.spareCount),
      terminalsProtected: elements.terminalsProtected.value,
      operatorApprovalConfirmed: elements.operatorApproval.value,
      location: {
        type: elements.locationType.value,
        rawText: elements.locationText.value.trim(),
      },
    };
  }

  function clearEmaAssessment() {
    elements.emaForm.reset();
    clearNode(elements.emaResult);
    updateEmaFields();
  }

  function clearSession() {
    elements.lookupForm.reset();
    clearNode(elements.lookupResult);
    clearEmaAssessment();
    showScreen("home");
  }

  elements.actionButtons.forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.notocScreen));
  });
  elements.backButtons.forEach((button) => button.addEventListener("click", () => showScreen("home")));
  elements.clearSession.addEventListener("click", clearSession);
  elements.batteryType.addEventListener("change", updateEmaFields);
  elements.installedStatus.addEventListener("change", updateEmaFields);

  elements.lookupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const lookup = core.lookupHandlingCode(elements.lookupCode.value, policyPack);
    renderEvaluation(elements.lookupResult, {
      overallState: lookup.finding.state,
      findings: [lookup.finding],
      policyPackVersion: policyPack.version,
    }, {
      summary: lookup.matched
        ? `${lookup.normalisedCode}: ${lookup.description}`
        : `${lookup.normalisedCode || "No code"}: unable to classify from the current verified BA mapping.`,
    });
  });

  elements.emaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const evaluation = core.evaluateEma(buildEmaEntry(), policyPack);
    renderEvaluation(elements.emaResult, evaluation, {
      summary: evaluation.expectation ? expectationLabel(evaluation.expectation) : undefined,
    });
  });
  elements.clearEma.addEventListener("click", clearEmaAssessment);

  updateEmaFields();
  showScreen("home", false);
})(typeof globalThis !== "undefined" ? globalThis : window);
