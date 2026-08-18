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
    lookupSuggestions: document.querySelector("#notocLookupSuggestions"),
    lookupResult: document.querySelector("#notocLookupResult"),
    emaForm: document.querySelector("#notocEmaForm"),
    emaQuestionStage: document.querySelector("#emaQuestionStage"),
    emaReviewStage: document.querySelector("#emaReviewStage"),
    emaStepLabel: document.querySelector("#emaStepLabel"),
    emaStepContext: document.querySelector("#emaStepContext"),
    emaQuestionTitle: document.querySelector("#emaQuestionTitle"),
    emaQuestionOptions: document.querySelector("#emaQuestionOptions"),
    emaQuestionInput: document.querySelector("#emaQuestionInput"),
    emaWizardBack: document.querySelector("#emaWizardBackButton"),
    emaWizardContinue: document.querySelector("#emaWizardContinueButton"),
    emaWizardUnknown: document.querySelector("#emaWizardUnknownButton"),
    emaReviewBack: document.querySelector("#emaReviewBackButton"),
    emaAnswerSummary: document.querySelector("#emaAnswerSummary"),
    emaResult: document.querySelector("#notocEmaResult"),
  };
  const screens = {
    home: elements.home,
    lookup: elements.lookup,
    ema: elements.ema,
  };

  const yesNoUnknown = [
    { value: "YES", label: "Yes" },
    { value: "NO", label: "No" },
    { value: "UNKNOWN", label: "Not confirmed" },
  ];
  const stepCatalog = {
    mobilityAidConfirmed: {
      id: "mobilityAidConfirmed",
      label: "Mobility aid",
      context: "Item",
      question: "Is this a wheelchair or electric mobility aid used by a person with reduced mobility?",
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
        { value: "NON_SPILLABLE", label: "Non-spillable wet battery" },
        { value: "SPILLABLE", label: "Spillable wet battery" },
        { value: "UNKNOWN", label: "Unknown or unclear" },
      ],
    },
    installedStatus: {
      id: "installedStatus",
      label: "Battery configuration",
      context: "Battery",
      question: "How is the battery configured?",
      type: "choice",
      choices: [
        { value: "INSTALLED", label: "Installed in mobility aid" },
        { value: "REMOVED", label: "Removed from mobility aid" },
        { value: "SPARE", label: "Spare battery" },
        { value: "UNKNOWN", label: "Unknown or unclear" },
      ],
    },
    securelyAttached: {
      id: "securelyAttached",
      label: "Securely attached",
      context: "Installed battery",
      question: "Is the installed battery securely attached?",
      type: "choice",
      choices: yesNoUnknown,
    },
    isolatedAgainstInadvertentActivation: {
      id: "isolatedAgainstInadvertentActivation",
      label: "Isolation",
      context: "Installed battery",
      question: "Is the mobility aid isolated against inadvertent activation?",
      type: "choice",
      choices: yesNoUnknown,
    },
    wattHours: {
      id: "wattHours",
      label: "Battery rating",
      context: "Battery",
      question: "What watt-hour rating is shown?",
      type: "number",
      min: 0.01,
      step: 0.01,
      inputMode: "decimal",
      suffix: "Wh",
      placeholder: "Enter rating",
      unknownLabel: "Not known",
    },
    spareCount: {
      id: "spareCount",
      label: "Spare batteries",
      context: "Spare battery",
      question: "How many spare batteries are shown?",
      type: "number",
      min: 1,
      step: 1,
      inputMode: "numeric",
      placeholder: "Enter number",
      unknownLabel: "Not known",
    },
    terminalsProtected: {
      id: "terminalsProtected",
      label: "Terminal protection",
      context: "Battery",
      question: "Are the battery terminals protected against short circuit?",
      type: "choice",
      choices: yesNoUnknown,
    },
    operatorApprovalConfirmed: {
      id: "operatorApprovalConfirmed",
      label: "Operator approval",
      context: "Approval",
      question: "Has operator approval been confirmed?",
      type: "choice",
      choices: yesNoUnknown,
    },
    locationType: {
      id: "locationType",
      label: "Stowage location",
      context: "Location",
      question: "Where is the battery or mobility aid shown as stowed?",
      type: "choice",
      choices: [
        { value: "CABIN", label: "Cabin" },
        { value: "HOLD", label: "Hold" },
        { value: "OTHER", label: "Other" },
        { value: "NOT_SHOWN", label: "Not shown" },
        { value: "UNCLEAR", label: "Unclear" },
      ],
    },
  };

  let emaAnswers = createEmptyEmaAnswers();
  let emaStepIndex = 0;

  function createEmptyEmaAnswers() {
    return {
      mobilityAidConfirmed: null,
      batteryType: null,
      installedStatus: null,
      securelyAttached: null,
      isolatedAgainstInadvertentActivation: null,
      wattHours: null,
      spareCount: null,
      terminalsProtected: null,
      operatorApprovalConfirmed: null,
      locationType: null,
    };
  }

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
      [core.STATES.NOT_APPLICABLE]: "is-neutral",
      [core.STATES.NO_OBVIOUS_INCONSISTENCY]: "is-clear",
      [core.STATES.ACTION_OR_INFORMATION_REQUIRED]: "is-action",
      [core.STATES.UNABLE_TO_DETERMINE_REFER]: "is-refer",
      [core.STATES.POSSIBLE_DISCREPANCY_QUERY]: "is-query",
    }[state] || "is-refer";
  }

  function stateLabel(state) {
    return {
      [core.STATES.NOT_APPLICABLE]: "Not applicable",
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
      CODE_VERIFIED_NOTOC_UNVERIFIED: "Code verified; NOTOC expectation not verified",
      UNVERIFIED_NOT_FOUND: "No authoritative source found",
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
    const section = document.createElement("section");
    section.className = "ema-result-answers";
    section.append(textElement("h4", "", "Answers used"));
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
    card.append(textElement("span", "result-state-label", stateLabel(evaluation.overallState)));
    card.append(textElement("h3", "", core.STATE_HEADINGS[evaluation.overallState]));
    if (options.summary) card.append(textElement("p", "result-summary", options.summary));
    if (options.answerRows?.length) card.append(createAnswerSummary(options.answerRows));

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
    return card;
  }

  function renderLookup(rawCode) {
    const lookup = core.lookupHandlingCode(rawCode, policyPack);
    renderEvaluation(elements.lookupResult, {
      overallState: lookup.finding.state,
      findings: [lookup.finding],
      policyPackVersion: policyPack.version,
    }, {
      summary: lookup.matched
        ? `${lookup.normalisedCode}: ${lookup.description}`
        : `${lookup.normalisedCode || "No code"}: unable to classify from the current verified BA mapping.`,
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
    if (!emaAnswers.batteryType || emaAnswers.batteryType === "UNKNOWN") return steps;

    steps.push(stepCatalog.installedStatus);
    if (!emaAnswers.installedStatus || emaAnswers.installedStatus === "UNKNOWN") return steps;
    if (emaAnswers.batteryType !== "LITHIUM") return steps;

    if (emaAnswers.installedStatus === "INSTALLED") {
      steps.push(stepCatalog.securelyAttached, stepCatalog.isolatedAgainstInadvertentActivation);
    }
    if (emaAnswers.installedStatus === "REMOVED") {
      steps.push(stepCatalog.wattHours, stepCatalog.terminalsProtected);
    }
    if (emaAnswers.installedStatus === "SPARE") {
      steps.push(stepCatalog.spareCount, stepCatalog.wattHours, stepCatalog.terminalsProtected);
    }
    steps.push(stepCatalog.operatorApprovalConfirmed, stepCatalog.locationType);
    return steps;
  }

  function clearAnswersAfter(stepId) {
    const branchOrder = ["mobilityAidConfirmed", "batteryType", "installedStatus"];
    const branchIndex = branchOrder.indexOf(stepId);
    if (branchIndex < 0) return;
    const retained = new Set(branchOrder.slice(0, branchIndex + 1));
    Object.keys(emaAnswers).forEach((key) => {
      if (retained.has(key)) return;
      emaAnswers[key] = null;
    });
  }

  function setEmaAnswer(step, value) {
    clearAnswersAfter(step.id);
    emaAnswers[step.id] = value;
  }

  function choiceLabel(step, value) {
    return step.choices?.find((choice) => choice.value === value)?.label || "Not known";
  }

  function answerDisplay(step) {
    const value = emaAnswers[step.id];
    if (step.type === "choice") return choiceLabel(step, value);
    if (step.id === "wattHours") return Number.isFinite(value) ? `${value} Wh` : "Not known";
    if (step.id === "spareCount") return Number.isInteger(value) ? String(value) : "Not known";
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

  function showEmaReview() {
    elements.emaQuestionStage.classList.add("hidden");
    elements.emaReviewStage.classList.remove("hidden");
    appendAnswerRows(elements.emaAnswerSummary, answerRows());
    window.requestAnimationFrame(() => elements.emaReviewStage.querySelector("button")?.focus?.({ preventScroll: true }));
  }

  function advanceEmaWizard() {
    const steps = activeEmaSteps();
    if (emaStepIndex >= steps.length - 1) {
      showEmaReview();
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
    elements.emaWizardUnknown.textContent = step.unknownLabel;
    elements.emaWizardUnknown.classList.remove("hidden");
  }

  function renderEmaQuestion() {
    const steps = activeEmaSteps();
    emaStepIndex = Math.max(0, Math.min(emaStepIndex, steps.length - 1));
    const step = steps[emaStepIndex];
    elements.emaForm.classList.remove("hidden");
    elements.emaQuestionStage.classList.remove("hidden");
    elements.emaReviewStage.classList.add("hidden");
    elements.emaStepLabel.textContent = `Question ${emaStepIndex + 1}`;
    elements.emaStepContext.textContent = step.context;
    elements.emaQuestionTitle.textContent = step.question;
    clearNode(elements.emaQuestionOptions);
    elements.emaQuestionOptions.classList.remove("is-three-options");
    clearNode(elements.emaQuestionInput);
    elements.emaQuestionInput.classList.toggle("hidden", step.type === "choice");
    elements.emaWizardBack.classList.toggle("hidden", emaStepIndex === 0);
    elements.emaWizardContinue.classList.add("hidden");
    elements.emaWizardUnknown.classList.add("hidden");

    if (step.type === "choice") renderChoiceQuestion(step);
    else renderInputQuestion(step);
    focusCurrentQuestion();
  }

  function advanceInputQuestion(useUnknown = false) {
    const step = activeEmaSteps()[emaStepIndex];
    if (step.type === "choice") return;
    if (useUnknown) {
      setEmaAnswer(step, step.type === "text" ? "" : null);
      advanceEmaWizard();
      return;
    }

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

  function buildEmaEntry() {
    return {
      id: "ema-session-item",
      mobilityAidConfirmed: emaAnswers.mobilityAidConfirmed || "UNKNOWN",
      batteryType: emaAnswers.batteryType || "UNKNOWN",
      installedStatus: emaAnswers.installedStatus || "UNKNOWN",
      securelyAttached: emaAnswers.securelyAttached || "UNKNOWN",
      isolatedAgainstInadvertentActivation: emaAnswers.isolatedAgainstInadvertentActivation || "UNKNOWN",
      wattHours: Number.isFinite(emaAnswers.wattHours) ? emaAnswers.wattHours : null,
      spareCount: Number.isInteger(emaAnswers.spareCount) ? emaAnswers.spareCount : null,
      terminalsProtected: emaAnswers.terminalsProtected || "UNKNOWN",
      operatorApprovalConfirmed: emaAnswers.operatorApprovalConfirmed || "UNKNOWN",
      location: {
        type: emaAnswers.locationType || "NOT_SHOWN",
        rawText: "",
      },
    };
  }

  function showEmaResult() {
    const rows = answerRows();
    const evaluation = core.evaluateEma(buildEmaEntry(), policyPack);
    elements.emaForm.classList.add("hidden");
    const card = renderEvaluation(elements.emaResult, evaluation, {
      summary: evaluation.overallState === core.STATES.NOT_APPLICABLE
        ? undefined
        : expectationLabel(evaluation.expectation),
      answerRows: rows,
    });
    const actions = document.createElement("div");
    actions.className = "form-actions ema-result-actions";
    const back = textElement("button", "text-button secondary", "Back to answers");
    back.type = "button";
    back.addEventListener("click", () => {
      clearNode(elements.emaResult);
      elements.emaForm.classList.remove("hidden");
      showEmaReview();
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
  }

  function clearSession() {
    elements.lookupForm.reset();
    hideLookupSuggestions();
    clearNode(elements.lookupResult);
    clearEmaAssessment();
    showScreen("home");
  }

  elements.actionButtons.forEach((button) => {
    button.addEventListener("click", () => showScreen(button.dataset.notocScreen));
  });
  elements.backButtons.forEach((button) => button.addEventListener("click", () => showScreen("home")));
  document.addEventListener("opsdeck:notoc-open", () => showScreen("home", false));
  document.addEventListener("opsdeck:notoc-policy-updated", () => {
    renderLookupSuggestions();
    if (elements.lookupCode.value.trim()) renderLookup(elements.lookupCode.value);
  });
  elements.clearSession.addEventListener("click", clearSession);

  elements.lookupCode.addEventListener("input", () => {
    renderLookupSuggestions();
    const exact = core.lookupHandlingCode(elements.lookupCode.value, policyPack);
    if (exact.matched) renderLookup(elements.lookupCode.value);
    else clearNode(elements.lookupResult);
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
  elements.emaWizardContinue.addEventListener("click", () => advanceInputQuestion(false));
  elements.emaWizardUnknown.addEventListener("click", () => advanceInputQuestion(true));
  elements.emaReviewBack.addEventListener("click", () => {
    emaStepIndex = activeEmaSteps().length - 1;
    renderEmaQuestion();
  });
  elements.emaForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!elements.emaReviewStage.classList.contains("hidden")) showEmaResult();
    else advanceInputQuestion(false);
  });

  renderEmaQuestion();
  showScreen("home", false);
})(typeof globalThis !== "undefined" ? globalThis : window);
