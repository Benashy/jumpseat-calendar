(function initialiseNotocUi(globalScope) {
  "use strict";

  const core = globalScope.OpsDeckNotoc;
  const policyPack = globalScope.OpsDeckNotocPolicy?.POLICY_PACK;
  const view = document.querySelector("#notocView");
  if (!core || !policyPack || !view) return;

  const elements = {
    clearSession: document.querySelector("#clearNotocSessionButton"),
    topBack: document.querySelector("#notocBackToChecks"),
    home: document.querySelector("#notocHomeScreen"),
    lookup: document.querySelector("#notocLookupScreen"),
    ema: document.querySelector("#notocEmaScreen"),
    actionButtons: document.querySelectorAll("[data-notoc-screen]"),
    lookupForm: document.querySelector("#notocLookupForm"),
    lookupCode: document.querySelector("#notocLookupCode"),
    lookupSuggestions: document.querySelector("#notocLookupSuggestions"),
    verifiedCodeBrowser: document.querySelector("#notocVerifiedCodeBrowser"),
    verifiedCodeCount: document.querySelector("#notocVerifiedCodeCount"),
    verifiedCodeList: document.querySelector("#notocVerifiedCodeList"),
    lookupResult: document.querySelector("#notocLookupResult"),
    emaForm: document.querySelector("#notocEmaForm"),
    emaQuestionStage: document.querySelector("#emaQuestionStage"),
    emaStepLabel: document.querySelector("#emaStepLabel"),
    emaStepContext: document.querySelector("#emaStepContext"),
    emaQuestionTitle: document.querySelector("#emaQuestionTitle"),
    emaQuestionOptions: document.querySelector("#emaQuestionOptions"),
    emaQuestionInput: document.querySelector("#emaQuestionInput"),
    emaWizardBack: document.querySelector("#emaWizardBackButton"),
    emaWizardContinue: document.querySelector("#emaWizardContinueButton"),
    emaResult: document.querySelector("#notocEmaResult"),
  };
  const screens = {
    home: elements.home,
    lookup: elements.lookup,
    ema: elements.ema,
  };

  const yesNo = [
    { value: "YES", label: "Yes" },
    { value: "NO", label: "No" },
  ];
  const stepCatalog = {
    mobilityAidConfirmed: {
      id: "mobilityAidConfirmed",
      label: "Mobility aid",
      context: "Item",
      question: "Is this wheelchair or electric mobility aid for use by a passenger with reduced mobility travelling on this flight?",
      type: "choice",
      choices: [
        { value: "YES", label: "Yes" },
        { value: "NO", label: "No" },
      ],
    },
    batteryType: {
      id: "batteryType",
      label: "Battery type",
      context: "Battery",
      question: "What battery type is shown or confirmed?",
      type: "choice",
      choices: [
        { value: "LITHIUM", label: "Lithium-ion" },
        { value: "DRY_CELL", label: "Dry cell (NiCd or NiMH)" },
        { value: "NON_SPILLABLE", label: "Non-spillable wet (gel, SLA or AGM)" },
        { value: "SPILLABLE", label: "Spillable wet" },
      ],
    },
    installedStatus: {
      id: "installedStatus",
      label: "Operating battery",
      context: "Battery",
      question: "Where is the operating battery?",
      type: "choice",
      choices: [
        { value: "INSTALLED", label: "Installed in mobility aid" },
        { value: "REMOVED", label: "Removed from mobility aid" },
      ],
    },
    lithiumLimitBand: {
      id: "lithiumLimitBand",
      label: "Quantity and rating",
      context: "Lithium battery",
      question: "What removed operating-battery quantity and rating is shown?",
      type: "choice",
      choices: [
        { value: "ONE_300", label: "One, up to 300 Wh" },
        { value: "TWO_300_TOTAL", label: "Two, each up to 160 Wh and up to 300 Wh combined" },
        { value: "TWO_301_320", label: "Two, each up to 160 Wh and 301–320 Wh combined" },
        { value: "EXCEEDS", label: "Outside these limits" },
      ],
    },
    spareLithiumBand: {
      id: "spareLithiumBand",
      label: "Spare batteries",
      context: "Lithium battery",
      question: "Are any separate spare lithium batteries carried?",
      type: "choice",
      choices: [
        { value: "NONE", label: "None" },
        { value: "ONE_300", label: "One, up to 300 Wh" },
        { value: "TWO_300_TOTAL", label: "Two, each up to 160 Wh and up to 300 Wh combined" },
        { value: "TWO_301_320", label: "Two, each up to 160 Wh and 301–320 Wh combined" },
        { value: "EXCEEDS", label: "Outside these limits" },
      ],
    },
    spareCountBand: {
      id: "spareCountBand",
      label: "Spare batteries",
      context: "Spare battery",
      question: "Are any separate spare batteries carried?",
      type: "choice",
      choices: [
        { value: "NONE", label: "None" },
        { value: "ONE", label: "One" },
        { value: "MORE_THAN_ONE", label: "More than one" },
      ],
    },
    notocContentConfirmed: {
      id: "notocContentConfirmed",
      label: "NOTOC entry",
      context: "NOTOC",
      question: (answers) => `Does the NOTOC show ${core.expectedMobilityNotoc(buildEmaEntry(answers))}?`,
      type: "choice",
      choices: yesNo,
    },
    loadsheetNotocIndicator: {
      id: "loadsheetNotocIndicator",
      label: "Current loadsheet",
      context: "Loadsheet",
      question: "Does the current loadsheet show NOTOC: YES?",
      type: "choice",
      choices: yesNo,
    },
  };

  const EMA_ANSWER_ORDER = [
    "mobilityAidConfirmed",
    "batteryType",
    "installedStatus",
    "lithiumLimitBand",
    "spareLithiumBand",
    "spareCountBand",
    "notocContentConfirmed",
    "loadsheetNotocIndicator",
  ];

  let emaAnswers = createEmptyEmaAnswers();
  let emaStepIndex = 0;
  let activeScreen = "home";

  function createEmptyEmaAnswers() {
    return {
      mobilityAidConfirmed: null,
      batteryType: null,
      installedStatus: null,
      lithiumLimitBand: null,
      spareLithiumBand: null,
      spareCountBand: null,
      notocContentConfirmed: null,
      loadsheetNotocIndicator: null,
    };
  }

  function showScreen(name, focus = true) {
    activeScreen = name;
    Object.entries(screens).forEach(([screenName, screen]) => {
      screen.classList.toggle("hidden", screenName !== name);
    });
    const backLabel = name === "home" ? "Back to Tools" : "Back to NOTOC";
    elements.topBack.setAttribute("aria-label", backLabel);
    elements.topBack.title = backLabel;
    updateSessionControls();
    if (focus) {
      const heading = screens[name].querySelector("h3, button, input, select");
      window.requestAnimationFrame(() => heading?.focus?.({ preventScroll: true }));
    }
  }

  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function hasSessionState() {
    return Boolean(
      elements.lookupCode.value.trim() ||
      elements.lookupResult.childElementCount ||
      Object.values(emaAnswers).some((value) => value !== null && value !== "")
    );
  }

  function updateSessionControls() {
    elements.clearSession.classList.toggle("hidden", !hasSessionState());
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
      [core.STATES.STOP_THIS_CHECK]: "is-stop",
    }[state] || "is-refer";
  }

  function stateLabel(state) {
    return {
      [core.STATES.NO_OBVIOUS_INCONSISTENCY]: "Clear",
      [core.STATES.ACTION_OR_INFORMATION_REQUIRED]: "Confirm",
      [core.STATES.UNABLE_TO_DETERMINE_REFER]: "Confirm",
      [core.STATES.POSSIBLE_DISCREPANCY_QUERY]: "Query",
      [core.STATES.STOP_THIS_CHECK]: "Stop this check",
    }[state] || "Confirm";
  }

  function expectationLabel(expectation) {
    return {
      [core.EXPECTATIONS.REQUIRED]: "NOTOC required",
      [core.EXPECTATIONS.NOT_EXPECTED]: "NOTOC not expected",
      [core.EXPECTATIONS.CONDITIONAL]: "Conditional NOTOC expectation",
      [core.EXPECTATIONS.UNKNOWN]: "NOTOC expectation unknown",
    }[expectation] || "NOTOC expectation unknown";
  }

  function appendAnswerRows(container, rows) {
    clearNode(container);
    rows.forEach((row) => {
      const item = document.createElement("div");
      item.append(textElement("dt", "", row.label));
      item.append(textElement("dd", "", row.value));
      container.append(item);
    });
  }

  function createAnswerSummary(rows) {
    const section = document.createElement("details");
    section.className = "ema-result-answers";
    section.append(textElement("summary", "", "Answers used"));
    const list = document.createElement("dl");
    list.className = "ema-answer-summary";
    appendAnswerRows(list, rows);
    section.append(list);
    return section;
  }

  function renderEvaluation(region, evaluation, options = {}) {
    clearNode(region);
    const card = document.createElement("article");
    card.className = `notoc-result-card ${stateClass(evaluation.overallState)}`;
    card.setAttribute("role", "status");
    card.append(textElement(
      "span",
      "result-state-label",
      options.stateLabel || stateLabel(evaluation.overallState)
    ));
    card.append(textElement(
      "h3",
      "",
      options.heading || evaluation.findings?.[0]?.heading || core.STATE_HEADINGS[evaluation.overallState]
    ));
    if (options.summary) card.append(textElement("p", "result-summary", options.summary));
    if (evaluation.details?.length) {
      const details = document.createElement("dl");
      details.className = "notoc-result-details";
      appendAnswerRows(details, evaluation.details);
      card.append(details);
    }
    const findings = document.createElement("div");
    findings.className = "notoc-findings";
    evaluation.findings.forEach((finding, index) => {
      const item = document.createElement("section");
      item.className = "notoc-finding";
      const itemTitle = options.findingTitles?.[index] || (evaluation.findings.length > 1 ? `Check ${index + 1}` : null);
      if (itemTitle) item.append(textElement("h4", "", itemTitle));
      if (finding.expectation && options.showExpectation !== false) {
        item.append(textElement("span", "expectation-badge", expectationLabel(finding.expectation)));
      }
      item.append(textElement("p", "", finding.explanation));
      if (finding.action) item.append(textElement("p", "finding-action", finding.action));
      findings.append(item);
    });
    card.append(findings);
    if (options.answerRows?.length) card.append(createAnswerSummary(options.answerRows));
    region.append(card);
    return card;
  }

  function renderLookup(rawCode) {
    const lookup = core.lookupHandlingCode(rawCode, policyPack);
    const lookupStateLabel = !lookup.matched
      ? "Not available"
      : lookup.finding.state === core.STATES.POSSIBLE_DISCREPANCY_QUERY
        ? "Query"
        : lookup.expectation === core.EXPECTATIONS.NOT_EXPECTED
          ? "Not expected"
          : "Required";
    renderEvaluation(elements.lookupResult, {
      overallState: lookup.finding.state,
      findings: [lookup.finding],
      policyPackVersion: policyPack.version,
    }, {
      summary: lookup.matched
        ? `${lookup.normalisedCode}: ${lookup.description}`
        : undefined,
      stateLabel: lookupStateLabel,
      heading: lookup.finding.heading,
      showExpectation: false,
    });
    updateSessionControls();
  }

  function verifiedCodeBadge(code) {
    if (code.isExplicitDiscrepancy) return { label: "Query", className: "is-query" };
    if (code.expectation === core.EXPECTATIONS.NOT_EXPECTED) {
      return { label: "Not expected", className: "is-not-expected" };
    }
    return { label: "Required", className: "is-required" };
  }

  function renderVerifiedCodeBrowser() {
    const codes = core.listVerifiedHandlingCodes(policyPack);
    clearNode(elements.verifiedCodeList);
    elements.verifiedCodeBrowser.classList.toggle("hidden", codes.length === 0);
    elements.verifiedCodeCount.textContent = codes.length ? `${codes.length} codes` : "";

    codes.forEach((code) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "verified-code-item";
      const copy = document.createElement("span");
      copy.className = "verified-code-copy";
      copy.append(textElement("strong", "", code.code));
      copy.append(textElement("span", "", code.description));
      const badge = verifiedCodeBadge(code);
      button.append(copy, textElement("small", `verified-code-badge ${badge.className}`, badge.label));
      button.addEventListener("click", () => {
        elements.lookupCode.value = code.code;
        elements.verifiedCodeBrowser.open = false;
        hideLookupSuggestions();
        renderLookup(code.code);
        elements.lookupResult.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
      elements.verifiedCodeList.append(button);
    });
  }

  function hideLookupSuggestions() {
    clearNode(elements.lookupSuggestions);
    elements.lookupSuggestions.classList.add("hidden");
  }

  function renderLookupSuggestions() {
    const matches = core.searchHandlingCodes(elements.lookupCode.value, policyPack, 6);
    hideLookupSuggestions();
    if (!matches.length) return;

    matches.forEach((match) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "notoc-suggestion";
      button.setAttribute("role", "option");
      button.setAttribute("aria-selected", "false");
      button.append(textElement("strong", "", match.code));
      button.append(textElement("span", "", match.description));
      button.addEventListener("click", () => {
        elements.lookupCode.value = match.code;
        hideLookupSuggestions();
        renderLookup(match.code);
      });
      elements.lookupSuggestions.append(button);
    });
    elements.lookupSuggestions.classList.remove("hidden");
  }

  function activeEmaSteps() {
    const steps = [stepCatalog.mobilityAidConfirmed];
    if (emaAnswers.mobilityAidConfirmed !== "YES") return steps;

    steps.push(stepCatalog.batteryType);
    if (!emaAnswers.batteryType) return steps;

    steps.push(stepCatalog.installedStatus);
    if (!emaAnswers.installedStatus) return steps;

    if (emaAnswers.batteryType === "LITHIUM" && emaAnswers.installedStatus === "REMOVED") {
      steps.push(stepCatalog.lithiumLimitBand);
      if (!emaAnswers.lithiumLimitBand || emaAnswers.lithiumLimitBand === "EXCEEDS") return steps;
    }

    if (emaAnswers.batteryType === "LITHIUM") {
      steps.push(stepCatalog.spareLithiumBand);
      if (!emaAnswers.spareLithiumBand || emaAnswers.spareLithiumBand === "EXCEEDS") return steps;
    } else {
      steps.push(stepCatalog.spareCountBand);
      if (!emaAnswers.spareCountBand || emaAnswers.spareCountBand === "MORE_THAN_ONE") return steps;
      if (emaAnswers.batteryType === "SPILLABLE" && emaAnswers.spareCountBand === "ONE") return steps;
    }

    const entry = buildEmaEntry(emaAnswers);
    const branchIds = core.resolveEmaBranchIds(entry);
    if (!branchIds.length || branchIds.some((branchId) => !core.mobilityBranch(policyPack, branchId))) return steps;

    steps.push(stepCatalog.notocContentConfirmed);
    if (emaAnswers.notocContentConfirmed !== "YES") return steps;

    steps.push(stepCatalog.loadsheetNotocIndicator);
    return steps;
  }

  function clearAnswersAfter(stepId) {
    const answerIndex = EMA_ANSWER_ORDER.indexOf(stepId);
    if (answerIndex < 0) return;
    EMA_ANSWER_ORDER.slice(answerIndex + 1).forEach((key) => {
      emaAnswers[key] = null;
    });
  }

  function setEmaAnswer(step, value) {
    clearAnswersAfter(step.id);
    emaAnswers[step.id] = value;
    updateSessionControls();
  }

  function choiceLabel(step, value) {
    return step.choices?.find((choice) => choice.value === value)?.label || "Not known";
  }

  function answerDisplay(step) {
    const value = emaAnswers[step.id];
    if (step.type === "choice") return choiceLabel(step, value);
    return value || "Not known";
  }

  function answerRows() {
    return activeEmaSteps().map((step) => ({ label: step.label, value: answerDisplay(step) }));
  }

  function focusCurrentQuestion() {
    window.requestAnimationFrame(() => {
      const target = elements.emaQuestionOptions.querySelector("[aria-pressed='true']") ||
        elements.emaQuestionInput.querySelector("input") ||
        elements.emaQuestionTitle;
      target?.focus?.({ preventScroll: true });
    });
  }

  function advanceEmaWizard() {
    const steps = activeEmaSteps();
    if (emaStepIndex >= steps.length - 1) {
      showEmaResult();
      return;
    }
    emaStepIndex += 1;
    renderEmaQuestion();
  }

  function renderChoiceQuestion(step) {
    elements.emaQuestionOptions.classList.toggle("is-three-options", step.choices.length === 3);
    step.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "ema-choice-button";
      button.textContent = choice.label;
      button.setAttribute("aria-pressed", String(emaAnswers[step.id] === choice.value));
      button.addEventListener("click", () => {
        setEmaAnswer(step, choice.value);
        advanceEmaWizard();
      });
      elements.emaQuestionOptions.append(button);
    });
  }

  function renderInputQuestion(step) {
    const label = document.createElement("label");
    label.setAttribute("for", "emaWizardInput");
    label.className = "visually-hidden";
    label.textContent = step.question;
    const wrapper = document.createElement("div");
    wrapper.className = step.suffix ? "ema-input-with-suffix" : "";
    const input = document.createElement("input");
    input.id = "emaWizardInput";
    input.type = step.type;
    input.placeholder = step.placeholder || "";
    input.autocomplete = "off";
    if (step.type === "number") {
      input.min = String(step.min);
      input.step = String(step.step);
      input.inputMode = step.inputMode;
    }
    input.setAttribute("aria-invalid", "false");
    input.setAttribute("aria-describedby", "emaWizardInputError");
    input.addEventListener("input", () => {
      input.classList.remove("invalid");
      input.setAttribute("aria-invalid", "false");
      const error = elements.emaQuestionInput.querySelector("#emaWizardInputError");
      if (error) error.textContent = "";
    });
    const currentValue = emaAnswers[step.id];
    if (currentValue !== null && currentValue !== "") input.value = String(currentValue);
    wrapper.append(input);
    if (step.suffix) wrapper.append(textElement("span", "", step.suffix));
    const error = textElement("small", "field-error", "");
    error.id = "emaWizardInputError";
    elements.emaQuestionInput.append(label, wrapper, error);
    elements.emaWizardContinue.classList.remove("hidden");
  }

  function renderEmaQuestion() {
    const steps = activeEmaSteps();
    emaStepIndex = Math.max(0, Math.min(emaStepIndex, steps.length - 1));
    const step = steps[emaStepIndex];
    elements.emaForm.classList.remove("hidden");
    elements.emaQuestionStage.classList.remove("hidden");
    elements.emaStepLabel.textContent = `Question ${emaStepIndex + 1}`;
    elements.emaStepContext.textContent = step.context;
    elements.emaQuestionTitle.textContent = typeof step.question === "function"
      ? step.question(emaAnswers)
      : step.question;
    clearNode(elements.emaQuestionOptions);
    elements.emaQuestionOptions.classList.remove("is-three-options");
    clearNode(elements.emaQuestionInput);
    elements.emaQuestionInput.classList.toggle("hidden", step.type === "choice");
    elements.emaWizardBack.classList.toggle("hidden", emaStepIndex === 0);
    elements.emaWizardContinue.classList.add("hidden");

    if (step.type === "choice") renderChoiceQuestion(step);
    else renderInputQuestion(step);
    focusCurrentQuestion();
  }

  function advanceInputQuestion() {
    const step = activeEmaSteps()[emaStepIndex];
    if (step.type === "choice") return;

    const input = elements.emaQuestionInput.querySelector("input");
    const rawValue = input.value.trim();
    if (step.type === "number") {
      const value = Number(rawValue);
      const valid = rawValue !== "" && Number.isFinite(value) && value >= step.min &&
        (step.step !== 1 || Number.isInteger(value));
      input.classList.toggle("invalid", !valid);
      input.setAttribute("aria-invalid", String(!valid));
      if (!valid) {
        elements.emaQuestionInput.querySelector("#emaWizardInputError").textContent =
          step.step === 1 ? `Enter a whole number of at least ${step.min}.` : `Enter a value of at least ${step.min}.`;
        input.focus();
        return;
      }
      setEmaAnswer(step, value);
    } else {
      setEmaAnswer(step, rawValue);
    }
    advanceEmaWizard();
  }

  function buildEmaEntry(answers = emaAnswers) {
    return {
      id: "ema-session-item",
      mobilityAidConfirmed: answers.mobilityAidConfirmed || "UNKNOWN",
      batteryType: answers.batteryType || "UNKNOWN",
      installedStatus: answers.installedStatus || "UNKNOWN",
      lithiumLimitBand: answers.lithiumLimitBand || "UNKNOWN",
      spareLithiumBand: answers.spareLithiumBand || "UNKNOWN",
      spareCountBand: answers.spareCountBand || "UNKNOWN",
      notocContentConfirmed: answers.notocContentConfirmed || "UNKNOWN",
      loadsheetNotocIndicator: answers.loadsheetNotocIndicator || "UNKNOWN",
    };
  }

  function showEmaResult() {
    const rows = answerRows();
    const evaluation = core.evaluateEma(buildEmaEntry(), policyPack);
    elements.emaForm.classList.add("hidden");
    const card = renderEvaluation(elements.emaResult, evaluation, {
      answerRows: rows,
      showExpectation: false,
    });
    const actions = document.createElement("div");
    actions.className = "form-actions ema-result-actions";
    const back = textElement("button", "text-button secondary", "Back to answers");
    back.type = "button";
    back.addEventListener("click", () => {
      clearNode(elements.emaResult);
      elements.emaForm.classList.remove("hidden");
      emaStepIndex = activeEmaSteps().length - 1;
      renderEmaQuestion();
    });
    const restart = textElement("button", "primary-button", "Start again");
    restart.type = "button";
    restart.addEventListener("click", clearEmaAssessment);
    actions.append(back, restart);
    card.append(actions);
  }

  function clearEmaAssessment() {
    emaAnswers = createEmptyEmaAnswers();
    emaStepIndex = 0;
    clearNode(elements.emaResult);
    elements.emaForm.classList.remove("hidden");
    renderEmaQuestion();
    updateSessionControls();
  }

  function clearSession() {
    elements.lookupForm.reset();
    hideLookupSuggestions();
    clearNode(elements.lookupResult);
    clearEmaAssessment();
    showScreen("home");
    updateSessionControls();
  }

  elements.actionButtons.forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.notocScreen));
  });
  elements.topBack.addEventListener("click", () => {
    if (activeScreen === "home") {
      document.dispatchEvent(new CustomEvent("opsdeck:notoc-back-to-tools"));
      return;
    }
    showScreen("home");
  });
  document.addEventListener("opsdeck:notoc-open", () => showScreen("home", false));
  document.addEventListener("opsdeck:notoc-policy-updated", () => {
    renderVerifiedCodeBrowser();
    renderLookupSuggestions();
    if (elements.lookupCode.value.trim()) renderLookup(elements.lookupCode.value);
  });
  elements.clearSession.addEventListener("click", clearSession);

  elements.lookupCode.addEventListener("input", () => {
    renderLookupSuggestions();
    const exact = core.lookupHandlingCode(elements.lookupCode.value, policyPack);
    if (exact.matched) renderLookup(elements.lookupCode.value);
    else clearNode(elements.lookupResult);
    updateSessionControls();
  });
  elements.lookupCode.addEventListener("focus", renderLookupSuggestions);
  elements.lookupCode.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hideLookupSuggestions();
  });
  elements.lookupForm.addEventListener("submit", (event) => {
    event.preventDefault();
    hideLookupSuggestions();
    renderLookup(elements.lookupCode.value);
  });

  elements.emaWizardBack.addEventListener("click", () => {
    if (emaStepIndex === 0) return;
    emaStepIndex -= 1;
    renderEmaQuestion();
  });
  elements.emaWizardContinue.addEventListener("click", advanceInputQuestion);
  elements.emaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    advanceInputQuestion();
  });

  renderVerifiedCodeBrowser();
  renderEmaQuestion();
  showScreen("home", false);
})(typeof globalThis !== "undefined" ? globalThis : window);
