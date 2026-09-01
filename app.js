const STORAGE_KEY = "jumpseat-calendar-requests-v1";
const REQUESTS_ENVELOPE_KEY = "opsdeck-jumpseat-state-v2";
const JUMPSEAT_DRAFT_KEY = "opsdeck-jumpseat-draft-v1";
const JUMPSEAT_DRAFT_SCHEMA_VERSION = 1;
const APP_VERSION = "2.69";
const CALCULATOR_STORAGE_KEY = "opsdeck-calculator-state-v1";
const CALCULATOR_SCHEMA_VERSION = 5;
const CREW_LIMIT_CAPS = { flight: 3, cabin: 6 };
const DEFAULT_FLIGHT_CREW_NAME = "Ben Ashurst";
const MAGIC_LINK_SENT_KEY = "jumpseat-calendar-magic-link-sent-at";
const APPEARANCE_STORAGE_KEY = "opsdeck-appearance-v1";
const NOTOC_POLICY_TABLE = "opsdeck_notoc_policy";
const MAX_REQUESTS_PER_FLIGHT = 10;
const MAGIC_LINK_COOLDOWN_SECONDS = 75;
const MAGIC_LINK_RATE_LIMIT_SECONDS = 60 * 60;
const CLOUD_FRESH_HOURS = 1;
const CLOUD_STALE_HOURS = 24;
const FTL_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short", weekday: "short" });
const FTL_SHORT_DATE_FORMATTER = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "2-digit", month: "short" });
const REQUEST_RETENTION_DAYS = 7;
const PAGE_QUERY = new URLSearchParams(window.location.search);
const IS_LOCAL_PREVIEW = ["127.0.0.1", "localhost"].includes(window.location.hostname) &&
  PAGE_QUERY.has("preview");
const LOCAL_PREVIEW_VIEW = IS_LOCAL_PREVIEW ? PAGE_QUERY.get("view") : null;

// Shared DOM handles and app state.
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
  checksSyncStatus: document.querySelector("#checksSyncStatus"),
  raSyncStatus: document.querySelector("#raSyncStatus"),
  notocSyncStatus: document.querySelector("#notocSyncStatus"),
  gpsSyncStatus: document.querySelector("#gpsSyncStatus"),
  notocPolicyStatus: document.querySelector("#notocPolicyStatus"),
  settingsSyncStatus: document.querySelector("#settingsSyncStatus"),
  offlineBanner: document.querySelector("#offlineBanner"),
  accountPanel: document.querySelector("#accountPanel"),
  ftlAccountPanel: document.querySelector("#ftlAccountPanel"),
  checksAccountPanel: document.querySelector("#checksAccountPanel"),
  raAccountPanel: document.querySelector("#raAccountPanel"),
  notocAccountPanel: document.querySelector("#notocAccountPanel"),
  gpsAccountPanel: document.querySelector("#gpsAccountPanel"),
  settingsAccountPanel: document.querySelector("#settingsAccountPanel"),
  magicLinkButton: document.querySelector("#magicLinkButton"),
  refreshCloudButton: document.querySelector("#refreshCloudButton"),
  ftlRefreshCloudButton: document.querySelector("#ftlRefreshCloudButton"),
  checksRefreshCloudButton: document.querySelector("#checksRefreshCloudButton"),
  raRefreshCloudButton: document.querySelector("#raRefreshCloudButton"),
  notocRefreshCloudButton: document.querySelector("#notocRefreshCloudButton"),
  settingsRefreshCloudButton: document.querySelector("#settingsRefreshCloudButton"),
  homeSettingsButton: document.querySelector("#homeSettingsButton"),
  ftlSettingsButton: document.querySelector("#ftlSettingsButton"),
  checksSettingsButton: document.querySelector("#checksSettingsButton"),
  raSettingsButton: document.querySelector("#raSettingsButton"),
  notocSettingsButton: document.querySelector("#notocSettingsButton"),
  gpsSettingsButton: document.querySelector("#gpsSettingsButton"),
  homeSignOutButton: document.querySelector("#homeSignOutButton"),
  ftlSignOutButton: document.querySelector("#ftlSignOutButton"),
  checksSignOutButton: document.querySelector("#checksSignOutButton"),
  raSignOutButton: document.querySelector("#raSignOutButton"),
  notocSignOutButton: document.querySelector("#notocSignOutButton"),
  gpsSignOutButton: document.querySelector("#gpsSignOutButton"),
  settingsSignOutButton: document.querySelector("#settingsSignOutButton"),
  toolMenu: document.querySelector(".tool-menu"),
  layout: document.querySelector(".layout"),
  jumpseatToolTab: document.querySelector("#jumpseatToolTab"),
  ftlToolTab: document.querySelector("#ftlToolTab"),
  checksToolTab: document.querySelector("#checksToolTab"),
  homeView: document.querySelector("#homeView"),
  addView: document.querySelector("#addView"),
  ftlView: document.querySelector("#ftlView"),
  checksView: document.querySelector("#checksView"),
  raView: document.querySelector("#raView"),
  notocView: document.querySelector("#notocView"),
  gpsView: document.querySelector("#gpsView"),
  settingsView: document.querySelector("#settingsView"),
  openRaCheckButton: document.querySelector("#openRaCheckButton"),
  openNotocButton: document.querySelector("#openNotocButton"),
  openGpsButton: document.querySelector("#openGpsButton"),
  gpsBackToChecks: document.querySelector("#gpsBackToChecks"),
  raBackToChecks: document.querySelector("#raBackToChecks"),
  notocBackToChecks: document.querySelector("#notocBackToChecks"),
  openAddRequestButton: document.querySelector("#openAddRequestButton"),
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
  backToRequestsButton: document.querySelector("#backToRequestsButton"),
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
  fdpInputsToggle: document.querySelector("#fdpInputsToggle"),
  fdpInputsContent: document.querySelector("#fdpInputsContent"),
  sectorInputsToggle: document.querySelector("#sectorInputsToggle"),
  sectorInputsContent: document.querySelector("#sectorInputsContent"),
  reportingTimeReminder: document.querySelector("#reportingTimeReminder"),
  ftlClarifications: document.querySelector("#ftlClarifications"),
  reportingTimeClarification: document.querySelector("#reportingTimeClarification"),
  clearFtlButton: document.querySelector("#clearFtlButton"),
  sendLtotTelegramButton: document.querySelector("#sendLtotTelegramButton"),
  ftlTelegramStatus: document.querySelector("#ftlTelegramStatus"),
  fdpTableTwoContainer: document.querySelector("#fdpTableTwoContainer"),
  fdpTableThreeContainer: document.querySelector("#fdpTableThreeContainer"),
  fdpReferenceStatus: document.querySelector("#fdpReferenceStatus"),
  fdpReferenceMessage: document.querySelector("#fdpReferenceMessage"),
  fdpReferenceReturnButton: document.querySelector("#fdpReferenceReturnButton"),
  bdxInfoButton: document.querySelector("#bdxInfoButton"),
  bdxInfoDialog: document.querySelector("#bdxInfoDialog"),
  bdxInfoCloseButton: document.querySelector("#bdxInfoCloseButton"),
  elapsedInfoButton: document.querySelector("#elapsedInfoButton"),
  elapsedInfoButtonMobile: document.querySelector("#elapsedInfoButtonMobile"),
  elapsedInfoDialog: document.querySelector("#elapsedInfoDialog"),
  elapsedInfoCloseButton: document.querySelector("#elapsedInfoCloseButton"),
  addCabinCrewButton: document.querySelector("#addCabinCrewButton"),
  addIndividualCrewButton: document.querySelector("#addIndividualCrewButton"),
  removeCabinCrewButton: document.querySelector("#removeCabinCrewButton"),
  crewTabsRow: document.querySelector("#crewTabsRow"),
  flightCrewTab: document.querySelector("#flightCrewTab"),
  cabinCrewTab: document.querySelector("#cabinCrewTab"),
  flightCrewInputs: document.querySelector("#flightCrewInputs"),
  cabinCrewInputs: document.querySelector("#cabinCrewInputs"),
  flightCrewLimits: document.querySelector("#flightCrewLimits"),
  cabinCrewLimits: document.querySelector("#cabinCrewLimits"),
  crewLimitTemplate: document.querySelector("#crewLimitTemplate"),
  latestPushback: document.querySelector("#latestPushback"),
  latestPushbackCountdown: document.querySelector("#latestPushbackCountdown"),
  pushbackCrewLimit: document.querySelector("#pushbackCrewLimit"),
  pushbackDiscretion: document.querySelector("#pushbackDiscretion"),
  pushbackContingency: document.querySelector("#pushbackContingency"),
  latestTakeoff: document.querySelector("#latestTakeoff"),
  latestTakeoffCountdown: document.querySelector("#latestTakeoffCountdown"),
  takeoffCrewLimit: document.querySelector("#takeoffCrewLimit"),
  takeoffDiscretion: document.querySelector("#takeoffDiscretion"),
  takeoffContingency: document.querySelector("#takeoffContingency"),
  latestOnChocks: document.querySelector("#latestOnChocks"),
  latestOnChocksCountdown: document.querySelector("#latestOnChocksCountdown"),
  onChocksCrewLimit: document.querySelector("#onChocksCrewLimit"),
  onChocksDiscretion: document.querySelector("#onChocksDiscretion"),
  ftlMobileResultStrip: document.querySelector("#ftlMobileResultStrip"),
  ftlMobilePushback: document.querySelector("#ftlMobilePushback"),
  ftlMobileTakeoff: document.querySelector("#ftlMobileTakeoff"),
  ftlMobileOnChocks: document.querySelector("#ftlMobileOnChocks"),
  crewResults: document.querySelector("#crewResults"),
  crewComparisonStatus: document.querySelector("#crewComparisonStatus"),
  crewResultRows: document.querySelector("#crewResultRows"),
  sectorLength: document.querySelector("#sectorLength"),
  fdpReferencePanel: document.querySelector("#fdpReferencePanel"),
  fdpTargetBanner: document.querySelector("#fdpTargetBanner"),
  fdpTargetSelect: document.querySelector("#fdpTargetSelect"),
  fdpWorkflowRoutes: document.querySelectorAll("[data-fdp-route-target]"),
  telegramLinkState: document.querySelector("#telegramLinkState"),
  telegramBotState: document.querySelector("#telegramBotState"),
  telegramPairingExpiry: document.querySelector("#telegramPairingExpiry"),
  telegramPairingCode: document.querySelector("#telegramPairingCode"),
  telegramStatus: document.querySelector("#telegramStatus"),
  generatePairingButton: document.querySelector("#generatePairingButton"),
  checkPairingButton: document.querySelector("#checkPairingButton"),
  sendTelegramTestButton: document.querySelector("#sendTelegramTestButton"),
  sendSampleReminderButton: document.querySelector("#sendSampleReminderButton"),
  appearanceInputs: document.querySelectorAll('input[name="appearance"]'),
  requestConflictDialog: document.querySelector("#requestConflictDialog"),
  requestConflictSummary: document.querySelector("#requestConflictSummary"),
  useCloudConflictButton: document.querySelector("#useCloudConflictButton"),
  keepDeviceConflictButton: document.querySelector("#keepDeviceConflictButton"),
  downloadConflictButton: document.querySelector("#downloadConflictButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  restoreBackupButton: document.querySelector("#restoreBackupButton"),
  restoreBackupInput: document.querySelector("#restoreBackupInput"),
  dataStatus: document.querySelector("#dataStatus"),
};

const ftlDurationControls = {
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

const FDP_TABLE_TWO_COLUMNS = [
  { key: "oneTwo", label: "1-2 sectors" },
  { key: "three", label: "3 sectors" },
  { key: "four", label: "4 sectors" },
  { key: "five", label: "5 sectors" },
];

const FDP_TABLE_TWO_ROWS = [
  { start: "0600-1329", oneTwo: "13:00", three: "12:30", four: "12:00", five: "11:30" },
  { start: "1330-1359", oneTwo: "12:45", three: "12:15", four: "11:45", five: "11:15" },
  { start: "1400-1429", oneTwo: "12:30", three: "12:00", four: "11:30", five: "11:00" },
  { start: "1430-1459", oneTwo: "12:15", three: "11:45", four: "11:15", five: "10:45" },
  { start: "1500-1529", oneTwo: "12:00", three: "11:30", four: "11:00", five: "10:30" },
  { start: "1530-1559", oneTwo: "11:45", three: "11:15", four: "10:45", five: "10:15" },
  { start: "1600-1629", oneTwo: "11:30", three: "11:00", four: "10:30", five: "10:00" },
  { start: "1630-1659", oneTwo: "11:15", three: "10:45", four: "10:15", five: "09:45" },
  { start: "1700-0459", oneTwo: "11:00", three: "10:30", four: "10:00", five: "09:30" },
  { start: "0500-0514", oneTwo: "12:00", three: "11:30", four: "11:00", five: "10:30" },
  { start: "0515-0529", oneTwo: "12:15", three: "11:45", four: "11:15", five: "10:45" },
  { start: "0530-0544", oneTwo: "12:30", three: "12:00", four: "11:30", five: "11:00" },
  { start: "0545-0559", oneTwo: "12:45", three: "12:15", four: "11:45", five: "11:15" },
];

const FDP_TABLE_THREE_COLUMNS = [
  { key: "oneTwo", label: "1-2 sectors" },
  { key: "three", label: "3 sectors" },
  { key: "four", label: "4 sectors" },
  { key: "five", label: "5 sectors" },
];

const FDP_TABLE_THREE_ROWS = [
  { start: "Maximum FDP", oneTwo: "11:00", three: "10:30", four: "10:00", five: "09:30" },
];

const initialRequestEnvelope = loadRequestEnvelope();
let requests = initialRequestEnvelope.requests;
let currentUser = null;
let notocPolicyLoadedUserId = null;
let notocPolicySource = "none";
let cloudReady = false;
let cloudLoaded = false;
let cloudUpdatedAt = null;
let saveTimer = null;
let requestRetryTimer = null;
let requestSaveInFlight = false;
let requestChangeRevision = 0;
let requestRetryAttempt = 0;
let requestLocalDirty = initialRequestEnvelope.dirty;
let requestLocalBaseUpdatedAt = initialRequestEnvelope.baseUpdatedAt;
let pendingRequestConflict = null;
let calculatorSaveTimer = null;
let calculatorRetryTimer = null;
let calculatorSaveInFlight = false;
let calculatorRetryAttempt = 0;
let calculatorChangeRevision = 0;
let magicLinkRetryTimer = null;
let syncElapsedTimer = null;
let ftlCountdownTimer = null;
let fdpReferenceStatusTimer = null;
let ftlLatestPushbackMinutes = null;
let ftlLatestTakeoffMinutes = null;
let ftlLatestOnChocksMinutes = null;
let ftlAnchorDate = null;
let nextCrewNumbers = { flight: 2, cabin: 1 };
let lastCloudSuccess = null;
let isOfflineReadOnly = false;
let telegramLinked = false;
let telegramBotConfigured = false;
let telegramLtotSupported = false;
let cabinCrewEnabled = false;
let activeFtlCrew = "flight";
let activeFdpTargetId = "flight";
let controllingFtlCrewIds = [];
let currentCrewComparison = null;
let crewLimitRecords = [];
let calculatorInitialised = false;
let calculatorCloudLoaded = false;
let calculatorCloudUpdatedAt = null;
let calculatorLocalDirty = false;
let calculatorLocalBaseUpdatedAt = null;
let elapsedInfoTrigger = null;
let manualSignOutInProgress = false;

const ftlCrewControls = {};

// Cloud setup and shared status helpers.
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
const notocPolicyApi = window.OpsDeckNotocPolicy || null;
const notocPolicyStore = window.OpsDeckNotocPolicyStore || null;

function setNotocPolicyStatus(message, state = "") {
  if (!elements.notocPolicyStatus) return;
  elements.notocPolicyStatus.textContent = message;
  elements.notocPolicyStatus.classList.toggle("is-ready", state === "ready");
  elements.notocPolicyStatus.classList.toggle("is-saved", state === "saved");
  elements.notocPolicyStatus.classList.toggle("is-warning", state === "warning");
  elements.notocPolicyStatus.classList.toggle("is-unavailable", state === "unavailable");
  elements.notocPolicyStatus.classList.toggle(
    "visually-hidden",
    ["ready", "saved", "loading"].includes(state)
  );
}

function announceNotocPolicyUpdate() {
  document.dispatchEvent(new CustomEvent("opsdeck:notoc-policy-updated"));
}

function resetNotocPolicy(message = "Sign in to load the BA guidance.") {
  notocPolicyApi?.resetHandlingCodeMapping?.();
  notocPolicyApi?.resetMobilityAidPolicy?.();
  notocPolicyLoadedUserId = null;
  notocPolicySource = "none";
  setNotocPolicyStatus(message, "unavailable");
  announceNotocPolicyUpdate();
}

function policyStatusMessage(policyRecord, source) {
  const mobilityReady = Boolean(policyRecord?.mobilityPolicy || policyRecord?.mobility_policy);
  const prefix = source === "cloud"
    ? "Verified BA guidance loaded"
    : `Saved BA guidance${navigator.onLine ? "" : " · offline"}`;
  return mobilityReady ? prefix : `${prefix} · mobility-aid guidance unavailable`;
}

function applyNotocPolicyRecord(record, userId, source) {
  if (!notocPolicyApi?.setHandlingCodeMapping || !notocPolicyApi?.setMobilityAidPolicy || !notocPolicyStore) return false;
  const envelope = notocPolicyStore.normaliseRecord(record, userId);
  if (!envelope) return false;

  notocPolicyApi.setHandlingCodeMapping(envelope.mapping, {
    policyVersion: envelope.policyVersion,
    updatedAt: envelope.updatedAt,
    source,
  });
  if (envelope.mobilityPolicy) {
    notocPolicyApi.setMobilityAidPolicy(envelope.mobilityPolicy, {
      policyVersion: envelope.policyVersion,
      updatedAt: envelope.updatedAt,
      source,
    });
  } else {
    notocPolicyApi.resetMobilityAidPolicy?.();
  }
  notocPolicyLoadedUserId = String(userId);
  notocPolicySource = source;
  const completePolicy = Boolean(envelope.mobilityPolicy);
  setNotocPolicyStatus(
    policyStatusMessage(envelope, source),
    completePolicy ? (source === "cloud" ? "ready" : "saved") : "warning"
  );
  announceNotocPolicyUpdate();
  return true;
}

function loadCachedNotocPolicy(user) {
  if (!user?.id || !notocPolicyStore) return false;
  const cached = notocPolicyStore.load(localStorage, user.id);
  return cached ? applyNotocPolicyRecord(cached, user.id, "cache") : false;
}

async function loadNotocPolicy({ forceCloud = false } = {}) {
  if (!currentUser?.id || !notocPolicyStore || !notocPolicyApi) return;
  const userId = currentUser.id;
  const hasCachedPolicy = loadCachedNotocPolicy(currentUser);

  if (!navigator.onLine || !supabaseClient) {
    if (!hasCachedPolicy) resetNotocPolicy("BA guidance unavailable offline.");
    return;
  }

  if (!forceCloud && notocPolicyLoadedUserId === userId && notocPolicySource === "cloud") return;
  setNotocPolicyStatus("Updating BA guidance...", "loading");

  const { data, error } = await supabaseClient
    .from(NOTOC_POLICY_TABLE)
    .select("policy_version,mapping,mapping_sha256,mobility_policy,mobility_policy_sha256,updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (currentUser?.id !== userId) return;
  if (error || !data) {
    if (hasCachedPolicy) {
      const cachedPolicy = {
        mapping: notocPolicyApi.POLICY_PACK.handlingCodes,
        mobilityPolicy: notocPolicyApi.POLICY_PACK.mobilityAidPolicy,
      };
      setNotocPolicyStatus(
        policyStatusMessage(cachedPolicy, "cache"),
        cachedPolicy.mobilityPolicy ? "saved" : "warning"
      );
    } else {
      resetNotocPolicy("BA policy unavailable. Refresh when online.");
    }
    return;
  }

  if (!applyNotocPolicyRecord(data, userId, "cloud")) {
    if (!hasCachedPolicy) resetNotocPolicy("BA policy failed validation. Refer instead.");
    return;
  }

  try {
    notocPolicyStore.save(localStorage, userId, data);
  } catch (_error) {
    setNotocPolicyStatus(`${policyStatusMessage(data, "cloud")} · offline copy not saved`, "warning");
  }
}

const systemAppearanceQuery = window.matchMedia("(prefers-color-scheme: dark)");

function readAppearancePreference() {
  try {
    const preference = localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return ["automatic", "light", "night"].includes(preference) ? preference : "automatic";
  } catch (_error) {
    return "automatic";
  }
}

function resolveAppearance(preference) {
  if (preference === "automatic") return systemAppearanceQuery.matches ? "night" : "light";
  return preference;
}

function applyAppearance(preference, persist = false) {
  const safePreference = ["automatic", "light", "night"].includes(preference)
    ? preference
    : "automatic";
  const resolvedTheme = resolveAppearance(safePreference);

  document.documentElement.dataset.appearance = safePreference;
  document.documentElement.dataset.theme = resolvedTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    "content",
    resolvedTheme === "night" ? "#10171c" : "#102f47"
  );

  elements.appearanceInputs.forEach((input) => {
    input.checked = input.value === safePreference;
  });

  if (!persist) return;

  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, safePreference);
  } catch (_error) {
    // The selected appearance still applies for this session.
  }
}

