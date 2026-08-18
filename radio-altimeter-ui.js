(function initialiseRadioAltimeterUi(globalScope) {
  "use strict";

  const core = globalScope.OpsDeckRadioAltimeter;
  const form = document.querySelector("#raForm");
  if (!core || !form) return;
  const REFERENCE_GLIDEPATH_ANGLE_DEG = 3;
  const PROFILE_DISPLAY_THRESHOLD_FT = 50;

  const elements = {
    threshold: document.querySelector("#raThresholdElevation"),
    temperature: document.querySelector("#raAirportTemperature"),
    angle: document.querySelector("#raGlidepathAngle"),
    thresholdError: document.querySelector("#raThresholdError"),
    temperatureError: document.querySelector("#raTemperatureError"),
    angleError: document.querySelector("#raAngleError"),
    resultPanel: document.querySelector("#raResultPanel"),
    baro: document.querySelector("#raBaroResult"),
    distance: document.querySelector("#raDistanceResult"),
    baroComparison: document.querySelector("#raBaroComparison"),
    coldWarning: document.querySelector("#raColdWeatherWarning"),
    geometry: document.querySelector(".ra-geometry-card"),
    diagramDescription: document.querySelector("#raDiagramDescription"),
    nominalLegend: document.querySelector("#raNominalLegend"),
    selectedLegendItem: document.querySelector("#raSelectedLegendItem"),
    affectedLegendItem: document.querySelector("#raAffectedLegendItem"),
    diagramThreeDegreePath: document.querySelector("#raDiagramThreeDegreePath"),
    diagramNominalPath: document.querySelector("#raDiagramNominalPath"),
    diagramAffectedPath: document.querySelector("#raDiagramAffectedPath"),
    diagramHeight: document.querySelector("#raDiagramHeight"),
    diagramMarker: document.querySelector("#raDiagramMarker"),
    diagramBaroMarker: document.querySelector("#raDiagramBaroMarker"),
    diagramAltitudeLabel: document.querySelector("#raDiagramAltitudeLabel"),
    diagramDistanceLabel: document.querySelector("#raDiagramDistanceLabel"),
    clearButton: document.querySelector("#clearRaButton"),
  };
  const touched = new Set();
  let renderTimer = null;

  for (
    let temperature = core.CONSTANTS.MIN_AIRPORT_TEMPERATURE_C;
    temperature <= core.CONSTANTS.MAX_AIRPORT_TEMPERATURE_C;
    temperature += 1
  ) {
    const option = document.createElement("option");
    option.value = String(temperature);
    option.textContent = temperature > 0 ? `+${temperature}` : String(temperature);
    option.defaultSelected = temperature === 15;
    elements.temperature.append(option);
  }
  elements.temperature.value = "15";

  function numberOrNull(field) {
    if (field.value.trim() === "") return null;
    const value = Number(field.value);
    return Number.isFinite(value) ? value : null;
  }

  function currentInput() {
    return {
      thresholdElevationFt: numberOrNull(elements.threshold),
      airportTemperatureC: numberOrNull(elements.temperature),
      glidepathAngleDeg: numberOrNull(elements.angle),
    };
  }

  function setFieldError(field, errorElement, message, key) {
    const showError = Boolean(message) && (touched.has(key) || field.value.trim() !== "");
    field.classList.toggle("invalid", showError);
    field.setAttribute("aria-invalid", String(showError));
    errorElement.textContent = showError ? message : "";
  }

  function resetDiagram() {
    elements.geometry.classList.add("is-empty");
    elements.geometry.classList.remove("is-warning", "is-cold", "is-warm", "is-neutral");
    elements.diagramDescription.textContent = "A fixed dashed 3.0 degree reference is shown. Selected and temperature-affected approach profiles will appear when required.";
    elements.nominalLegend.textContent = "Selected glidepath";
    elements.selectedLegendItem.classList.add("hidden");
    elements.affectedLegendItem.classList.add("hidden");
    elements.diagramNominalPath.classList.add("hidden");
    elements.diagramAffectedPath.classList.add("hidden");
    elements.diagramBaroMarker.classList.add("hidden");
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = "Select valid inputs";
    elements.baroComparison.textContent = "Enter valid inputs to compare the profiles.";
  }

  function renderDiagram(result, glidepathAngleDeg) {
    const minimumDistanceNm = 5.7;
    const maximumDistanceNm = 9.3;
    const thresholdX = 34;
    const runwayY = 184;
    const nominalY = 52;
    const minimumX = 230;
    const maximumX = 360;
    const distanceToX = (distanceNm) => {
      const clampedDistance = Math.min(maximumDistanceNm, Math.max(minimumDistanceNm, distanceNm));
      return minimumX + (
        (clampedDistance - minimumDistanceNm) /
        (maximumDistanceNm - minimumDistanceNm)
      ) * (maximumX - minimumX);
    };
    const aircraftX = distanceToX(result.slantDistanceNmRaw);
    const referenceDistanceNm = (core.CONSTANTS.RA_TRIGGER_FT - core.CONSTANTS.ASSUMED_TCH_FT) /
      (core.CONSTANTS.FT_PER_NM * Math.sin(REFERENCE_GLIDEPATH_ANGLE_DEG * Math.PI / 180));
    const referenceX = distanceToX(referenceDistanceNm);
    const affectedRatio = result.indicatedHeightAboveThresholdFtRaw / core.CONSTANTS.RA_TRIGGER_FT;
    const visualAffectedRatio = 1 + ((affectedRatio - 1) * 1.55);
    const affectedY = Math.min(
      runwayY - 5,
      Math.max(20, runwayY - ((runwayY - nominalY) * visualAffectedRatio))
    );
    const labelX = (thresholdX + aircraftX) / 2;
    const formattedDistance = core.formatSlantDistance(result.slantDistanceNmRaw);
    const formattedAngle = Number(glidepathAngleDeg).toFixed(1);
    const roundedError = Math.round(Math.abs(result.barometricErrorFtRaw));
    const isMaterial = Math.abs(result.barometricErrorFtRaw) >= PROFILE_DISPLAY_THRESHOLD_FT;
    const isOverReading = result.barometricErrorFtRaw > 0;
    const selectedDiffersFromReference = Math.abs(Number(glidepathAngleDeg) - REFERENCE_GLIDEPATH_ANGLE_DEG) > 0.001;
    const comparison = !isMaterial
      ? `Difference below ${PROFILE_DISPLAY_THRESHOLD_FT} ft at 2,500 ft RA`
      : `Baro ${isOverReading ? "over-reads" : "under-reads"} by ${new Intl.NumberFormat("en-GB").format(roundedError)} ft`;
    const descriptionComparison = !isMaterial
      ? `The temperature-related difference is below ${PROFILE_DISPLAY_THRESHOLD_FT} feet at 2,500 feet radio altitude, so no separate affected profile is shown.`
      : `The barometric indication ${isOverReading ? "over-reads" : "under-reads"} by approximately ${roundedError} feet.`;

    elements.diagramThreeDegreePath.setAttribute("x2", referenceX.toFixed(1));
    elements.diagramThreeDegreePath.setAttribute("y2", String(nominalY));
    elements.diagramNominalPath.setAttribute("x2", aircraftX.toFixed(1));
    elements.diagramNominalPath.setAttribute("y2", String(nominalY));
    elements.diagramAffectedPath.setAttribute("x2", aircraftX.toFixed(1));
    elements.diagramAffectedPath.setAttribute("y2", affectedY.toFixed(1));
    elements.diagramHeight.setAttribute("x1", aircraftX.toFixed(1));
    elements.diagramHeight.setAttribute("x2", aircraftX.toFixed(1));
    elements.diagramHeight.setAttribute("y1", String(nominalY));
    elements.diagramMarker.setAttribute("cx", aircraftX.toFixed(1));
    elements.diagramMarker.setAttribute("cy", String(nominalY));
    elements.diagramBaroMarker.setAttribute("cx", aircraftX.toFixed(1));
    elements.diagramBaroMarker.setAttribute("cy", affectedY.toFixed(1));
    const putAltitudeLabelLeft = aircraftX > 325;
    elements.diagramAltitudeLabel.setAttribute("x", (aircraftX + (putAltitudeLabelLeft ? -8 : 8)).toFixed(1));
    elements.diagramAltitudeLabel.setAttribute("y", String((nominalY + runwayY) / 2));
    elements.diagramAltitudeLabel.setAttribute("text-anchor", putAltitudeLabelLeft ? "end" : "start");
    elements.diagramDistanceLabel.setAttribute("x", labelX.toFixed(1));
    elements.nominalLegend.textContent = `Selected ${formattedAngle} degree glidepath`;
    elements.selectedLegendItem.classList.toggle("hidden", !selectedDiffersFromReference);
    elements.affectedLegendItem.classList.toggle("hidden", !isMaterial);
    elements.diagramNominalPath.classList.toggle("hidden", !selectedDiffersFromReference);
    elements.diagramAffectedPath.classList.toggle("hidden", !isMaterial);
    elements.diagramBaroMarker.classList.toggle("hidden", !isMaterial);
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = `Selected ${formattedAngle} degrees / ${formattedDistance}`;
    elements.baroComparison.textContent = comparison;
    elements.diagramDescription.textContent = `The dashed reference shows 3.0 degrees. The selected ${formattedAngle} degree glidepath reaches 2,500 feet radio altitude at ${formattedDistance} slant distance from the threshold. ${descriptionComparison}${isMaterial ? " The visual separation between profiles is enlarged for clarity." : ""}`;
    elements.geometry.classList.remove("is-empty");
    elements.geometry.classList.toggle("is-warning", result.coldWeatherWarning);
    elements.geometry.classList.toggle("is-cold", isMaterial && isOverReading);
    elements.geometry.classList.toggle("is-warm", isMaterial && !isOverReading);
    elements.geometry.classList.toggle("is-neutral", !isMaterial);
  }

  function render() {
    renderTimer = null;
    const input = currentInput();
    const calculation = core.calculateRadioAltimeterPosition(input);
    setFieldError(elements.threshold, elements.thresholdError, calculation.errors.thresholdElevationFt, "thresholdElevationFt");
    setFieldError(elements.temperature, elements.temperatureError, calculation.errors.airportTemperatureC, "airportTemperatureC");
    setFieldError(elements.angle, elements.angleError, calculation.errors.glidepathAngleDeg, "glidepathAngleDeg");

    if (!calculation.valid) {
      elements.resultPanel.classList.add("is-empty");
      elements.resultPanel.removeAttribute("data-baro-raw");
      elements.resultPanel.removeAttribute("data-distance-raw");
      elements.resultPanel.removeAttribute("data-baro-error-raw");
      elements.baro.textContent = "-- ft";
      elements.distance.textContent = "-- NM";
      elements.coldWarning.classList.add("hidden");
      resetDiagram();
      return;
    }

    const result = calculation.result;
    elements.resultPanel.classList.remove("is-empty");
    elements.resultPanel.dataset.baroRaw = String(result.expectedBaroAltitudeFtRaw);
    elements.resultPanel.dataset.distanceRaw = String(result.slantDistanceNmRaw);
    elements.resultPanel.dataset.baroErrorRaw = String(result.barometricErrorFtRaw);
    elements.baro.textContent = core.formatBaroAltitude(result.expectedBaroAltitudeFtRaw);
    elements.distance.textContent = core.formatSlantDistance(result.slantDistanceNmRaw);
    elements.coldWarning.classList.toggle("hidden", !result.coldWeatherWarning);
    renderDiagram(result, input.glidepathAngleDeg);
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 140);
  }

  [
    [elements.threshold, "thresholdElevationFt"],
    [elements.temperature, "airportTemperatureC"],
    [elements.angle, "glidepathAngleDeg"],
  ].forEach(([field, key]) => {
    field.addEventListener("input", scheduleRender);
    field.addEventListener("change", scheduleRender);
    field.addEventListener("blur", () => {
      touched.add(key);
      render();
    });
  });

  elements.clearButton.addEventListener("click", () => {
    window.clearTimeout(renderTimer);
    touched.clear();
    form.reset();
    elements.threshold.value = "0";
    elements.temperature.value = "15";
    elements.angle.value = "3.0";
    render();
    elements.threshold.focus();
  });

  render();
})(typeof globalThis !== "undefined" ? globalThis : window);
