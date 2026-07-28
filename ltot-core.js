(function attachLtotCore(globalScope) {
  "use strict";

  const MINUTES_IN_DAY = 24 * 60;

  function isFiniteMinute(value) {
    return Number.isFinite(value);
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

  function calculateLtot(input) {
    const dutyStartMinutes = input.dutyStartMinutes;
    const maximumFdpMinutes = input.maximumFdpMinutes;
    const discretionMinutes = isFiniteMinute(input.discretionMinutes) ? input.discretionMinutes : 0;
    const taxiOutMinutes = isFiniteMinute(input.taxiOutMinutes) ? input.taxiOutMinutes : 0;
    const flightTimeMinutes = input.flightTimeMinutes;
    const holdingMinutes = isFiniteMinute(input.holdingMinutes) ? input.holdingMinutes : 0;
    const taxiInMinutes = isFiniteMinute(input.taxiInMinutes) ? input.taxiInMinutes : 0;
    const contingencyMinutes = isFiniteMinute(input.contingencyMinutes) ? input.contingencyMinutes : 0;
    const hasFdpLimit = isFiniteMinute(dutyStartMinutes) && isFiniteMinute(maximumFdpMinutes);
    const maximumAllowableFdpMinutes = isFiniteMinute(maximumFdpMinutes)
      ? maximumFdpMinutes + discretionMinutes
      : null;

    if (!hasFdpLimit) {
      return {
        maximumAllowableFdpMinutes,
        latestOnChocksMinutes: null,
        latestTakeoffMinutes: null,
        latestPushbackMinutes: null,
        sectorLengthMinutes: isFiniteMinute(flightTimeMinutes) ? taxiOutMinutes + flightTimeMinutes + holdingMinutes + taxiInMinutes + contingencyMinutes : null,
      };
    }

    const latestOnChocksMinutes = dutyStartMinutes + maximumAllowableFdpMinutes;
    const sectorLengthMinutes = isFiniteMinute(flightTimeMinutes)
      ? taxiOutMinutes + flightTimeMinutes + holdingMinutes + taxiInMinutes + contingencyMinutes
      : null;

    if (sectorLengthMinutes === null) {
      return {
        maximumAllowableFdpMinutes,
        latestOnChocksMinutes,
        latestTakeoffMinutes: null,
        latestPushbackMinutes: null,
        sectorLengthMinutes,
      };
    }

    const latestTakeoffMinutes = latestOnChocksMinutes - flightTimeMinutes - holdingMinutes - taxiInMinutes - contingencyMinutes;
    const latestPushbackMinutes = latestTakeoffMinutes - taxiOutMinutes;

    return {
      maximumAllowableFdpMinutes,
      latestOnChocksMinutes,
      latestTakeoffMinutes,
      latestPushbackMinutes,
      sectorLengthMinutes,
    };
  }

  const api = {
    MINUTES_IN_DAY,
    calculateLtot,
    formatZuluTime,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckLtot = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
