const assert = require("node:assert/strict");
const test = require("node:test");
const {
  absoluteTargetMs,
  calculateCrewLimits,
  calculateCrewLtot,
  calculateLtot,
  countdownSeconds,
  formatZuluTime,
  resolveNearestUtcDateIso,
} = require("../ltot-core");

const hr = (hours) => hours * 60;

test("formats Zulu times with day rollover suffixes", () => {
  assert.equal(formatZuluTime(hr(8) + 15), "08:15Z");
  assert.equal(formatZuluTime(hr(24) + 5), "00:05Z +1");
  assert.equal(formatZuluTime((hr(48)) + 75), "01:15Z +2");
  assert.equal(formatZuluTime(-15), "23:45Z -1");
});

test("anchors an entered duty start to the nearest UTC calendar date", () => {
  const justAfterMidnight = Date.parse("2026-08-19T00:30:00Z");

  assert.equal(resolveNearestUtcDateIso((23 * 60) + 45, justAfterMidnight), "2026-08-18");
  assert.equal(resolveNearestUtcDateIso(60, justAfterMidnight), "2026-08-19");
});

test("keeps next-day LTOT countdowns correct across midnight", () => {
  const anchorDate = "2026-08-18";
  const nextDayTargetMinutes = (24 * 60) + 60;

  assert.equal(
    absoluteTargetMs(anchorDate, nextDayTargetMinutes),
    Date.parse("2026-08-19T01:00:00Z")
  );
  assert.equal(
    countdownSeconds(anchorDate, nextDayTargetMinutes, Date.parse("2026-08-18T23:30:00Z")),
    90 * 60
  );
  assert.equal(
    countdownSeconds(anchorDate, nextDayTargetMinutes, Date.parse("2026-08-19T00:30:00Z")),
    30 * 60
  );
});

test("uses the persisted anchor date after reopening the calculator", () => {
  const savedAnchorDate = "2026-08-18";
  const targetMinutes = (24 * 60) + 15;

  assert.equal(
    countdownSeconds(savedAnchorDate, targetMinutes, Date.parse("2026-08-19T00:05:00Z")),
    10 * 60
  );
});

test("calculates latest on-chocks as a standalone FDP gross check", () => {
  const result = calculateLtot({
    dutyStartMinutes: hr(22),
    maximumFdpMinutes: hr(13),
    discretionMinutes: 0,
  });

  assert.equal(formatZuluTime(result.latestOnChocksMinutes), "11:00Z +1");
  assert.equal(result.maximumAllowableFdpMinutes, hr(13));
  assert.equal(result.latestTakeoffMinutes, null);
  assert.equal(result.latestPushbackMinutes, null);
});

test("calculates full LTOT outputs across midnight", () => {
  const result = calculateLtot({
    dutyStartMinutes: hr(22),
    maximumFdpMinutes: hr(13),
    discretionMinutes: 0,
    taxiOutMinutes: 15,
    flightTimeMinutes: hr(2),
    holdingMinutes: 15,
    taxiInMinutes: 15,
    contingencyMinutes: 5,
  });

  assert.equal(formatZuluTime(result.latestOnChocksMinutes), "11:00Z +1");
  assert.equal(formatZuluTime(result.latestTakeoffMinutes), "08:25Z +1");
  assert.equal(formatZuluTime(result.latestPushbackMinutes), "08:10Z +1");
  assert.equal(result.sectorLengthMinutes, 170);
});

test("includes Commander's discretion in maximum allowable FDP", () => {
  const result = calculateLtot({
    dutyStartMinutes: hr(6),
    maximumFdpMinutes: hr(12),
    discretionMinutes: hr(1) + 5,
  });

  assert.equal(result.maximumAllowableFdpMinutes, hr(13) + 5);
  assert.equal(formatZuluTime(result.latestOnChocksMinutes), "19:05Z");
});

