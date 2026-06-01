const STORAGE_KEY = "jumpseat-calendar-requests-v1";
const MAX_REQUESTS_PER_FLIGHT = 10;

const elements = {
  selectedDate: document.querySelector("#selectedDate"),
  requestDate: document.querySelector("#requestDate"),
  authPanel: document.querySelector("#authPanel"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authStatus: document.querySelector("#authStatus"),
  authSession: document.querySelector("#authSession"),
  syncStatus: document.querySelector("#syncStatus"),
  signUpButton: document.querySelector("#signUpButton"),
  signOutButton: document.querySelector("#signOutButton"),
  appTabs: document.querySelector(".app-tabs"),
  layout: document.querySelector(".layout"),
  homeTab: document.querySelector("#homeTab"),
  addTab: document.querySelector("#addTab"),
  homeView: document.querySelector("#homeView"),
  addView: document.querySelector("#addView"),
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
  routeFrom: document.querySelector("#routeFrom"),
  routeTo: document.querySelector("#routeTo"),
  staffFields: document.querySelector("#staffFields"),
  addSeatButton: document.querySelector("#addSeatButton"),
  notes: document.querySelector("#notes"),
  template: document.querySelector("#requestTemplate"),
};

let requests = loadRequests();
let currentUser = null;
let cloudReady = false;
let cloudLoaded = false;
let saveTimer = null;

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

function setAuthStatus(message, isError = false) {
  elements.authStatus.textContent = message;
  elements.authStatus.classList.toggle("status-error", isError);
}

function setSyncStatus(message, isError = false) {
  elements.syncStatus.textContent = message;
  elements.syncStatus.classList.toggle("status-error", isError);
}

function setAppVisible(isVisible) {
  elements.appTabs.classList.toggle("hidden", !isVisible);
  elements.layout.classList.toggle("hidden", !isVisible);
}

function setSignedInState(user) {
  currentUser = user;
  elements.authForm.classList.toggle("hidden", Boolean(user));
  elements.authSession.classList.toggle("hidden", !user);
  setAppVisible(Boolean(user));

  if (user) {
    setAuthStatus(`Signed in as ${user.email}.`);
  } else {
    cloudLoaded = false;
    setAuthStatus("Sign in to load and save your jumpseat requests online.");
    setSyncStatus("Cloud ready");
  }
}

function setActiveTab(tabName) {
  const isHome = tabName === "home";
  elements.homeView.classList.toggle("hidden", !isHome);
  elements.addView.classList.toggle("hidden", isHome);
  elements.homeTab.classList.toggle("active", isHome);
  elements.addTab.classList.toggle("active", !isHome);
  elements.homeTab.setAttribute("aria-selected", String(isHome));
  elements.addTab.setAttribute("aria-selected", String(!isHome));
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
  if (!supabaseClient || !currentUser || !cloudLoaded) return;

  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveCloudRequests();
  }, 350);
}

async function saveCloudRequests() {
  if (!supabaseClient || !currentUser) return;

  setSyncStatus("Saving...");
  const { error } = await supabaseClient
    .from("jumpseat_data")
    .upsert(
      {
        user_id: currentUser.id,
        requests,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  if (error) {
    setSyncStatus("Cloud save failed", true);
    return;
  }

  setSyncStatus("Saved to cloud");
}

async function loadCloudRequests() {
  if (!supabaseClient || !currentUser) return;

  cloudLoaded = false;
  setSyncStatus("Loading cloud data...");

  const { data, error } = await supabaseClient
    .from("jumpseat_data")
    .select("requests")
    .eq("user_id", currentUser.id)
    .maybeSingle();

  if (error) {
    setSyncStatus("Cloud load failed", true);
    return;
  }

  const localRequests = loadRequests();

  if (Array.isArray(data?.requests)) {
    requests = sanitizeRequests(data.requests);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    cloudLoaded = true;
    setSyncStatus("Loaded from cloud");
  } else {
    requests = sanitizeRequests(localRequests);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
    cloudLoaded = true;
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
  elements.addSeatButton.disabled = hasReachedLimit || hasBlankVisibleRequest;
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

    card.querySelector(".edit-button").addEventListener("click", () => startEdit(request.id));
    card.querySelector(".delete-button").addEventListener("click", () => deleteRequest(request.id));
    elements.requestList.append(card);
  });
}

function startEdit(id) {
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

async function createAccount() {
  const email = elements.authEmail.value.trim();
  const password = elements.authPassword.value;

  if (!email || !password) {
    setAuthStatus("Enter your email and choose a password.", true);
    return;
  }

  if (password.length < 8) {
    setAuthStatus("Use a password of at least 8 characters.", true);
    return;
  }

  setAuthStatus("Creating account...");
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href.split("#")[0],
    },
  });

  if (error) {
    setAuthStatus(error.message || "Account creation failed.", true);
    return;
  }

  elements.authPassword.value = "";

  if (data.session) {
    await handleSession(data.session);
  } else {
    setAuthStatus("Account created. Check your email to confirm it, then sign in.");
  }
}

async function signOut() {
  if (!supabaseClient) return;

  setSyncStatus("Signing out...");
  await supabaseClient.auth.signOut();
  requests = [];
  localStorage.removeItem(STORAGE_KEY);
  render();
  setSignedInState(null);
}

async function initCloud() {
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
elements.signUpButton.addEventListener("click", createAccount);
elements.signOutButton.addEventListener("click", signOut);

setSelectedDate(todayIso());
clearForm();
initCloud();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}
