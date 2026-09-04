(function initialiseGpsChecklistUi(globalScope) {
  "use strict";
  const core = globalScope.OpsDeckGpsChecklist;
  const root = document.querySelector("#gpsView");
  if (!core || !root) return;
  const content = document.querySelector("#gpsChecklistContent");
  const introduction = document.querySelector("#gpsIntroduction");
  const sectionsPicker = document.querySelector("#gpsSectionChoices");
  const sectionsDetails = document.querySelector("#gpsSectionsControl");
  const hiddenStatus = document.querySelector("#gpsHiddenStatus");
  const status = document.querySelector("#gpsStatus");
  const revision = document.querySelector("#gpsRevision");
  const resetButton = document.querySelector("#gpsResetButton");
  const clearButton = document.querySelector("#gpsClearTicksButton");
  const restoreButton = document.querySelector("#gpsRestoreSectionsButton");
  const refreshButton = document.querySelector("#gpsRefreshButton");
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
  const notApplicableViews = new Map();

  function saved(kind) {
    try { return core.readSaved(globalScope.localStorage, kind, userId); }
    catch (_) { return null; }
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

  function appendText(parent, text) {
    // Only bold markers and the two system labels are styled; HTML stays inert.
    String(text).split(/(\*\*[^*]+\*\*|\bTERR\b|\bSYS\b)/g).filter(Boolean).forEach((part) => {
      if (part === "TERR" || part === "SYS") parent.append(node("strong", "gps-system-label", part));
      else if (part.startsWith("**") && part.endsWith("**")) parent.append(node("strong", "", part.slice(2, -2)));
      else parent.append(document.createTextNode(part));
    });
  }

  function plainText(text) {
    return String(text).replaceAll("**", "");
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
    updateProgress();
  }

  function renderBlock(block, parent) {
    if (core.CHECKABLE_TYPES.has(block.type)) {
      const item = node("div", `gps-check-item${block.indent ? " gps-indented" : ""}`);
      item.dataset.gpsRow = block.id;
      const row = node("label", "gps-check-row");
      const input = node("input");
      input.type = "checkbox";
      input.dataset.gpsItem = block.id;
      const copy = node("span", "gps-check-copy");
      appendText(copy, block.text);
      row.append(input, copy);

      const options = node("details", "gps-item-options");
      const trigger = node("summary", "gps-item-options-trigger");
      trigger.title = "More options";
      trigger["aria-label"] = `More options for ${plainText(block.text)}`;
      const dots = node("span", "gps-more-icon");
      dots["aria-hidden"] = "true";
      dots.append(node("span"), node("span"), node("span"));
      trigger.append(dots);
      const menu = node("div", "gps-item-options-menu");
      const markNotApplicable = node("button", "gps-mark-not-applicable", "Mark not applicable");
      markNotApplicable.type = "button";
      markNotApplicable.dataset.gpsMarkNotApplicable = block.id;
      markNotApplicable.addEventListener("click", () => {
        readLatestState();
        state = core.setNotApplicable(policy, state, block.id, true);
        options.open = false;
        persist();
      });
      menu.append(markNotApplicable);
      options.append(trigger, menu);
      item.append(row, options);
      input.addEventListener("change", () => {
        readLatestState();
        const other = block.exclusiveGroup && core.items(policy).find((item) =>
          item.id !== block.id && item.exclusiveGroup === block.exclusiveGroup && state.completedIds.includes(item.id));
        if (input.checked && other && !globalScope.confirm("Change this branch? The tick on the alternative outcome will be cleared. Other ticks will be kept.")) {
          updateProgress();
          return;
        }
        state = core.setChecked(policy, state, block.id, input.checked);
        persist();
      });
      parent.append(item);
      return;
    }
    const tag = block.type === "heading" ? "h4" : "p";
    const element = node(tag, `gps-${block.type}${block.presentation ? ` gps-${block.presentation}` : ""}${block.personalTechnique ? " gps-personal-technique" : ""}${block.indent ? " gps-indented" : ""}`);
    if (block.forBlockId) element.dataset.gpsParentItem = block.forBlockId;
    appendText(element, block.text);
    parent.append(element);
  }

  function updateNotApplicableLists() {
    const allItems = core.items(policy);
    const notApplicable = new Set(state.notApplicableIds || []);
    for (const [sectionId, view] of notApplicableViews) {
      const sectionItems = allItems.filter((item) => item.sectionId === sectionId && notApplicable.has(item.id));
      view.list.replaceChildren();
      view.label.textContent = sectionItems.length === 1 ? "Not applicable · 1 item" : `Not applicable · ${sectionItems.length} items`;
      view.status.textContent = sectionItems.length ? `${sectionItems.length} N/A` : "";
      view.status.title = !sectionItems.length
        ? ""
        : sectionItems.length === 1
          ? "1 item marked not applicable"
          : `${sectionItems.length} items marked not applicable`;
      view.status["aria-label"] = view.status.title;
      view.status.classList.toggle("hidden", !sectionItems.length);
      for (const item of sectionItems) {
        const row = node("div", "gps-na-row");
        const copy = node("span", "gps-na-copy");
        appendText(copy, item.text);
        const restore = node("button", "gps-na-restore", "Restore");
        restore.type = "button";
        restore.dataset.gpsRestoreItem = item.id;
        restore["aria-label"] = `Restore ${plainText(item.text)}`;
        restore.addEventListener("click", () => {
          readLatestState();
          state = core.setNotApplicable(policy, state, item.id, false);
          persist();
        });
        row.append(copy, restore);
        view.list.append(row);
      }
      view.panel.classList.toggle("hidden", !sectionItems.length);
      if (!sectionItems.length) view.panel.open = false;
    }
  }

  function updateProgress() {
    if (!policy || !state) return;
    const hidden = core.hiddenStatus(policy, state);
    hiddenStatus.textContent = hidden.count ? `${hidden.count} ${hidden.count === 1 ? "section" : "sections"} hidden` : "";
    hiddenStatus.dataset.severity = hidden.severity || "";
    hiddenStatus.classList.toggle("hidden", !hidden.count);
    revision.textContent = core.updatedLabel(state.updatedAt);
    const notApplicable = new Set(state.notApplicableIds || []);
    root.querySelectorAll("[data-gps-item]").forEach((input) => {
      input.checked = state.completedIds.includes(input.dataset.gpsItem);
    });
    root.querySelectorAll("[data-gps-row]").forEach((row) => {
      row.classList.toggle("is-checked", state.completedIds.includes(row.dataset.gpsRow));
      row.classList.toggle("gps-is-not-applicable", notApplicable.has(row.dataset.gpsRow));
    });
    root.querySelectorAll("[data-gps-parent-item]").forEach((element) => {
      element.classList.toggle("hidden", notApplicable.has(element.dataset.gpsParentItem));
    });
    updateNotApplicableLists();
    root.querySelectorAll("[data-gps-section]").forEach((section) => {
      const hidden = state.hiddenSectionIds.includes(section.dataset.gpsSection);
      const wasHidden = section.classList.contains("gps-is-hidden");
      section.classList.toggle("gps-is-hidden", hidden);
      if (hidden) section.open = false;
      else if (wasHidden) section.open = true;
    });
    root.querySelectorAll("[data-gps-visibility]").forEach((input) => {
      input.checked = !state.hiddenSectionIds.includes(input.dataset.gpsVisibility);
    });
    root.querySelectorAll("[data-gps-section-status]").forEach((label) => {
      const isHidden = state.hiddenSectionIds.includes(label.dataset.gpsSectionStatus);
      label.textContent = isHidden ? "Hidden · Show" : "";
      label.classList.toggle("hidden", !isHidden);
    });
    resetButton.disabled = false;
    clearButton.disabled = !state.completedIds.length;
    restoreButton.disabled = !state.hiddenSectionIds.length;
    sectionsDetails.classList.remove("hidden");
  }

  function render() {
    introduction.replaceChildren();
    content.replaceChildren();
    sectionsPicker.replaceChildren();
    notApplicableViews.clear();
    hiddenStatus.textContent = "";
    hiddenStatus.classList.add("hidden");
    revision.textContent = "";
    resetButton.disabled = true;
    clearButton.disabled = true;
    restoreButton.disabled = true;
    sectionsDetails.classList.add("hidden");
    if (!policy) return;
    policy.introduction.forEach((block) => renderBlock(block, introduction));
    const visibilityGroups = new Set();
    for (const section of policy.sections) {
      const groupId = section.visibilityGroup || section.id;
      if (!visibilityGroups.has(groupId)) {
        visibilityGroups.add(groupId);
        const group = policy.sections.filter((entry) => (entry.visibilityGroup || entry.id) === groupId);
        const label = node("label", "gps-section-choice");
        const input = node("input");
        input.type = "checkbox";
        input.dataset.gpsVisibility = section.id;
        input.addEventListener("change", () => {
          readLatestState();
          state = core.setSectionVisible(policy, state, section.id, input.checked);
          persist();
        });
        label.append(input, node("span", "", group.map((entry) => entry.title).join(" + ")));
        sectionsPicker.append(label);
      }
      const panel = node("details", "gps-section");
      panel.open = true;
      panel.dataset.gpsSection = section.id;
      const summary = node("summary", "gps-disclosure");
      summary.addEventListener("click", (event) => {
        if (!state.hiddenSectionIds.includes(section.id)) return;
        event.preventDefault();
        readLatestState();
        state = core.setSectionVisible(policy, state, section.id, true);
        persist();
      });
      const title = node("h3", "", section.title);
      const notApplicableStatus = node("span", "gps-na-badge hidden");
      notApplicableStatus.dataset.gpsNaStatus = section.id;
      const sectionStatus = node("span", "gps-hidden-badge hidden");
      sectionStatus.dataset.gpsSectionStatus = section.id;
      sectionStatus.dataset.severity = core.hiddenSeverity(section.id);
      summary.append(title, notApplicableStatus, sectionStatus);
      const body = node("div", "gps-section-body");
      section.blocks.forEach((block) => renderBlock(block, body));
      const notApplicablePanel = node("details", "gps-na-summary hidden");
      const notApplicableLabel = node("summary", "gps-na-summary-label");
      const notApplicableList = node("div", "gps-na-list");
      notApplicablePanel.append(notApplicableLabel, notApplicableList);
      body.append(notApplicablePanel);
      notApplicableViews.set(section.id, {
        panel: notApplicablePanel,
        label: notApplicableLabel,
        list: notApplicableList,
        status: notApplicableStatus,
      });
      panel.append(summary, body);
      content.append(panel);
    }
    updateProgress();
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
      message("Checklist revised. Previous checklist progress and section choices have been cleared.", true);
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
        } catch (_) { /* A damaged offline copy must not prevent a fresh download. */ }
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
        if (policy && record?.content_sha256 !== hash &&
          (state.completedIds.length || (state.notApplicableIds || []).length || state.hiddenSectionIds.length)) {
          if (!core.validatePolicy(record?.checklist) || await core.policyHash(record.checklist, globalScope.crypto) !== record.content_sha256) {
            throw new Error("Invalid checklist");
          }
          if (generation !== token) return;
          if (!globalScope.confirm("An updated checklist is available. Open it now? This clears checklist progress and shows every section because the wording has changed.")) {
            cloudLoaded = true;
            message("Checklist update postponed. Your saved version and ticks are unchanged.", true);
            return;
          }
        }
        // A refresh of the same source must not replace in-memory progress.
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
        } catch (_) { message("The checklist is open, but its offline copy could not be saved.", true); }
      } catch (_) {
        if (generation === token) message(policy ? "Could not refresh. The saved checklist is still available." : "Checklist unavailable. Refresh when connected.", true);
      }
    })();
    pending = operation;
    operation.finally(() => {
      if (generation === token) { pending = null; refreshButton.disabled = false; }
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
      try { globalScope.localStorage.removeItem(core.storageKey("policy", userId)); }
      catch (_) { /* The signed-out view still clears all checklist text. */ }
    }
    setContext(null, null);
  }

  resetButton.addEventListener("click", () => {
    if (!policy) return;
    readLatestState();
    if ((state.completedIds.length || (state.notApplicableIds || []).length || state.hiddenSectionIds.length) &&
      !globalScope.confirm("Start a new checklist? All ticks and not-applicable choices will be cleared, and every section shown again.")) return;
    state = core.newState(userId, hash);
    persist();
    void load({ force: true });
  });
  clearButton.addEventListener("click", () => {
    if (!policy) return;
    readLatestState();
    if (!globalScope.confirm("Clear all ticks? Not-applicable items and section choices will be kept.")) return;
    state = { ...state, completedIds: [], updatedAt: new Date().toISOString() };
    persist();
  });
  restoreButton.addEventListener("click", () => {
    if (!policy) return;
    readLatestState();
    state = { ...state, hiddenSectionIds: [], updatedAt: new Date().toISOString() };
    persist();
  });
  refreshButton.addEventListener("click", () => void load({ force: true }));
  globalScope.addEventListener("storage", (event) => {
    if (policy && event.key === core.storageKey("progress", userId)) {
      readLatestState();
      updateProgress();
    }
  });
  globalScope.OpsDeckGpsUi = { setContext, load, forget };
  render();
})(window);
