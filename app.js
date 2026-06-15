const STORAGE_KEY = "jumpseat-calendar-requests-v1";
const MAGIC_LINK_SENT_KEY = "jumpseat-calendar-magic-link-sent-at";
const MAX_REQUESTS_PER_FLIGHT = 10;
const MAGIC_LINK_COOLDOWN_SECONDS = 75;
const MAGIC_LINK_RATE_LIMIT_SECONDS = 60 * 60;
const CLOUD_FRESH_HOURS = 1;
const CLOUD_STALE_HOURS = 24;
const MINUTES_IN_DAY = 24 * 60;

const elements = {
  selectedDate: document.querySelector("#selectedDate"),
  requestDate: document.querySelector("#requestDate"),
  authPanel: document.querySelector("#authPanel"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authStatus: document.querySelector("#authStatus"),
  homeSyncStatus: document.querySelector("#homeSyncStatus"),
  ftlSyncStatus: document.querySelector("#ftlSyncStatus"),
  offlineBanner: document.querySelector("#offlineBanner"),
  accountPanel: document.querySelector("#accountPanel"),
  ftlAccountPanel: document.querySelector("#ftlAccountPanel"),
  magicLinkButton: document.querySelector("#magicLinkButton"),
  refreshCloudButton: document.querySelector("#refreshCloudButton"),
  ftlRefreshCloudButton: document.querySelector("#ftlRefreshCloudButton"),
  homeSignOutButton: document.querySelector("#homeSignOutButton"),
  ftlSignOutButton: document.querySelector("#ftlSignOutButton"),
  toolMenu: document.querySelector(".tool-menu"),
  appTabs: document.querySelector(".app-tabs"),
  layout: document.querySelector(".layout"),
  jumpseatToolTab: document.querySelector("#jumpseatToolTab"),
  ftlToolTab: document.querySelector("#ftlToolTab"),
  homeTab: document.querySelector("#homeTab"),
  addTab: document.querySelector("#addTab"),
  homeView: document.querySelector("#homeView"),
  addView: document.querySelector("#addView"),
  ftlView: document.querySelector("#ftlView"),
  previousDay: document.querySelector("#previousDay"),
  nextDay: document.querySelector("#nextDay"),
  todayButton: document.querySelector("#todayButton"),
  weekdayLabel: document.querySelector("#weekdayLabel"),
  dateLabel: document.querySelector("#dateLabel"),
  flightCount: document.querySelector("#flightCount"),
  seatCount: document.querySelector("#seatCount"),
  upcomingList: document.querySelector("#upcomingList"),
  globalSearch: document.querySelector("#globalSearch"),
  globalResults: document.querySelector("#globalResults"),
  requestList: document.querySelector("#requestList"),
  requestForm: document.querySelector("#requestForm"),
  editingId: document.querySelector("#editingId"),
  formError: document.querySelector("#formError"),
  formTitle: document.querySelector("#formTitle"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  saveButton: document.querySelector("#saveButton"),
  flightNumber: document.querySelector("#flightNumber"),
  departureTime: document.querySelector("#departureTime"),
  availableSeats: document.querySelector("#availableSeats"),
  availableSeatsUp: document.querySelector("#availableSeatsUp"),
  availableSeatsDown: document.querySelector("#availableSeatsDown"),
  routeFrom: document.querySelector("#routeFrom"),
  routeTo: document.querySelector("#routeTo"),
  staffFields: document.querySelector("#staffFields"),
  addSeatButton: document.querySelector("#addSeatButton"),
  notes: document.querySelector("#notes"),
  template: document.querySelector("#requestTemplate"),
  ftlForm: document.querySelector("#ftlForm"),
  clearFtlButton: document.querySelector("#clearFtlButton"),
  dutyStartTime: document.querySelector("#dutyStartTime"),
  dutyStartShell: document.querySelector("#dutyStartShell"),
  latestPushback: document.querySelector("#latestPushback"),
  latestPushbackCountdown: document.querySelector("#latestPushbackCountdown"),
  pushbackDiscretion: document.querySelector("#pushbackDiscretion"),
  pushbackContingency: document.querySelector("#pushbackContingency"),
  latestTakeoff: document.querySelector("#latestTakeoff"),
  latestTakeoffCountdown: document.querySelector("#latestTakeoffCountdown"),
  takeoffDiscretion: document.querySelector("#takeoffDiscretion"),
  takeoffContingency: document.querySelector("#takeoffContingency"),
  latestOnChocks: document.querySelector("#latestOnChocks"),
  maxAllowableFdp: document.querySelector("#maxAllowableFdp"),
  sectorLength: document.querySelector("#sectorLength"),
};

const ftlDurationControls = {
  maxFdp: {
    hours: document.querySelector("#maxFdpHours"),
    minutes: document.querySelector("#maxFdpMinutes"),
    minHours: 9,
    maxHours: 14,
    maxMinutesAtMaxHour: 0,
    minuteStep: 5,
    defaultHours: "",
    defaultMinutes: "",
    blankDefault: true,
  },
  discretion: {
    hours: document.querySelector("#discretionHours"),
    minutes: document.querySelector("#discretionMinutes"),
    maxHours: 2,
    maxMinutesAtMaxHour: 0,
    defaultHours: "",
    defaultMinutes: "",
    blankDefault: true,
  },
  taxiOut: {
    minutes: document.querySelector("#taxiOutMinutes"),
    minuteOnly: true,
    defaultMinutes: 15,
  },
  flightTime: {
    hours: document.querySelector("#flightTimeHours"),
    minutes: document.querySelector("#flightTimeMinutes"),
    maxHours: 8,
    minMinutesWhenZero: 1,
    maxMinutesAtMaxHour: 0,
    defaultHours: "",
    defaultMinutes: "",
    blankDefault: true,
  },
  holding: {
    minutes: document.querySelector("#holdingMinutes"),
    minuteOnly: true,
    defaultMinutes: 15,
  },
  taxiIn: {
    minutes: document.querySelector("#taxiInMinutes"),
    minuteOnly: true,
    defaultMinutes: 15,
  },
  contingency: {
    minutes: document.querySelector("#contingencyMinutes"),
    minuteOnly: true,
    defaultMinutes: 0,
  },
};

let requests = loadRequests();
let currentUser = null;
let cloudReady = false;
let cloudLoaded = false;
let cloudUpdatedAt = null;
let saveTimer = null;
let magicLinkRetryTimer = null;
let syncElapsedTimer = null;
let ftlCountdownTimer = null;
let ftlLatestPushbackMinutes = null;
let ftlLatestTakeoffMinutes = null;
let lastCloudSuccess = null;
let isOfflineReadOnly = false;

const cloudConfig = window.JUMPSEAT_SUPABASE || {};
const hasCloudConfig = Boolean(
  cloudConfig.url &&
    cloudConfig.anonKey &&
    !cloudConfig.url.includes("YOUR_PROJECT_REF") &&
    !cloudConfig.anonKey.includes("YOUR_SUPABASE_ANON_KEY")
);
const supabaseClient = hasCloudConfig && window.supabase
  ? window.supabase.createClient(cloudConfig.url, cloudConfig.anonKey)
  : null;

function setAuthStatus(message, isError = false, isSuccess = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle("status-error", isError);
  elements.authStatus.classList.toggle("status-success", isSuccess);
}

function isSuccessStatus(message) {
  return message.startsWith("Updated");
}

function setSyncStatus(message, isError = false, isWarning = false) {
  [elements.homeSyncStatus, elements.ftlSyncStatus].forEach((statusElement) => {
    statusElement.textContent = message;
    statusElement.classList.toggle("status-error", isError);
    statusElement.classList.toggle("status-warning", isWarning);
    statusElement.classList.toggle("status-success", !isError && !isWarning && isSuccessStatus(message));
  });
}

function formatElapsed(fromDate) {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - fromDate.getTime()) / 1000));
  const elapsedMinutes = Math.floor(elapsedSeconds / 60);
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  if (elapsedSeconds < 45) return "just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} ${pluralize(elapsedMinutes, "min")} ago`;
  if (minutes === 0) return `${hours} ${pluralize(hours, "hr")} ago`;
  return `${hours} ${pluralize(hours, "hr")} ${minutes} ${pluralize(minutes, "min")} ago`;
}