test("contingency moves pushback and takeoff earlier but not on-chocks", () => {
  const base = calculateLtot({
    dutyStartMinutes: hr(8),
    maximumFdpMinutes: hr(12),
    discretionMinutes: 0,
    taxiOutMinutes: 15,
    flightTimeMinutes: hr(2),
    holdingMinutes: 15,
    taxiInMinutes: 15,
    contingencyMinutes: 0,
  });
  const withContingency = calculateLtot({
    dutyStartMinutes: hr(8),
    maximumFdpMinutes: hr(12),
    discretionMinutes: 0,
    taxiOutMinutes: 15,
    flightTimeMinutes: hr(2),
    holdingMinutes: 15,
    taxiInMinutes: 15,
    contingencyMinutes: 10,
  });

  assert.equal(withContingency.latestOnChocksMinutes, base.latestOnChocksMinutes);
  assert.equal(withContingency.latestTakeoffMinutes, base.latestTakeoffMinutes - 10);
  assert.equal(withContingency.latestPushbackMinutes, base.latestPushbackMinutes - 10);
});

test("missing FDP inputs prevent any latest time calculation", () => {
  const result = calculateLtot({
    dutyStartMinutes: hr(8),
    maximumFdpMinutes: null,
    discretionMinutes: 0,
    flightTimeMinutes: hr(2),
    taxiOutMinutes: 15,
    holdingMinutes: 15,
    taxiInMinutes: 15,
    contingencyMinutes: 0,
  });

  assert.equal(result.latestOnChocksMinutes, null);
  assert.equal(result.latestTakeoffMinutes, null);
  assert.equal(result.latestPushbackMinutes, null);
});

test("selects the earlier cabin crew FDP limit as controlling", () => {
  const result = calculateCrewLtot({
    cabinCrewEnabled: true,
    flightCrew: {
      dutyStartMinutes: hr(6),
      maximumFdpMinutes: hr(13),
      discretionMinutes: 0,
    },
    cabinCrew: {
      dutyStartMinutes: hr(5) + 30,
      maximumFdpMinutes: hr(12),
      discretionMinutes: 0,
    },
    sectorTiming: {
      taxiOutMinutes: 15,
      flightTimeMinutes: hr(2),
      holdingMinutes: 15,
      taxiInMinutes: 15,
      contingencyMinutes: 5,
    },
  });

  assert.equal(result.comparisonComplete, true);
  assert.equal(result.controllingCrew, "cabin");
  assert.equal(formatZuluTime(result.flightCrew.latestOnChocksMinutes), "19:00Z");
  assert.equal(formatZuluTime(result.cabinCrew.latestOnChocksMinutes), "17:30Z");
  assert.equal(result.controllingResult, result.cabinCrew);
});

test("preserves the existing single flight crew calculation by default", () => {
  const result = calculateCrewLtot({
    flightCrew: {
      dutyStartMinutes: hr(7),
      maximumFdpMinutes: hr(12) + 30,
      discretionMinutes: 0,
    },
    sectorTiming: {
      taxiOutMinutes: 15,
      flightTimeMinutes: hr(2),
      holdingMinutes: 15,
      taxiInMinutes: 15,
      contingencyMinutes: 0,
    },
  });

  assert.equal(result.cabinCrew, null);
  assert.equal(result.controllingCrew, "flight");
  assert.equal(formatZuluTime(result.controllingResult.latestOnChocksMinutes), "19:30Z");
  assert.equal(formatZuluTime(result.controllingResult.latestPushbackMinutes), "16:45Z");
});

test("reports a joint limit when both crew groups have the same latest on-chocks", () => {
  const result = calculateCrewLtot({
    cabinCrewEnabled: true,
    flightCrew: {
      dutyStartMinutes: hr(6),
      maximumFdpMinutes: hr(13),
      discretionMinutes: 0,
    },
    cabinCrew: {
      dutyStartMinutes: hr(7),
      maximumFdpMinutes: hr(12),
      discretionMinutes: 0,
    },
  });

  assert.equal(result.comparisonComplete, true);
  assert.equal(result.controllingCrew, "joint");
  assert.equal(formatZuluTime(result.controllingResult.latestOnChocksMinutes), "19:00Z");
});

