const assert = require("node:assert/strict");
const test = require("node:test");
const { calculateLtot, formatZuluTime } = require("../ltot-core");

const hr = (hours) => hours * 60;

test("formats Zulu times with day rollover suffixes", () => {
  assert.equal(formatZuluTime(hr(8) + 15), "08:15Z");
  assert.equal(formatZuluTime(hr(24) + 5), "00:05Z +1");
  assert.equal(formatZuluTime((hr(48)) + 75), "01:15Z +2");
  assert.equal(formatZuluTime(-15), "23:45Z -1");
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