function updateCloudSuccessStatus() {
  if (!lastCloudSuccess) return;
  const elapsedHours = (Date.now() - lastCloudSuccess.at.getTime()) / (60 * 60 * 1000);
  const isStale = elapsedHours >= CLOUD_STALE_HOURS;
  const isAged = elapsedHours >= CLOUD_FRESH_HOURS && !isStale;

  setSyncStatus(`Updated ${formatElapsed(lastCloudSuccess.at)}`, isStale, isAged);
}

function setCloudSuccessStatus() {
  lastCloudSuccess = {
    at: new Date(),
  };

  updateCloudSuccessStatus();
  window.clearInterval(syncElapsedTimer);
  syncElapsedTimer = window.setInterval(updateCloudSuccessStatus, 30000);
}

function setMagicLinkRetryCountdown(seconds) {
  let remaining = seconds;
  window.clearInterval(magicLinkRetryTimer);
  elements.magicLinkButton.disabled = true;

  const updateMessage = () => {
    const timeLabel = remaining >= 60
      ? `${Math.ceil(remaining / 60)} ${pluralize(Math.ceil(remaining / 60), "minute")}`
      : `${remaining} ${pluralize(remaining, "second")}`;
    setAuthStatus(`You can request another magic link in ${timeLabel}. Use password sign-in if you need access now.`, true);
  };

  updateMessage();
  magicLinkRetryTimer = window.setInterval(() => {
    remaining -= 1;

    if (remaining <= 0) {
      window.clearInterval(magicLinkRetryTimer);
      elements.magicLinkButton.disabled = false;
      setAuthStatus("You can request another magic link now.");
      return;
    }

    updateMessage();
  }, 1000);
}

function getRetrySeconds(message) {
  const minuteMatch = message.match(/after\s+(\d+)\s+minutes?/i) || message.match(/(\d+)\s+minutes?/i);
  if (minuteMatch) return Number(minuteMatch[1]) * 60;

  const match = message.match(/after\s+(\d+)\s+seconds?/i) || message.match(/(\d+)\s+seconds?/i);
  return match ? Number(match[1]) : null;
}

function getMagicLinkCooldownSeconds() {
  const sentAt = Number(localStorage.getItem(MAGIC_LINK_SENT_KEY));
  if (!Number.isFinite(sentAt)) return 0;

  const elapsedSeconds = Math.floor((Date.now() - sentAt) / 1000);
  return Math.max(0, MAGIC_LINK_COOLDOWN_SECONDS - elapsedSeconds);
}

function rememberMagicLinkSent() {
  localStorage.setItem(MAGIC_LINK_SENT_KEY, String(Date.now()));
}

function isRateLimitError(message) {
  return /rate limit|too many|over_email_send_rate_limit/i.test(message);
}

function setCredentialValue(field, value) {
  field.value = value;
  field.dispatchEvent(new Event("input", { bubbles: true }));
  field.dispatchEvent(new Event("change", { bubbles: true }));
}

function useCredentialPasteEvent(field, event) {
  const text = event.clipboardData?.getData("text/plain") || event.clipboardData?.getData("text");
  if (!text) return;

  event.preventDefault();
  setCredentialValue(field, text.trim());
  setAuthStatus("Pasted from clipboard.", false, true);
}

function useCredentialBeforeInput(field, event) {
  if (event.inputType !== "insertFromPaste") return;

  const text = event.dataTransfer?.getData("text/plain") || event.dataTransfer?.getData("text");
  if (!text) return;

  event.preventDefault();
  setCredentialValue(field, text.trim());
  setAuthStatus("Pasted from clipboard.", false, true);
}

function strengthenCredentialPaste(field) {
  field.addEventListener("paste", (event) => useCredentialPasteEvent(field, event));
  field.addEventListener("beforeinput", (event) => useCredentialBeforeInput(field, event));
}

function setOfflineReadOnly(isReadOnly) {
  isOfflineReadOnly = isReadOnly;
  document.body.classList.toggle("offline-readonly", isReadOnly);
  elements.offlineBanner.classList.toggle("hidden", !isReadOnly);
  elements.addTab.disabled = isReadOnly;
  elements.refreshCloudButton.disabled = isReadOnly;
  elements.ftlRefreshCloudButton.disabled = isReadOnly;

  if (isReadOnly) {
    setActiveTab("home");
    setSyncStatus("Offline: viewing saved data", false, true);
  }

  render();
}

function startOfflineMode(message = "Offline: viewing saved data") {
  requests = sanitizeRequests(loadRequests());
  cloudLoaded = false;
  cloudUpdatedAt = null;
  elements.authPanel.classList.add("hidden");
  elements.accountPanel.classList.add("hidden");
  elements.ftlAccountPanel.classList.add("hidden");
  setAppVisible(true);
  setOfflineReadOnly(true);
  setSyncStatus(message, false, true);
}

function setAppVisible(isVisible) {
  elements.toolMenu.classList.toggle("hidden", !isVisible);
  elements.appTabs.classList.toggle("hidden", !isVisible);
  elements.layout.classList.toggle("hidden", !isVisible);
}

function setSignedInState(user) {
  currentUser = user;
  elements.authForm.classList.toggle("hidden", Boolean(user));
  elements.authPanel.classList.toggle("hidden", Boolean(user));
  elements.accountPanel.classList.toggle("hidden", !user);
  elements.ftlAccountPanel.classList.toggle("hidden", !user);
  setAppVisible(Boolean(user));

  if (user) {
    setAuthStatus(`Signed in as ${user.email}`);
    setOfflineReadOnly(false);
  } else {
    cloudLoaded = false;
    cloudUpdatedAt = null;
    lastCloudSuccess = null;
    window.clearInterval(syncElapsedTimer);
    window.clearInterval(magicLinkRetryTimer);
    elements.magicLinkButton.disabled = false;
    elements.magicLinkButton.textContent = "Email magic link";
    setAuthStatus("Sign in to load and save your jumpseat requests online.");
    setSyncStatus("Cloud ready");
  }
}

