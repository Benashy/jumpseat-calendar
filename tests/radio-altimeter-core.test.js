const assert = require("node:assert/strict");
const test = require("node:test");
const {
  CONSTANTS,
  calculateRadioAltimeterPosition,
  formatBaroAltitude,
  formatHorizontalDistance,
} = require("../radio-altimeter-core");

const CASES = [
  [0, 15, 3.0, 2500.000, "~2,500 ft", "7.7 NM"],
  [0, 0, 3.0, 2637.287, "~2,640 ft", "7.7 NM"],
  [0, 50, 3.0, 2229.228, "~2,230 ft", "7.7 NM"],
  [2000, -30, 3.0, 4921.937, "~4,920 ft", "7.7 NM"],
  [-500, -30, 3.0, 2472.862, "~2,470 ft", "7.7 NM"],
  [500, -30, 3.0, 3452.492, "~3,450 ft", "7.7 NM"],
  [0, 15, 2.5, 2500.000, "~2,500 ft", "9.2 NM"],
  [0, 15, 4.0, 2500.000, "~2,500 ft", "5.8 NM"],
];

for (const [elevation, temperature, angle, expectedBaro, displayBaro, displayDistance] of CASES) {
  test(`calculates ${elevation} ft, ${temperature} C and ${angle} degrees`, () => {
    const calculation = calculateRadioAltimeterPosition({
      thresholdElevationFt: elevation,
      airportTemperatureC: temperature,
      glidepathAngleDeg: angle,
    });

    assert.equal(calculation.valid, true);
    assert.ok(Math.abs(calculation.result.expectedBaroAltitudeFtRaw - expectedBaro) <= 0.5);
    assert.equal(formatBaroAltitude(calculation.result.expectedBaroAltitudeFtRaw), displayBaro);
    assert.equal(formatHorizontalDistance(calculation.result.horizontalDistanceNmRaw), displayDistance);
  });
}

test("uses horizontal distance rather than slant range", () => {
  const calculation = calculateRadioAltimeterPosition({
    thresholdElevationFt: 0,
    airportTemperatureC: 15,
    glidepathAngleDeg: 3,
  });

  assert.ok(Math.abs(calculation.result.horizontalDistanceNmRaw - 7.693860) <= 0.00001);
  assert.ok(Math.abs(calculation.result.horizontalDistanceNmRaw - 7.704419) > 0.00001);
});

test("keeps temperature independent from horizontal distance", () => {
  const cold = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: -30, glidepathAngleDeg: 3 });
  const warm = calculateRadioAltimeterPosition({ thresholdElevationFt: 0, airportTemperatureC: 50, glidepathAngleDeg: 3 });

  assert.equal(cold.result.horizontalDistanceNmRaw, warm.result.horizontalDistanceNmRaw);
  assert.notEqual(cold.result.expectedBaroAltitudeFtRaw, warm.result.expectedBaroAltitudeFtRaw);
});

test("keeps glidepath independent from barometric altitude", () => {
  const shallow = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: -30, glidepathAngleDeg: 2.5 });
  const steep = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: -30, glidepathAngleDeg: 4 });

  assert.equal(shallow.result.expectedBaroAltitudeFtRaw, steep.result.expectedBaroAltitudeFtRaw);
  assert.notEqual(shallow.result.horizontalDistanceNmRaw, steep.result.horizontalDistanceNmRaw);
});

test("uses threshold elevation when calculating ISA temperature, including below sea level", () => {
  const calculation = calculateRadioAltimeterPosition({
    thresholdElevationFt: -500,
    airportTemperatureC: 15,
    glidepathAngleDeg: 3,
  });

  assert.equal(
    calculation.result.isaTemperatureAtThresholdC,
    CONSTANTS.ISA_SEA_LEVEL_TEMP_C + (500 * CONSTANTS.ISA_LAPSE_C_PER_FT)
  );
});

test("marks the provisional ISA minus 25 warning threshold", () => {
  const isaAt2000 = CONSTANTS.ISA_SEA_LEVEL_TEMP_C - (2000 * CONSTANTS.ISA_LAPSE_C_PER_FT);
  const below = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: isaAt2000 - 25, glidepathAngleDeg: 3 });
  const above = calculateRadioAltimeterPosition({ thresholdElevationFt: 2000, airportTemperatureC: isaAt2000 - 24.9, glidepathAngleDeg: 3 });

  assert.equal(below.result.coldWeatherWarning, true);
  assert.equal(above.result.coldWeatherWarning, false);
});

test("accepts every defined input boundary", () => {
  for (const input of [
    { thresholdElevationFt: -1500, airportTemperatureC: -60, glidepathAngleDeg: 2.5 },
    { thresholdElevationFt: 15000, airportTemperatureC: 60, glidepathAngleDeg: 4.0 },
  ]) {
    assert.equal(calculateRadioAltimeterPosition(input).valid, true);
  }
});

test("rejects missing, non-finite and out-of-range values without clamping", () => {
  const invalidInputs = [
    { thresholdElevationFt: null, airportTemperatureC: 10, glidepathAngleDeg: 3 },
    { thresholdElevationFt: Infinity, airportTemperatureC: 10, glidepathAngleDeg: 3 },
    { thresholdElevationFt: -1501, airportTemperatureC: 10, glidepathAngleDeg: 3 },
    { thresholdElevationFt: 15001, airportTemperatureC: 10, glidepathAngleDeg: 3 },
    { thresholdElevationFt: 0, airportTemperatureC: -61, glidepathAngleDeg: 3 },
    { thresholdElevationFt: 0, airportTemperatureC: 61, glidepathAngleDeg: 3 },
    { thresholdElevationFt: 0, airportTemperatureC: 10, glidepathAngleDeg: 2.4 },
    { thresholdElevationFt: 0, airportTemperatureC: 10, glidepathAngleDeg: 4.1 },
  ];

  for (const input of invalidInputs) {
    const calculation = calculateRadioAltimeterPosition(input);
    assert.equal(calculation.valid, false);
    assert.equal(calculation.result, null);
    assert.ok(Object.keys(calculation.errors).length > 0);
  }
});
