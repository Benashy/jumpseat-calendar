(function initialiseLvtoChecklistUi(globalScope) {
  "use strict";

  const core = globalScope.OpsDeckLvtoChecklist;
  const root = document.querySelector("#lvtoView");
  if (!core || !root) return;

  const content = document.querySelector("#lvtoChecklistContent");
  const status = document.querySelector("#lvtoStatus");
  const revision = document.querySelector("#lvtoRevision");
  const resetButton = document.querySelector("#lvtoResetButton");
  const clearButton = document.querySelector("#lvtoClearTicksButton");
  const refreshButton = document.querySelector("#lvtoRefreshButton");
  let userId = null;
  let fetchRecord = null;
  let generation = 0;
  let pending = null;
  let policy = null;
  let hash = null;
  let state = null;
  let cloudLoaded = false;
  let progressSaved = true;
  let policyRevised = false;

  function saved(kind) {
    try {
      return core.readSaved(globalScope.localStorage, kind, userId);
    } catch (_) {
      return null;
    }
  }

  function message(text, warning = false) {
    status.textContent = text;
    status.classList.toggle("status-warning", warning);
    status.classList.toggle("hidden", !text);
  }

  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function readLatestState() {
    if (!progressSaved) return;
    const latest = saved("progress");
    if (latest?.policyHash === hash) state = core.restoreState(policy, userId, hash, latest);
  }

  function persist() {
    try {
      globalScope.localStorage.setItem(core.storageKey("progress", userId), JSON.stringify(state));
      progressSaved = true;
      policyRevised = false;
      message("");
    } catch (_) {
      progressSaved = false;
      message("Progress is not saved on this device. Keep this page open.", true);
    }
    updateState();
  }

  function conditionAttributes(element, item) {
    if (!item.condition) return;
    element.dataset.lvtoConditionDecision = item.condition.decisionId;
    element.dataset.lvtoConditionEquals = item.condition.equals;
    element.classList.add("lvto-conditional");
  }

  function renderCheck(item) {
    const row = node("label", "lvto-check-row");
    conditionAttributes(row, item);
    const input = node("input");
    input.type = "checkbox";
    input.dataset.lvtoCheck = item.id;
    const copy = node("span", "lvto-check-copy", item.text);
    row.append(input, copy);
    input.addEventListener("change", () => {
      readLatestState();
      state = core.setChecked(policy, state, item.id, input.checked);
      persist();
    });
    return row;
  }

  function renderDecision(item) {
    const fieldset = node("fieldset", "lvto-decision");
    conditionAttributes(fieldset, item);
    const legend = node("legend", "lvto-decision-question", item.text);
    const options = node("div", "lvto-decision-options");
    options.setAttribute("role", "group");
    options.setAttribute("aria-label", item.text);
    for (const option of item.options) {
      const button = node("button", "lvto-decision-button", option.label);
      button.type = "button";
      button.dataset.lvtoDecision = item.id;
      button.dataset.lvtoOption = option.id;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        readLatestState();
        const next = state.decisions[item.id] === option.id ? null : option.id;
        state = core.setDecision(policy, state, item.id, next);
        persist();
      });
      options.append(button);
    }
    fieldset.append(legend, options);
    return fieldset;
  }

  function renderField(item) {
    const label = node("label", "lvto-field");
    conditionAttributes(label, item);
    label.append(node("span", "lvto-field-label", item.label));
    const control = node("span", "lvto-field-control");
    const input = node("input");
    input.type = "text";
    input.inputMode = item.inputMode || "text";
    input.maxLength = item.maxLength || 80;
    input.autocomplete = "off";
    input.spellcheck = false;
    input.dataset.lvtoField = item.id;
    input.setAttribute("aria-label", item.label);
    if (item.placeholder) input.placeholder = item.placeholder;
    input.addEventListener("input", () => {
      readLatestState();
      state = core.setValue(policy, state, item.id, input.value);
      persist();
    });
    control.append(input);
    if (item.unit) control.append(node("span", "lvto-field-unit", item.unit));
    label.append(control);
    return label;
  }

  function renderReference(item) {
    const element = node("div", "lvto-reference-value");
    conditionAttributes(element, item);
    element.append(node("span", "lvto-reference-label", item.label), node("strong", "", item.value));
    return element;
  }

  function renderText(item) {
    const tag = item.type === "heading" ? "h4" : "p";
    const element = node(tag, item.type === "heading" ? "lvto-item-heading" : "lvto-note", item.text);
    if (item.tone) element.dataset.tone = item.tone;
    conditionAttributes(element, item);
    return element;
  }

  function renderItem(item) {
    if (item.type === "check") return renderCheck(item);
    if (item.type === "decision") return renderDecision(item);
    if (item.type === "field") return renderField(item);
    if (item.type === "reference") return renderReference(item);
    return renderText(item);
  }

  function renderSection(section) {
    const panel = node("details", "lvto-section");
    panel.open = section.openByDefault !== false;
    panel.dataset.lvtoSection = section.id;
    const summary = node("summary", "lvto-disclosure");
    summary.append(node("h3", "", section.title));
    const body = node("div", "lvto-section-body");
    for (let index = 0; index < section.items.length;) {
      const item = section.items[index];
      if (!item.layoutGroup) {
        body.append(renderItem(item));
        index += 1;
        continue;
      }
      const group = node("div", "lvto-entry-grid");
      group.dataset.layoutGroup = item.layoutGroup;
      while (index < section.items.length && section.items[index].layoutGroup === item.layoutGroup) {
        group.append(renderItem(section.items[index]));
        index += 1;
      }
      body.append(group);
    }
    panel.append(summary, body);
    return panel;
  }

  function updateState() {
    if (!policy || !state) return;
    revision.textContent = core.updatedLabel(state.updatedAt);
    root.querySelectorAll("[data-lvto-check]").forEach((input) => {
      input.checked = state.completedIds.includes(input.dataset.lvtoCheck);
      input.closest(".lvto-check-row").classList.toggle("is-checked", input.checked);
    });
    root.querySelectorAll("[data-lvto-field]").forEach((input) => {
      const value = state.values[input.dataset.lvtoField] || "";
      if (input.value !== value) input.value = value;
    });
    root.querySelectorAll("[data-lvto-decision]").forEach((button) => {
      const selected = state.decisions[button.dataset.lvtoDecision] === button.dataset.lvtoOption;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    root.querySelectorAll("[data-lvto-condition-decision]").forEach((element) => {
      const visible = state.decisions[element.dataset.lvtoConditionDecision] === element.dataset.lvtoConditionEquals;
      element.classList.toggle("hidden", !visible);
      element.querySelectorAll?.("input, button").forEach((control) => { control.disabled = !visible; });
    });
    resetButton.disabled = false;
    clearButton.disabled = !state.completedIds.length;
  }

  function render() {
    content.replaceChildren();
    revision.textContent = "";
    resetButton.disabled = true;
    clearButton.disabled = true;
    if (!policy) return;
    policy.sections.forEach((section) => content.append(renderSection(section)));
    updateState();
  }

  async function acceptRecord(record, token) {
    if (!record || !core.validatePolicy(record.checklist) || !/^[a-f0-9]{64}$/.test(record.content_sha256 || "")) return false;
    const digest = await core.policyHash(record.checklist, globalScope.crypto);
    if (generation !== token || digest !== record.content_sha256) return false;
    const previous = saved("progress");
    policy = record.checklist;
    hash = digest;
    state = core.restoreState(policy, userId, hash, previous);
    render();
    if (previous && previous.policyHash !== hash) {
      persist();
      policyRevised = true;
      message("Checklist revised. Previous entries and ticks have been cleared.", true);
    }
    return true;
  }

  function load({ force = false } = {}) {
    if (!userId || !fetchRecord) return Promise.resolve();
    if (pending) return pending;
    if (cloudLoaded && !force) return Promise.resolve();
    const token = generation;
    const owner = userId;
    const loader = fetchRecord;
    refreshButton.disabled = true;
    const operation = (async () => {
      if (!policy) {
        try {
          const cached = saved("policy");
          if (cached) await acceptRecord(cached, token);
        } catch (_) {
          // A damaged offline copy must not prevent a fresh download.
        }
      }
      if (generation !== token) return;
      if (!navigator.onLine) {
        message(policy ? "Using the saved checklist offline." : "Connect and sign in once to download the checklist.", !policy);
        return;
      }
      if (!policy) message("Loading checklist...");
      try {
        const record = await loader();
        if (generation !== token) return;
        const oldHash = hash;
        if (policy && record?.content_sha256 !== hash && core.hasProgress(state)) {
          if (!core.validatePolicy(record?.checklist) || await core.policyHash(record.checklist, globalScope.crypto) !== record.content_sha256) {
            throw new Error("Invalid checklist");
          }
          if (generation !== token) return;
          if (!globalScope.confirm("An updated checklist is available. Open it now? This clears the current entries and ticks because the wording has changed.")) {
            cloudLoaded = true;
            message("Checklist update postponed. Your saved version and entries are unchanged.", true);
            return;
          }
        }
        if (policy && record?.content_sha256 === hash && core.validatePolicy(record.checklist)) {
          if (await core.policyHash(record.checklist, globalScope.crypto) !== hash) throw new Error("Invalid checklist");
          if (generation !== token) return;
          cloudLoaded = true;
        } else if (await acceptRecord(record, token)) cloudLoaded = true;
        else throw new Error("Invalid checklist");
        if (generation !== token) return;
        try {
          globalScope.localStorage.setItem(core.storageKey("policy", owner), JSON.stringify({ ...record, userId: owner }));
          if ((!oldHash || oldHash === hash) && !policyRevised && progressSaved) message("");
        } catch (_) {
          message("The checklist is open, but its offline copy could not be saved.", true);
        }
      } catch (_) {
        if (generation === token) message(policy ? "Could not refresh. The saved checklist is still available." : "Checklist unavailable. Refresh when connected.", true);
      }
    })();
    pending = operation;
    operation.finally(() => {
      if (generation === token) {
        pending = null;
        refreshButton.disabled = false;
      }
    });
    return operation;
  }

  function setContext(owner, loader) {
    if (owner === userId) return;
    generation += 1;
    userId = owner || null;
    fetchRecord = loader || null;
    pending = null;
    policy = null;
    state = null;
    hash = null;
    cloudLoaded = false;
    progressSaved = true;
    policyRevised = false;
    refreshButton.disabled = !owner;
    render();
    message(owner ? "Loading checklist..." : "Sign in to load the checklist.");
    if (owner) void load();
  }

  function forget() {
    if (userId) {
      try {
        globalScope.localStorage.removeItem(core.storageKey("policy", userId));
      } catch (_) {
        // The signed-out view still clears all checklist text.
      }
    }
    setContext(null, null);
  }

  resetButton.addEventListener("click", () => {
    if (!policy) return;
    readLatestState();
    if (core.hasProgress(state) && !globalScope.confirm("Start a new checklist? All entries and ticks will be cleared.")) return;
    state = core.newState(userId, hash);
    persist();
    void load({ force: true });
  });
  clearButton.addEventListener("click", () => {
    if (!policy) return;
    readLatestState();
    if (!globalScope.confirm("Clear all ticks? Entered values and the return decision will be kept.")) return;
    state = core.clearChecks(state);
    persist();
  });
  refreshButton.addEventListener("click", () => void load({ force: true }));
  globalScope.addEventListener("storage", (event) => {
    if (policy && event.key === core.storageKey("progress", userId)) {
      readLatestState();
      updateState();
    }
  });

  globalScope.OpsDeckLvtoUi = { setContext, load, forget };
  render();
})(window);
