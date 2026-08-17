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

  function alignToNearestOperationalDay(value, reference) {
    if (!isFiniteMinute(value) || !isFiniteMinute(reference)) return value;

    let aligned = value;
    while ((aligned - reference) > (MINUTES_IN_DAY / 2)) aligned -= MINUTES_IN_DAY;
    while ((aligned - reference) < -(MINUTES_IN_DAY / 2)) aligned += MINUTES_IN_DAY;
    return aligned;
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

  function calculateCrewLimits(input) {
    const sectorTiming = input.sectorTiming || {};
    const crewLimits = Array.isArray(input.crewLimits)
      ? input.crewLimits.filter((crewLimit) => crewLimit && crewLimit.enabled !== false)
      : [];
    const preferredAnchor = crewLimits.find((crewLimit) => (
      crewLimit.id === input.anchorId && isFiniteMinute(crewLimit.dutyStartMinutes)
    ));
    const anchor = preferredAnchor || crewLimits.find((crewLimit) => isFiniteMinute(crewLimit.dutyStartMinutes));
    const anchorDutyStart = anchor?.dutyStartMinutes;
    const results = crewLimits.map((crewLimit) => {
      const dutyStartMinutes = isFiniteMinute(anchorDutyStart) && isFiniteMinute(crewLimit.dutyStartMinutes)
        ? alignToNearestOperationalDay(crewLimit.dutyStartMinutes, anchorDutyStart)
        : crewLimit.dutyStartMinutes;
      const calculation = calculateLtot({
        ...sectorTiming,
        ...crewLimit,
        dutyStartMinutes,
      });

      return {
        id: crewLimit.id,
        category: crewLimit.category,
        name: crewLimit.name || "",
        dutyStartMinutes,
        maximumFdpMinutes: crewLimit.maximumFdpMinutes,
        discretionMinutes: isFiniteMinute(crewLimit.discretionMinutes) ? crewLimit.discretionMinutes : 0,
        calculation,
        complete: isFiniteMinute(calculation.latestOnChocksMinutes),
      };
    });
    const comparisonComplete = results.length > 0 && results.every((result) => result.complete);

    if (!comparisonComplete) {
      return {
        results,
        comparisonComplete: false,
        controllingIds: [],
        controllingResult: null,
      };
    }

    const earliestOnChocks = Math.min(...results.map((result) => result.calculation.latestOnChocksMinutes));
    const controlling = results.filter((result) => result.calculation.latestOnChocksMinutes === earliestOnChocks);

    return {
      results,
      comparisonComplete: true,
      controllingIds: controlling.map((result) => result.id),
      controllingResult: controlling[0].calculation,
    };
  }

  function calculateCrewLtot(input) {
    const cabinCrewEnabled = Boolean(input.cabinCrewEnabled);
    const comparison = calculateCrewLimits({
      anchorId: "flight",
      crewLimits: [
        { id: "flight", category: "flight", ...(input.flightCrew || {}) },
        ...(cabinCrewEnabled ? [{ id: "cabin", category: "cabin", ...(input.cabinCrew || {}) }] : []),
      ],
      sectorTiming: input.sectorTiming,
    });
    const flightCrew = comparison.results.find((result) => result.id === "flight")?.calculation || null;
    const cabinCrew = comparison.results.find((result) => result.id === "cabin")?.calculation || null;
    let controllingCrew = null;

    if (comparison.controllingIds.length === 2) controllingCrew = "joint";
    else if (comparison.controllingIds[0] === "flight") controllingCrew = "flight";
    else if (comparison.controllingIds[0] === "cabin") controllingCrew = "cabin";

    return {
      flightCrew,
      cabinCrew,
      comparisonComplete: comparison.comparisonComplete,
      controllingCrew,
      controllingResult: comparison.controllingResult,
    };
  }

  const api = {
    MINUTES_IN_DAY,
    calculateCrewLimits,
    calculateCrewLtot,
    calculateLtot,
    formatZuluTime,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckLtot = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