function setActiveTab(tabName) {
  const isHome = tabName === "home";
  elements.homeView.classList.toggle("hidden", !isHome);
  elements.addView.classList.toggle("hidden", isHome);
  elements.ftlView.classList.add("hidden");
  elements.appTabs.classList.remove("hidden");
  elements.jumpseatToolTab.classList.add("active");
  elements.ftlToolTab.classList.remove("active");
  elements.jumpseatToolTab.setAttribute("aria-selected", "true");
  elements.ftlToolTab.setAttribute("aria-selected", "false");
  elements.homeTab.classList.toggle("active", isHome);
  elements.addTab.classList.toggle("active", !isHome);
  elements.homeTab.setAttribute("aria-selected", String(isHome));
  elements.addTab.setAttribute("aria-selected", String(!isHome));
}

function setActiveTool(toolName) {
  const isFtl = toolName === "ftl";

  elements.appTabs.classList.toggle("hidden", isFtl);
  elements.homeView.classList.toggle("hidden", isFtl);
  elements.addView.classList.add("hidden");
  elements.ftlView.classList.toggle("hidden", !isFtl);
  elements.jumpseatToolTab.classList.toggle("active", !isFtl);
  elements.ftlToolTab.classList.toggle("active", isFtl);
  elements.jumpseatToolTab.setAttribute("aria-selected", String(!isFtl));
  elements.ftlToolTab.setAttribute("aria-selected", String(isFtl));

  if (!isFtl) setActiveTab("home");
}

function todayIso() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function formatDate(iso, options) {
  return new Intl.DateTimeFormat("en-GB", options).format(new Date(`${iso}T12:00:00`));
}

