const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CONSTANTS,
  calculateRadioAltimeterPosition,
  formatBaroAltitude,
  formatDmeDistance,
  shouldShowThreeDegreeReference,
} = require("../radio-altimeter-core");

const CASES = [
  [0, 15, 3.0, 2500.000, "~2,500 ft", "7.7 NM"],
  [0, 0, 3.0, 2637.287, "~2,640 ft", "7.7 NM"],
  [0, 50, 3.0, 2229.228, "~2,230 ft", "7.7 NM"],
  [2000, -25, 3.0, 4863.063, "~4,860 ft", "7.7 NM"],
  [-500, -25, 3.0, 2412.962, "~2,410 ft", "7.7 NM"],
  [500, -25, 3.0, 3393.002, "~3,390 ft", "7.7 NM"],
  [0, 15, 2.5, 2500.000, "~2,500 ft", "9.2 NM"],
  [0, 15, 4.0, 2500.000, "~2,500 ft", "5.8 NM"],
];

for (const [elevation, temperature, angle, expectedBaro, displayBaro, displayDistance] of CASES) {
  test(`calculates ${elevation} ft, ${temperature} C and ${angle} degrees`, () => {
    const calculation = calculateRadioAltimeterPosition({
      thresholdElevationFt: elevation,
      airportTemperatureC: temperature,
      glideSlopeAngleDeg: angle,
    });

    assert.equal(calculation.valid, true);
    assert.ok(Math.abs(calculation.result.expectedBaroAltitudeFtRaw - expectedBaro) <= 0.5);
    assert.equal(formatBaroAltitude(calculation.result.expectedBaroAltitudeFtRaw), displayBaro);
    assert.equal(formatDmeDistance(calculation.result.expectedDmeIndicationNmRaw), displayDistance);
  });
}

test("uses geometric slant range for the DME-style distance", () => {
  const calculation = calculateRadioAltimeterPosition({
    thresholdElevationFt: 0,
    airportTemperatureC: 15,
    glideSlopeAngleDeg: 3,
  });

  assert.ok(Math.abs(calculation.result.expectedDmeIndicationNmRaw - 7.704854) <= 0.00001);
});

test("calculates DME indications for references beyond and before the threshold", () => {
  const baseInput = {
    thresholdElevationFt: 0,
    airportTemperatureC: 15,
    glideSlopeAngleDeg: 3,
    dmeReferenceDistanceNm: 1,
  };
  const beyond = calculateRadioAltimeterPosition({
    ...baseInput,
    dmeReferencePosition: "BEYOND_THRESHOLD",
  });
  const before = calculateRadioAltimeterPosition({
    ...baseInput,
    dmeReferencePosition: "BEFORE_THRESHOLD",
  });

  assert.equal(formatDmeDistance(beyond.result.expectedDmeIndicationNmRaw), "8.7 NM");
  assert.equal(formatDmeDistance(before.result.expectedDmeIndicationNmRaw), "6.7 NM");
  assert.ok(beyond.result.expectedDmeIndicationNmRaw > beyond.result.thresholdSlantDistanceNmRaw);
  assert.ok(before.result.expectedDmeIndicationNmRaw < before.result.thresholdSlantDistanceNmRaw);
});

test("rejects invalid DME reference inputs", () => {
  const baseInput = {
    thresholdElevationFt: 0,
    airportTemperatureC: 15,
    glideSlopeAngleDeg: 3,
  };
  const invalidPosition = calculateRadioAltimeterPosition({
    ...baseInput,
    dmeReferencePosition: "UNKNOWN",
    dmeReferenceDistanceNm: 0,
  });
  const invalidDistance = calculateRadioAltimeterPosition({
    ...baseInput,
    dmeReferencePosition: "BEYOND_THRESHOLD",
    dmeReferenceDistanceNm: 50.1,
  });
  const thresholdWithOffset = calculateRadioAltimeterPosition({
    ...baseInput,
    dmeReferencePosition: "THRESHOLD",
    dmeReferenceDistanceNm: 0.1,
  });

  assert.equal(invalidPosition.valid, false);
  assert.equal(invalidDistance.valid, false);
  assert.equal(thresholdWithOffset.valid, false);
});

test("keeps temperature independent from slant distance", () => {
  const cold = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: -25, glideSlopeAngleDeg: 3 });
  const warm = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: 50, glideSlopeAngleDeg: 3 });

  assert.equal(cold.result.expectedDmeIndicationNmRaw, warm.result.expectedDmeIndicationNmRaw);
  assert.notEqual(cold.result.expectedBaroAltitudeFtRaw, warm.result.expectedBaroAltitudeFtRaw);
});

