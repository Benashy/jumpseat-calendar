(function attachDataPortability(globalScope) {
  "use strict";

  const BACKUP_FORMAT = "opsdeck-backup";
  const BACKUP_SCHEMA_VERSION = 1;
  const MAX_BACKUP_BYTES = 2_000_000;
  const object = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);
  const text = (value, maximum, optional = false) => optional && value == null || typeof value === "string" && value.length <= maximum;
  const date = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  const time = (value) => value == null || value === "" || typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const number = (value, minimum, maximum, step = 1) => value == null || value === "" ||
    ["string", "number"].includes(typeof value) && /^\d+$/.test(String(value)) &&
    Number(value) >= minimum && Number(value) <= maximum && Number(value) % step === 0;

  function validRequests(requests) {
    if (requests.length > 5000) return false;
    const ids = new Set();
    return requests.every((request) => {
      if (!object(request) || !date(request.date) || !text(request.flightNumber, 20) || !request.flightNumber.trim() ||
        !text(request.id, 120, true) || !time(request.departureTime) || !number(request.availableSeats, 0, 20) ||
        !text(request.routeFrom, 12, true) || !text(request.routeTo, 12, true) || !text(request.notes, 10000, true) ||
        !Array.isArray(request.staff) || request.staff.length > 10 || !request.staff.every((person) =>
          typeof person === "string" ? text(person, 200) && Boolean(person.trim()) : object(person) &&
          text(person.name, 200) && Boolean(person.name.trim()) && (person.baid === undefined || typeof person.baid === "boolean"))) return false;
      if (request.id && ids.has(request.id)) return false;
      if (request.id) ids.add(request.id);
      return true;
    });
  }

  function validDuration(value, minHours, maxHours, step = 1) {
    return value === undefined || object(value) && number(value.hours, minHours, maxHours) &&
      number(value.minutes, 0, 59, step) && !(Number(value.hours) === maxHours && Number(value.minutes) > 0);
  }

  function validCalculator(value) {
    if (!object(value) || (value.schemaVersion !== undefined && !number(value.schemaVersion, 1, 5)) ||
      (value.anchorDate != null && !date(value.anchorDate))) return false;
    const crew = value.crewLimits;
    if (crew !== undefined) {
      const ids = new Set();
      if (!Array.isArray(crew) || crew.length > 9 || !crew.every((person) => {
        if (!object(person) || !["flight", "cabin"].includes(person.category) || !text(person.id, 80) || ids.has(person.id) ||
          !text(person.name, 40, true) || (person.dutyDate && !date(person.dutyDate)) || !time(person.dutyStart) ||
          !validDuration(person.maximumFdp, 9, 14, 5) || !validDuration(person.discretion, 0, 2)) return false;
        ids.add(person.id);
        return true;
      })) return false;
      if (crew.filter((person) => person.category === "flight").length > 3 || crew.filter((person) => person.category === "cabin").length > 6) return false;
    }
    const timing = value.sectorTiming;
    return timing === undefined || object(timing) && validDuration(timing.flightTime, 0, 8) &&
      ["taxiOutMinutes", "holdingMinutes", "taxiInMinutes", "contingencyMinutes"].every((key) => number(timing[key], 0, 59));
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildBackup({ appVersion, requests, calculatorState, exportedAt = new Date().toISOString() }) {
    return {
      format: BACKUP_FORMAT,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      appVersion: String(appVersion || "unknown"),
      exportedAt,
      jumpseatRequests: clone(Array.isArray(requests) ? requests : []),
      calculatorState: clone(calculatorState && typeof calculatorState === "object" ? calculatorState : {}),
    };
  }

  function parseBackup(text) {
    if (typeof text !== "string" || new TextEncoder().encode(text).length > MAX_BACKUP_BYTES) throw new Error("This backup is too large. Maximum size is 2 MB.");
    let value;
    try {
      value = JSON.parse(text);
    } catch {
      throw new Error("This is not a valid OpsDeck JSON backup.");
    }

    if (!value || value.format !== BACKUP_FORMAT || value.schemaVersion !== BACKUP_SCHEMA_VERSION) {
      throw new Error("This backup format is not recognised by this version of OpsDeck.");
    }
    if (!Array.isArray(value.jumpseatRequests)) {
      throw new Error("The backup does not contain a valid Jumpseat request list.");
    }
    if (!validRequests(value.jumpseatRequests)) throw new Error("A flight record is invalid, duplicated or exceeds the supported limits. Nothing has been restored.");
    if (!validCalculator(value.calculatorState)) {
      throw new Error("The backup does not contain valid FDP and LTOT data.");
    }

    return {
      jumpseatRequests: clone(value.jumpseatRequests),
      calculatorState: clone(value.calculatorState),
      exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : null,
    };
  }

  function csvCell(value) {
    const content = String(value ?? "");
    const safe = /^[\s]*[=+\-@＝＋－＠]/u.test(content) ? `\t${content}` : content;
    return `"${safe.replaceAll('"', '""')}"`;
  }

  function requestsToCsv(requests) {
    const rows = [[
      "Date",
      "Flight",
      "Departure Zulu",
      "From",
      "To",
      "Available jumpseats",
      "Request order",
      "Name",
      "BA ID",
      "Notes",
    ]];

    (Array.isArray(requests) ? requests : []).forEach((request) => {
      const staff = Array.isArray(request.staff) ? request.staff : [];
      staff.forEach((entry, index) => {
        const name = typeof entry === "string" ? entry : entry?.name;
        const baid = typeof entry === "object" && Boolean(entry?.baid);
        rows.push([
          request.date,
          request.flightNumber,
          request.departureTime ? `${request.departureTime}Z` : "",
          request.routeFrom,
          request.routeTo,
          request.availableSeats ?? "",
          index + 1,
          name || "",
          baid ? "Yes" : "No",
          request.notes || "",
        ]);
      });
    });

    return `\ufeff${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
  }

  const api = {
    MAX_BACKUP_BYTES, validRequests, validCalculator,
    BACKUP_FORMAT,
    BACKUP_SCHEMA_VERSION,
    buildBackup,
    parseBackup,
    requestsToCsv,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckData = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