function shiftDate(iso, days) {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function pluralize(count, singular, plural = `${singular}s`) {
  return count === 1 ? singular : plural;
}

function formatDepartureTime(time) {
  return time ? `${time}Z` : "Time not set";
}

function twoDigits(value) {
  return String(value).padStart(2, "0");
}

function formatZuluTime(totalMinutes) {
  const dayOffset = Math.floor(totalMinutes / MINUTES_IN_DAY);
  const normalized = ((totalMinutes % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const suffix = dayOffset > 0 ? ` +${dayOffset}` : dayOffset < 0 ? ` ${dayOffset}` : "";

  return `${twoDigits(hours)}:${twoDigits(minutes)}Z${suffix}`;
}

function populateSelect(select, start, end, selectedValue, options = {}) {
  select.innerHTML = "";
  const step = options.step || 1;

  if (options.includeBlank) {
    const blankOption = document.createElement("option");
    blankOption.value = "";
    blankOption.textContent = "--";
    blankOption.selected = selectedValue === "";
    select.append(blankOption);
  }

  for (let value = start; value <= end; value += step) {
    const option = document.createElement("option");
    option.value = String(value);
    option.textContent = twoDigits(value);
    option.selected = String(value) === String(selectedValue);
    select.append(option);
  }
}

function updateMinuteOptions(control) {
  if (control.minuteOnly) return;
  const minuteStep = control.minuteStep || 1;

  if (control.blankDefault && control.hours.value === "") {
    populateSelect(control.minutes, 0, 59, "", { includeBlank: true, step: minuteStep });
    updateDurationIncompleteState(control);
    return;
  }

  const currentMinute = Number(control.minutes.value || control.defaultMinutes || 0);
  const selectedHour = Number(control.hours.value || 0);
  const minMinute = selectedHour === 0 ? (control.minMinutesWhenZero || 0) : 0;
  const maxMinute = selectedHour === control.maxHours && control.maxMinutesAtMaxHour !== undefined
    ? control.maxMinutesAtMaxHour
    : 59;
  const isForcedMaximumMinute = selectedHour === control.maxHours && control.maxMinutesAtMaxHour !== undefined;

  if (control.blankDefault && control.minutes.value === "" && !isForcedMaximumMinute) {
    populateSelect(control.minutes, minMinute, maxMinute, "", { includeBlank: true, step: minuteStep });
    updateDurationIncompleteState(control);
    return;
  }

  const steppedMinute = Math.round(currentMinute / minuteStep) * minuteStep;
  const nextMinute = Math.min(maxMinute, Math.max(minMinute, steppedMinute));

  populateSelect(control.minutes, minMinute, maxMinute, nextMinute, { step: minuteStep });
  updateDurationIncompleteState(control);
}

function updateDurationIncompleteState(control) {
  if (control.minuteOnly) return;
  const isIncomplete = Boolean(control.blankDefault && control.hours.value !== "" && control.minutes.value === "");
  control.minutes.classList.toggle("is-incomplete", isIncomplete);
  control.minutes.setAttribute("aria-invalid", String(isIncomplete));
  control.hours.closest(".duration-control")?.classList.toggle("has-incomplete-minutes", isIncomplete);
}

function setupDurationControl(control) {
  if (control.minuteOnly) {
    populateSelect(control.minutes, 0, 59, control.defaultMinutes);
    control.minutes.addEventListener("change", calculateFtl);
    return;
  }

  populateSelect(control.hours, control.minHours || 0, control.maxHours, control.defaultHours, { includeBlank: Boolean(control.blankDefault) });
  updateMinuteOptions(control);
  if (!control.blankDefault) control.minutes.value = String(control.defaultMinutes);
  updateMinuteOptions(control);
  control.hours.addEventListener("change", () => {
    updateMinuteOptions(control);
    calculateFtl();
  });
  control.minutes.addEventListener("change", () => {
    if (control.blankDefault && control.minutes.value !== "" && control.hours.value === "" && !control.minHours) {
      control.hours.value = "0";
      updateMinuteOptions(control);
    }

    updateDurationIncompleteState(control);
    calculateFtl();
  });
}

function setDurationControl(control, hours, minutes) {
  if (control.minuteOnly) {
    control.minutes.value = String(minutes);
    return;
  }

  if (control.blankDefault && hours === "") {
    control.hours.value = "";
    updateMinuteOptions(control);
    return;
  }

  control.hours.value = String(hours);
  updateMinuteOptions(control);
  control.minutes.value = String(minutes);
}

function hasDurationValue(control) {
  if (control.minuteOnly) return control.minutes.value !== "";
  return control.hours.value !== "" && control.minutes.value !== "";
}

function hasPartialDurationValue(control) {
  if (control.minuteOnly) return false;
  return (control.hours.value !== "" && control.minutes.value === "") ||
    (control.hours.value === "" && control.minutes.value !== "");
}

function getDurationMinutes(control) {
  if (!hasDurationValue(control)) return 0;
  if (control.minuteOnly) return Number(control.minutes.value);
  return (Number(control.hours.value) * 60) + Number(control.minutes.value);
}

function hasDutyStartValue() {
  return elements.dutyStartTime.value !== "";
}

function updateDutyStartEmptyState() {
  elements.dutyStartShell.classList.toggle("is-empty", elements.dutyStartTime.value === "");
}

function getDutyStartMinutes() {
  const [hours, minutes] = elements.dutyStartTime.value.split(":").map(Number);
  return (hours * 60) + minutes;
}

function formatDurationFromMinutes(totalMinutes) {
  const absoluteMinutes = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  if (hours === 0) return `${minutes} ${pluralize(minutes, "min")}`;
  if (minutes === 0) return `${hours} ${pluralize(hours, "hr")}`;
  return `${hours} ${pluralize(hours, "hr")} ${minutes} ${pluralize(minutes, "min")}`;
}

function formatDurationWithZeroMinutes(totalMinutes) {
  const absoluteMinutes = Math.abs(Math.round(totalMinutes));
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;
  return `${hours} hr ${minutes} min`;
}

function formatContingencyIncluded(totalMinutes) {
  const minutes = Math.abs(Math.round(totalMinutes));
  return `${minutes} ${pluralize(minutes, "minute")} contingency included`;
}

function formatCommanderDiscretion(totalMinutes) {
  return `${formatDurationWithZeroMinutes(totalMinutes)} Commander's discretion included`;
}

function formatDurationFromSeconds(totalSeconds) {
  const absoluteSeconds = Math.abs(Math.floor(totalSeconds));
  const hours = Math.floor(absoluteSeconds / 3600);
  const minutes = Math.floor((absoluteSeconds % 3600) / 60);
  const seconds = absoluteSeconds % 60;

  if (hours === 0 && minutes === 0) return `${seconds} ${pluralize(seconds, "sec")}`;
  if (hours === 0) return `${minutes} ${pluralize(minutes, "min")} ${seconds} ${pluralize(seconds, "sec")}`;
  return `${hours} ${pluralize(hours, "hr")} ${minutes} ${pluralize(minutes, "min")} ${seconds} ${pluralize(seconds, "sec")}`;
}

function updateCountdownElement(element, targetMinutes) {
  const card = element.closest(".ftl-result-card");

  if (targetMinutes === null) {
    element.textContent = "Set required inputs";
    element.classList.remove("status-error", "status-warning", "status-success");
    card?.classList.remove("is-overdue");
    return;
  }

  const now = new Date();
  const currentZuluSeconds = (now.getUTCHours() * 3600) + (now.getUTCMinutes() * 60) + now.getUTCSeconds();
  const remainingSeconds = (targetMinutes * 60) - currentZuluSeconds;
  const isPast = remainingSeconds < 0;
  const isClose = remainingSeconds >= 0 && remainingSeconds <= (30 * 60);

  element.textContent = isPast
    ? `${formatDurationFromSeconds(remainingSeconds)} ago`
    : `${formatDurationFromSeconds(remainingSeconds)} remaining`;
  element.classList.toggle("status-error", isPast);
  element.classList.toggle("status-warning", isClose);
  element.classList.toggle("status-success", !isPast && !isClose);
  card?.classList.toggle("is-overdue", isPast);
}

function updateFtlCountdown() {
  updateCountdownElement(elements.latestPushbackCountdown, ftlLatestPushbackMinutes);
  updateCountdownElement(elements.latestTakeoffCountdown, ftlLatestTakeoffMinutes);
}

function updateContingencyNote(element, contingency) {
  const hasContingency = contingency > 0;
  element.textContent = hasContingency ? formatContingencyIncluded(contingency) : "";
  element.classList.toggle("hidden", !hasContingency);
  element.classList.toggle("is-included", contingency > 0);
}

function updateMaximumAllowableFdp(maximumAllowableFdp, discretion) {
  elements.maxAllowableFdp.textContent = formatDurationWithZeroMinutes(maximumAllowableFdp);
  if (discretion <= 0) return;

  const discretionNote = document.createElement("span");
  discretionNote.className = "discretion-note is-active";
  discretionNote.textContent = `(${formatCommanderDiscretion(discretion)})`;
  elements.maxAllowableFdp.append(discretionNote);
}

function updateResultDiscretionNote(element, discretion) {
  const hasDiscretion = discretion > 0;
  element.textContent = hasDiscretion ? formatCommanderDiscretion(discretion) : "";
  element.classList.toggle("hidden", !hasDiscretion);
}

function updateResultDiscretionNotes(discretion) {
  updateResultDiscretionNote(elements.pushbackDiscretion, discretion);
  updateResultDiscretionNote(elements.takeoffDiscretion, discretion);
}

function resetFtlResults() {
  elements.latestOnChocks.textContent = "--:--Z";
  elements.latestTakeoff.textContent = "--:--Z";
  elements.latestPushback.textContent = "--:--Z";
  updateContingencyNote(elements.pushbackContingency, 0);
  updateContingencyNote(elements.takeoffContingency, 0);
  updateResultDiscretionNotes(0);
  ftlLatestPushbackMinutes = null;
  ftlLatestTakeoffMinutes = null;
  updateFtlCountdown();
}

function calculateFtl() {
  const hasDutyStart = hasDutyStartValue();
  const hasMaximumFdp = hasDurationValue(ftlDurationControls.maxFdp);
  const hasFlightTime = hasDurationValue(ftlDurationControls.flightTime);
  const hasPartialDiscretion = hasPartialDurationValue(ftlDurationControls.discretion);
  const dutyStart = hasDutyStart ? getDutyStartMinutes() : 0;
  const maximumFdp = getDurationMinutes(ftlDurationControls.maxFdp);
  const discretion = getDurationMinutes(ftlDurationControls.discretion);
  const maximumAllowableFdp = maximumFdp + discretion;
  const sectorLength =
    getDurationMinutes(ftlDurationControls.taxiOut) +
    getDurationMinutes(ftlDurationControls.flightTime) +
    getDurationMinutes(ftlDurationControls.holding) +
    getDurationMinutes(ftlDurationControls.taxiIn) +
    getDurationMinutes(ftlDurationControls.contingency);
  const contingency = getDurationMinutes(ftlDurationControls.contingency);

  if (hasMaximumFdp && !hasPartialDiscretion) {
    updateMaximumAllowableFdp(maximumAllowableFdp, discretion);
  } else {
    elements.maxAllowableFdp.textContent = "--";
  }

  elements.sectorLength.textContent = hasFlightTime ? formatDurationWithZeroMinutes(sectorLength) : "--";

  if (!hasDutyStart || !hasMaximumFdp || !hasFlightTime || hasPartialDiscretion) {
    resetFtlResults();
    return;
  }

  const latestOnChocks = dutyStart + maximumAllowableFdp;
  const latestTakeoff = latestOnChocks -
    getDurationMinutes(ftlDurationControls.flightTime) -
    getDurationMinutes(ftlDurationControls.holding) -
    getDurationMinutes(ftlDurationControls.taxiIn) -
    getDurationMinutes(ftlDurationControls.contingency);
  const latestPushback = latestTakeoff - getDurationMinutes(ftlDurationControls.taxiOut);

  elements.latestOnChocks.textContent = formatZuluTime(latestOnChocks);
  elements.latestTakeoff.textContent = formatZuluTime(latestTakeoff);
  elements.latestPushback.textContent = formatZuluTime(latestPushback);
  updateContingencyNote(elements.pushbackContingency, contingency);
  updateContingencyNote(elements.takeoffContingency, contingency);
  updateResultDiscretionNotes(discretion);
  ftlLatestPushbackMinutes = latestPushback;
  ftlLatestTakeoffMinutes = latestTakeoff;
  updateFtlCountdown();
}

function setupFtlCalculator() {
  Object.values(ftlDurationControls).forEach(setupDurationControl);
  elements.dutyStartTime.addEventListener("input", () => {
    updateDutyStartEmptyState();
    calculateFtl();
  });
  elements.dutyStartTime.addEventListener("change", () => {
    updateDutyStartEmptyState();
    calculateFtl();
  });
  updateDutyStartEmptyState();
  calculateFtl();
  window.clearInterval(ftlCountdownTimer);
  ftlCountdownTimer = window.setInterval(updateFtlCountdown, 1000);
}

function clearFtlCalculator() {
  elements.dutyStartTime.value = "";
  updateDutyStartEmptyState();

  Object.values(ftlDurationControls).forEach((control) => {
    setDurationControl(control, control.defaultHours ?? 0, control.defaultMinutes ?? 0);
  });

  calculateFtl();
}

function requestSortValue(request) {
  return request.departureTime || "99:99";
}

function hasAvailableSeats(request) {
  return request.availableSeats !== null && request.availableSeats !== undefined && request.availableSeats !== "";
}

function availabilityText(request) {
  if (!hasAvailableSeats(request)) {
    return `${request.staff.length} ${pluralize(request.staff.length, "request")}`;
  }

  const available = Number(request.availableSeats);
  if (!Number.isInteger(available) || available < 0) {
    return `${request.staff.length} ${pluralize(request.staff.length, "request")}`;
  }
  return `${request.staff.length} ${pluralize(request.staff.length, "request")} · ${available} available`;
}

function isOverRequested(request) {
  if (!hasAvailableSeats(request)) return false;

  const available = Number(request.availableSeats);
  return Number.isInteger(available) && request.staff.length > available;
}

function availabilityStatus(request) {
  if (!hasAvailableSeats(request)) return "unknown";

  const available = Number(request.availableSeats);
  if (!Number.isInteger(available) || available < 0) return "unknown";
  if (request.staff.length > available) return "over";
  if (request.staff.length === available) return "full";
  return "spare";
}

function loadRequests() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function saveRequests() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  queueCloudSave();
}

function sanitizeRequests(value) {
  if (!Array.isArray(value)) return [];

  return value
    .filter((request) => request.date && request.flightNumber && Array.isArray(request.staff))
    .map((request) => ({
      id: request.id || crypto.randomUUID(),
      date: request.date,
      flightNumber: normalizeText(String(request.flightNumber)).toUpperCase(),
      departureTime: request.departureTime || "",
      availableSeats: request.availableSeats ?? null,
      routeFrom: normalizeText(String(request.routeFrom || "")).toUpperCase(),
      routeTo: normalizeText(String(request.routeTo || "")).toUpperCase(),
      staff: request.staff.slice(0, MAX_REQUESTS_PER_FLIGHT).map((name) => normalizeText(String(name))).filter(Boolean),
      notes: normalizeText(String(request.notes || "")),
      updatedAt: request.updatedAt || new Date().toISOString(),
    }));
}

function queueCloudSave() {
  if (isOfflineReadOnly || !supabaseClient || !currentUser || !cloudLoaded) return;

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveCloudRequests();
  }, 350);
}