test("does not declare a controlling limit until both enabled crew groups are complete", () => {
  const result = calculateCrewLtot({
    cabinCrewEnabled: true,
    flightCrew: {
      dutyStartMinutes: hr(6),
      maximumFdpMinutes: hr(13),
      discretionMinutes: 0,
    },
    cabinCrew: {
      dutyStartMinutes: hr(6) + 30,
      maximumFdpMinutes: null,
      discretionMinutes: 0,
    },
  });

  assert.equal(formatZuluTime(result.flightCrew.latestOnChocksMinutes), "19:00Z");
  assert.equal(result.cabinCrew.latestOnChocksMinutes, null);
  assert.equal(result.comparisonComplete, false);
  assert.equal(result.controllingCrew, null);
  assert.equal(result.controllingResult, null);
});

test("compares split crew reports correctly across midnight", () => {
  const result = calculateCrewLtot({
    cabinCrewEnabled: true,
    flightCrew: {
      dutyStartMinutes: hr(23) + 30,
      maximumFdpMinutes: hr(13),
      discretionMinutes: 0,
    },
    cabinCrew: {
      dutyStartMinutes: 15,
      maximumFdpMinutes: hr(11) + 30,
      discretionMinutes: 0,
    },
  });

  assert.equal(formatZuluTime(result.flightCrew.latestOnChocksMinutes), "12:30Z +1");
  assert.equal(formatZuluTime(result.cabinCrew.latestOnChocksMinutes), "11:45Z +1");
  assert.equal(result.controllingCrew, "cabin");
});

test("selects the earliest limit from two pilots and six cabin crew records", () => {
  const crewLimits = [
    { id: "flight-1", category: "flight", name: "Ben", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(13), discretionMinutes: 0 },
    { id: "flight-2", category: "flight", name: "Pilot 2", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(12) + 45, discretionMinutes: 0 },
    { id: "cabin-1", category: "cabin", name: "Cabin 1", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(12) + 30, discretionMinutes: 0 },
    { id: "cabin-2", category: "cabin", name: "Cabin 2", dutyStartMinutes: hr(5), maximumFdpMinutes: hr(13), discretionMinutes: 0 },
    { id: "cabin-3", category: "cabin", name: "Cabin 3", dutyStartMinutes: hr(4), maximumFdpMinutes: hr(13), discretionMinutes: 30 },
    { id: "cabin-4", category: "cabin", name: "Cabin 4", dutyStartMinutes: hr(4) + 30, maximumFdpMinutes: hr(12), discretionMinutes: 0 },
    { id: "cabin-5", category: "cabin", name: "Cabin 5", dutyStartMinutes: hr(5) + 30, maximumFdpMinutes: hr(11), discretionMinutes: 0 },
    { id: "cabin-6", category: "cabin", name: "Cabin 6", dutyStartMinutes: hr(7), maximumFdpMinutes: hr(10), discretionMinutes: 0 },
  ];
  const result = calculateCrewLimits({ crewLimits, anchorId: "flight-1" });

  assert.equal(result.results.length, 8);
  assert.equal(result.comparisonComplete, true);
  assert.deepEqual(result.controllingIds, ["cabin-4", "cabin-5"]);
  assert.equal(formatZuluTime(result.controllingResult.latestOnChocksMinutes), "16:30Z");
});

test("applies Commander's discretion independently to each crew limit", () => {
  const result = calculateCrewLimits({
    crewLimits: [
      { id: "flight-1", category: "flight", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(12), discretionMinutes: hr(1) },
      { id: "cabin-1", category: "cabin", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(12), discretionMinutes: 30 },
    ],
  });

  assert.deepEqual(result.controllingIds, ["cabin-1"]);
  assert.equal(formatZuluTime(result.results[0].calculation.latestOnChocksMinutes), "19:00Z");
  assert.equal(formatZuluTime(result.results[1].calculation.latestOnChocksMinutes), "18:30Z");
});