function initialiseAppearance() {
  applyAppearance(readAppearancePreference());

  elements.appearanceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      if (input.checked) applyAppearance(input.value, true);
    });
  });

  const updateAutomaticAppearance = () => {
    if (document.documentElement.dataset.appearance === "automatic") applyAppearance("automatic");
  };

  if (typeof systemAppearanceQuery.addEventListener === "function") {
    systemAppearanceQuery.addEventListener("change", updateAutomaticAppearance);
  } else {
    systemAppearanceQuery.addListener(updateAutomaticAppearance);
  }

  window.addEventListener("storage", (event) => {
    if (event.key === APPEARANCE_STORAGE_KEY) applyAppearance(readAppearancePreference());
  });
}

function setAuthStatus(message, isError = false, isSuccess = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle("status-error", isError);
  elements.authStatus.classList.toggle("status-success", isSuccess);
}

function isSuccessStatus(message) {
  return message.startsWith("Updated");
}

function setSyncStatus(message, isError = false, isWarning = false) {
  [
    elements.homeSyncStatus,
    elements.ftlSyncStatus,
    elements.checksSyncStatus,
    elements.raSyncStatus,
    elements.notocSyncStatus,
    elements.gpsSyncStatus,
    elements.settingsSyncStatus,
  ].forEach((statusElement) => {
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

  if (elapsedSeconds < 45) return "now";
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
  if (requestLocalDirty || calculatorLocalDirty) {
    setSyncStatus("Changes not yet synced · retrying automatically", false, true);
    return;
  }

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
  elements.openAddRequestButton.disabled = isReadOnly;
  elements.refreshCloudButton.disabled = isReadOnly;
  elements.ftlRefreshCloudButton.disabled = isReadOnly;
  elements.checksRefreshCloudButton.disabled = isReadOnly;
  elements.raRefreshCloudButton.disabled = isReadOnly;
  elements.notocRefreshCloudButton.disabled = isReadOnly;
  elements.settingsRefreshCloudButton.disabled = isReadOnly;
  elements.generatePairingButton.disabled = isReadOnly;
  elements.checkPairingButton.disabled = isReadOnly;
  elements.sendTelegramTestButton.disabled = isReadOnly;
  elements.sendSampleReminderButton.disabled = isReadOnly;
  elements.restoreBackupButton.disabled = isReadOnly;
  updateLtotTelegramButton();

  if (isReadOnly) {
    if (!elements.addView.classList.contains("hidden")) persistJumpseatDraft();
    if (!elements.addView.classList.contains("hidden")) setActiveTab("home");
    setSyncStatus("Offline: viewing saved data", false, true);
  }

  render();
}

function startOfflineMode(message = "Offline: viewing saved data") {
  const local = loadRequestEnvelope();
  requests = local.requests;
  requestLocalDirty = local.dirty;
  requestLocalBaseUpdatedAt = local.baseUpdatedAt;
  cloudLoaded = false;
  cloudUpdatedAt = null;
  calculatorCloudLoaded = false;
  elements.authPanel.classList.add("hidden");
  elements.accountPanel.classList.add("hidden");
  elements.ftlAccountPanel.classList.add("hidden");
  elements.checksAccountPanel.classList.add("hidden");
  elements.raAccountPanel.classList.add("hidden");
  elements.notocAccountPanel.classList.add("hidden");
  elements.gpsAccountPanel.classList.add("hidden");
  elements.settingsAccountPanel.classList.add("hidden");
  setAppVisible(true);
  setOfflineReadOnly(true);
  setSyncStatus(message, false, true);
}

function setAppVisible(isVisible) {
  elements.toolMenu.classList.toggle("hidden", !isVisible);
  elements.layout.classList.toggle("hidden", !isVisible);
}

function setSignedInState(user) {
  const previousUserId = currentUser?.id || null;
  currentUser = user;
  window.OpsDeckGpsUi?.setContext(user?.id || null, async () => {
    const { data, error } = await supabaseClient.from("opsdeck_gps_checklist")
      .select("checklist,content_sha256,updated_at").eq("user_id", user.id).maybeSingle();
    if (error || !data) throw new Error("Checklist unavailable");
    return data;
  });
  if (!user || (previousUserId && previousUserId !== user.id)) resetNotocPolicy();
  elements.authForm.classList.toggle("hidden", Boolean(user));
  elements.authPanel.classList.toggle("hidden", Boolean(user));
  elements.accountPanel.classList.toggle("hidden", !user);
  elements.ftlAccountPanel.classList.toggle("hidden", !user);
  elements.checksAccountPanel.classList.toggle("hidden", !user);
  elements.raAccountPanel.classList.toggle("hidden", !user);
  elements.notocAccountPanel.classList.toggle("hidden", !user);
  elements.gpsAccountPanel.classList.toggle("hidden", !user);
  elements.settingsAccountPanel.classList.toggle("hidden", !user);
  setAppVisible(Boolean(user));

  if (user) {
    setAuthStatus(`Signed in as ${user.email}`);
    setOfflineReadOnly(false);
  } else {
    cloudLoaded = false;
    cloudUpdatedAt = null;
    calculatorCloudLoaded = false;
    calculatorCloudUpdatedAt = calculatorLocalBaseUpdatedAt;
    lastCloudSuccess = null;
    window.clearInterval(syncElapsedTimer);
    window.clearInterval(magicLinkRetryTimer);
    window.clearTimeout(requestRetryTimer);
    window.clearTimeout(calculatorRetryTimer);
    elements.magicLinkButton.disabled = false;
    elements.magicLinkButton.textContent = "Email magic link";
    setAuthStatus("Sign in to load and save your OpsDeck data.");
    setSyncStatus("Cloud ready");
    resetTelegramPanel();
  }
}

function setActiveTab(tabName) {
  elements.gpsView.classList.add("hidden");
  elements.gpsView.setAttribute("aria-hidden", "true");
  const isHome = tabName === "home";
  elements.homeView.classList.toggle("hidden", !isHome);
  elements.addView.classList.toggle("hidden", isHome);
  elements.ftlView.classList.add("hidden");
  elements.checksView.classList.add("hidden");
  elements.raView.classList.add("hidden");
  elements.notocView.classList.add("hidden");
  elements.settingsView.classList.add("hidden");
  elements.homeView.setAttribute("aria-hidden", String(!isHome));
  elements.addView.setAttribute("aria-hidden", String(isHome));
  elements.ftlView.setAttribute("aria-hidden", "true");
  elements.checksView.setAttribute("aria-hidden", "true");
  elements.raView.setAttribute("aria-hidden", "true");
  elements.notocView.setAttribute("aria-hidden", "true");
  elements.settingsView.setAttribute("aria-hidden", "true");
  elements.jumpseatToolTab.classList.add("active");
  elements.ftlToolTab.classList.remove("active");
  elements.checksToolTab.classList.remove("active");
  elements.jumpseatToolTab.setAttribute("aria-selected", "true");
  elements.ftlToolTab.setAttribute("aria-selected", "false");
  elements.checksToolTab.setAttribute("aria-selected", "false");
}

function setActiveTool(toolName) {
  if (!elements.addView.classList.contains("hidden")) persistJumpseatDraft();

  const isJumpseat = toolName === "jumpseat";
  const isFtl = toolName === "ftl";
  const isChecks = toolName === "checks";
  const isRa = toolName === "ra";
  const isNotoc = toolName === "notoc";
  const isGps = toolName === "gps";
  const isChecksSection = isChecks || isRa || isNotoc || isGps;
  elements.gpsView.classList.toggle("hidden", !isGps);
  elements.gpsView.setAttribute("aria-hidden", String(!isGps));

  elements.homeView.classList.toggle("hidden", !isJumpseat);
  elements.addView.classList.add("hidden");
  elements.ftlView.classList.toggle("hidden", !isFtl);
  elements.checksView.classList.toggle("hidden", !isChecks);
  elements.raView.classList.toggle("hidden", !isRa);
  elements.notocView.classList.toggle("hidden", !isNotoc);
  elements.settingsView.classList.add("hidden");
  elements.homeView.setAttribute("aria-hidden", String(!isJumpseat));
  elements.addView.setAttribute("aria-hidden", "true");
  elements.ftlView.setAttribute("aria-hidden", String(!isFtl));
  elements.checksView.setAttribute("aria-hidden", String(!isChecks));
  elements.raView.setAttribute("aria-hidden", String(!isRa));
  elements.notocView.setAttribute("aria-hidden", String(!isNotoc));
  elements.settingsView.setAttribute("aria-hidden", "true");
  elements.jumpseatToolTab.classList.toggle("active", isJumpseat);
  elements.ftlToolTab.classList.toggle("active", isFtl);
  elements.checksToolTab.classList.toggle("active", isChecksSection);
  elements.jumpseatToolTab.setAttribute("aria-selected", String(isJumpseat));
  elements.ftlToolTab.setAttribute("aria-selected", String(isFtl));
  elements.checksToolTab.setAttribute("aria-selected", String(isChecksSection));

  if (isJumpseat) setActiveTab("home");
  if (isNotoc) document.dispatchEvent(new CustomEvent("opsdeck:notoc-open"));
  if (isGps) void window.OpsDeckGpsUi?.load();
}

function openSettings() {
  elements.gpsView.classList.add("hidden");
  elements.gpsView.setAttribute("aria-hidden", "true");
  elements.homeView.classList.add("hidden");
  elements.addView.classList.add("hidden");
  elements.ftlView.classList.add("hidden");
  elements.checksView.classList.add("hidden");
  elements.raView.classList.add("hidden");
  elements.notocView.classList.add("hidden");
  elements.settingsView.classList.remove("hidden");
  elements.homeView.setAttribute("aria-hidden", "true");
  elements.addView.setAttribute("aria-hidden", "true");
  elements.ftlView.setAttribute("aria-hidden", "true");
  elements.checksView.setAttribute("aria-hidden", "true");
  elements.raView.setAttribute("aria-hidden", "true");
  elements.notocView.setAttribute("aria-hidden", "true");
  elements.settingsView.setAttribute("aria-hidden", "false");
  elements.jumpseatToolTab.classList.remove("active");
  elements.ftlToolTab.classList.remove("active");
  elements.checksToolTab.classList.remove("active");
  elements.jumpseatToolTab.setAttribute("aria-selected", "false");
  elements.ftlToolTab.setAttribute("aria-selected", "false");
  elements.checksToolTab.setAttribute("aria-selected", "false");
  refreshTelegramStatus();
}

function todayIso() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 10);
}

function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultCrewLimitRecord(category, options = {}) {
  const baseline = options.baseline !== false;
  return {
    id: baseline ? category : (options.id || `${category}-${createId()}`),
    category,
    baseline,
    displayNumber: baseline ? (category === "flight" ? 1 : 0) : (options.displayNumber || null),
    name: sanitizeStoredText(options.name, 40),
    dutyDate: options.dutyDate ?? window.OpsDeckLtot.utcTodayIso(),
    dutyStart: "",
    maximumFdp: { hours: "", minutes: "" },
    discretion: { hours: "", minutes: "" },
    selectedFdpReferenceKey: null,
  };
}

function createDefaultCalculatorState() {
  const dutyDate = window.OpsDeckLtot.utcTodayIso();
  return {
    schemaVersion: CALCULATOR_SCHEMA_VERSION,
    anchorDate: dutyDate,
    nextCrewNumbers: { flight: 2, cabin: 1 },
    crewLimits: [createDefaultCrewLimitRecord("flight", { dutyDate })],
    sectorTiming: {
      taxiOutMinutes: "15",
      flightTime: { hours: "", minutes: "" },
      holdingMinutes: "15",
      taxiInMinutes: "15",
      contingencyMinutes: "0",
    },
  };
}

function sanitizeStoredText(value, maxLength = 60) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function sanitizeStoredTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(value || "")) ? String(value) : "";
}

function sanitizeStoredNumber(value, min, max, options = {}) {
  if (value === "" || value === null || value === undefined) return "";
  const number = Number(value);
  const step = options.step || 1;
  if (!Number.isInteger(number) || number < min || number > max || number % step !== 0) return "";
  return String(number);
}

function sanitizeStoredDuration(value, type) {
  const source = value && typeof value === "object" ? value : {};
  const isMaximumFdp = type === "maximumFdp";
  const maxHours = isMaximumFdp ? 14 : 2;
  const minHours = isMaximumFdp ? 9 : 0;
  const minuteStep = isMaximumFdp ? 5 : 1;
  const hours = sanitizeStoredNumber(source.hours, minHours, maxHours);
  let minutes = sanitizeStoredNumber(source.minutes, 0, 59, { step: minuteStep });

  if (hours === String(maxHours) && minutes !== "0") minutes = "0";
  return { hours, minutes };
}