async function saveCloudRequests() {
  if (!supabaseClient || !currentUser) return;

  setSyncStatus("Saving...");
  const nextUpdatedAt = new Date().toISOString();
  const payload = {
    requests,
    updated_at: nextUpdatedAt,
  };

  const query = cloudUpdatedAt
    ? supabaseClient
        .from("jumpseat_data")
        .update(payload)
        .eq("user_id", currentUser.id)
        .eq("updated_at", cloudUpdatedAt)
    : supabaseClient
        .from("jumpseat_data")
        .insert({ user_id: currentUser.id, ...payload });

  const { data, error } = await query.select("updated_at").maybeSingle();

  if (error) {
    if (isRateLimitError(error.message || "")) {
      setSyncStatus("Cloud save rate-limited. Try again shortly.", true);
      return;
    }

    if (error.code === "23505") {
      cloudLoaded = false;
      setSyncStatus("Cloud changed on another device. Tap Refresh before saving again.", true);
      window.alert("Cloud data changed on another device. Tap Refresh before making further changes, so this device does not overwrite the newer cloud copy.");
      return;
    }

    setSyncStatus(`Cloud save failed: ${error.message}`, true);
    return;
  }

  if (!data) {
    cloudLoaded = false;
    setSyncStatus("Cloud changed on another device. Tap Refresh before saving again.", true);
    window.alert("Cloud data changed on another device. Tap Refresh before making further changes, so this device does not overwrite the newer cloud copy.");
    return;
  }

  cloudUpdatedAt = data.updated_at || nextUpdatedAt;
  setCloudSuccessStatus();
}

async function loadCloudRequests() {
  if (!supabaseClient || !currentUser) return;

  if (!navigator.onLine) {
    startOfflineMode();
    return;
  }

  cloudLoaded = false;
  cloudUpdatedAt = null;
  setSyncStatus("Loading cloud data...");

  const { data, error } = await supabaseClient
    .from("jumpseat_data")
    .select("requests, updated_at")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    startOfflineMode(navigator.onLine ? "Cloud unavailable: viewing saved data" : "Offline: viewing saved data");
    return;
  }

  const localRequests = loadRequests();

  if (Array.isArray(data?.requests)) {
    requests = sanitizeRequests(data.requests);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    cloudLoaded = true;
    cloudUpdatedAt = data.updated_at || null;
    setCloudSuccessStatus();
  } else {
    requests = sanitizeRequests(localRequests);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    cloudLoaded = true;
    cloudUpdatedAt = null;
    await saveCloudRequests();
  }

  render();
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function getStaffInputs() {
  return Array.from(elements.staffFields.querySelectorAll(".staff-input"));
}

function clearValidation() {
  elements.formError.classList.add("hidden");
  elements.formError.textContent = "";
  [elements.requestDate, elements.flightNumber, elements.routeFrom, elements.routeTo, elements.departureTime]
    .forEach((field) => field.classList.remove("invalid"));
  getStaffInputs().forEach((input) => input.classList.remove("invalid"));
}

function showFormError(message) {
  elements.formError.textContent = message;
  elements.formError.classList.remove("hidden");
}

