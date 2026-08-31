const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const ltot = require("../ltot-core.js");

const app = fs.readFileSync(path.join(__dirname, "../app.js"), "utf8");

function element() {
  const classes = new Set();
  return {
    textContent: "", dataset: {}, attributes: {},
    classList: {
      toggle(name, enabled) { if (enabled) classes.add(name); else classes.delete(name); },
      contains: (name) => classes.has(name),
    },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
}

function harness(now = "2026-08-31T12:00:00Z") {
  const elements = {};
  for (const key of ["Pushback", "Takeoff", "OnChocks"]) {
    const card = element();
    const date = element();
    card.querySelector = () => date;
    const countdown = element();
    countdown.closest = () => card;
    elements[`latest${key}Countdown`] = countdown;
    elements[`latest${key}`] = element();
    const mobile = element();
    const mobileFields = { ".mobile-result-date": element(), ".mobile-result-status": element() };
    mobile.parentElement = element();
    mobile.parentElement.querySelector = (selector) => mobileFields[selector];
    elements[`ftlMobile${key}`] = mobile;
  }
  elements.ftlMobileResultStrip = element();
  elements.ftlMobileResultStrip.innerText = "Calculated latest times";
  elements.ftlView = element();
  const context = {
    elements,
    ftlAnchorDate: "2026-08-31",
    ftlLatestPushbackMinutes: null,
    ftlLatestTakeoffMinutes: null,
    ftlLatestOnChocksMinutes: null,
    window: { OpsDeckLtot: {
      ...ltot,
      countdownPresentation: (date, minutes) => ltot.countdownPresentation(date, minutes, Date.parse(now)),
    } },
  };
  const constants = ["FTL_DATE_FORMATTER", "FTL_SHORT_DATE_FORMATTER"]
    .map((name) => app.match(new RegExp(`^const ${name} = .+;`, "m"))[0]);
  const functions = ["ftlResultDate", "updateCountdownElement", "updateFtlCountdown", "updateMobileFtlResults"]
    .map((name) => app.match(new RegExp(`^function ${name}\\([^]*?^}`, "m"))[0]);
  vm.runInNewContext([...constants, ...functions].join("\n"), context);
  return context;
}

test("mobile and full results agree on normal, amber and exceeded states", () => {
  const h = harness();
  h.ftlLatestPushbackMinutes = 719;
  h.ftlLatestTakeoffMinutes = 735;
  h.ftlLatestOnChocksMinutes = 810;
  for (const [key, time] of [["Pushback", "11:59Z"], ["Takeoff", "12:15Z"], ["OnChocks", "13:30Z"]]) {
    h.elements[`latest${key}`].textContent = time;
  }
  h.updateFtlCountdown();
  for (const [key, state, text] of [["Pushback", "overdue", "Exceeded"], ["Takeoff", "warning", "15m left"], ["OnChocks", "normal", "1h 30m left"]]) {
    const mobile = h.elements[`ftlMobile${key}`];
    assert.equal(mobile.parentElement.dataset.state, state);
    assert.equal(mobile.parentElement.querySelector(".mobile-result-status").textContent, text);
    assert.equal(mobile.parentElement.querySelector(".mobile-result-date").textContent, "31 Aug");
    assert.equal(mobile.textContent, h.elements[`latest${key}`].textContent);
  }
  assert.ok(h.elements.latestPushbackCountdown.closest().classList.contains("is-overdue"));
  assert.ok(h.elements.latestTakeoffCountdown.closest().classList.contains("is-warning"));
  assert.equal(h.elements.latestOnChocksCountdown.textContent, "1h 30m remaining");
});

test("expired values are not repeated as ordinary times in the pinned strip", () => {
  const h = harness();
  h.ftlAnchorDate = "2026-08-30";
  h.ftlLatestOnChocksMinutes = 1020;
  h.elements.latestOnChocks.textContent = "17:00Z";
  h.updateFtlCountdown();
  assert.equal(h.elements.ftlMobileOnChocks.textContent, "--:--Z");
  assert.equal(h.elements.ftlMobileOnChocks.parentElement.dataset.state, "expired");
  assert.equal(h.elements.latestOnChocksCountdown.textContent, "Calculation expired");
  assert.equal(h.elements.latestOnChocksCountdown.closest().querySelector().textContent, "Sun 30 Aug");
});

test("FDP-only view is compact, next-day dates are explicit and clearing inputs hides the strip", () => {
  const h = harness();
  h.ftlLatestOnChocksMinutes = 1500;
  h.elements.latestOnChocks.textContent = "01:00Z +1";
  h.updateFtlCountdown();
  assert.ok(h.elements.ftlView.classList.contains("is-fdp-only"));
  assert.equal(h.elements.latestOnChocksCountdown.closest().querySelector().textContent, "Tue 01 Sept");
  assert.equal(h.elements.ftlMobileOnChocks.parentElement.querySelector(".mobile-result-date").textContent, "01 Sept");
  assert.ok(!h.elements.ftlMobileResultStrip.classList.contains("hidden"));
  h.ftlLatestOnChocksMinutes = null;
  h.elements.latestOnChocks.textContent = "--:--Z";
  h.updateFtlCountdown();
  assert.ok(h.elements.ftlMobileResultStrip.classList.contains("hidden"));
  assert.equal(h.elements.latestOnChocksCountdown.closest().querySelector().textContent, "");
});