function sanitizeStoredCrewLimits(value) {
  const source = Array.isArray(value) ? value : [];
  const result = [];
  const usedIds = new Set();

  ["flight", "cabin"].forEach((category) => {
    const categoryRecords = source.filter((candidate) => candidate?.category === category);
    const baselineRecord = categoryRecords.find((candidate) => candidate.id === category || candidate.baseline === true) || categoryRecords[0];
    if (!baselineRecord) return;

    result.push({
      id: category,
      category,
      baseline: true,
      displayNumber: category === "flight" ? 1 : 0,
      name: category === "flight" ? sanitizeStoredText(baselineRecord.name, 40) : "",
      dutyDate: window.OpsDeckLtot.isIsoDate(baselineRecord.dutyDate) ? baselineRecord.dutyDate : "",
      dutyStart: sanitizeStoredTime(baselineRecord.dutyStart),
      maximumFdp: sanitizeStoredDuration(baselineRecord.maximumFdp, "maximumFdp"),
      discretion: sanitizeStoredDuration(baselineRecord.discretion, "discretion"),
      selectedFdpReferenceKey: sanitizeStoredText(baselineRecord.selectedFdpReferenceKey, 160) || null,
    });
    usedIds.add(category);
    const usedNumbers = new Set(category === "flight" ? [1] : []);
    let nextNumber = category === "flight" ? 2 : 1;

    categoryRecords
      .filter((candidate) => candidate !== baselineRecord && candidate.id !== category && candidate.baseline !== true)
      .forEach((candidate) => {
        let id = String(candidate.id || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
        if (!id || usedIds.has(id) || id === "flight" || id === "cabin") id = `${category}-${createId()}`;
        usedIds.add(id);
        let displayNumber = Number(candidate.displayNumber);
        if (!Number.isSafeInteger(displayNumber) || displayNumber < (category === "flight" ? 2 : 1) || usedNumbers.has(displayNumber)) {
          while (usedNumbers.has(nextNumber)) nextNumber += 1;
          displayNumber = nextNumber;
        }
        usedNumbers.add(displayNumber);
        nextNumber = Math.max(nextNumber, displayNumber + 1);
        result.push({
          id,
          category,
          baseline: false,
          displayNumber,
          name: sanitizeStoredText(candidate.name, 40),
          dutyDate: window.OpsDeckLtot.isIsoDate(candidate.dutyDate) ? candidate.dutyDate : "",
          dutyStart: sanitizeStoredTime(candidate.dutyStart),
          maximumFdp: sanitizeStoredDuration(candidate.maximumFdp, "maximumFdp"),
          discretion: sanitizeStoredDuration(candidate.discretion, "discretion"),
          selectedFdpReferenceKey: sanitizeStoredText(candidate.selectedFdpReferenceKey, 160) || null,
        });
      });
  });

  if (!result.some((record) => record.category === "flight")) {
    result.unshift(createDefaultCrewLimitRecord("flight"));
  }
  return result;
}

function sanitizeCalculatorState(value) {
  const fallback = createDefaultCalculatorState();
  if (!value || typeof value !== "object") return fallback;

  const sourceTiming = value.sectorTiming && typeof value.sectorTiming === "object"
    ? value.sectorTiming
    : {};
  const flightTimeSource = sourceTiming.flightTime && typeof sourceTiming.flightTime === "object"
    ? sourceTiming.flightTime
    : {};
  let flightHours = sanitizeStoredNumber(flightTimeSource.hours, 0, 8);
  let flightMinutes = sanitizeStoredNumber(flightTimeSource.minutes, flightHours === "0" ? 1 : 0, 59);
  if (flightHours === "8" && flightMinutes !== "0") flightMinutes = "0";
  if (!flightHours) flightMinutes = "";

  const crewLimits = sanitizeStoredCrewLimits(value.crewLimits);
  const flight = crewLimits.find((record) => record.id === "flight");
  if (Number(value.schemaVersion || 0) < 5) {
    const referenceMinutes = flight.dutyStart ? durationStringToMinutes(flight.dutyStart) : null;
    crewLimits.forEach((record) => {
      if (record.dutyDate) return;
      record.dutyDate = window.OpsDeckLtot.migrateReportDate(
        value.anchorDate,
        record.dutyStart ? durationStringToMinutes(record.dutyStart) : null,
        referenceMinutes
      );
    });
  }
  const counters = {};
  ["flight", "cabin"].forEach((category) => {
    const minimum = Math.max(category === "flight" ? 1 : 0, ...crewLimits.filter((record) => record.category === category).map((record) => record.displayNumber)) + 1;
    const saved = Number(value.nextCrewNumbers?.[category]);
    counters[category] = Number.isSafeInteger(saved) ? Math.max(saved, minimum) : minimum;
  });
  // Earlier saves did not retain a name for the original Flight crew entry.
  if (Number(value.schemaVersion || 0) < 4 && crewLimits.some((record) => record.category === "flight" && !record.baseline)) {
    const flight = crewLimits.find((record) => record.id === "flight");
    if (!flight.name) flight.name = DEFAULT_FLIGHT_CREW_NAME;
  }

  return {
    schemaVersion: CALCULATOR_SCHEMA_VERSION,
    anchorDate: window.OpsDeckLtot.isIsoDate(flight.dutyDate) ? flight.dutyDate : null,
    nextCrewNumbers: counters,
    crewLimits,
    sectorTiming: {
      taxiOutMinutes: sanitizeStoredNumber(sourceTiming.taxiOutMinutes, 0, 59) || "15",
      flightTime: { hours: flightHours, minutes: flightMinutes },
      holdingMinutes: sanitizeStoredNumber(sourceTiming.holdingMinutes, 0, 59) || "15",
      taxiInMinutes: sanitizeStoredNumber(sourceTiming.taxiInMinutes, 0, 59) || "15",
      contingencyMinutes: sanitizeStoredNumber(sourceTiming.contingencyMinutes, 0, 59) || "0",
    },
  };
}

function loadCalculatorEnvelope() {
  try {
    const saved = JSON.parse(localStorage.getItem(CALCULATOR_STORAGE_KEY) || "null");
    if (!saved) return { state: createDefaultCalculatorState(), dirty: false, baseUpdatedAt: null };
    if (saved.state) {
      return {
        state: sanitizeCalculatorState(saved.state),
        dirty: Boolean(saved.dirty),
        baseUpdatedAt: saved.baseUpdatedAt || null,
      };
    }
    return { state: sanitizeCalculatorState(saved), dirty: false, baseUpdatedAt: null };
  } catch {
    return { state: createDefaultCalculatorState(), dirty: false, baseUpdatedAt: null };
  }
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
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
  return window.OpsDeckLtot.formatZuluTime(totalMinutes);
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

function crewCategoryLabel(category) {
  return category === "cabin" ? "Cabin crew" : "Flight crew";
}

function isSharedCrewLimitMode() {
  return crewLimitRecords.length === 1 && crewLimitRecords[0]?.id === "flight";
}

function crewLimitName(control) {
  return sanitizeStoredText(control?.nameInput?.value ?? control?.name, 40);
}

function crewLimitIsNamed(control) {
  return Boolean(control && (control.baseline === false || (
    control.category === "flight" && crewLimitRecords.some((record) => record.category === "flight" && record.baseline === false)
  )));
}

function crewLimitRoleLabel(control) {
  if (!control) return "Crew";
  if (isSharedCrewLimitMode() && control.id === "flight") return "All crew";
  const group = crewLimitRecords.filter((record) => record.category === control.category);
  if (!group.some((record) => record.baseline === false)) return crewCategoryLabel(control.category);
  if (control.category === "cabin" && control.baseline !== false) return "Cabin crew group";
  return `${crewCategoryLabel(control.category)} ${control.displayNumber}`;
}

function crewLimitDisplayLabel(control) {
  const role = crewLimitRoleLabel(control);
  const name = crewLimitIsNamed(control) ? crewLimitName(control) : "";
  return name ? `${role}: ${name}` : role;
}

function crewLimitTargetLabel(control) {
  return crewLimitDisplayLabel(control);
}

function crewLimitStatusLabel(control) {
  if (isSharedCrewLimitMode() && control?.id === "flight") return "Crew limit";
  return `${crewLimitDisplayLabel(control)} limit`;
}

function createCrewDurationControl(hours, minutes, type, savedValue) {
  const isMaximumFdp = type === "maximumFdp";
  return {
    hours,
    minutes,
    minHours: isMaximumFdp ? 9 : 0,
    maxHours: isMaximumFdp ? 14 : 2,
    maxMinutesAtMaxHour: 0,
    minuteStep: isMaximumFdp ? 5 : 1,
    defaultHours: savedValue?.hours ?? "",
    defaultMinutes: savedValue?.minutes ?? "",
    blankDefault: true,
  };
}

function createCrewLimitCard(record) {
  const card = elements.crewLimitTemplate.content.firstElementChild.cloneNode(true);
  const title = crewCategoryLabel(record.category);
  const isIndividual = record.baseline === false;
  const isNamed = crewLimitIsNamed(record);
  const identity = card.querySelector(".crew-limit-identity");
  const nameInput = card.querySelector(".crew-limit-name");
  const removeButton = card.querySelector(".crew-limit-remove");
  const dutyStart = card.querySelector(".crew-limit-duty-start");
  const dutyDate = card.querySelector(".crew-limit-duty-date");
  const dutyStartShell = card.querySelector(".time-input-shell");
  const maxFdp = createCrewDurationControl(
    card.querySelector(".crew-limit-max-hours"),
    card.querySelector(".crew-limit-max-minutes"),
    "maximumFdp",
    record.maximumFdp
  );
  const discretion = createCrewDurationControl(
    card.querySelector(".crew-limit-discretion-hours"),
    card.querySelector(".crew-limit-discretion-minutes"),
    "discretion",
    record.discretion
  );
  const lookupButton = card.querySelector(".fdp-lookup-button");
  const control = {
    id: record.id,
    category: record.category,
    baseline: !isIndividual,
    displayNumber: record.displayNumber,
    name: record.name || "",
    nameInput,
    removeButton,
    label: title,
    card,
    dutyStart,
    dutyDate,
    dutyStartShell,
    maxFdp,
    discretion,
    maxAllowableFdp: card.querySelector(".crew-limit-allowable"),
    selectedFdpReferenceKey: record.selectedFdpReferenceKey || null,
    lookupButton,
  };

  card.dataset.crewLimitId = record.id;
  card.classList.toggle("is-individual", isIndividual);
  identity.classList.toggle("hidden", !isNamed);
  identity.classList.toggle("is-baseline", !isIndividual);
  removeButton.classList.toggle("hidden", !isIndividual);
  nameInput.value = record.name || "";
  dutyStart.value = record.dutyStart || "";
  dutyDate.value = record.dutyDate || "";
  dutyStart.setAttribute("aria-label", `${title} duty start time Zulu`);

  maxFdp.hours.setAttribute("aria-label", `${title} Maximum FDP hours`);
  maxFdp.minutes.setAttribute("aria-label", `${title} Maximum FDP minutes`);
  discretion.hours.setAttribute("aria-label", `${title} Commander's discretion hours`);
  discretion.minutes.setAttribute("aria-label", `${title} Commander's discretion minutes`);
  setupDurationControl(maxFdp);
  setupDurationControl(discretion);
  setDurationControl(maxFdp, record.maximumFdp?.hours ?? "", record.maximumFdp?.minutes ?? "");
  setDurationControl(discretion, record.discretion?.hours ?? "", record.discretion?.minutes ?? "");
  updateDurationIncompleteState(maxFdp);
  updateDurationIncompleteState(discretion);
  dutyStartShell.classList.toggle("is-empty", !dutyStart.value);

  const handleCrewChange = (event) => {
    dutyStartShell.classList.toggle("is-empty", !dutyStart.value);
    if (record.id === "flight" && event.currentTarget === dutyDate) {
      ftlAnchorDate = window.OpsDeckLtot.isIsoDate(dutyDate.value) ? dutyDate.value : null;
    }
    updateCrewLimitAccessibleLabels(control);
    updateFdpTargetBanner();
    calculateFtl();
  };
  if (isNamed) {
    nameInput.addEventListener("input", handleCrewChange);
    nameInput.addEventListener("change", handleCrewChange);
  }
  if (isIndividual) {
    removeButton.addEventListener("click", () => removeIndividualCrewLimit(record.id));
  }
  dutyStart.addEventListener("input", handleCrewChange);
  dutyStart.addEventListener("change", handleCrewChange);
  dutyDate.addEventListener("input", handleCrewChange);
  dutyDate.addEventListener("change", handleCrewChange);
  lookupButton.addEventListener("click", () => openFdpReferenceFor(record.id));
  ftlCrewControls[record.id] = control;
  updateCrewLimitAccessibleLabels(control);
  return card;
}

function updateCrewLimitAccessibleLabels(control) {
  const label = crewLimitDisplayLabel(control);
  const role = crewLimitRoleLabel(control);
  control.card.querySelector(".crew-limit-heading").textContent = role;
  control.dutyDate.setAttribute("aria-label", `${label} report date Zulu`);
  control.nameInput.placeholder = role;
  control.nameInput.setAttribute("aria-label", `${role} name or identifier (optional)`);
  control.removeButton.setAttribute("aria-label", `Remove ${label} limit`);
  control.removeButton.title = `Remove ${label} limit`;
  control.card.setAttribute("aria-label", `${label} FDP limit`);
  control.dutyStart.setAttribute("aria-label", `${label} duty start time Zulu`);
  control.maxFdp.hours.setAttribute("aria-label", `${label} Maximum FDP hours`);
  control.maxFdp.minutes.setAttribute("aria-label", `${label} Maximum FDP minutes`);
  control.discretion.hours.setAttribute("aria-label", `${label} Commander's discretion hours`);
  control.discretion.minutes.setAttribute("aria-label", `${label} Commander's discretion minutes`);
  control.lookupButton.setAttribute("aria-label", `Open FDP table for ${label}`);
  control.lookupButton.title = `Open FDP table for ${label}`;
}

function renderCrewLimitRecords(records) {
  Object.keys(ftlCrewControls).forEach((key) => delete ftlCrewControls[key]);
  elements.flightCrewLimits.replaceChildren();
  elements.cabinCrewLimits.replaceChildren();
  crewLimitRecords = sanitizeStoredCrewLimits(records);
  ["flight", "cabin"].forEach((category) => {
    nextCrewNumbers[category] = Math.max(nextCrewNumbers[category], ...crewLimitRecords.filter((record) => record.category === category).map((record) => record.displayNumber + 1));
  });

  ["flight", "cabin"].forEach((category) => {
    const container = category === "flight" ? elements.flightCrewLimits : elements.cabinCrewLimits;
    crewLimitRecords
      .filter((record) => record.category === category)
      .forEach((record) => container.append(createCrewLimitCard(record)));
  });

  cabinCrewEnabled = crewLimitRecords.some((record) => record.category === "cabin");
  if (!ftlCrewControls[activeFdpTargetId]) {
    activeFdpTargetId = ftlCrewControls[activeFtlCrew] ? activeFtlCrew : "flight";
  }
  updateFdpTargetBanner();
  renderFtlCrewMode();
}

function crewLimitHasOperationalData(control) {
  return Boolean(
    control.dutyStart.value ||
    hasDurationValue(control.maxFdp) ||
    hasPartialDurationValue(control.maxFdp) ||
    hasDurationValue(control.discretion) ||
    hasPartialDurationValue(control.discretion)
  );
}

function crewLimitHasData(control) {
  return Boolean(crewLimitName(control) || crewLimitHasOperationalData(control));
}

function durationStringToParts(value) {
  const [hours, minutes] = value.split(":").map(Number);
  return { hours, minutes };
}

function durationStringToMinutes(value) {
  const { hours, minutes } = durationStringToParts(value);
  return (hours * 60) + minutes;
}

function currentMaximumFdpTableValue(crewId = activeFdpTargetId) {
  const control = ftlCrewControls[crewId]?.maxFdp;
  if (!control) return "";
  if (!hasDurationValue(control)) return "";
  const hours = String(Number(control.hours.value)).padStart(2, "0");
  const minutes = String(Number(control.minutes.value)).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function updateFdpReferenceSelection() {
  const selectedValue = currentMaximumFdpTableValue();
  const selectedKey = ftlCrewControls[activeFdpTargetId]?.selectedFdpReferenceKey || null;
  [elements.fdpTableTwoContainer, elements.fdpTableThreeContainer].forEach((container) => {
    if (!container) return;
    container.querySelectorAll(".fdp-table-button").forEach((button) => {
      const isSelected = button.dataset.key === selectedKey && button.dataset.value === selectedValue;
      button.classList.toggle("is-selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    });
  });
}

function updateFdpTargetBanner() {
  if (!elements.fdpTargetSelect) return;
  const shared = crewLimitRecords.length === 1;
  const options = crewLimitRecords.map((record) => {
    const option = document.createElement("option");
    option.value = record.id;
    option.textContent = crewLimitTargetLabel(ftlCrewControls[record.id]);
    return option;
  });
  [elements.fdpTargetSelect, ...document.querySelectorAll(".fdp-table-target-select")].forEach((select) => {
    select.replaceChildren(...options.map((option) => option.cloneNode(true)));
    select.value = activeFdpTargetId;
    select.disabled = shared;
    select.classList.toggle("hidden", shared);
  });
  document.querySelectorAll(".fdp-target-value").forEach((value) => {
    value.textContent = crewLimitTargetLabel(ftlCrewControls[activeFdpTargetId]);
    value.classList.toggle("hidden", !shared);
  });
}

function setFdpReferenceTarget(crewId, preservePosition = false) {
  const control = ftlCrewControls[crewId];
  if (!control) return;
  const previousTop = preservePosition ? elements.fdpTargetBanner.getBoundingClientRect().top : null;
  activeFdpTargetId = crewId;
  activeFtlCrew = control.category;
  renderFtlCrewMode();
  updateFdpTargetBanner();
  updateFdpReferenceSelection();
  window.clearTimeout(fdpReferenceStatusTimer);
  elements.fdpReferenceMessage.textContent = "";
  elements.fdpReferenceReturnButton.dataset.crewId = "";
  elements.fdpReferenceStatus.classList.add("hidden");
  if (preservePosition) {
    window.scrollBy({ top: elements.fdpTargetBanner.getBoundingClientRect().top - previousTop, behavior: "instant" });
  }
}

function openFdpReferenceFor(crewId) {
  if (!ftlCrewControls[crewId]) return;
  setFdpReferenceTarget(crewId);
  elements.fdpReferencePanel.open = true;
  window.requestAnimationFrame(() => {
    elements.fdpTargetBanner.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function openFdpWorkflowSection(targetId) {
  const section = document.getElementById(targetId);
  if (!section) return;

  section.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => section.querySelector("h3")?.focus({ preventScroll: true }), 350);
}

function scheduleFdpReferenceDismiss() {
  window.clearTimeout(fdpReferenceStatusTimer);
  fdpReferenceStatusTimer = window.setTimeout(() => {
    if (elements.fdpReferenceStatus.contains(document.activeElement)) return;
    elements.fdpReferenceStatus.classList.add("hidden");
  }, 8000);
}

function showFdpReferenceStatus(message) {
  if (!elements.fdpReferenceStatus) return;

  elements.fdpReferenceMessage.textContent = message;
  elements.fdpReferenceReturnButton.dataset.crewId = activeFdpTargetId;
  elements.fdpReferenceReturnButton.setAttribute("aria-label", `Return to Maximum FDP for ${crewLimitDisplayLabel(ftlCrewControls[activeFdpTargetId])}`);
  elements.fdpReferenceStatus.classList.remove("hidden");
  scheduleFdpReferenceDismiss();
}

function setFtlInputSectionOpen(section, open) {
  elements[`${section}InputsToggle`].setAttribute("aria-expanded", String(open));
  elements[`${section}InputsContent`].classList.toggle("hidden", !open);
}

function returnToFdpInput() {
  const crewId = elements.fdpReferenceReturnButton.dataset.crewId;
  const crew = ftlCrewControls[crewId];
  if (!crew) return;

  setFdpReferenceTarget(crewId);
  setFtlInputSectionOpen("fdp", true);
  window.requestAnimationFrame(() => {
    crew.lookupButton.scrollIntoView({ behavior: ftlScrollBehaviour(), block: "center" });
    crew.lookupButton.focus({ preventScroll: true });
  });
}

function ftlScrollBehaviour() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth";
}

function openReportingTimeClarification() {
  elements.ftlClarifications.open = true;
  elements.reportingTimeClarification.scrollIntoView({ behavior: ftlScrollBehaviour(), block: "center" });
  elements.reportingTimeClarification.focus({ preventScroll: true });
}

// A UI reminder only: these inputs cannot establish the briefing or sector-sequence conditions.
function shouldShowReportingTimeReminder(comparison) {
  if (!comparison?.comparisonComplete) return false;
  const flight = comparison.results.find((result) => result.id === "flight");
  if (!flight) return false;
  if (comparison.results.length === 1) return flight.discretionMinutes > 0;
  if (comparison.results.length !== 2) return false;
  const cabin = comparison.results.find((result) => result.id === "cabin");
  if (!cabin || cabin.discretionMinutes <= 0) return false;
  const earlierReportMinutes = flight.dutyStartMinutes - cabin.dutyStartMinutes;
  return earlierReportMinutes > 0 && earlierReportMinutes <= 60;
}

function setMaximumFdpFromReference(value, rowLabel, columnLabel, tableLabel, referenceKey) {
  const targetId = activeFdpTargetId;
  const crew = ftlCrewControls[targetId];
  if (!crew) return;
  const isSelected = referenceKey === crew.selectedFdpReferenceKey && currentMaximumFdpTableValue(targetId) === value;
  if (isSelected) {
    crew.selectedFdpReferenceKey = null;
    setDurationControl(crew.maxFdp, "", "");
    updateDurationIncompleteState(crew.maxFdp);
    calculateFtl();
    if (document.activeElement?.classList?.contains("fdp-table-button")) {
      document.activeElement.blur();
    }

    showFdpReferenceStatus(`${crewLimitStatusLabel(crew)} cleared.`);
    return;
  }

  crew.selectedFdpReferenceKey = referenceKey;
  const { hours, minutes } = durationStringToParts(value);
  setDurationControl(crew.maxFdp, hours, minutes);
  updateDurationIncompleteState(crew.maxFdp);
  calculateFtl();

  showFdpReferenceStatus(
    `${crewLimitStatusLabel(crew)} set to ${formatDurationWithZeroMinutes(durationStringToMinutes(value))} from ${tableLabel}, ${rowLabel}, ${columnLabel}.`
  );
}

function renderFdpReferenceTable(container, rows, columns, firstColumnLabel, tableLabel) {
  if (!container) return;

  const table = document.createElement("table");
  table.className = "fdp-reference-table fdp-value-table";
  const colgroup = document.createElement("colgroup");
  [20, 20, 20, 20, 20].forEach((width) => {
    const col = document.createElement("col");
    col.style.width = `${width}%`;
    colgroup.append(col);
  });
  table.append(colgroup);

  const header = document.createElement("thead");
  const headerRow = document.createElement("tr");
  [firstColumnLabel, ...columns.map((column) => column.label)].forEach((label) => {
    const heading = document.createElement("th");
    heading.scope = "col";
    heading.textContent = label;
    headerRow.append(heading);
  });
  header.append(headerRow);
  table.append(header);

  const body = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const rowHeading = document.createElement("th");
    rowHeading.scope = "row";
    rowHeading.textContent = row.start;
    tr.append(rowHeading);

    columns.forEach((column) => {
      const cell = document.createElement("td");
      const referenceKey = `${tableLabel}-${row.start}-${column.key}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "fdp-table-button";
      button.textContent = row[column.key];
      button.dataset.value = row[column.key];
      button.dataset.key = referenceKey;
      button.setAttribute(
        "aria-label",
        `Set Maximum FDP to ${row[column.key]} from ${tableLabel}, ${row.start}, ${column.label}`
      );
      button.addEventListener("click", (event) => {
        setMaximumFdpFromReference(row[column.key], row.start, column.label, tableLabel, referenceKey);
        if (event.detail > 0) button.blur();
      });
      cell.append(button);
      tr.append(cell);
    });

    body.append(tr);
  });
  table.append(body);

  const toolbar = document.createElement("div");
  toolbar.className = "fdp-table-toolbar";
  const target = document.createElement("div");
  target.className = "fdp-table-target";
  const caption = document.createElement("span");
  caption.textContent = "Maximum FDP for";
  const select = document.createElement("select");
  select.className = "fdp-table-target-select";
  select.setAttribute("aria-label", `${tableLabel} Maximum FDP for`);
  select.addEventListener("change", () => setFdpReferenceTarget(select.value, true));
  const targetValue = document.createElement("strong");
  targetValue.className = "fdp-target-value hidden";
  target.append(caption, targetValue, select);
  const headingsViewport = document.createElement("div");
  headingsViewport.className = "fdp-column-viewport";
  headingsViewport.setAttribute("aria-hidden", "true");
  const headings = document.createElement("div");
  headings.className = "fdp-column-headings";
  [firstColumnLabel, ...columns.map((column) => column.label)].forEach((label) => {
    const heading = document.createElement("span");
    heading.textContent = label;
    if (label === "Start of FDP") {
      const timeBasis = document.createElement("small");
      timeBasis.textContent = "Local/reference";
      heading.append(timeBasis);
    }
    headings.append(heading);
  });
  headingsViewport.append(headings);
  toolbar.append(target, headingsViewport);
  const scroll = document.createElement("div");
  scroll.className = "fdp-table-scroll";
  scroll.append(table);
  // The real table keeps its accessible headings; the pinned copy follows horizontal scrolling.
  scroll.addEventListener("scroll", () => { headingsViewport.scrollLeft = scroll.scrollLeft; }, { passive: true });
  container.classList.remove("fdp-table-scroll");
  container.classList.add("fdp-selection-table");
  container.replaceChildren(toolbar, scroll);
}

function renderFdpReferenceTables() {
  renderFdpReferenceTable(
    elements.fdpTableTwoContainer,
    FDP_TABLE_TWO_ROWS,
    FDP_TABLE_TWO_COLUMNS,
    "Start of FDP",
    "Table 2"
  );
  renderFdpReferenceTable(
    elements.fdpTableThreeContainer,
    FDP_TABLE_THREE_ROWS,
    FDP_TABLE_THREE_COLUMNS,
    "Unknown state",
    "Table 3"
  );
  updateFdpReferenceSelection();
  updateFdpTargetBanner();
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

function serializeCalculatorState() {
  const crewLimits = crewLimitRecords.map((record) => {
    const control = ftlCrewControls[record.id];
    if (!control) return record;
    return {
      id: record.id,
      category: record.category,
      baseline: record.baseline !== false,
      displayNumber: record.displayNumber,
      name: crewLimitName(control),
      dutyDate: control.dutyDate.value || "",
      dutyStart: control.dutyStart.value || "",
      maximumFdp: {
        hours: control.maxFdp.hours.value,
        minutes: control.maxFdp.minutes.value,
      },
      discretion: {
        hours: control.discretion.hours.value,
        minutes: control.discretion.minutes.value,
      },
      selectedFdpReferenceKey: control.selectedFdpReferenceKey,
    };
  });

  return sanitizeCalculatorState({
    schemaVersion: CALCULATOR_SCHEMA_VERSION,
    anchorDate: ftlAnchorDate,
    nextCrewNumbers,
    crewLimits,
    sectorTiming: {
      taxiOutMinutes: ftlDurationControls.taxiOut.minutes.value,
      flightTime: {
        hours: ftlDurationControls.flightTime.hours.value,
        minutes: ftlDurationControls.flightTime.minutes.value,
      },
      holdingMinutes: ftlDurationControls.holding.minutes.value,
      taxiInMinutes: ftlDurationControls.taxiIn.minutes.value,
      contingencyMinutes: ftlDurationControls.contingency.minutes.value,
    },
  });
}

function saveCalculatorEnvelope() {
  if (!calculatorInitialised) return;
  localStorage.setItem(CALCULATOR_STORAGE_KEY, JSON.stringify({
    state: serializeCalculatorState(),
    dirty: calculatorLocalDirty,
    baseUpdatedAt: calculatorLocalBaseUpdatedAt,
  }));
}

function queueCalculatorSave() {
  if (!calculatorInitialised) return;
  calculatorChangeRevision += 1;
  calculatorLocalDirty = true;
  if (calculatorCloudLoaded) calculatorLocalBaseUpdatedAt = calculatorCloudUpdatedAt;
  saveCalculatorEnvelope();

  if (!navigator.onLine || !supabaseClient || !currentUser || !calculatorCloudLoaded) return;
  if (calculatorSaveInFlight) return;
  window.clearTimeout(calculatorSaveTimer);
  calculatorSaveTimer = window.setTimeout(() => {
    saveCloudCalculatorState();
  }, 500);
}

function scheduleCalculatorRetry() {
  if (!calculatorLocalDirty || !navigator.onLine || !currentUser || !calculatorCloudLoaded) return;
  const delays = [2000, 5000, 15000, 30000];
  const delay = delays[Math.min(calculatorRetryAttempt, delays.length - 1)];
  calculatorRetryAttempt += 1;
  window.clearTimeout(calculatorRetryTimer);
  setSyncStatus("Calculator changes not yet synced · retrying automatically", false, true);
  calculatorRetryTimer = window.setTimeout(() => saveCloudCalculatorState(), delay);
}

function applySectorTimingState(sectorTiming) {
  const timing = sanitizeCalculatorState({ crewLimits: crewLimitRecords, sectorTiming }).sectorTiming;
  setDurationControl(ftlDurationControls.taxiOut, 0, timing.taxiOutMinutes);
  setDurationControl(ftlDurationControls.flightTime, timing.flightTime.hours, timing.flightTime.minutes);
  setDurationControl(ftlDurationControls.holding, 0, timing.holdingMinutes);
  setDurationControl(ftlDurationControls.taxiIn, 0, timing.taxiInMinutes);
  setDurationControl(ftlDurationControls.contingency, 0, timing.contingencyMinutes);
  updateDurationIncompleteState(ftlDurationControls.flightTime);
}

function applyCalculatorState(value) {
  const state = sanitizeCalculatorState(value);
  ftlAnchorDate = state.anchorDate;
  nextCrewNumbers = state.nextCrewNumbers;
  applySectorTimingState(state.sectorTiming);
  renderCrewLimitRecords(state.crewLimits);
  if (!cabinCrewEnabled && activeFtlCrew === "cabin") activeFtlCrew = "flight";
  renderFtlCrewMode();
  calculateFtl(false);
}

function hasDutyStartValue(crewKey) {
  return ftlCrewControls[crewKey].dutyStart.value !== "";
}

function updateDutyStartEmptyState(crewKey) {
  const crew = ftlCrewControls[crewKey];
  crew.dutyStartShell.classList.toggle("is-empty", crew.dutyStart.value === "");
}

function getDutyStartMinutes(crewKey) {
  const [hours, minutes] = ftlCrewControls[crewKey].dutyStart.value.split(":").map(Number);
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

function formatOptionalDuration(control) {
  if (!hasDurationValue(control)) return "--";
  return formatDurationWithZeroMinutes(getDurationMinutes(control));
}

function formatOptionalMinuteDuration(control) {
  if (!hasDurationValue(control)) return "--";
  return formatDurationFromMinutes(getDurationMinutes(control));
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

function ftlResultDate(targetMinutes, includeWeekday = true) {
  const date = window.OpsDeckLtot.dateForMinutes(ftlAnchorDate, targetMinutes);
  return date ? (includeWeekday ? FTL_DATE_FORMATTER : FTL_SHORT_DATE_FORMATTER).format(new Date(`${date}T00:00:00Z`)) : "";
}

function updateCountdownElement(element, targetMinutes) {
  const card = element.closest(".ftl-result-card");
  const status = window.OpsDeckLtot.countdownPresentation(ftlAnchorDate, targetMinutes);
  const isPast = status.state === "overdue" || status.state === "expired";
  const isClose = status.state === "warning";
  element.textContent = status.text;
  element.classList.toggle("status-error", isPast);
  element.classList.toggle("status-warning", isClose);
  element.classList.toggle("status-success", status.state === "normal");
  card?.classList.toggle("is-warning", isClose);
  card?.classList.toggle("is-overdue", isPast);
  card?.classList.toggle("is-pending", status.state === "incomplete");
  const date = card?.querySelector(".result-date");
  if (date) {
    date.textContent = ftlResultDate(targetMinutes);
    date.classList.toggle("hidden", !date.textContent);
  }
}

function updateFtlCountdown() {
  updateCountdownElement(elements.latestOnChocksCountdown, ftlLatestOnChocksMinutes);
  updateCountdownElement(elements.latestPushbackCountdown, ftlLatestPushbackMinutes);
  updateCountdownElement(elements.latestTakeoffCountdown, ftlLatestTakeoffMinutes);
  elements.ftlView.classList.toggle("is-fdp-only", ftlLatestPushbackMinutes === null && ftlLatestTakeoffMinutes === null);
  updateMobileFtlResults();
}

function updateMobileFtlResults() {
  if (!elements.ftlMobileResultStrip) return;

  const hasResult = ftlLatestOnChocksMinutes !== null;
  const summaries = [
    [elements.ftlMobilePushback, elements.latestPushback, ftlLatestPushbackMinutes],
    [elements.ftlMobileTakeoff, elements.latestTakeoff, ftlLatestTakeoffMinutes],
    [elements.ftlMobileOnChocks, elements.latestOnChocks, ftlLatestOnChocksMinutes],
  ];
  summaries.forEach(([element, source, minutes]) => {
    const status = window.OpsDeckLtot.countdownPresentation(ftlAnchorDate, minutes);
    element.textContent = status.state === "expired" ? "--:--Z" : source.textContent;
    element.parentElement.dataset.state = status.state;
    element.parentElement.querySelector(".mobile-result-date").textContent = ftlResultDate(minutes, false);
    element.parentElement.querySelector(".mobile-result-status").textContent = status.shortText;
  });
  elements.ftlMobileResultStrip.classList.toggle("hidden", !hasResult);
  elements.ftlMobileResultStrip.setAttribute(
    "aria-label",
    hasResult
      ? `View calculated latest times. ${elements.ftlMobileResultStrip.innerText.replace(/\n/g, ", ")}`
      : "View calculated latest times"
  );
}

function hasCompleteLtotResult() {
  return ftlLatestOnChocksMinutes !== null &&
    ftlLatestPushbackMinutes !== null &&
    ftlLatestTakeoffMinutes !== null;
}

function setLtotTelegramStatus(message = "", isError = false, isSuccess = false) {
  elements.ftlTelegramStatus.textContent = message;
  elements.ftlTelegramStatus.classList.toggle("hidden", !message);
  elements.ftlTelegramStatus.classList.toggle("status-error", isError);
  elements.ftlTelegramStatus.classList.toggle("status-success", isSuccess);
}

function updateLtotTelegramButton() {
  if (!elements.sendLtotTelegramButton) return;

  const showButton = telegramLtotSupported;
  const hasResult = hasCompleteLtotResult();
  elements.sendLtotTelegramButton.classList.toggle("hidden", !showButton);

  if (!showButton) {
    elements.sendLtotTelegramButton.disabled = true;
    return;
  }

  elements.sendLtotTelegramButton.disabled = isOfflineReadOnly || !telegramLinked || !hasResult;
  elements.sendLtotTelegramButton.title = !telegramLinked
    ? "Link Telegram in Settings first"
    : !hasResult
      ? "Enter final sector timing before sending LTOT"
      : "";
}

function buildLtotTelegramSummary() {
  if (!hasCompleteLtotResult() || !currentCrewComparison?.controllingIds?.length) return null;

  const controllingControls = currentCrewComparison.controllingIds
    .map((id) => ftlCrewControls[id])
    .filter(Boolean);
  const includeCrewLabels = controllingControls.length > 1;
  const formatCrewValue = (crew, value) => includeCrewLabels
    ? `${crewLimitDisplayLabel(crew)} ${value}`
    : value;
  const limitingCrew = controllingControls.length === 1
    ? crewLimitDisplayLabel(controllingControls[0])
    : `Joint: ${controllingControls.map(crewLimitDisplayLabel).join("; ")}`;

  return {
    latest_pushback: elements.latestPushback.textContent,
    latest_takeoff: elements.latestTakeoff.textContent,
    latest_on_chocks: elements.latestOnChocks.textContent,
    limiting_crew: limitingCrew,
    duty_start: controllingControls.map((crew) => formatCrewValue(crew, `${crew.dutyStart.value}Z`)).join("; "),
    maximum_fdp: controllingControls.map((crew) => formatCrewValue(crew, formatOptionalDuration(crew.maxFdp))).join("; "),
    commander_discretion: controllingControls.map((crew) => formatCrewValue(crew, formatOptionalDuration(crew.discretion))).join("; "),
    flight_time: formatOptionalDuration(ftlDurationControls.flightTime),
    taxi_out: formatOptionalMinuteDuration(ftlDurationControls.taxiOut),
    holding: formatOptionalMinuteDuration(ftlDurationControls.holding),
    taxi_in: formatOptionalMinuteDuration(ftlDurationControls.taxiIn),
    contingency: formatOptionalMinuteDuration(ftlDurationControls.contingency),
    sector_length: elements.sectorLength.textContent,
  };
}

function updateContingencyNote(element, contingency) {
  const hasContingency = contingency > 0;
  element.textContent = hasContingency ? formatContingencyIncluded(contingency) : "";
  element.classList.toggle("hidden", !hasContingency);
  element.classList.toggle("is-included", contingency > 0);
}

function updateMaximumAllowableFdp(element, maximumAllowableFdp, discretion) {
  element.textContent = formatDurationWithZeroMinutes(maximumAllowableFdp);
  if (discretion <= 0) return;

  const discretionNote = document.createElement("span");
  discretionNote.className = "discretion-note is-active";
  discretionNote.textContent = `(${formatCommanderDiscretion(discretion)})`;
  element.append(discretionNote);
}

function updateResultDiscretionNote(element, discretion) {
  const hasDiscretion = discretion > 0;
  element.textContent = hasDiscretion ? formatCommanderDiscretion(discretion) : "";
  element.classList.toggle("hidden", !hasDiscretion);
}

function updateResultDiscretionText(element, text) {
  element.textContent = text;
  element.classList.toggle("hidden", !text);
}

function getCrewDiscretionMinutes(crewId) {
  return getDurationMinutes(ftlCrewControls[crewId].discretion);
}

function controllingDiscretionText(controllingIds) {
  const entries = controllingIds
    .map((id) => ({ control: ftlCrewControls[id], minutes: getCrewDiscretionMinutes(id) }))
    .filter((entry) => entry.control && entry.minutes > 0);
  if (entries.length === 0) return "";
  if (controllingIds.length === 1) return formatCommanderDiscretion(entries[0].minutes);

  return `${entries
    .map((entry) => `${crewLimitDisplayLabel(entry.control)} ${formatDurationWithZeroMinutes(entry.minutes)}`)
    .join("; ")} Commander's discretion included`;
}

function updateResultDiscretionNotes(text) {
  updateResultDiscretionText(elements.pushbackDiscretion, text);
  updateResultDiscretionText(elements.takeoffDiscretion, text);
}

function controllingCrewSourceLabel(controllingIds) {
  if (!controllingIds.length) return "";
  const labels = controllingIds.map((id) => crewLimitDisplayLabel(ftlCrewControls[id])).filter(Boolean);
  return labels.length > 1 ? `Joint limit: ${labels.join("; ")}` : labels[0];
}

function updateCrewLimitSources(controllingIds, hasFinalSector) {
  const label = controllingIds.length > 1 ? `Joint limit (${controllingIds.length} crew entries)` : controllingCrewSourceLabel(controllingIds);

  [elements.pushbackCrewLimit, elements.takeoffCrewLimit].forEach((element) => {
    element.textContent = hasFinalSector ? label : "";
    element.classList.toggle("hidden", !hasFinalSector || !label);
  });
  elements.onChocksCrewLimit.textContent = label;
  elements.onChocksCrewLimit.classList.toggle("hidden", !label);
}

function crewResultTime(result, property) {
  const value = result?.calculation?.[property] ?? result?.[property];
  return Number.isFinite(value) ? formatZuluTime(value) : "--:--Z";
}

function updateCrewComparison(comparison) {
  const showComparison = comparison.results.length > 1;
  elements.crewResults.classList.toggle("hidden", !showComparison);
  elements.crewResults.setAttribute("aria-hidden", String(!showComparison));
  elements.crewResultRows.replaceChildren();
  elements.crewComparisonStatus.textContent = "";
  elements.crewComparisonStatus.classList.toggle("hidden", comparison.comparisonComplete);
  if (!showComparison) return;

  comparison.results.forEach((result) => {
    const control = ftlCrewControls[result.id];
    const row = document.createElement("div");
    const name = document.createElement("span");
    const dutyStart = document.createElement("strong");
    const allowable = document.createElement("span");
    const allowableValue = document.createElement("strong");
    const discretion = document.createElement("small");
    const onChocks = document.createElement("strong");
    const isLimiting = comparison.controllingIds.includes(result.id);

    row.className = "crew-result-row";
    row.setAttribute("role", "row");
    row.classList.toggle("is-limiting", isLimiting);
    name.className = "crew-result-name";
    name.setAttribute("role", "rowheader");
    name.textContent = crewLimitRoleLabel(control);
    if (crewLimitIsNamed(control) && crewLimitName(control)) {
      const person = document.createElement("small");
      person.className = "crew-result-person";
      person.textContent = crewLimitName(control);
      name.append(person);
    }
    if (isLimiting) {
      const badge = document.createElement("small");
      badge.className = "crew-limiting-badge";
      badge.textContent = comparison.controllingIds.length > 1 ? "Joint limit" : "Limiting";
      name.append(badge);
    }
    dutyStart.setAttribute("role", "cell");
    dutyStart.dataset.label = "Duty start";
    dutyStart.textContent = Number.isFinite(result.dutyStartMinutes) ? formatZuluTime(result.dutyStartMinutes) : "--:--Z";
    allowable.className = "crew-result-fdp";
    allowable.setAttribute("role", "cell");
    allowable.dataset.label = "Allowable FDP";
    allowableValue.textContent = Number.isFinite(result.calculation.maximumAllowableFdpMinutes)
      ? formatDurationWithZeroMinutes(result.calculation.maximumAllowableFdpMinutes)
      : "--";
    discretion.textContent = result.discretionMinutes > 0
      ? `+ ${formatDurationWithZeroMinutes(result.discretionMinutes)} discretion`
      : "No discretion";
    discretion.classList.toggle("crew-discretion-active", result.discretionMinutes > 0);
    allowable.append(allowableValue, discretion);
    onChocks.setAttribute("role", "cell");
    onChocks.dataset.label = "On-chocks";
    onChocks.textContent = crewResultTime(result, "latestOnChocksMinutes");
    row.append(name, dutyStart, allowable, onChocks);
    elements.crewResultRows.append(row);
  });

  if (!comparison.comparisonComplete) {
    const incomplete = comparison.results.filter((result) => !result.complete);
    elements.crewComparisonStatus.textContent = incomplete.length === 1
      ? `${crewLimitDisplayLabel(ftlCrewControls[incomplete[0].id])} incomplete`
      : `${incomplete.length} crew limits incomplete`;
  }
}

function resetFtlResults() {
  elements.latestOnChocks.textContent = "--:--Z";
  ftlLatestOnChocksMinutes = null;
  updateResultDiscretionNote(elements.onChocksDiscretion, 0);
  updateCrewLimitSources([], false);
  resetFinalSectorResults();
}

function resetFinalSectorResults() {
  elements.latestTakeoff.textContent = "--:--Z";
  elements.latestPushback.textContent = "--:--Z";
  updateContingencyNote(elements.pushbackContingency, 0);
  updateContingencyNote(elements.takeoffContingency, 0);
  updateResultDiscretionNotes("");
  elements.pushbackCrewLimit.classList.add("hidden");
  elements.takeoffCrewLimit.classList.add("hidden");
  ftlLatestPushbackMinutes = null;
  ftlLatestTakeoffMinutes = null;
  updateFtlCountdown();
  updateLtotTelegramButton();
}

function buildCrewFtlInput(crewId) {
  const crew = ftlCrewControls[crewId];
  const name = crewLimitName(crew);
  const hasDutyStart = hasDutyStartValue(crewId);
  const hasMaximumFdp = hasDurationValue(crew.maxFdp);
  const hasPartialDiscretion = hasPartialDurationValue(crew.discretion);

  return {
    id: crew.id,
    category: crew.category,
    name,
    dutyDate: crew.dutyDate.value,
    dutyStartMinutes: hasDutyStart ? getDutyStartMinutes(crewId) : null,
    maximumFdpMinutes: hasMaximumFdp && !hasPartialDiscretion
      ? getDurationMinutes(crew.maxFdp)
      : null,
    discretionMinutes: getDurationMinutes(crew.discretion),
  };
}

function updateCrewMaximumAllowableFdp(crewId, calculation) {
  const crew = ftlCrewControls[crewId];
  if (!crew) return;
  const hasMaximumFdp = hasDurationValue(crew.maxFdp);
  const hasPartialDiscretion = hasPartialDurationValue(crew.discretion);

  if (hasMaximumFdp && !hasPartialDiscretion && Number.isFinite(calculation?.maximumAllowableFdpMinutes)) {
    updateMaximumAllowableFdp(
      crew.maxAllowableFdp,
      calculation.maximumAllowableFdpMinutes,
      getDurationMinutes(crew.discretion)
    );
  } else {
    crew.maxAllowableFdp.textContent = "--";
  }
}

function calculateFtl(shouldPersist = true) {
  ftlAnchorDate = window.OpsDeckLtot.isIsoDate(ftlCrewControls.flight?.dutyDate.value) ? ftlCrewControls.flight.dutyDate.value : null;
  const hasFlightTime = hasDurationValue(ftlDurationControls.flightTime);
  const sectorTiming = {
    taxiOutMinutes: getDurationMinutes(ftlDurationControls.taxiOut),
    flightTimeMinutes: hasFlightTime ? getDurationMinutes(ftlDurationControls.flightTime) : null,
    holdingMinutes: getDurationMinutes(ftlDurationControls.holding),
    taxiInMinutes: getDurationMinutes(ftlDurationControls.taxiIn),
    contingencyMinutes: getDurationMinutes(ftlDurationControls.contingency),
  };
  const comparison = window.OpsDeckLtot.calculateCrewLimits({
    anchorId: "flight",
    anchorDate: ftlAnchorDate,
    crewLimits: crewLimitRecords.map((record) => buildCrewFtlInput(record.id)),
    sectorTiming,
  });
  const sectorLength = comparison.results[0]?.calculation?.sectorLengthMinutes ?? 0;
  const contingency = sectorTiming.contingencyMinutes;

  currentCrewComparison = comparison;
  elements.reportingTimeReminder.classList.toggle("hidden", !shouldShowReportingTimeReminder(comparison));
  controllingFtlCrewIds = comparison.controllingIds;
  comparison.results.forEach((result) => updateCrewMaximumAllowableFdp(result.id, result.calculation));
  updateCrewComparison(comparison);
  updateFdpReferenceSelection();
  elements.sectorLength.textContent = hasFlightTime ? formatDurationWithZeroMinutes(sectorLength) : "--";

  const controllingResult = comparison.controllingResult;
  if (!controllingResult) {
    resetFtlResults();
    if (shouldPersist) queueCalculatorSave();
    return;
  }

  const discretionText = comparison.controllingIds.length > 1 && comparison.controllingIds.some((id) => getCrewDiscretionMinutes(id) > 0)
    ? "Discretion: crew comparison."
    : controllingDiscretionText(comparison.controllingIds);
  const latestOnChocks = controllingResult.latestOnChocksMinutes;
  elements.latestOnChocks.textContent = formatZuluTime(latestOnChocks);
  updateResultDiscretionText(elements.onChocksDiscretion, discretionText);
  ftlLatestOnChocksMinutes = latestOnChocks;
  updateCrewLimitSources(comparison.controllingIds, hasFlightTime);

  if (!hasFlightTime) {
    resetFinalSectorResults();
    updateFtlCountdown();
    if (shouldPersist) queueCalculatorSave();
    return;
  }

  const latestTakeoff = controllingResult.latestTakeoffMinutes;
  const latestPushback = controllingResult.latestPushbackMinutes;
  elements.latestTakeoff.textContent = formatZuluTime(latestTakeoff);
  elements.latestPushback.textContent = formatZuluTime(latestPushback);
  updateContingencyNote(elements.pushbackContingency, contingency);
  updateContingencyNote(elements.takeoffContingency, contingency);
  updateResultDiscretionNotes(discretionText);
  ftlLatestPushbackMinutes = latestPushback;
  ftlLatestTakeoffMinutes = latestTakeoff;
  updateFtlCountdown();
  updateLtotTelegramButton();
  if (shouldPersist) queueCalculatorSave();
}

function renderFtlCrewMode() {
  const showCabin = cabinCrewEnabled;
  elements.crewTabsRow.classList.toggle("hidden", !showCabin);
  elements.addCabinCrewButton.classList.toggle("hidden", showCabin);
  elements.addCabinCrewButton.setAttribute("aria-expanded", String(showCabin));

  const cabinActive = showCabin && activeFtlCrew === "cabin";
  elements.flightCrewTab.classList.toggle("active", !cabinActive);
  elements.flightCrewTab.setAttribute("aria-selected", String(!cabinActive));
  elements.cabinCrewTab.classList.toggle("active", cabinActive);
  elements.cabinCrewTab.setAttribute("aria-selected", String(cabinActive));
  elements.flightCrewInputs.classList.toggle("hidden", cabinActive);
  elements.flightCrewInputs.setAttribute("aria-hidden", String(cabinActive));
  elements.cabinCrewInputs.classList.toggle("hidden", !cabinActive);
  elements.cabinCrewInputs.setAttribute("aria-hidden", String(!cabinActive));
  const category = cabinActive ? "cabin" : "flight";
  const atCapacity = !canAddIndividualCrewLimit(category);
  elements.addIndividualCrewButton.disabled = atCapacity;
  elements.addIndividualCrewButton.setAttribute("aria-label", atCapacity
    ? `${crewCategoryLabel(category)} limit reached: ${CREW_LIMIT_CAPS[category]} entries`
    : `Add an individual ${crewCategoryLabel(category)} limit`);
  elements.addIndividualCrewButton.title = atCapacity
    ? `Maximum ${CREW_LIMIT_CAPS[category]} ${crewCategoryLabel(category)} entries, including the original entry`
    : "";
}

function setActiveFtlCrew(crewKey) {
  if (crewKey === "cabin" && !cabinCrewEnabled) return;
  activeFtlCrew = crewKey;
  activeFdpTargetId = ftlCrewControls[crewKey]
    ? crewKey
    : crewLimitRecords.find((record) => record.category === crewKey)?.id || "flight";
  setFdpReferenceTarget(activeFdpTargetId);
}

function addCabinCrew() {
  if (cabinCrewEnabled) return;
  const state = serializeCalculatorState();
  const shared = state.crewLimits.find((record) => record.id === "flight");
  state.crewLimits.push({
    ...createDefaultCrewLimitRecord("cabin", { dutyDate: shared.dutyDate }),
    dutyStart: shared.dutyStart,
    maximumFdp: { ...shared.maximumFdp },
    discretion: { ...shared.discretion },
    selectedFdpReferenceKey: shared.selectedFdpReferenceKey,
  });
  setFtlInputSectionOpen("fdp", true);
  activeFtlCrew = "cabin";
  activeFdpTargetId = "cabin";
  renderCrewLimitRecords(state.crewLimits);
  calculateFtl();
}

function canAddIndividualCrewLimit(category) {
  return crewLimitRecords.filter((record) => record.category === category).length < (CREW_LIMIT_CAPS[category] || 0);
}

function addIndividualCrewLimit() {
  if (!cabinCrewEnabled || !canAddIndividualCrewLimit(activeFtlCrew)) return;
  setFtlInputSectionOpen("fdp", true);
  const state = serializeCalculatorState();
  if (activeFtlCrew === "flight" && !state.crewLimits.some((record) => record.category === "flight" && !record.baseline)) {
    const flight = state.crewLimits.find((record) => record.id === "flight");
    if (!flight.name) flight.name = DEFAULT_FLIGHT_CREW_NAME;
  }
  const record = createDefaultCrewLimitRecord(activeFtlCrew, {
    baseline: false,
    displayNumber: nextCrewNumbers[activeFtlCrew]++,
    dutyDate: ftlCrewControls[activeFtlCrew].dutyDate.value,
  });
  state.crewLimits.push(record);
  activeFdpTargetId = record.id;
  renderCrewLimitRecords(state.crewLimits);
  calculateFtl();
  window.requestAnimationFrame(() => ftlCrewControls[record.id]?.nameInput?.focus());
}

function removeIndividualCrewLimit(crewId) {
  const record = crewLimitRecords.find((candidate) => candidate.id === crewId && candidate.baseline === false);
  const control = ftlCrewControls[crewId];
  if (!record || !control) return;
  const label = crewLimitDisplayLabel(control);
  if (crewLimitHasData(control) && !window.confirm(`Remove the individual crew limit for ${label}?`)) return;

  const state = serializeCalculatorState();
  state.crewLimits = state.crewLimits.filter((candidate) => candidate.id !== crewId);
  if (activeFdpTargetId === crewId) activeFdpTargetId = record.category;
  renderCrewLimitRecords(state.crewLimits);
  calculateFtl();
}

function removeCabinCrew() {
  if (!cabinCrewEnabled) return;
  const state = serializeCalculatorState();
  const separateControls = crewLimitRecords
    .filter((record) => record.id !== "flight")
    .map((record) => ftlCrewControls[record.id]);
  const hasSeparateData = separateControls.some(crewLimitHasData);
  const retainedCrew = ftlCrewControls.flight;
  const retainedName = crewLimitIsNamed(retainedCrew) ? crewLimitName(retainedCrew) : "";
  const retainedLabel = `${crewLimitRoleLabel(retainedCrew)}${retainedName ? ` (${retainedName})` : ""}`;
  if (hasSeparateData && !window.confirm(`Use shared crew limit? Separate and individual crew inputs will be removed. All crew will use the values entered for ${retainedLabel}.`)) return;
  state.crewLimits = state.crewLimits.filter((record) => record.id === "flight");
  activeFtlCrew = "flight";
  activeFdpTargetId = "flight";
  renderCrewLimitRecords(state.crewLimits);
  calculateFtl();
}

function setupFtlCalculator() {
  const saved = loadCalculatorEnvelope();
  calculatorLocalDirty = saved.dirty;
  calculatorLocalBaseUpdatedAt = saved.baseUpdatedAt;
  calculatorCloudUpdatedAt = saved.baseUpdatedAt;
  Object.values(ftlDurationControls).forEach(setupDurationControl);
  crewLimitRecords = saved.state.crewLimits;
  ftlAnchorDate = saved.state.anchorDate;
  nextCrewNumbers = saved.state.nextCrewNumbers;
  applySectorTimingState(saved.state.sectorTiming);
  renderCrewLimitRecords(saved.state.crewLimits);
  renderFdpReferenceTables();
  elements.addCabinCrewButton.addEventListener("click", addCabinCrew);
  elements.addIndividualCrewButton.addEventListener("click", addIndividualCrewLimit);
  elements.removeCabinCrewButton.addEventListener("click", removeCabinCrew);
  elements.flightCrewTab.addEventListener("click", () => setActiveFtlCrew("flight"));
  elements.cabinCrewTab.addEventListener("click", () => setActiveFtlCrew("cabin"));
  elements.fdpTargetSelect.addEventListener("change", () => setFdpReferenceTarget(elements.fdpTargetSelect.value, true));
  elements.fdpReferenceReturnButton.addEventListener("click", returnToFdpInput);
  elements.fdpReferenceStatus.addEventListener("pointerenter", () => window.clearTimeout(fdpReferenceStatusTimer));
  elements.fdpReferenceStatus.addEventListener("pointerleave", scheduleFdpReferenceDismiss);
  elements.fdpReferenceStatus.addEventListener("focusin", () => window.clearTimeout(fdpReferenceStatusTimer));
  elements.fdpReferenceStatus.addEventListener("focusout", scheduleFdpReferenceDismiss);
  elements.reportingTimeReminder.addEventListener("click", openReportingTimeClarification);
  ["fdp", "sector"].forEach((section) => {
    const toggle = elements[`${section}InputsToggle`];
    toggle.addEventListener("click", () => setFtlInputSectionOpen(section, toggle.getAttribute("aria-expanded") !== "true"));
  });
  renderFtlCrewMode();
  calculatorInitialised = true;
  calculateFtl(false);
  saveCalculatorEnvelope();
  window.clearInterval(ftlCountdownTimer);
  ftlCountdownTimer = window.setInterval(updateFtlCountdown, 1000);
  const updateStickyOffsets = () => {
    elements.ftlView.style.setProperty("--ftl-nav-height", `${elements.toolMenu.getBoundingClientRect().height}px`);
    elements.ftlView.style.setProperty("--ftl-summary-height", `${elements.ftlMobileResultStrip.getBoundingClientRect().height}px`);
  };
  const stickyObserver = new ResizeObserver(updateStickyOffsets);
  stickyObserver.observe(elements.toolMenu);
  stickyObserver.observe(elements.ftlMobileResultStrip);
  updateStickyOffsets();
}

function releaseFtlPickerFocus(event) {
  const focusedControl = document.activeElement;
  if (!(focusedControl instanceof HTMLElement)) return;
  if (!elements.ftlForm.contains(focusedControl)) return;
  if (!focusedControl.matches('select, input[type="time"], input[type="date"]')) return;
  if (focusedControl === event.target || focusedControl.contains(event.target)) return;

  focusedControl.blur();
}

function clearFtlCalculator() {
  const confirmed = window.confirm("Reset all crew limits and final sector inputs?");
  if (!confirmed) return;

  setFtlInputSectionOpen("fdp", true);
  setFtlInputSectionOpen("sector", true);
  window.clearTimeout(fdpReferenceStatusTimer);
  elements.fdpReferenceStatus?.classList.add("hidden");
  const state = createDefaultCalculatorState();
  ftlAnchorDate = state.crewLimits[0].dutyDate;
  nextCrewNumbers = state.nextCrewNumbers;
  applySectorTimingState(state.sectorTiming);
  activeFtlCrew = "flight";
  activeFdpTargetId = "flight";
  controllingFtlCrewIds = [];
  currentCrewComparison = null;
  renderCrewLimitRecords(state.crewLimits);
  calculateFtl();
}

function openBdxInfo() {
  elements.bdxInfoDialog?.classList.remove("hidden");
  elements.bdxInfoCloseButton?.focus();
}

function closeBdxInfo() {
  elements.bdxInfoDialog?.classList.add("hidden");
  elements.bdxInfoButton?.focus();
}

function openElapsedInfo(event) {
  elapsedInfoTrigger = event?.currentTarget || null;
  elements.elapsedInfoDialog?.classList.remove("hidden");
  elements.elapsedInfoCloseButton?.focus();
}

function closeElapsedInfo() {
  elements.elapsedInfoDialog?.classList.add("hidden");
  elapsedInfoTrigger?.focus();
  elapsedInfoTrigger = null;
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
  return loadRequestEnvelope().requests;
}

function persistLoadedRequestEnvelope(envelope) {
  try {
    localStorage.setItem(REQUESTS_ENVELOPE_KEY, JSON.stringify(envelope));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope.requests));
  } catch {
    // Loading can continue with the retained in-memory copy if device storage is unavailable.
  }
}

function loadRequestEnvelope() {
  try {
    const saved = JSON.parse(localStorage.getItem(REQUESTS_ENVELOPE_KEY) || "null");
    if (saved && Array.isArray(saved.requests)) {
      const envelope = {
        requests: sanitizeRequests(saved.requests),
        dirty: Boolean(saved.dirty),
        baseUpdatedAt: saved.baseUpdatedAt || null,
      };
      persistLoadedRequestEnvelope(envelope);
      return envelope;
    }

    const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    const envelope = {
      requests: sanitizeRequests(Array.isArray(legacy) ? legacy : []),
      dirty: false,
      baseUpdatedAt: null,
    };
    persistLoadedRequestEnvelope(envelope);
    return envelope;
  } catch {
    return { requests: [], dirty: false, baseUpdatedAt: null };
  }
}

function saveRequestEnvelope() {
  try {
    const sanitized = sanitizeRequests(requests);
    localStorage.setItem(REQUESTS_ENVELOPE_KEY, JSON.stringify({
      requests: sanitized,
      dirty: requestLocalDirty,
      baseUpdatedAt: requestLocalBaseUpdatedAt,
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
    return true;
  } catch {
    setSyncStatus("This device could not store the latest changes.", true);
    return false;
  }
}

function saveRequests() {
  requestChangeRevision += 1;
  requestLocalDirty = true;
  if (cloudLoaded) requestLocalBaseUpdatedAt = cloudUpdatedAt;
  saveRequestEnvelope();

  if (!navigator.onLine || !supabaseClient || !currentUser || !cloudLoaded) {
    setSyncStatus("Changes saved on this device · waiting for cloud", false, true);
  }
  queueCloudSave();
}

function normalizeStaffEntry(entry) {
  if (typeof entry === "string") {
    const name = normalizeText(entry);
    return name ? { name, baid: false } : null;
  }

  if (!entry || typeof entry !== "object") return null;

  const name = normalizeText(String(entry.name || ""));
  if (!name) return null;

  return {
    name,
    baid: Boolean(entry.baid),
  };
}

function staffName(entry) {
  return typeof entry === "string" ? normalizeText(entry) : normalizeText(String(entry?.name || ""));
}

function staffHasBaid(entry) {
  return typeof entry === "object" && Boolean(entry?.baid);
}

function sanitizeRequests(value) {
  if (!Array.isArray(value)) return [];

  const sanitized = value
    .filter((request) => request.date && request.flightNumber && Array.isArray(request.staff))
    .map((request) => ({
      id: request.id || createId(),
      date: request.date,
      flightNumber: normalizeText(String(request.flightNumber)).toUpperCase(),
      departureTime: request.departureTime || "",
      availableSeats: request.availableSeats ?? null,
      routeFrom: normalizeText(String(request.routeFrom || "")).toUpperCase(),
      routeTo: normalizeText(String(request.routeTo || "")).toUpperCase(),
      staff: request.staff.slice(0, MAX_REQUESTS_PER_FLIGHT).map(normalizeStaffEntry).filter(Boolean),
      notes: normalizeText(String(request.notes || "")),
      updatedAt: request.updatedAt || new Date().toISOString(),
    }));

  return window.OpsDeckRetention.partitionRequests(sanitized, {
    retentionDays: REQUEST_RETENTION_DAYS,
  }).retained;
}

function queueCloudSave(delay = 350) {
  if (!requestLocalDirty || isOfflineReadOnly || !navigator.onLine || !supabaseClient || !currentUser || !cloudLoaded) return;

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveCloudRequests();
  }, delay);
}

function scheduleRequestRetry() {
  if (!requestLocalDirty || !navigator.onLine || !currentUser || !cloudLoaded || pendingRequestConflict) return;
  const delays = [2000, 5000, 15000, 30000];
  const delay = delays[Math.min(requestRetryAttempt, delays.length - 1)];
  requestRetryAttempt += 1;
  window.clearTimeout(requestRetryTimer);
  setSyncStatus("Changes not yet synced · retrying automatically", false, true);
  requestRetryTimer = window.setTimeout(() => saveCloudRequests(), delay);
}

function downloadTextFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function downloadJsonFile(filename, value) {
  downloadTextFile(filename, JSON.stringify(value, null, 2), "application/json");
}

function backupTimestamp() {
  return new Date().toISOString().replace(/[:]/g, "").slice(0, 15);
}

function setDataStatus(message = "", isError = false, isSuccess = false) {
  elements.dataStatus.textContent = message;
  elements.dataStatus.classList.toggle("status-error", isError);
  elements.dataStatus.classList.toggle("status-success", isSuccess);
}

function buildPortableBackup() {
  return window.OpsDeckData.buildBackup({
    appVersion: APP_VERSION,
    requests: sanitizeRequests(requests),
    calculatorState: serializeCalculatorState(),
  });
}

function exportJsonBackup() {
  downloadJsonFile(`opsdeck-backup-${backupTimestamp()}.json`, buildPortableBackup());
  setDataStatus("JSON backup downloaded.", false, true);
}

function exportCsvBackup() {
  downloadTextFile(
    `opsdeck-jumpseat-${backupTimestamp()}.csv`,
    window.OpsDeckData.requestsToCsv(sanitizeRequests(requests)),
    "text/csv;charset=utf-8"
  );
  setDataStatus("CSV export downloaded.", false, true);
}

async function restoreJsonBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const backup = window.OpsDeckData.parseBackup(await file.text());
    const restoredRequests = sanitizeRequests(backup.jumpseatRequests);
    const restoredCalculator = sanitizeCalculatorState(backup.calculatorState);
    const confirmed = window.confirm(
      `Restore ${restoredRequests.length} ${pluralize(restoredRequests.length, "flight")} and the saved FDP and LTOT inputs? This replaces the current data on this account.`
    );
    if (!confirmed) {
      setDataStatus("Restore cancelled.");
      return;
    }

    requests = restoredRequests;
    applyCalculatorState(restoredCalculator);
    saveRequests();
    queueCalculatorSave();
    render();
    setDataStatus("Backup restored. Cloud synchronisation is in progress.", false, true);
  } catch (error) {
    setDataStatus(error.message || "The backup could not be restored.", true);
  } finally {
    event.target.value = "";
  }
}

function closeRequestConflictDialog() {
  elements.requestConflictDialog?.classList.add("hidden");
  pendingRequestConflict = null;
}

function showRequestConflict(localRequests, cloudRequests, latestCloudUpdatedAt) {
  pendingRequestConflict = {
    localRequests: sanitizeRequests(localRequests),
    cloudRequests: sanitizeRequests(cloudRequests),
    cloudUpdatedAt: latestCloudUpdatedAt || null,
  };
  elements.requestConflictSummary.textContent = `This device has ${localRequests.length} ${pluralize(localRequests.length, "flight")} and the cloud has ${cloudRequests.length}. Choose which copy to keep.`;
  elements.requestConflictDialog.classList.remove("hidden");
  elements.useCloudConflictButton.focus();
}

function useCloudConflictCopy() {
  if (!pendingRequestConflict) return;
  requests = pendingRequestConflict.cloudRequests;
  cloudUpdatedAt = pendingRequestConflict.cloudUpdatedAt;
  requestLocalBaseUpdatedAt = cloudUpdatedAt;
  requestLocalDirty = false;
  cloudLoaded = true;
  requestRetryAttempt = 0;
  saveRequestEnvelope();
  closeRequestConflictDialog();
  render();
  setCloudSuccessStatus();
}

async function keepDeviceConflictCopy() {
  if (!pendingRequestConflict) return;
  requests = pendingRequestConflict.localRequests;
  cloudUpdatedAt = pendingRequestConflict.cloudUpdatedAt;
  requestLocalBaseUpdatedAt = cloudUpdatedAt;
  requestLocalDirty = true;
  cloudLoaded = true;
  saveRequestEnvelope();
  closeRequestConflictDialog();
  render();
  await saveCloudRequests();
}

function downloadRequestConflictCopies() {
  if (!pendingRequestConflict) return;
  downloadJsonFile(`opsdeck-conflict-${new Date().toISOString().slice(0, 10)}.json`, {
    exportedAt: new Date().toISOString(),
    deviceCopy: pendingRequestConflict.localRequests,
    cloudCopy: pendingRequestConflict.cloudRequests,
    cloudUpdatedAt: pendingRequestConflict.cloudUpdatedAt,
  });
}

async function handleCloudConflict() {
  cloudLoaded = false;
  window.clearTimeout(saveTimer);
  window.clearTimeout(requestRetryTimer);
  setSyncStatus("Cloud changed on another device · review required", true);

  const { data, error } = await supabaseClient
    .from("jumpseat_data")
    .select("requests, updated_at")
    .eq("user_id", currentUser.id)
    .maybeSingle();
  if (error || !Array.isArray(data?.requests)) {
    setSyncStatus("Cloud changed on another device. Refresh when the connection is stable.", true);
    return;
  }

  showRequestConflict(requests, data.requests, data.updated_at);
}

async function saveCloudRequests() {
  if (!supabaseClient || !currentUser || !cloudLoaded || !navigator.onLine || !requestLocalDirty) return;
  if (requestSaveInFlight || pendingRequestConflict) return;

  requestSaveInFlight = true;
  const saveRevision = requestChangeRevision;
  const saveUserId = currentUser.id;
  const requestSnapshot = sanitizeRequests(requests);
  let shouldSaveAgain = false;
  setSyncStatus("Saving...");
  const nextUpdatedAt = new Date().toISOString();
  const payload = {
    requests: requestSnapshot,
    updated_at: nextUpdatedAt,
  };

  const query = cloudUpdatedAt
    ? supabaseClient
        .from("jumpseat_data")
        .update(payload)
        .eq("user_id", saveUserId)
        .eq("updated_at", cloudUpdatedAt)
    : supabaseClient
        .from("jumpseat_data")
        .insert({ user_id: saveUserId, ...payload });

  try {
    const { data, error } = await query.select("updated_at").maybeSingle();

    if (error) {
      if (error.code === "23505") {
        await handleCloudConflict();
        return;
      }
      setSyncStatus(
        isRateLimitError(error.message || "")
          ? "Cloud save delayed · retrying automatically"
          : "Cloud save interrupted · retrying automatically",
        false,
        true
      );
      scheduleRequestRetry();
      return;
    }

    if (!data) {
      await handleCloudConflict();
      return;
    }

    cloudUpdatedAt = data.updated_at || nextUpdatedAt;
    requestLocalBaseUpdatedAt = cloudUpdatedAt;
    requestLocalDirty = requestChangeRevision !== saveRevision;
    requestRetryAttempt = 0;
    saveRequestEnvelope();
    shouldSaveAgain = requestLocalDirty;
    setCloudSuccessStatus();
  } catch {
    scheduleRequestRetry();
  } finally {
    requestSaveInFlight = false;
    if (shouldSaveAgain && currentUser?.id === saveUserId) queueCloudSave(100);
  }
}

function handleCalculatorCloudConflict() {
  calculatorCloudLoaded = false;
  window.clearTimeout(calculatorSaveTimer);
  setSyncStatus("Calculator changed on another device. Tap Refresh before saving again.", true);
  window.alert("The FDP and LTOT calculator changed on another device. This device has kept its local inputs, but it will not overwrite the newer cloud copy. Review anything you need, then tap Refresh to load the cloud version.");
}

async function saveCloudCalculatorState() {
  if (!supabaseClient || !currentUser || !calculatorCloudLoaded || !navigator.onLine) return;
  if (calculatorSaveInFlight) return;

  calculatorSaveInFlight = true;
  const saveRevision = calculatorChangeRevision;
  const saveUserId = currentUser.id;
  let shouldSaveAgain = false;
  setSyncStatus("Saving...");
  const nextUpdatedAt = new Date().toISOString();
  const payload = {
    state: serializeCalculatorState(),
    updated_at: nextUpdatedAt,
  };
  const query = calculatorCloudUpdatedAt
    ? supabaseClient
        .from("opsdeck_calculator_state")
        .update(payload)
        .eq("user_id", saveUserId)
        .eq("updated_at", calculatorCloudUpdatedAt)
    : supabaseClient
        .from("opsdeck_calculator_state")
        .insert({ user_id: saveUserId, ...payload });

  try {
    const { data, error } = await query.select("updated_at").maybeSingle();

    if (error) {
      if (isRateLimitError(error.message || "")) {
        scheduleCalculatorRetry();
        return;
      }
      if (error.code === "23505") {
        handleCalculatorCloudConflict();
        return;
      }
      scheduleCalculatorRetry();
      return;
    }

    if (!data) {
      handleCalculatorCloudConflict();
      return;
    }

    calculatorCloudUpdatedAt = data.updated_at || nextUpdatedAt;
    calculatorLocalBaseUpdatedAt = calculatorCloudUpdatedAt;
    calculatorLocalDirty = calculatorChangeRevision !== saveRevision;
    calculatorRetryAttempt = 0;
    shouldSaveAgain = calculatorLocalDirty;
    saveCalculatorEnvelope();
    setCloudSuccessStatus();
  } catch (error) {
    scheduleCalculatorRetry();
  } finally {
    calculatorSaveInFlight = false;
    if (shouldSaveAgain && navigator.onLine && currentUser?.id === saveUserId && calculatorCloudLoaded) {
      window.clearTimeout(calculatorSaveTimer);
      calculatorSaveTimer = window.setTimeout(() => {
        saveCloudCalculatorState();
      }, 100);
    }
  }
}

async function loadCloudCalculatorState(options = {}) {
  if (!supabaseClient || !currentUser || !navigator.onLine) return;

  const forceCloud = Boolean(options.forceCloud);
  const local = loadCalculatorEnvelope();
  calculatorCloudLoaded = false;
  setSyncStatus("Loading calculator data...");
  const { data, error } = await supabaseClient
    .from("opsdeck_calculator_state")
    .select("state, updated_at")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    calculatorLocalDirty = local.dirty;
    calculatorLocalBaseUpdatedAt = local.baseUpdatedAt;
    setSyncStatus("Calculator cloud unavailable: local inputs retained", false, true);
    return;
  }

  if (data?.state && local.dirty && !forceCloud) {
    if (local.baseUpdatedAt !== data.updated_at) {
      calculatorCloudUpdatedAt = data.updated_at || null;
      handleCalculatorCloudConflict();
      return;
    }

    applyCalculatorState(local.state);
    calculatorCloudLoaded = true;
    calculatorCloudUpdatedAt = data.updated_at || null;
    calculatorLocalBaseUpdatedAt = calculatorCloudUpdatedAt;
    calculatorLocalDirty = true;
    saveCalculatorEnvelope();
    await saveCloudCalculatorState();
    return;
  }

  if (data?.state) {
    applyCalculatorState(data.state);
    calculatorCloudLoaded = true;
    calculatorCloudUpdatedAt = data.updated_at || null;
    calculatorLocalBaseUpdatedAt = calculatorCloudUpdatedAt;
    calculatorLocalDirty = false;
    saveCalculatorEnvelope();
    setCloudSuccessStatus();
    return;
  }

  applyCalculatorState(local.state);
  calculatorCloudLoaded = true;
  calculatorCloudUpdatedAt = null;
  calculatorLocalBaseUpdatedAt = null;
  calculatorLocalDirty = true;
  saveCalculatorEnvelope();
  await saveCloudCalculatorState();
}

async function loadCloudRequests(options = {}) {
  if (!supabaseClient || !currentUser) return;

  if (!navigator.onLine) {
    startOfflineMode();
    return;
  }

  const forceCloud = Boolean(options.forceCloud);
  const local = loadRequestEnvelope();
  cloudLoaded = false;
  setSyncStatus("Loading cloud data...");

  const { data, error } = await supabaseClient
    .from("jumpseat_data")
    .select("requests, updated_at")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    requestLocalDirty = local.dirty;
    requestLocalBaseUpdatedAt = local.baseUpdatedAt;
    startOfflineMode(navigator.onLine ? "Cloud unavailable: viewing saved data" : "Offline: viewing saved data");
    return;
  }

  if (Array.isArray(data?.requests)) {
    if (local.dirty && !forceCloud) {
      if (local.baseUpdatedAt !== data.updated_at) {
        cloudUpdatedAt = data.updated_at || null;
        await handleCloudConflict();
        render();
        return;
      }

      requests = local.requests;
      cloudLoaded = true;
      cloudUpdatedAt = data.updated_at || null;
      requestLocalBaseUpdatedAt = cloudUpdatedAt;
      requestLocalDirty = true;
      saveRequestEnvelope();
      await saveCloudRequests();
      render();
      return;
    }

    requests = sanitizeRequests(data.requests);
    cloudLoaded = true;
    cloudUpdatedAt = data.updated_at || null;
    requestLocalBaseUpdatedAt = cloudUpdatedAt;
    requestLocalDirty = false;
    requestRetryAttempt = 0;
    saveRequestEnvelope();
    setCloudSuccessStatus();
  } else {
    requests = local.requests;
    cloudLoaded = true;
    cloudUpdatedAt = null;
    requestLocalBaseUpdatedAt = null;
    requestLocalDirty = true;
    saveRequestEnvelope();
    await saveCloudRequests();
  }

  render();
}

function normalizeText(value) {
  return value.trim().replace(/\s+/g, " ");
}

function readJumpseatDraft() {
  try {
    const draft = JSON.parse(localStorage.getItem(JUMPSEAT_DRAFT_KEY) || "null");
    if (!draft || draft.schemaVersion !== JUMPSEAT_DRAFT_SCHEMA_VERSION) return null;

    const ownerId = currentUser?.id || null;
    if (draft.ownerId && draft.ownerId !== ownerId) return null;
    if (!draft.ownerId && ownerId && !IS_LOCAL_PREVIEW) return null;
    return draft;
  } catch (_error) {
    return null;
  }
}

function clearJumpseatDraft() {
  try {
    localStorage.removeItem(JUMPSEAT_DRAFT_KEY);
  } catch (_error) {
    // The form can still be cleared when browser storage is unavailable.
  }
}

function collectJumpseatDraft() {
  return {
    schemaVersion: JUMPSEAT_DRAFT_SCHEMA_VERSION,
    ownerId: currentUser?.id || null,
    editingId: elements.editingId.value,
    date: elements.requestDate.value,
    flightNumber: elements.flightNumber.value,
    departureTime: elements.departureTime.value,
    availableSeats: elements.availableSeats.value,
    routeFrom: elements.routeFrom.value,
    routeTo: elements.routeTo.value,
    staff: getStaffValues(),
    notes: elements.notes.value,
    savedAt: new Date().toISOString(),
  };
}

function hasMeaningfulJumpseatDraft(draft = collectJumpseatDraft()) {
  return Boolean(
    draft.editingId ||
    String(draft.flightNumber || "").trim() ||
    String(draft.departureTime || "").trim() ||
    String(draft.availableSeats || "").trim() ||
    String(draft.routeFrom || "").trim() ||
    String(draft.routeTo || "").trim() ||
    String(draft.notes || "").trim() ||
    (Array.isArray(draft.staff) && draft.staff.some((entry) => staffName(entry)))
  );
}

function persistJumpseatDraft() {
  const draft = collectJumpseatDraft();
  if (!hasMeaningfulJumpseatDraft(draft)) {
    clearJumpseatDraft();
    return;
  }

  try {
    localStorage.setItem(JUMPSEAT_DRAFT_KEY, JSON.stringify(draft));
  } catch (_error) {
    // An in-memory draft remains available until the page is closed.
  }
}

function applyJumpseatDraft(draft) {
  if (!draft || !hasMeaningfulJumpseatDraft(draft)) return false;

  const isExistingEdit = Boolean(draft.editingId && requests.some((request) => request.id === draft.editingId));
  elements.editingId.value = isExistingEdit ? draft.editingId : "";
  elements.requestDate.value = isIsoDate(draft.date) ? draft.date : (elements.selectedDate.value || todayIso());
  elements.flightNumber.value = String(draft.flightNumber || "");
  elements.departureTime.value = sanitizeStoredTime(draft.departureTime);
  const availableSeats = Number(draft.availableSeats);
  elements.availableSeats.value = Number.isInteger(availableSeats) && availableSeats >= 0 && availableSeats <= 99
    ? String(availableSeats)
    : "";
  elements.routeFrom.value = String(draft.routeFrom || "");
  elements.routeTo.value = String(draft.routeTo || "");
  renderStaffFields(Array.isArray(draft.staff) && draft.staff.length ? draft.staff : [""]);
  elements.notes.value = String(draft.notes || "");
  elements.formTitle.textContent = isExistingEdit ? "Edit request" : "Add request";
  elements.saveButton.textContent = isExistingEdit ? "Update request" : "Save request";
  clearValidation();
  return true;
}

function getStaffInputs() {
  return Array.from(elements.staffFields.querySelectorAll(".staff-input"));
}

function getStaffBaidInputs() {
  return Array.from(elements.staffFields.querySelectorAll(".staff-baid"));
}

function requestValidationEntries() {
  return [
    { field: elements.requestDate, label: "date", message: "Select the date." },
    { field: elements.flightNumber, label: "flight number", message: "Enter the flight number." },
    { field: elements.routeFrom, label: "from", message: "Enter the departure airport." },
    { field: elements.routeTo, label: "to", message: "Enter the destination airport." },
    { field: elements.departureTime, label: "departure time", message: "Select the Zulu departure time." },
    ...getStaffInputs().map((field, index) => ({
      field,
      label: `request ${index + 1} name`,
      message: `Enter request ${index + 1} name.`,
    })),
  ];
}

function requestFieldError(field) {
  const errorId = field.getAttribute("aria-describedby")?.split(/\s+/).find(Boolean);
  return errorId ? document.getElementById(errorId) : null;
}

function clearFieldValidation(field) {
  field.classList.remove("invalid");
  field.setAttribute("aria-invalid", "false");
  const error = requestFieldError(field);
  if (error?.classList.contains("request-field-error")) error.textContent = "";
}

function setFieldValidationError(field, message) {
  field.classList.add("invalid");
  field.setAttribute("aria-invalid", "true");
  const error = requestFieldError(field);
  if (error?.classList.contains("request-field-error")) error.textContent = message;
}

function updateValidationSummary() {
  const missing = requestValidationEntries()
    .filter(({ field }) => field.classList.contains("invalid"))
    .map(({ label }) => label);

  if (missing.length === 0) {
    elements.formError.classList.add("hidden");
    elements.formError.textContent = "";
    return;
  }

  showFormError(`Please complete: ${missing.join(", ")}.`);
}

function clearValidation() {
  requestValidationEntries().forEach(({ field }) => clearFieldValidation(field));
  updateValidationSummary();
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

  const missing = requestValidationEntries().filter(({ field }) => !field.value.trim());
  missing.forEach(({ field, message }) => setFieldValidationError(field, message));
  updateValidationSummary();
  if (missing.length === 0) return true;

  missing[0].field.focus();
  return false;
}

function getStaffValues() {
  const baidInputs = getStaffBaidInputs();
  return getStaffInputs().map((input, index) => ({
    name: input.value,
    baid: Boolean(baidInputs[index]?.checked),
  }));
}

function moveStaffField(fromIndex, toIndex) {
  const values = getStaffValues();
  if (toIndex < 0 || toIndex >= values.length) return;
  [values[fromIndex], values[toIndex]] = [values[toIndex], values[fromIndex]];
  renderStaffFields(values);
  persistJumpseatDraft();
  getStaffInputs()[toIndex]?.focus();
}

function renderStaffFields(values = [""]) {
  const visibleValues = values.length
    ? values.slice(0, MAX_REQUESTS_PER_FLIGHT).map((value) => normalizeStaffEntry(value) || { name: "", baid: false })
    : [{ name: "", baid: false }];
  elements.staffFields.innerHTML = "";

  visibleValues.forEach((value, index) => {
    const row = document.createElement("div");
    const entry = document.createElement("div");
    const label = document.createElement("label");
    const input = document.createElement("input");
    const error = document.createElement("small");
    const baidLabel = document.createElement("label");
    const baidInput = document.createElement("input");
    const baidText = document.createElement("span");

    row.className = visibleValues.length > 1 || index > 0 ? "staff-row has-controls" : "staff-row";
    entry.className = "staff-entry";
    label.textContent = `Request ${index + 1}`;
    input.className = "staff-input";
    input.name = `staff${index + 1}`;
    input.type = "text";
    input.placeholder = "Name";
    input.autocomplete = "off";
    input.autocapitalize = "words";
    input.setAttribute("aria-describedby", `staffError${index + 1}`);
    input.setAttribute("aria-invalid", "false");
    input.value = value.name;
    input.required = true;
    input.addEventListener("input", () => {
      clearFieldValidation(input);
      updateValidationSummary();
      updateAddRequestButton();
      persistJumpseatDraft();
    });

    error.className = "field-error request-field-error";
    error.id = `staffError${index + 1}`;

    baidLabel.className = "baid-toggle";
    baidInput.className = "staff-baid";
    baidInput.name = `staffBaid${index + 1}`;
    baidInput.type = "checkbox";
    baidInput.checked = value.baid;
    baidInput.addEventListener("change", persistJumpseatDraft);
    baidText.textContent = "BA ID";

    label.append(input, error);
    baidLabel.append(baidInput, baidText);
    entry.append(label, baidLabel);
    row.append(entry);

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
  updateValidationSummary();
}

function removeStaffField(indexToRemove) {
  const values = getStaffValues().filter((_, index) => index !== indexToRemove);
  renderStaffFields(values.length ? values : [""]);
  persistJumpseatDraft();
}

function getFormData() {
  return {
    id: elements.editingId.value || createId(),
    date: elements.requestDate.value,
    flightNumber: normalizeText(elements.flightNumber.value).toUpperCase(),
    departureTime: elements.departureTime.value,
    availableSeats: elements.availableSeats.value === "" ? null : Number(elements.availableSeats.value),
    routeFrom: normalizeText(elements.routeFrom.value).toUpperCase(),
    routeTo: normalizeText(elements.routeTo.value).toUpperCase(),
    staff: getStaffValues().map(normalizeStaffEntry).filter(Boolean),
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
  renderStaffFields();
  clearValidation();
}

function focusJumpseatForm() {
  const firstIncomplete = requestValidationEntries().find(({ field }) => !field.value.trim())?.field;
  (firstIncomplete || elements.flightNumber).focus();
}

function startAdd() {
  if (isOfflineReadOnly) {
    window.alert("Offline mode is view only. Connect to the internet to add requests.");
    return;
  }

  const restoredDraft = applyJumpseatDraft(readJumpseatDraft());
  if (!restoredDraft) clearForm();
  setActiveTab("add");
  focusJumpseatForm();
}

function setSelectedDate(iso) {
  const safeDate = isIsoDate(iso) ? iso : todayIso();
  elements.selectedDate.value = safeDate;
  elements.requestDate.value = safeDate;
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
    ...request.staff.map((entry) => `${staffName(entry)} ${staffHasBaid(entry) ? "BA ID" : ""}`),
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
    detail.textContent = `${formatDepartureTime(request.departureTime)} · ${request.routeFrom} to ${request.routeTo} · ${request.staff.map(staffName).join(", ")}`;
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
    const copy = document.createElement("p");

    empty.className = "empty-state";
    copy.innerHTML = "<strong>No requests for this day</strong>Add the first jumpseat request for the selected date.";
    empty.append(copy);
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
    request.staff.forEach((staffEntry) => {
      const item = document.createElement("li");
      const name = document.createElement("span");

      name.textContent = staffName(staffEntry);
      item.append(name);

      if (staffHasBaid(staffEntry)) {
        const baidBadge = document.createElement("span");
        baidBadge.className = "baid-badge";
        baidBadge.textContent = "BA ID";
        item.append(baidBadge);
      }

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

  const draft = readJumpseatDraft();
  if (draft && hasMeaningfulJumpseatDraft(draft)) {
    if (draft.editingId === id) {
      applyJumpseatDraft(draft);
      setActiveTab("add");
      focusJumpseatForm();
      return;
    }

    const replaceDraft = window.confirm("Replace the unfinished Jumpseat request on this device with this saved request?");
    if (!replaceDraft) return;
  }
  clearJumpseatDraft();

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
  persistJumpseatDraft();
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
  if (elements.editingId.value === id) {
    clearJumpseatDraft();
    clearForm();
  }
  render();
}

async function handleSession(session) {
  const user = session?.user || null;
  const isSameLoadedUser = user?.id && user.id === currentUser?.id && cloudLoaded && calculatorCloudLoaded;

  setSignedInState(user);
  if (user && !isSameLoadedUser) {
    await loadCloudRequests();
    await loadCloudCalculatorState();
  }
  if (user && (notocPolicyLoadedUserId !== user.id || notocPolicySource !== "cloud")) {
    await loadNotocPolicy();
  }
  if (user) refreshTelegramStatus();
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

async function signOut(message = "Sign in to load and save your OpsDeck data.") {
  window.OpsDeckGpsUi?.forget();
  setSyncStatus("Signing out...");
  manualSignOutInProgress = true;

  try {
    if (supabaseClient && navigator.onLine) {
      await supabaseClient.auth.signOut().catch(() => {});
    }

    cloudLoaded = false;
    cloudUpdatedAt = null;
    calculatorCloudLoaded = false;
    calculatorCloudUpdatedAt = calculatorLocalBaseUpdatedAt;
    setSignedInState(null);
    setAuthStatus(message, false);
  } finally {
    manualSignOutInProgress = false;
  }
}

async function refreshCloudData() {
  if (!currentUser) return;
  if (requestLocalDirty || calculatorLocalDirty) {
    const confirmed = window.confirm("Refresh will replace this device's unsaved Jumpseat, FDP and LTOT changes with the cloud copy. Continue?");
    if (!confirmed) return;
  }
  await loadCloudRequests({ forceCloud: true });
  await loadCloudCalculatorState({ forceCloud: true });
  await loadNotocPolicy({ forceCloud: true });
  await window.OpsDeckGpsUi?.load({ force: true });
}

function setTelegramStatus(message, isError = false, isSuccess = false, isWarning = false) {
  elements.telegramStatus.textContent = message;
  elements.telegramStatus.classList.toggle("status-error", isError);
  elements.telegramStatus.classList.toggle("status-success", isSuccess);
  elements.telegramStatus.classList.toggle("status-warning", isWarning);
}

function resetTelegramPanel() {
  telegramLinked = false;
  telegramBotConfigured = false;
  telegramLtotSupported = false;
  elements.telegramLinkState.textContent = "Not linked";
  elements.telegramBotState.textContent = "Service unavailable";
  elements.telegramPairingExpiry.textContent = "Not started";
  elements.telegramPairingCode.textContent = "OD------";
  setTelegramStatus("Telegram reminders are not linked yet.");
  setLtotTelegramStatus("");
  updateLtotTelegramButton();
}

function setTelegramBusy(isBusy) {
  if (isBusy) {
    elements.generatePairingButton.disabled = true;
    elements.checkPairingButton.disabled = true;
    elements.sendTelegramTestButton.disabled = true;
    elements.sendSampleReminderButton.disabled = true;
    return;
  }

  const botConfigured = telegramBotConfigured;
  elements.generatePairingButton.disabled = isOfflineReadOnly;
  elements.checkPairingButton.disabled = isOfflineReadOnly || !botConfigured;
  elements.sendTelegramTestButton.disabled = isOfflineReadOnly || !botConfigured || !telegramLinked;
  elements.sendSampleReminderButton.disabled = isOfflineReadOnly || !botConfigured || !telegramLinked;
  updateLtotTelegramButton();
}

async function invokeTelegramAction(action, body = {}) {
  if (!supabaseClient || !currentUser || !hasCloudConfig) {
    throw new Error("Cloud sign-in is required before using Telegram reminders.");
  }

  if (!navigator.onLine) {
    throw new Error("Connect to the internet before using Telegram reminders.");
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if (error || !data.session?.access_token) {
    throw new Error("Your sign-in session could not be checked. Sign out and back in, then try again.");
  }

  const response = await fetch(`${cloudConfig.url}/functions/v1/opsdeck-telegram`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": cloudConfig.anonKey,
      "Authorization": `Bearer ${data.session.access_token}`,
    },
    body: JSON.stringify({ action, ...body }),
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.message || `Telegram request failed (${response.status}).`);
  }

  return payload;
}

function updateTelegramPanel(data) {
  telegramLinked = Boolean(data.linked);
  telegramBotConfigured = Boolean(data.bot_configured);
  telegramLtotSupported = Boolean(data.ltot_summary_supported);
  const linkedLabel = data.linked
    ? `Linked to ${data.chat_label || data.username || "Telegram"}`
    : "Not linked";
  elements.telegramLinkState.textContent = linkedLabel;
  elements.telegramBotState.textContent = data.bot_configured ? "Service ready" : "Service unavailable";

  elements.sendTelegramTestButton.disabled = isOfflineReadOnly || !data.linked || !data.bot_configured;
  elements.sendSampleReminderButton.disabled = isOfflineReadOnly || !data.linked || !data.bot_configured;
  elements.checkPairingButton.disabled = isOfflineReadOnly || !data.bot_configured;
  updateLtotTelegramButton();

  if (!data.bot_configured) {
    setTelegramStatus("Telegram is temporarily unavailable. Try again later.", false, false, true);
    return;
  }

  if (data.linked) {
    setTelegramStatus("Telegram reminders are linked.", false, true);
    return;
  }

  setTelegramStatus("Create a pairing code to link Telegram reminders.");
}

async function refreshTelegramStatus() {
  if (!currentUser || isOfflineReadOnly) return;

  setTelegramStatus("Checking Telegram reminder setup...");
  try {
    const data = await invokeTelegramAction("probe");
    updateTelegramPanel(data);
  } catch (error) {
    setTelegramStatus(error.message || "Telegram setup could not be checked.", true);
  }
}

async function startTelegramPairing() {
  setTelegramBusy(true);
  setTelegramStatus("Creating pairing code...");

  try {
    const data = await invokeTelegramAction("start_pairing");
    telegramLinked = false;
    elements.telegramPairingCode.textContent = data.pairing_code || "OD------";
    elements.telegramPairingExpiry.textContent = data.pairing_minutes
      ? `Expires in ${data.pairing_minutes} min`
      : "Pairing active";
    updateTelegramPanel({ ...data, linked: false });
    setTelegramStatus(data.bot_configured
      ? "Pairing code created. Send it to the Telegram bot, then check pairing."
      : "Pairing code created, but Telegram is temporarily unavailable.",
      false,
      Boolean(data.bot_configured),
      !data.bot_configured);
  } catch (error) {
    setTelegramStatus(error.message || "Pairing code could not be created.", true);
  } finally {
    setTelegramBusy(false);
  }
}

async function checkTelegramPairing() {
  if (telegramLinked) {
    setTelegramStatus("Telegram is already linked.", false, true);
    return;
  }

  setTelegramBusy(true);
  setTelegramStatus("Checking Telegram messages...");

  try {
    const data = await invokeTelegramAction("resolve_chat");
    elements.telegramPairingExpiry.textContent = "Linked";
    updateTelegramPanel({ ...data, bot_configured: true });
    setTelegramStatus("Telegram linked. Send a test message next.", false, true);
  } catch (error) {
    setTelegramStatus(error.message || "Telegram pairing could not be checked.", true);
  } finally {
    setTelegramBusy(false);
  }
}

async function sendTelegramTest() {
  setTelegramBusy(true);
  setTelegramStatus("Sending Telegram test...");

  try {
    await invokeTelegramAction("send_test");
    setTelegramStatus("Telegram test sent.", false, true);
    refreshTelegramStatus();
  } catch (error) {
    setTelegramStatus(error.message || "Telegram test could not be sent.", true);
  } finally {
    setTelegramBusy(false);
  }
}

async function sendSampleReminder() {
  setTelegramBusy(true);
  setTelegramStatus("Sending sample jumpseat reminder...");

  try {
    await invokeTelegramAction("send_sample_reminder");
    setTelegramStatus("Sample reminder sent.", false, true);
    refreshTelegramStatus();
  } catch (error) {
    setTelegramStatus(error.message || "Sample reminder could not be sent.", true);
  } finally {
    setTelegramBusy(false);
  }
}

async function sendLtotTelegramSummary() {
  const summary = buildLtotTelegramSummary();

  if (!summary) {
    setLtotTelegramStatus("Enter final sector timing before sending LTOT.", true);
    updateLtotTelegramButton();
    return;
  }

  elements.sendLtotTelegramButton.disabled = true;
  setLtotTelegramStatus("Sending LTOT to Telegram...");

  try {
    await invokeTelegramAction("send_ltot_summary", { summary });
    setLtotTelegramStatus("LTOT sent to Telegram.", false, true);
    refreshTelegramStatus();
  } catch (error) {
    setLtotTelegramStatus(error.message || "LTOT could not be sent to Telegram.", true);
  } finally {
    updateLtotTelegramButton();
  }
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
  if (IS_LOCAL_PREVIEW) {
    if (LOCAL_PREVIEW_VIEW === "gps") window.OpsDeckGpsUi?.setContext("local-preview", async () => {
      const response = await fetch("./__gps-checklist-preview.json", { cache: "no-store" });
      if (!response.ok) throw new Error("Local preview data unavailable");
      return response.json();
    });
    elements.authPanel.classList.add("hidden");
    setAppVisible(true);
    return;
  }

  if (!navigator.onLine) {
    if (supabaseClient) {
      const { data } = await supabaseClient.auth.getSession().catch(() => ({ data: null }));
      if (data?.session?.user) {
        setSignedInState(data.session.user);
        loadCachedNotocPolicy(data.session.user);
      }
    }
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

  supabaseClient.auth.onAuthStateChange((event, session) => {
    const sessionEndedUnexpectedly = event === "SIGNED_OUT" && Boolean(currentUser) && !manualSignOutInProgress;
    handleSession(session).then(() => {
      if (sessionEndedUnexpectedly) setAuthStatus("Session expired. Sign in again.", true);
    });
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
  clearJumpseatDraft();
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
elements.checksToolTab.addEventListener("click", () => setActiveTool("checks"));
elements.openRaCheckButton.addEventListener("click", () => setActiveTool("ra"));
elements.openNotocButton.addEventListener("click", () => setActiveTool("notoc"));
elements.openGpsButton.addEventListener("click", () => setActiveTool("gps"));
elements.gpsBackToChecks.addEventListener("click", () => {
  setActiveTool("checks");
  elements.openGpsButton.focus();
});
elements.raBackToChecks.addEventListener("click", () => {
  setActiveTool("checks");
  elements.openRaCheckButton.focus();
});
document.addEventListener("opsdeck:notoc-back-to-tools", () => {
  setActiveTool("checks");
  elements.openNotocButton.focus();
});
elements.clearFtlButton.addEventListener("click", clearFtlCalculator);
elements.sendLtotTelegramButton.addEventListener("click", sendLtotTelegramSummary);
elements.ftlMobileResultStrip?.addEventListener("click", () => {
  document.querySelector(".ftl-results")?.scrollIntoView({ behavior: "smooth", block: "start" });
});
elements.fdpWorkflowRoutes.forEach((button) => {
  button.addEventListener("click", () => openFdpWorkflowSection(button.dataset.fdpRouteTarget));
});
elements.bdxInfoButton?.addEventListener("click", openBdxInfo);
elements.bdxInfoCloseButton?.addEventListener("click", closeBdxInfo);
elements.bdxInfoDialog?.addEventListener("click", (event) => {
  if (event.target === elements.bdxInfoDialog) closeBdxInfo();
});
elements.elapsedInfoButton?.addEventListener("click", openElapsedInfo);
elements.elapsedInfoButtonMobile?.addEventListener("click", openElapsedInfo);
elements.elapsedInfoCloseButton?.addEventListener("click", closeElapsedInfo);
elements.elapsedInfoDialog?.addEventListener("click", (event) => {
  if (event.target === elements.elapsedInfoDialog) closeElapsedInfo();
});
elements.openAddRequestButton.addEventListener("click", startAdd);
[elements.requestDate, elements.flightNumber, elements.routeFrom, elements.routeTo, elements.departureTime]
  .forEach((field) => field.addEventListener("input", () => {
    clearFieldValidation(field);
    updateValidationSummary();
  }));
elements.requestForm.addEventListener("input", persistJumpseatDraft);
elements.requestForm.addEventListener("change", persistJumpseatDraft);
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
elements.backToRequestsButton.addEventListener("click", () => {
  if (hasMeaningfulJumpseatDraft() && !window.confirm("Discard this unfinished Jumpseat request?")) return;
  clearJumpseatDraft();
  clearForm();
  setActiveTab("home");
  elements.openAddRequestButton.focus();
});
elements.addSeatButton.addEventListener("click", () => {
  const values = getStaffValues();
  if (values.length >= MAX_REQUESTS_PER_FLIGHT) return;

  const blankIndex = values.findIndex((value) => !staffName(value));
  if (blankIndex >= 0) {
    const input = getStaffInputs()[blankIndex];
    setFieldValidationError(input, `Enter request ${blankIndex + 1} name before adding another person.`);
    updateValidationSummary();
    input.focus();
    updateAddRequestButton();
    return;
  }

  renderStaffFields([...values, { name: "", baid: false }]);
  persistJumpseatDraft();
  getStaffInputs().at(-1)?.focus();
});

elements.authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  signIn();
});
elements.magicLinkButton.addEventListener("click", sendMagicLink);
elements.refreshCloudButton.addEventListener("click", refreshCloudData);
elements.ftlRefreshCloudButton.addEventListener("click", refreshCloudData);
elements.checksRefreshCloudButton.addEventListener("click", refreshCloudData);
elements.raRefreshCloudButton.addEventListener("click", refreshCloudData);
elements.notocRefreshCloudButton.addEventListener("click", refreshCloudData);
elements.settingsRefreshCloudButton.addEventListener("click", refreshCloudData);
elements.homeSettingsButton.addEventListener("click", openSettings);
elements.ftlSettingsButton.addEventListener("click", openSettings);
elements.checksSettingsButton.addEventListener("click", openSettings);
elements.raSettingsButton.addEventListener("click", openSettings);
elements.notocSettingsButton.addEventListener("click", openSettings);
elements.gpsSettingsButton.addEventListener("click", openSettings);
elements.homeSignOutButton.addEventListener("click", () => signOut());
elements.ftlSignOutButton.addEventListener("click", () => signOut());
elements.checksSignOutButton.addEventListener("click", () => signOut());
elements.raSignOutButton.addEventListener("click", () => signOut());
elements.notocSignOutButton.addEventListener("click", () => signOut());
elements.gpsSignOutButton.addEventListener("click", () => signOut());
elements.settingsSignOutButton.addEventListener("click", () => signOut());
elements.generatePairingButton.addEventListener("click", startTelegramPairing);
elements.checkPairingButton.addEventListener("click", checkTelegramPairing);
elements.sendTelegramTestButton.addEventListener("click", sendTelegramTest);
elements.sendSampleReminderButton.addEventListener("click", sendSampleReminder);
elements.useCloudConflictButton.addEventListener("click", useCloudConflictCopy);
elements.keepDeviceConflictButton.addEventListener("click", keepDeviceConflictCopy);
elements.downloadConflictButton.addEventListener("click", downloadRequestConflictCopies);
elements.exportJsonButton.addEventListener("click", exportJsonBackup);
elements.exportCsvButton.addEventListener("click", exportCsvBackup);
elements.restoreBackupButton.addEventListener("click", () => elements.restoreBackupInput.click());
elements.restoreBackupInput.addEventListener("change", restoreJsonBackup);
window.addEventListener("offline", () => startOfflineMode());
window.addEventListener("online", returnOnline);
document.addEventListener("pointerdown", releaseFtlPickerFocus, true);
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.bdxInfoDialog?.classList.contains("hidden")) {
    closeBdxInfo();
  } else if (event.key === "Escape" && !elements.elapsedInfoDialog?.classList.contains("hidden")) {
    closeElapsedInfo();
  }
});

initialiseAppearance();
setSelectedDate(todayIso());
clearForm();
setupFtlCalculator();
strengthenCredentialPaste(elements.authEmail);
strengthenCredentialPaste(elements.authPassword);
initCloud();
if (LOCAL_PREVIEW_VIEW === "settings") openSettings();
else if (["ftl", "checks", "ra", "notoc", "gps"].includes(LOCAL_PREVIEW_VIEW)) setActiveTool(LOCAL_PREVIEW_VIEW);

if ("serviceWorker" in navigator && !IS_LOCAL_PREVIEW) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