function updateAddRequestButton() {
  const staffInputs = getStaffInputs();
  const hasReachedLimit = staffInputs.length >= MAX_REQUESTS_PER_FLIGHT;
  const hasBlankVisibleRequest = staffInputs.some((input) => !input.value.trim());

  elements.addSeatButton.classList.toggle("hidden", hasReachedLimit);
  elements.addSeatButton.disabled = isOfflineReadOnly || hasReachedLimit || hasBlankVisibleRequest;
  elements.addSeatButton.title = hasBlankVisibleRequest ? "Enter the current request name first" : "";
}

function validateRequestForm() {
  clearValidation();

  const requiredFields = [
    { field: elements.requestDate, label: "date" },
    { field: elements.flightNumber, label: "flight number" },
    { field: elements.routeFrom, label: "from" },
    { field: elements.routeTo, label: "to" },
    { field: elements.departureTime, label: "departure time" },
  ];
  const missing = [];

  requiredFields.forEach(({ field, label }) => {
    if (!field.value.trim()) {
      field.classList.add("invalid");
      missing.push(label);
    }
  });

  getStaffInputs().forEach((input, index) => {
    if (!input.value.trim()) {
      input.classList.add("invalid");
      missing.push(`request ${index + 1} name`);
    }
  });

  if (missing.length === 0) return true;

  showFormError(`Please complete: ${missing.join(", ")}.`);
  document.querySelector(".invalid")?.focus();
  return false;
}

function getStaffValues() {
  return getStaffInputs().map((input) => input.value);
}

function moveStaffField(fromIndex, toIndex) {
  const values = getStaffValues();
  if (toIndex < 0 || toIndex >= values.length) return;
  [values[fromIndex], values[toIndex]] = [values[toIndex], values[fromIndex]];
  renderStaffFields(values);
  getStaffInputs()[toIndex]?.focus();
}

function renderStaffFields(values = [""]) {
  const visibleValues = values.length ? values.slice(0, MAX_REQUESTS_PER_FLIGHT) : [""];
  elements.staffFields.innerHTML = "";

  visibleValues.forEach((value, index) => {
    const row = document.createElement("div");
    const label = document.createElement("label");
    const input = document.createElement("input");

    row.className = visibleValues.length > 1 || index > 0 ? "staff-row has-controls" : "staff-row";
    label.textContent = `Request ${index + 1}`;
    input.className = "staff-input";
    input.name = `staff${index + 1}`;
    input.type = "text";
    input.placeholder = "Name";
    input.autocomplete = "off";
    input.value = value;
    input.required = true;
    input.addEventListener("input", () => {
      clearValidation();
      updateAddRequestButton();
    });

    label.append(input);
    row.append(label);

    if (visibleValues.length > 1 || index > 0) {
      const controls = document.createElement("div");
      controls.className = "staff-controls";

      if (index > 0) {
        const upButton = document.createElement("button");
        upButton.className = "icon-button";
        upButton.type = "button";
        upButton.title = `Move request ${index + 1} up`;
        upButton.setAttribute("aria-label", `Move request ${index + 1} up`);
        upButton.textContent = "↑";
        upButton.addEventListener("click", () => moveStaffField(index, index - 1));
        controls.append(upButton);
      }

      if (index < visibleValues.length - 1) {
        const downButton = document.createElement("button");
        downButton.className = "icon-button";
        downButton.type = "button";
        downButton.title = `Move request ${index + 1} down`;
        downButton.setAttribute("aria-label", `Move request ${index + 1} down`);
        downButton.textContent = "↓";
        downButton.addEventListener("click", () => moveStaffField(index, index + 1));
        controls.append(downButton);
      }

      if (index > 0) {
        const removeButton = document.createElement("button");
        removeButton.className = "icon-button";
        removeButton.type = "button";
        removeButton.title = `Remove request ${index + 1}`;
        removeButton.setAttribute("aria-label", `Remove request ${index + 1}`);
        removeButton.textContent = "×";
        removeButton.addEventListener("click", () => removeStaffField(index));
        controls.append(removeButton);
      }

      row.append(controls);
    }

    elements.staffFields.append(row);
  });

  updateAddRequestButton();
}

function removeStaffField(indexToRemove) {
  const values = getStaffValues().filter((_, index) => index !== indexToRemove);
  renderStaffFields(values.length ? values : [""]);
}

function getFormData() {
  return {
    id: elements.editingId.value || crypto.randomUUID(),
    date: elements.requestDate.value,
    flightNumber: normalizeText(elements.flightNumber.value).toUpperCase(),
    departureTime: elements.departureTime.value,
    availableSeats: elements.availableSeats.value === "" ? null : Number(elements.availableSeats.value),
    routeFrom: normalizeText(elements.routeFrom.value).toUpperCase(),
    routeTo: normalizeText(elements.routeTo.value).toUpperCase(),
    staff: getStaffValues().map(normalizeText).filter(Boolean),
    notes: normalizeText(elements.notes.value),
    updatedAt: new Date().toISOString(),
  };
}

function stepAvailableSeats(delta) {
  const currentValue = elements.availableSeats.value === "" ? null : Number(elements.availableSeats.value);
  const currentNumber = Number.isInteger(currentValue) ? currentValue : 0;
  const nextValue = Math.min(99, Math.max(0, currentNumber + delta));
  elements.availableSeats.value = String(nextValue);
  elements.availableSeats.dispatchEvent(new Event("input", { bubbles: true }));
}

function focusNextFormControl(currentControl) {
  const controls = Array.from(
    elements.requestForm.querySelectorAll("input:not([type='hidden']), textarea, button")
  ).filter((control) => (
    control.tabIndex !== -1 &&
    !control.disabled &&
    !control.classList.contains("hidden") &&
    control.offsetParent !== null
  ));
  const currentIndex = controls.indexOf(currentControl);
  const nextControl = controls[currentIndex + 1];

  if (nextControl) nextControl.focus();
}

function sameFlight(a, b) {
  return (
    a.date === b.date &&
    a.flightNumber === b.flightNumber
  );
}

function clearForm(keepDate = true) {
  const activeDate = elements.selectedDate.value || todayIso();
  elements.requestForm.reset();
  elements.editingId.value = "";
  elements.requestDate.value = keepDate ? activeDate : todayIso();
  elements.departureTime.value = "";
  elements.availableSeats.value = "";
  elements.formTitle.textContent = "Add request";
  elements.saveButton.textContent = "Save request";
  elements.cancelEditButton.classList.add("hidden");
  renderStaffFields();
  clearValidation();
}

function startAdd() {
  if (isOfflineReadOnly) {
    window.alert("Offline mode is view only. Connect to the internet to add requests.");
    return;
  }

  clearForm();
  setActiveTab("add");
  elements.requestDate.focus();
}

function setSelectedDate(iso) {
  elements.selectedDate.value = iso;
  elements.requestDate.value = iso;
  render();
}

