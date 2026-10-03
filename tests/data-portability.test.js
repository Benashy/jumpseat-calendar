const assert = require("node:assert/strict");
const test = require("node:test");
const { buildBackup, parseBackup, requestsToCsv } = require("../data-portability");

test("round-trips a portable OpsDeck backup", () => {
  const backup = buildBackup({
    appVersion: "2.34",
    requests: [{ id: "flight-1", date: "2026-08-18", flightNumber: "BA123", staff: [{ name: "Smith", baid: true }] }],
    calculatorState: { anchorDate: "2026-08-18", crewLimits: [] },
    exportedAt: "2026-08-18T10:00:00.000Z",
  });
  const restored = parseBackup(JSON.stringify(backup));

  assert.equal(restored.jumpseatRequests[0].flightNumber, "BA123");
  assert.equal(restored.calculatorState.anchorDate, "2026-08-18");
  assert.equal(restored.exportedAt, "2026-08-18T10:00:00.000Z");
});

test("rejects malformed records before restore", () => {
  for (const record of [null, { date: "2026-02-30", flightNumber: "BA1", staff: [] },
    { date: "2026-08-18", flightNumber: "BA1", staff: Array(11).fill("Name") }]) {
    const backup = buildBackup({ requests: [record], calculatorState: {} });
    assert.throws(() => parseBackup(JSON.stringify(backup)), /record is invalid/);
  }
});

test("spreadsheet formula prefixes are exported as text", () => {
  for (const name of ["=1+1", "+1", "-1", "@SUM(1)", "  =1", "＝1"]) {
    const csv = requestsToCsv([{ staff: [{ name }] }]);
    assert.ok(csv.includes(`"\t${name}"`));
  }
});

test("rejects unrelated or incomplete JSON", () => {
  assert.throws(() => parseBackup("not json"), /valid OpsDeck JSON backup/);
  assert.throws(() => parseBackup('{"format":"something-else"}'), /not recognised/);
});

test("exports one readable CSV row per person and escapes punctuation", () => {
  const csv = requestsToCsv([{
    date: "2026-08-18",
    flightNumber: "BA123",
    departureTime: "10:40",
    routeFrom: "LHR",
    routeTo: "LIS",
    availableSeats: 2,
    staff: [{ name: 'Smith, "Ben"', baid: true }, { name: "Jones", baid: false }],
    notes: "Call dispatcher",
  }]);

  assert.match(csv, /"Smith, ""Ben"""/);
  assert.match(csv, /"Yes"/);
  assert.match(csv, /"Jones","No"/);
  assert.equal(csv.split("\r\n").filter(Boolean).length, 3);
});