test("blocks the controlling output while any enabled crew limit is incomplete", () => {
  const result = calculateCrewLimits({
    crewLimits: [
      { id: "flight-1", category: "flight", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(13), discretionMinutes: 0 },
      { id: "cabin-1", category: "cabin", name: "Outlier", dutyStartMinutes: hr(5), maximumFdpMinutes: null, discretionMinutes: 0 },
      { id: "cabin-disabled", category: "cabin", enabled: false, dutyStartMinutes: null, maximumFdpMinutes: null },
    ],
  });

  assert.equal(result.results.length, 2);
  assert.equal(result.comparisonComplete, false);
  assert.deepEqual(result.controllingIds, []);
  assert.equal(result.controllingResult, null);
});

test("reports all equal earliest limits as joint controllers", () => {
  const result = calculateCrewLimits({
    crewLimits: [
      { id: "flight-1", category: "flight", name: "Pilot", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(12), discretionMinutes: 0 },
      { id: "cabin-1", category: "cabin", name: "Cabin A", dutyStartMinutes: hr(5), maximumFdpMinutes: hr(13), discretionMinutes: 0 },
      { id: "cabin-2", category: "cabin", name: "Cabin B", dutyStartMinutes: hr(7), maximumFdpMinutes: hr(12), discretionMinutes: 0 },
    ],
  });

  assert.deepEqual(result.controllingIds, ["flight-1", "cabin-1"]);
  assert.equal(formatZuluTime(result.controllingResult.latestOnChocksMinutes), "18:00Z");
});

test("aligns several crew reports across midnight within the short-haul 12-hour scope", () => {
  const result = calculateCrewLimits({
    anchorId: "flight-1",
    crewLimits: [
      { id: "flight-1", category: "flight", dutyStartMinutes: hr(23) + 30, maximumFdpMinutes: hr(13), discretionMinutes: 0 },
      { id: "flight-2", category: "flight", dutyStartMinutes: 15, maximumFdpMinutes: hr(12), discretionMinutes: 0 },
      { id: "cabin-1", category: "cabin", dutyStartMinutes: hr(22) + 45, maximumFdpMinutes: hr(12), discretionMinutes: 0 },
      { id: "cabin-2", category: "cabin", dutyStartMinutes: 45, maximumFdpMinutes: hr(10), discretionMinutes: 0 },
    ],
  });

  assert.equal(formatZuluTime(result.results[0].calculation.latestOnChocksMinutes), "12:30Z +1");
  assert.equal(formatZuluTime(result.results[1].calculation.latestOnChocksMinutes), "12:15Z +1");
  assert.equal(formatZuluTime(result.results[2].calculation.latestOnChocksMinutes), "10:45Z +1");
  assert.equal(formatZuluTime(result.results[3].calculation.latestOnChocksMinutes), "10:45Z +1");
  assert.deepEqual(result.controllingIds, ["cabin-1", "cabin-2"]);
});

test("uses the same limiting crew for shared pushback, takeoff and on-chocks offsets", () => {
  const result = calculateCrewLimits({
    crewLimits: [
      { id: "flight-1", category: "flight", dutyStartMinutes: hr(6), maximumFdpMinutes: hr(13), discretionMinutes: 0 },
      { id: "cabin-1", category: "cabin", dutyStartMinutes: hr(5), maximumFdpMinutes: hr(12), discretionMinutes: 0 },
    ],
    sectorTiming: {
      taxiOutMinutes: 15,
      flightTimeMinutes: hr(2),
      holdingMinutes: 15,
      taxiInMinutes: 15,
      contingencyMinutes: 5,
    },
  });

  assert.deepEqual(result.controllingIds, ["cabin-1"]);
  const controlling = result.results.find((entry) => entry.id === "cabin-1").calculation;
  assert.equal(result.controllingResult.latestOnChocksMinutes, controlling.latestOnChocksMinutes);
  assert.equal(result.controllingResult.latestTakeoffMinutes, controlling.latestTakeoffMinutes);
  assert.equal(result.controllingResult.latestPushbackMinutes, controlling.latestPushbackMinutes);
});