function renderUpcoming() {
  const start = todayIso();
  const end = shiftDate(start, 6);
  const upcoming = requests
    .filter((request) => request.date >= start && request.date <= end)
    .sort((a, b) => a.date.localeCompare(b.date) || requestSortValue(a).localeCompare(requestSortValue(b)) || a.flightNumber.localeCompare(b.flightNumber));

  elements.upcomingList.innerHTML = "";

  if (upcoming.length === 0) {
    const empty = document.createElement("div");
    empty.className = "upcoming-empty";
    empty.textContent = "No requests in the next 7 days.";
    elements.upcomingList.append(empty);
    return;
  }

  upcoming.forEach((request) => {
    const item = document.createElement("button");
    const date = document.createElement("span");
    const flight = document.createElement("span");
    const flightNumber = document.createElement("strong");
    const route = document.createElement("span");
    const count = document.createElement("span");

    item.className = "upcoming-item";
    item.type = "button";
    item.setAttribute(
      "aria-label",
      `Open ${request.flightNumber} on ${formatDate(request.date, { day: "numeric", month: "long" })}`
    );
    date.className = "upcoming-date";
    flight.className = "upcoming-flight";
    count.className = "upcoming-count";

    date.textContent = formatDate(request.date, { weekday: "short", day: "numeric", month: "short" });
    flightNumber.textContent = request.flightNumber;
    route.textContent = `${formatDepartureTime(request.departureTime)} · ${request.routeFrom} to ${request.routeTo}`;
    count.textContent = availabilityText(request);

    flight.append(flightNumber, route);
    item.append(date, flight, count);
    item.addEventListener("click", () => {
      setSelectedDate(request.date);
    });
    elements.upcomingList.append(item);
  });
}

function requestMatchesQuery(request, query) {
  const haystack = [
    request.flightNumber,
    request.departureTime,
    request.routeFrom,
    request.routeTo,
    request.notes,
    ...request.staff,
  ].join(" ").toLowerCase();
  return haystack.includes(query);
}

function renderGlobalSearch() {
  const query = elements.globalSearch.value.trim().toLowerCase();
  elements.globalResults.innerHTML = "";

  if (!query) return;

  const matches = requests
    .filter((request) => requestMatchesQuery(request, query))
    .sort((a, b) => a.date.localeCompare(b.date) || requestSortValue(a).localeCompare(requestSortValue(b)) || a.flightNumber.localeCompare(b.flightNumber));

  if (matches.length === 0) {
    const empty = document.createElement("div");
    empty.className = "global-empty";
    empty.textContent = "No saved requests match that search.";
    elements.globalResults.append(empty);
    return;
  }

  matches.forEach((request) => {
    const item = document.createElement("button");
    const date = document.createElement("span");
    const match = document.createElement("span");
    const flight = document.createElement("strong");
    const detail = document.createElement("span");
    const count = document.createElement("span");

    item.className = "global-result";
    item.type = "button";
    item.setAttribute(
      "aria-label",
      `Open ${request.flightNumber} on ${formatDate(request.date, { day: "numeric", month: "long", year: "numeric" })}`
    );
    date.className = "global-date";
    match.className = "global-match";
    count.className = "global-count";

    date.textContent = formatDate(request.date, { day: "numeric", month: "short", year: "numeric" });
    flight.textContent = request.flightNumber;
    detail.textContent = `${formatDepartureTime(request.departureTime)} · ${request.routeFrom} to ${request.routeTo} · ${request.staff.join(", ")}`;
    count.textContent = availabilityText(request);

    match.append(flight, detail);
    item.append(date, match, count);
    item.addEventListener("click", () => setSelectedDate(request.date));
    elements.globalResults.append(item);
  });
}

function render() {
  const date = elements.selectedDate.value;
  const dayRequests = requests
    .filter((request) => request.date === date)
    .sort((a, b) => requestSortValue(a).localeCompare(requestSortValue(b)) || a.flightNumber.localeCompare(b.flightNumber));

  elements.weekdayLabel.textContent = formatDate(date, { weekday: "long" });
  elements.dateLabel.textContent = formatDate(date, { day: "numeric", month: "long", year: "numeric" });
  elements.flightCount.textContent = String(dayRequests.length);
  elements.seatCount.textContent = String(dayRequests.reduce((total, request) => total + request.staff.length, 0));
  renderUpcoming();
  renderGlobalSearch();
  elements.requestList.innerHTML = "";

  if (dayRequests.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = "<p><strong>No requests saved</strong>Add a flight and staff names to start this day.</p>";
    elements.requestList.append(empty);
    return;
  }

  dayRequests.forEach((request) => {
    const card = elements.template.content.firstElementChild.cloneNode(true);
    card.dataset.id = request.id;
    card.querySelector(".flight-line").textContent = `${request.flightNumber} · ${formatDepartureTime(request.departureTime)}`;
    card.querySelector("h3").textContent = `${request.routeFrom} to ${request.routeTo}`;
    const badge = card.querySelector(".seat-badge");
    badge.textContent = availabilityText(request);
    badge.classList.add(`availability-${availabilityStatus(request)}`);

    const nameList = card.querySelector(".name-list");
    request.staff.forEach((name) => {
      const item = document.createElement("li");
      item.textContent = name;
      nameList.append(item);
    });

    const notes = card.querySelector(".notes-text");
    if (request.notes) {
      notes.textContent = request.notes;
    } else {
      notes.remove();
    }

    const editButton = card.querySelector(".edit-button");
    const deleteButton = card.querySelector(".delete-button");

    if (isOfflineReadOnly) {
      editButton.disabled = true;
      deleteButton.disabled = true;
      editButton.title = "Connect to the internet to edit";
      deleteButton.title = "Connect to the internet to delete";
    } else {
      editButton.addEventListener("click", () => startEdit(request.id));
      deleteButton.addEventListener("click", () => deleteRequest(request.id));
    }

    elements.requestList.append(card);
  });
}

function startEdit(id) {
  if (isOfflineReadOnly) {
    window.alert("Offline mode is view only. Connect to the internet to edit requests.");
    return;
  }

  const request = requests.find((item) => item.id === id);
  if (!request) return;

  elements.editingId.value = request.id;
  elements.flightNumber.value = request.flightNumber;
  elements.requestDate.value = request.date;
  elements.departureTime.value = request.departureTime || "";
  elements.availableSeats.value = hasAvailableSeats(request) && Number.isInteger(Number(request.availableSeats)) ? String(request.availableSeats) : "";
  elements.routeFrom.value = request.routeFrom;
  elements.routeTo.value = request.routeTo;
  renderStaffFields(request.staff);
  elements.notes.value = request.notes || "";
  elements.formTitle.textContent = "Edit request";
  elements.saveButton.textContent = "Update request";
  elements.cancelEditButton.classList.remove("hidden");
  setActiveTab("add");
  elements.flightNumber.focus();
}

function deleteRequest(id) {
  if (isOfflineReadOnly) {
    window.alert("Offline mode is view only. Connect to the internet to delete requests.");
    return;
  }

  const request = requests.find((item) => item.id === id);
  if (!request) return;

  const confirmed = window.confirm(`Delete ${request.flightNumber} ${request.routeFrom}-${request.routeTo}?`);
  if (!confirmed) return;

  requests = requests.filter((item) => item.id !== id);
  saveRequests();
  if (elements.editingId.value === id) clearForm();
  render();
}

