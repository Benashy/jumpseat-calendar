(function attachUiAccessibility(scope) {
  "use strict";
  let active = null;
  let trigger = null;
  const backgrounds = new Map();
  const focusable = () => [...active.querySelectorAll("button, input, select, textarea, a[href], [tabindex]")]
    .filter((element) => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);

  function close(dialog) {
    if (!dialog) return;
    dialog.classList.add("hidden");
    if (dialog !== active) return;
    for (const [element, inert] of backgrounds) element.inert = inert;
    backgrounds.clear();
    active = null;
    const returnTo = trigger;
    trigger = null;
    if (returnTo?.isConnected) returnTo.focus();
  }

  function open(dialog, source = document.activeElement) {
    if (!dialog) return;
    if (active) close(active);
    active = dialog;
    trigger = source;
    dialog.classList.remove("hidden");
    dialog.tabIndex = -1;
    let branch = dialog;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (sibling === branch || ["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)) continue;
        backgrounds.set(sibling, sibling.inert);
        sibling.inert = true;
      }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
    (focusable()[0] || dialog).focus();
  }

  document.addEventListener("focusin", (event) => {
    if (active && !active.contains(event.target)) (focusable()[0] || active).focus();
  });
  document.addEventListener("keydown", (event) => {
    if (active && event.key === "Tab") {
      const controls = focusable();
      if (!controls.length) { event.preventDefault(); active.focus(); return; }
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      return;
    }
    const tab = event.target.closest?.('[role="tab"]');
    const list = tab?.closest('[role="tablist"]');
    if (!list || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const tabs = [...list.querySelectorAll('[role="tab"]')].filter((item) => !item.disabled && item.getClientRects().length);
    const index = tabs.indexOf(tab);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next]?.click();
    tabs[next]?.focus();
  });
  const updateTabs = () => document.querySelectorAll('[role="tablist"]').forEach((list) => {
    const tabs = [...list.querySelectorAll('[role="tab"]')];
    const selected = tabs.find((tab) => tab.getAttribute("aria-selected") === "true") || tabs[0];
    tabs.forEach((tab) => { tab.tabIndex = tab === selected ? 0 : -1; });
  });
  new MutationObserver(updateTabs).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected"] });
  updateTabs();
  scope.OpsDeckDialogs = { open, close };
})(window);