test("keeps the ILS glide slope independent from barometric altitude", () => {
  const shallow = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: -20, glideSlopeAngleDeg: 2.5 });
  const steep = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: -20, glideSlopeAngleDeg: 4 });

  assert.equal(shallow.result.expectedBaroAltitudeFtRaw, steep.result.expectedBaroAltitudeFtRaw);
  assert.notEqual(shallow.result.expectedDmeIndicationNmRaw, steep.result.expectedDmeIndicationNmRaw);
});

test("shows the 3 degree reference only outside the comparison band", () => {
  assert.equal(shouldShowThreeDegreeReference(2.7), true);
  assert.equal(shouldShowThreeDegreeReference(2.8), false);
  assert.equal(shouldShowThreeDegreeReference(3.0), false);
  assert.equal(shouldShowThreeDegreeReference(3.3), false);
  assert.equal(shouldShowThreeDegreeReference(3.4), true);
});

test("uses threshold elevation when calculating ISA temperature, including below sea level", () => {
  const calculation = calculateRadioAltimeterPosition({
    thresholdElevationFt: -500,
    airportTemperatureC: 15,
    glideSlopeAngleDeg: 3,
  });

  assert.equal(
    calculation.result.isaTemperatureAtThresholdC,
    CONSTANTS.ISA_SEA_LEVEL_TEMP_C + (500 * CONSTANTS.ISA_LAPSE_C_PER_FT)
  );
});

test("warns only when temperature is strictly below ISA minus 25", () => {
  const isaAt2000 = CONSTANTS.ISA_SEA_LEVEL_TEMP_C - (2000 * CONSTANTS.ISA_LAPSE_C_PER_FT);
  const atThreshold = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: isaAt2000 - 25, glideSlopeAngleDeg: 3 });
  const below = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: isaAt2000 - 25.01, glideSlopeAngleDeg: 3 });
  const above = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: isaAt2000 - 24.9, glideSlopeAngleDeg: 3 });

  assert.equal(atThreshold.result.coldWeatherWarning, false);
  assert.equal(below.result.coldWeatherWarning, true);
  assert.equal(above.result.coldWeatherWarning, false);
});

test("accepts every defined input boundary", () => {
  for (const input of [
    { thresholdElevationFt: -1500, airportTemperatureC: -25, glideSlopeAngleDeg: 2.5 },
    { thresholdElevationFt: 15000, airportTemperatureC: 50, glideSlopeAngleDeg: 4.0 },
  ]) {
    assert.equal(calculateRadioAltimeterPosition(input).valid, true);
  }
});

test("rejects missing, non-finite and out-of-range values without clamping", () => {
  const invalidInputs = [
    { thresholdElevationFt: null, airportTemperatureC: 10, glideSlopeAngleDeg: 3 },
    { thresholdElevationFt: Infinity, airportTemperatureC: 10, glideSlopeAngleDeg: 3 },
    { thresholdElevationFt: -1501, airportTemperatureC: 10, glideSlopeAngleDeg: 3 },
    { thresholdElevationFt: 15001, airportTemperatureC: 10, glideSlopeAngleDeg: 3 },
    { thresholdElevationFt: 0, airportTemperatureC: -26, glideSlopeAngleDeg: 3 },
    { thresholdElevationFt: 0, airportTemperatureC: 51, glideSlopeAngleDeg: 3 },
    { thresholdElevationFt: 0, airportTemperatureC: 10, glideSlopeAngleDeg: 2.4 },
    { thresholdElevationFt: 0, airportTemperatureC: 10, glideSlopeAngleDeg: 4.1 },
  ];

  for (const input of invalidInputs) {
    const calculation = calculateRadioAltimeterPosition(input);
    assert.equal(calculation.valid, false);
    assert.equal(calculation.result, null);
    assert.ok(Object.keys(calculation.errors).length > 0);
  }
});

test("reports barometric indication error against the true 2,500 ft RA altitude", () => {
  const cold = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: -25, glideSlopeAngleDeg: 3 });
  const isa = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: 15, glideSlopeAngleDeg: 3 });
  const warm = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: 50, glideSlopeAngleDeg: 3 });

  assert.equal(cold.result.trueBaroAltitudeFtRaw, 2500);
  assert.ok(cold.result.barometricErrorFtRaw > 0);
  assert.equal(isa.result.barometricErrorFtRaw, 0);
  assert.ok(warm.result.barometricErrorFtRaw < 0);
  assert.equal(
    warm.result.barometricErrorFtRaw,
    warm.result.expectedBaroAltitudeFtRaw - warm.result.trueBaroAltitudeFtRaw
  );
});

test("uses the published temperature range without silently clamping", () => {
  const below = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: -26, glideSlopeAngleDeg: 3 });
  const above = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: 51, glideSlopeAngleDeg: 3 });

  assert.equal(below.valid, false);
  assert.equal(above.valid, false);
  assert.equal(below.errors.airportTemperatureC, "Use a temperature between -25 and +50 degrees Celsius.");
});