async function handleSession(session) {
  const user = session?.user || null;
  const isSameLoadedUser = user?.id && user.id === currentUser?.id && cloudLoaded;

  setSignedInState(user);
  if (user && !isSameLoadedUser) await loadCloudRequests();
}

async function signIn() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;

  if (!email || !password) {
    setAuthStatus("Enter your email and password.", true);
    return;
  }

  setAuthStatus("Signing in...");
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    setAuthStatus(error.message || "Sign in failed.", true);
    return;
  }

  elements.authPassword.value = "";
  await handleSession(data.session);
}

async function sendMagicLink() {
  const email = elements.authEmail.value.trim();

  if (!email) {
    setAuthStatus("Enter your email address first.", true);
    return;
  }

  const cooldownSeconds = getMagicLinkCooldownSeconds();
  if (cooldownSeconds > 0) {
    setMagicLinkRetryCountdown(cooldownSeconds);
    return;
  }

  window.clearInterval(magicLinkRetryTimer);
  elements.magicLinkButton.disabled = true;
  setAuthStatus("Sending magic link...");
  const { error } = await supabaseClient.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
      shouldCreateUser: false,
    },
  });

  if (error) {
    const message = error.message || "";
    const retrySeconds = getRetrySeconds(message) || (isRateLimitError(message) ? MAGIC_LINK_RATE_LIMIT_SECONDS : null);
    if (retrySeconds) {
      rememberMagicLinkSent();
      setMagicLinkRetryCountdown(retrySeconds);
      return;
    }

    elements.magicLinkButton.disabled = false;
    setAuthStatus(message || "Magic link could not be sent.", true);
    return;
  }

  rememberMagicLinkSent();
  elements.magicLinkButton.disabled = false;
  setAuthStatus("Magic link sent. Check your email to sign in.", false, true);
}

async function signOut(message = "Sign in to load and save your jumpseat requests online.") {
  setSyncStatus("Signing out...");

  if (supabaseClient && navigator.onLine) {
    await supabaseClient.auth.signOut().catch(() => {});
  }

  cloudLoaded = false;
  cloudUpdatedAt = null;
  setSignedInState(null);
  setAuthStatus(message, false);
}

async function refreshCloudData() {
  if (!currentUser) return;
  await loadCloudRequests();
}

async function returnOnline() {
  setOfflineReadOnly(false);
  elements.authPanel.classList.remove("hidden");

  if (!supabaseClient) {
    setAuthStatus("Cloud saving could not start. Refresh once you are online.", true);
    return;
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setAuthStatus("Could not check sign-in status.", true);
    return;
  }

  await handleSession(data.session);
}

async function initCloud() {
  if (!navigator.onLine) {
    startOfflineMode();
    return;
  }

  if (!hasCloudConfig) {
    cloudReady = false;
    elements.authPanel.classList.add("hidden");
    setAppVisible(true);
    return;
  }

  elements.authPanel.classList.remove("hidden");
  setAppVisible(false);

  if (!supabaseClient) {
    setAuthStatus("Cloud saving could not start. Check the Supabase script connection.", true);
    return;
  }

  cloudReady = true;
  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    setAuthStatus("Could not check sign-in status.", true);
    return;
  }

  await handleSession(data.session);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    handleSession(session);
  });
}

elements.requestForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (isOfflineReadOnly) {
    window.alert("Offline mode is view only. Connect to the internet to save changes.");
    return;
  }

  if (!validateRequestForm()) return;

  const formData = getFormData();

  const existingIndex = requests.findIndex((request) => request.id === formData.id);
  const duplicate = requests.find((request) => request.id !== formData.id && sameFlight(request, formData));
  if (duplicate) {
    window.alert("That flight is already saved for this day. Use Edit on the existing card to update the names.");
    return;
  }

  if (existingIndex >= 0) {
    requests[existingIndex] = formData;
  } else {
    requests.push(formData);
  }

  saveRequests();
  setSelectedDate(formData.date);
  clearForm();
  setActiveTab("home");
});

elements.requestForm.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || event.target.tagName !== "INPUT") return;

  event.preventDefault();
  focusNextFormControl(event.target);
});

elements.jumpseatToolTab.addEventListener("click", () => setActiveTool("jumpseat"));
elements.ftlToolTab.addEventListener("click", () => setActiveTool("ftl"));
elements.clearFtlButton.addEventListener("click", clearFtlCalculator);
elements.homeTab.addEventListener("click", () => setActiveTab("home"));
elements.addTab.addEventListener("click", startAdd);
[elements.requestDate, elements.flightNumber, elements.routeFrom, elements.routeTo, elements.departureTime]
  .forEach((field) => field.addEventListener("input", clearValidation));
elements.selectedDate.addEventListener("change", () => setSelectedDate(elements.selectedDate.value));
elements.requestDate.addEventListener("change", () => {
  if (!elements.editingId.value) elements.selectedDate.value = elements.requestDate.value;
});
elements.previousDay.addEventListener("click", () => setSelectedDate(shiftDate(elements.selectedDate.value, -1)));
elements.nextDay.addEventListener("click", () => setSelectedDate(shiftDate(elements.selectedDate.value, 1)));
elements.todayButton.addEventListener("click", () => setSelectedDate(todayIso()));
elements.globalSearch.addEventListener("input", renderGlobalSearch);
elements.availableSeatsUp.addEventListener("click", () => stepAvailableSeats(1));
elements.availableSeatsDown.addEventListener("click", () => stepAvailableSeats(-1));
elements.cancelEditButton.addEventListener("click", () => {
  clearForm();
  setActiveTab("home");
});
elements.addSeatButton.addEventListener("click", () => {
  const values = getStaffValues();
  if (values.length >= MAX_REQUESTS_PER_FLIGHT) return;

  const blankIndex = values.findIndex((value) => !value.trim());
  if (blankIndex >= 0) {
    const input = getStaffInputs()[blankIndex];
    input.classList.add("invalid");
    showFormError(`Please enter request ${blankIndex + 1} before adding another request.`);
    input.focus();
    updateAddRequestButton();
    return;
  }

  renderStaffFields([...values, ""]);
  getStaffInputs().at(-1)?.focus();
});

elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  signIn();
});
elements.magicLinkButton.addEventListener("click", sendMagicLink);
elements.refreshCloudButton.addEventListener("click", refreshCloudData);
elements.ftlRefreshCloudButton.addEventListener("click", refreshCloudData);
elements.homeSignOutButton.addEventListener("click", () => signOut());
elements.ftlSignOutButton.addEventListener("click", () => signOut());
window.addEventListener("offline", () => startOfflineMode());
window.addEventListener("online", returnOnline);

setSelectedDate(todayIso());
clearForm();
setupFtlCalculator();
strengthenCredentialPaste(elements.authEmail);
strengthenCredentialPaste(elements.authPassword);
initCloud();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
