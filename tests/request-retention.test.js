const assert = require("node:assert/strict");
const test = require("node:test");
const { isIsoDate, partitionRequests, retentionCutoffIso } = require("../request-retention");

const NOW = Date.parse("2026-08-18T23:30:00Z");

test("calculates the seven-day cutoff using the Zulu calendar date", () => {
  assert.equal(retentionCutoffIso(NOW, 7), "2026-08-11");
});

test("keeps seven complete days after the flight date and removes older requests", () => {
  const requests = [
    { id: "expired", date: "2026-08-10" },
    { id: "boundary", date: "2026-08-11" },
    { id: "today", date: "2026-08-18" },
  ];
  const result = partitionRequests(requests, { nowMs: NOW, retentionDays: 7 });

  assert.deepEqual(result.expired.map((request) => request.id), ["expired"]);
  assert.deepEqual(result.retained.map((request) => request.id), ["boundary", "today"]);
});

test("does not delete malformed dates automatically", () => {
  const requests = [
    { id: "invalid-day", date: "2026-02-30" },
    { id: "invalid-format", date: "10/08/2026" },
  ];
  const result = partitionRequests(requests, { nowMs: NOW, retentionDays: 7 });

  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.deepEqual(result.expired, []);
  assert.equal(result.retained.length, 2);
});
