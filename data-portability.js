(function attachDataPortability(globalScope) {
  "use strict";

  const BACKUP_FORMAT = "opsdeck-backup";
  const BACKUP_SCHEMA_VERSION = 1;

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
    if (!value.calculatorState || typeof value.calculatorState !== "object" || Array.isArray(value.calculatorState)) {
      throw new Error("The backup does not contain valid FDP and LTOT data.");
    }

    return {
      jumpseatRequests: clone(value.jumpseatRequests),
      calculatorState: clone(value.calculatorState),
      exportedAt: typeof value.exportedAt === "string" ? value.exportedAt : null,
    };
  }

  function csvCell(value) {
    return `"${String(value ?? "").replaceAll('"', '""')}"`;
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
