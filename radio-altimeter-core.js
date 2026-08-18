(function attachRadioAltimeterCore(globalScope) {
  "use strict";

  const CONSTANTS = Object.freeze({
    RA_TRIGGER_FT: 2500,
    ASSUMED_TCH_FT: 50,
    ISA_SEA_LEVEL_TEMP_C: 15,
    ISA_LAPSE_C_PER_FT: 0.0019812,
    KELVIN_OFFSET: 273.15,
    FT_PER_NM: 6076.1154856,
    MIN_THRESHOLD_ELEVATION_FT: -1500,
    MAX_THRESHOLD_ELEVATION_FT: 15000,
    MIN_AIRPORT_TEMPERATURE_C: -60,
    MAX_AIRPORT_TEMPERATURE_C: 60,
    MIN_GLIDEPATH_ANGLE_DEG: 2.5,
    MAX_GLIDEPATH_ANGLE_DEG: 4.0,
    COLD_WARNING_ISA_DEVIATION_C: -25,
  });

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function validateRadioAltimeterInput(input) {
    const errors = {};
    const thresholdElevationFt = input?.thresholdElevationFt;
    const airportTemperatureC = input?.airportTemperatureC;
    const glidepathAngleDeg = input?.glidepathAngleDeg;

    if (!finiteNumber(thresholdElevationFt)) {
      errors.thresholdElevationFt = "Enter the landing threshold elevation.";
    } else if (
      thresholdElevationFt < CONSTANTS.MIN_THRESHOLD_ELEVATION_FT ||
      thresholdElevationFt > CONSTANTS.MAX_THRESHOLD_ELEVATION_FT
    ) {
      errors.thresholdElevationFt = "Use a threshold elevation between -1,500 and 15,000 ft.";
    }

    if (!finiteNumber(airportTemperatureC)) {
      errors.airportTemperatureC = "Enter the airport temperature.";
    } else if (
      airportTemperatureC < CONSTANTS.MIN_AIRPORT_TEMPERATURE_C ||
      airportTemperatureC > CONSTANTS.MAX_AIRPORT_TEMPERATURE_C
    ) {
      errors.airportTemperatureC = "Use a temperature between -60 and +60 degrees Celsius.";
    }

    if (!finiteNumber(glidepathAngleDeg)) {
      errors.glidepathAngleDeg = "Select a glidepath angle.";
    } else if (
      glidepathAngleDeg < CONSTANTS.MIN_GLIDEPATH_ANGLE_DEG ||
      glidepathAngleDeg > CONSTANTS.MAX_GLIDEPATH_ANGLE_DEG
    ) {
      errors.glidepathAngleDeg = "Use a glidepath angle between 2.5 and 4.0 degrees.";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  function calculateRadioAltimeterPosition(input) {
    const validation = validateRadioAltimeterInput(input);
    if (!validation.valid) {
      return {
        valid: false,
        errors: validation.errors,
        result: null,
      };
    }

    const {
      thresholdElevationFt,
      airportTemperatureC,
      glidepathAngleDeg,
    } = input;
    const isaTemperatureAtThresholdC = CONSTANTS.ISA_SEA_LEVEL_TEMP_C -
      (CONSTANTS.ISA_LAPSE_C_PER_FT * thresholdElevationFt);
    const indicatedHeightAboveThresholdFt = CONSTANTS.RA_TRIGGER_FT *
      (isaTemperatureAtThresholdC + CONSTANTS.KELVIN_OFFSET) /
      (airportTemperatureC + CONSTANTS.KELVIN_OFFSET);
    const expectedBaroAltitudeFtRaw = thresholdElevationFt + indicatedHeightAboveThresholdFt;
    const verticalHeightAboveThresholdFt = CONSTANTS.RA_TRIGGER_FT - CONSTANTS.ASSUMED_TCH_FT;
    const slantDistanceNmRaw = verticalHeightAboveThresholdFt /
      (CONSTANTS.FT_PER_NM * Math.sin(glidepathAngleDeg * Math.PI / 180));
    const isaDeviationC = airportTemperatureC - isaTemperatureAtThresholdC;

    return {
      valid: true,
      errors: {},
      result: {
        expectedBaroAltitudeFtRaw,
        slantDistanceNmRaw,
        isaTemperatureAtThresholdC,
        isaDeviationC,
        coldWeatherWarning: isaDeviationC < CONSTANTS.COLD_WARNING_ISA_DEVIATION_C,
      },
    };
  }

  function formatBaroAltitude(value) {
    if (!finiteNumber(value)) return "";
    const rounded = Math.round(value / 10) * 10;
    return `~${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(rounded)} ft`;
  }

  function formatSlantDistance(value) {
    if (!finiteNumber(value)) return "";
    return `${value.toFixed(1)} NM`;
  }

  const api = {
    CONSTANTS,
    calculateRadioAltimeterPosition,
    formatBaroAltitude,
    formatSlantDistance,
    validateRadioAltimeterInput,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckRadioAltimeter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
