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
    MIN_AIRPORT_TEMPERATURE_C: -25,
    MAX_AIRPORT_TEMPERATURE_C: 50,
    MIN_GLIDE_SLOPE_ANGLE_DEG: 2.5,
    MAX_GLIDE_SLOPE_ANGLE_DEG: 4.0,
    REFERENCE_GLIDE_SLOPE_ANGLE_DEG: 3.0,
    REFERENCE_DISPLAY_MIN_ANGLE_DEG: 2.8,
    REFERENCE_DISPLAY_MAX_ANGLE_DEG: 3.3,
    MAX_DME_REFERENCE_DISTANCE_NM: 50,
    COLD_WARNING_ISA_DEVIATION_C: -25,
  });
  const DME_REFERENCE_POSITIONS = Object.freeze([
    "THRESHOLD",
    "BEYOND_THRESHOLD",
    "BEFORE_THRESHOLD",
  ]);
  const APPROACH_MODES = Object.freeze([
    "ILS",
    "FLS",
    "FINAL_APP",
  ]);
  const TEMPERATURE_PROFILES = Object.freeze({
    ILS_GEOMETRIC: "ILS_GEOMETRIC",
    FLS_COMPENSATED_BELOW_ISA: "FLS_COMPENSATED_BELOW_ISA",
    FLS_AT_ISA: "FLS_AT_ISA",
    FLS_UNCOMPENSATED_ABOVE_ISA: "FLS_UNCOMPENSATED_ABOVE_ISA",
    FINAL_APP_BELOW_GENERIC_MINIMUM: "FINAL_APP_BELOW_GENERIC_MINIMUM",
    FINAL_APP_BELOW_ISA: "FINAL_APP_BELOW_ISA",
    FINAL_APP_AT_ISA: "FINAL_APP_AT_ISA",
    FINAL_APP_ABOVE_ISA: "FINAL_APP_ABOVE_ISA",
  });

  function finiteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
  }

  function validateRadioAltimeterInput(input) {
    const errors = {};
    const approachMode = input?.approachMode ?? "ILS";
    const thresholdElevationFt = input?.thresholdElevationFt;
    const airportTemperatureC = input?.airportTemperatureC;
    const glideSlopeAngleDeg = input?.glideSlopeAngleDeg;
    const dmeReferencePosition = input?.dmeReferencePosition ?? "THRESHOLD";
    const dmeReferenceDistanceNm = input?.dmeReferenceDistanceNm ?? 0;

    if (!APPROACH_MODES.includes(approachMode)) {
      errors.approachMode = "Select an approach type.";
    }

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
      errors.airportTemperatureC = "Use a temperature between -25 and +50 degrees Celsius.";
    }

    const angleName = approachMode === "FLS"
      ? "FLS coded slope"
      : approachMode === "FINAL_APP"
        ? "FINAL APP coded FPA"
        : "ILS glide slope angle";
    if (!finiteNumber(glideSlopeAngleDeg)) {
      errors.glideSlopeAngleDeg = `Select the ${angleName}.`;
    } else if (
      glideSlopeAngleDeg < CONSTANTS.MIN_GLIDE_SLOPE_ANGLE_DEG ||
      glideSlopeAngleDeg > CONSTANTS.MAX_GLIDE_SLOPE_ANGLE_DEG
    ) {
      errors.glideSlopeAngleDeg = `Use an angle between 2.5 and 4.0 degrees for the ${angleName}.`;
    }

    if (approachMode === "ILS") {
      if (!DME_REFERENCE_POSITIONS.includes(dmeReferencePosition)) {
        errors.dmeReferencePosition = "Select the DME reference position.";
      }

      if (!finiteNumber(dmeReferenceDistanceNm)) {
        errors.dmeReferenceDistanceNm = "Enter the DME reference distance.";
      } else if (
        dmeReferenceDistanceNm < 0 ||
        dmeReferenceDistanceNm > CONSTANTS.MAX_DME_REFERENCE_DISTANCE_NM
      ) {
        errors.dmeReferenceDistanceNm = "Use a DME reference distance between 0.0 and 50.0 NM.";
      } else if (dmeReferencePosition === "THRESHOLD" && dmeReferenceDistanceNm !== 0) {
        errors.dmeReferenceDistanceNm = "Use 0.0 NM when the DME reference is at the threshold.";
      }
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  function classifyTemperatureProfile(approachMode, isaDeviationC) {
    if (approachMode === "FLS") {
      if (isaDeviationC < 0) return TEMPERATURE_PROFILES.FLS_COMPENSATED_BELOW_ISA;
      if (isaDeviationC > 0) return TEMPERATURE_PROFILES.FLS_UNCOMPENSATED_ABOVE_ISA;
      return TEMPERATURE_PROFILES.FLS_AT_ISA;
    }

    if (approachMode === "FINAL_APP") {
      if (isaDeviationC < CONSTANTS.COLD_WARNING_ISA_DEVIATION_C) {
        return TEMPERATURE_PROFILES.FINAL_APP_BELOW_GENERIC_MINIMUM;
      }
      if (isaDeviationC < 0) return TEMPERATURE_PROFILES.FINAL_APP_BELOW_ISA;
      if (isaDeviationC > 0) return TEMPERATURE_PROFILES.FINAL_APP_ABOVE_ISA;
      return TEMPERATURE_PROFILES.FINAL_APP_AT_ISA;
    }

    return TEMPERATURE_PROFILES.ILS_GEOMETRIC;
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
      glideSlopeAngleDeg,
    } = input;
    const approachMode = input.approachMode ?? "ILS";
    const dmeReferencePosition = approachMode === "ILS"
      ? input.dmeReferencePosition ?? "THRESHOLD"
      : "THRESHOLD";
    const dmeReferenceDistanceNm = approachMode === "ILS"
      ? input.dmeReferenceDistanceNm ?? 0
      : 0;
    const isaTemperatureAtThresholdC = CONSTANTS.ISA_SEA_LEVEL_TEMP_C -
      (CONSTANTS.ISA_LAPSE_C_PER_FT * thresholdElevationFt);
    const indicatedHeightAboveThresholdFt = CONSTANTS.RA_TRIGGER_FT *
      (isaTemperatureAtThresholdC + CONSTANTS.KELVIN_OFFSET) /
      (airportTemperatureC + CONSTANTS.KELVIN_OFFSET);
    const trueBaroAltitudeFtRaw = thresholdElevationFt + CONSTANTS.RA_TRIGGER_FT;
    const expectedBaroAltitudeFtRaw = thresholdElevationFt + indicatedHeightAboveThresholdFt;
    const barometricErrorFtRaw = expectedBaroAltitudeFtRaw - trueBaroAltitudeFtRaw;
    const verticalHeightAbovePathAnchorFt = CONSTANTS.RA_TRIGGER_FT - CONSTANTS.ASSUMED_TCH_FT;
    const glideSlopeRadians = glideSlopeAngleDeg * Math.PI / 180;
    const horizontalDistanceFromThresholdFt = verticalHeightAbovePathAnchorFt / Math.tan(glideSlopeRadians);
    const horizontalDistanceFromThresholdNmRaw = horizontalDistanceFromThresholdFt /
      CONSTANTS.FT_PER_NM;
    const thresholdSlantDistanceNmRaw = Math.hypot(
      horizontalDistanceFromThresholdFt,
      CONSTANTS.RA_TRIGGER_FT
    ) / CONSTANTS.FT_PER_NM;
    const dmeReferenceOffsetFt = dmeReferenceDistanceNm * CONSTANTS.FT_PER_NM;
    const signedDmeReferenceOffsetFt = dmeReferencePosition === "BEYOND_THRESHOLD"
      ? dmeReferenceOffsetFt
      : dmeReferencePosition === "BEFORE_THRESHOLD"
        ? -dmeReferenceOffsetFt
        : 0;
    const horizontalDistanceToDmeReferenceFt = Math.abs(
      -horizontalDistanceFromThresholdFt - signedDmeReferenceOffsetFt
    );
    const expectedDmeIndicationNmRaw = Math.hypot(
      horizontalDistanceToDmeReferenceFt,
      CONSTANTS.RA_TRIGGER_FT
    ) / CONSTANTS.FT_PER_NM;
    const isaDeviationC = airportTemperatureC - isaTemperatureAtThresholdC;
    const temperatureProfile = classifyTemperatureProfile(approachMode, isaDeviationC);

    return {
      valid: true,
      errors: {},
      result: {
        indicatedHeightAboveThresholdFtRaw: indicatedHeightAboveThresholdFt,
        trueBaroAltitudeFtRaw,
        expectedBaroAltitudeFtRaw,
        barometricErrorFtRaw,
        horizontalDistanceFromThresholdFt,
        horizontalDistanceFromThresholdNmRaw,
        thresholdSlantDistanceNmRaw,
        expectedDmeIndicationNmRaw,
        isaTemperatureAtThresholdC,
        isaDeviationC,
        approachMode,
        temperatureProfile,
        coldWeatherWarning: isaDeviationC < CONSTANTS.COLD_WARNING_ISA_DEVIATION_C,
      },
    };
  }

  function formatBaroAltitude(value) {
    if (!finiteNumber(value)) return "";
    const rounded = Math.round(value / 10) * 10;
    return `~${new Intl.NumberFormat("en-GB", { maximumFractionDigits: 0 }).format(rounded)} ft`;
  }

  function formatDmeDistance(value) {
    if (!finiteNumber(value)) return "";
    return `${value.toFixed(1)} NM`;
  }

  function shouldShowThreeDegreeReference(glideSlopeAngleDeg) {
    return finiteNumber(glideSlopeAngleDeg) && (
      glideSlopeAngleDeg < CONSTANTS.REFERENCE_DISPLAY_MIN_ANGLE_DEG ||
      glideSlopeAngleDeg > CONSTANTS.REFERENCE_DISPLAY_MAX_ANGLE_DEG
    );
  }

  const api = {
    APPROACH_MODES,
    CONSTANTS,
    DME_REFERENCE_POSITIONS,
    TEMPERATURE_PROFILES,
    calculateRadioAltimeterPosition,
    classifyTemperatureProfile,
    formatBaroAltitude,
    formatDmeDistance,
    shouldShowThreeDegreeReference,
    validateRadioAltimeterInput,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.OpsDeckRadioAltimeter = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
