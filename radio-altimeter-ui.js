(function initialiseRadioAltimeterUi(globalScope) {
  "use strict";

  const core = globalScope.OpsDeckRadioAltimeter;
  const form = document.querySelector("#raForm");
  if (!core || !form) return;
  const PROFILE_DISPLAY_THRESHOLD_FT = 50;

  const elements = {
    threshold: document.querySelector("#raThresholdElevation"),
    temperature: document.querySelector("#raAirportTemperature"),
    angle: document.querySelector("#raGlideSlopeAngle"),
    dmeReferencePosition: document.querySelector("#raDmeReferencePosition"),
    dmeReferenceDistance: document.querySelector("#raDmeReferenceDistance"),
    thresholdError: document.querySelector("#raThresholdError"),
    temperatureError: document.querySelector("#raTemperatureError"),
    angleError: document.querySelector("#raAngleError"),
    dmeReferencePositionError: document.querySelector("#raDmeReferencePositionError"),
    dmeReferenceDistanceError: document.querySelector("#raDmeReferenceDistanceError"),
    resultPanel: document.querySelector("#raResultPanel"),
    baro: document.querySelector("#raBaroResult"),
    distance: document.querySelector("#raDistanceResult"),
    dmeReferenceResult: document.querySelector("#raDmeReferenceResult"),
    baroComparison: document.querySelector("#raBaroComparison"),
    coldWarning: document.querySelector("#raColdWeatherWarning"),
    geometry: document.querySelector(".ra-geometry-card"),
    diagramDescription: document.querySelector("#raDiagramDescription"),
    referenceLegendItem: document.querySelector("#raReferenceLegendItem"),
    nominalLegend: document.querySelector("#raNominalLegend"),
    selectedLegendItem: document.querySelector("#raSelectedLegendItem"),
    diagramThreeDegreePath: document.querySelector("#raDiagramThreeDegreePath"),
    diagramNominalPath: document.querySelector("#raDiagramNominalPath"),
    diagramHeight: document.querySelector("#raDiagramHeight"),
    diagramMarker: document.querySelector("#raDiagramMarker"),
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
      glideSlopeAngleDeg: numberOrNull(elements.angle),
      dmeReferencePosition: elements.dmeReferencePosition.value,
      dmeReferenceDistanceNm: numberOrNull(elements.dmeReferenceDistance),
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
    elements.diagramDescription.textContent = "The selected ILS glide slope will appear when valid inputs are available.";
    elements.referenceLegendItem.classList.add("hidden");
    elements.nominalLegend.textContent = "Selected glide slope";
    elements.selectedLegendItem.classList.add("hidden");
    elements.diagramThreeDegreePath.classList.add("hidden");
    elements.diagramNominalPath.classList.add("hidden");
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = "Select valid inputs";
    elements.baroComparison.textContent = "Enter valid inputs to calculate the expected QNH indication.";
  }

  function dmeReferenceDescription(position, distanceNm) {
    if (position === "BEYOND_THRESHOLD") return `${distanceNm.toFixed(1)} NM beyond the threshold`;
    if (position === "BEFORE_THRESHOLD") return `${distanceNm.toFixed(1)} NM before the threshold`;
    return "at the threshold";
  }

  function renderDiagram(result, glideSlopeAngleDeg, dmeReferencePosition, dmeReferenceDistanceNm) {
    const minimumDistanceNm = 5.7;
    const maximumDistanceNm = 9.3;
    const thresholdX = 44;
    const runwayY = 205;
    const nominalY = 48;
    const minimumX = 360;
    const maximumX = 465;
    const distanceToX = (distanceNm) => {
      const clampedDistance = Math.min(maximumDistanceNm, Math.max(minimumDistanceNm, distanceNm));
      return minimumX + (
        (clampedDistance - minimumDistanceNm) /
        (maximumDistanceNm - minimumDistanceNm)
      ) * (maximumX - minimumX);
    };
    const aircraftX = distanceToX(result.thresholdSlantDistanceNmRaw);
    const referenceHorizontalDistanceFt = (core.CONSTANTS.RA_TRIGGER_FT - core.CONSTANTS.ASSUMED_TCH_FT) /
      Math.tan(core.CONSTANTS.REFERENCE_GLIDE_SLOPE_ANGLE_DEG * Math.PI / 180);
    const referenceDistanceNm = Math.hypot(
      referenceHorizontalDistanceFt,
      core.CONSTANTS.RA_TRIGGER_FT
    ) / core.CONSTANTS.FT_PER_NM;
    const referenceX = distanceToX(referenceDistanceNm);
    const labelX = (thresholdX + aircraftX) / 2;
    const formattedDme = core.formatDmeDistance(result.expectedDmeIndicationNmRaw);
    const formattedThresholdDistance = core.formatDmeDistance(result.thresholdSlantDistanceNmRaw);
    const formattedAngle = Number(glideSlopeAngleDeg).toFixed(1);
    const roundedError = Math.round(Math.abs(result.barometricErrorFtRaw));
    const isMaterial = Math.abs(result.barometricErrorFtRaw) >= PROFILE_DISPLAY_THRESHOLD_FT;
    const isOverReading = result.barometricErrorFtRaw > 0;
    const showReference = core.shouldShowThreeDegreeReference(Number(glideSlopeAngleDeg));
    const comparison = !isMaterial
      ? `Temperature correction is less than ${PROFILE_DISPLAY_THRESHOLD_FT} ft at 2,500 ft RA`
      : `Baro ${isOverReading ? "over-reads" : "under-reads"} by ${new Intl.NumberFormat("en-GB").format(roundedError)} ft`;
    const descriptionComparison = !isMaterial
      ? `The temperature correction is less than ${PROFILE_DISPLAY_THRESHOLD_FT} feet at 2,500 feet radio altitude.`
      : `The expected barometric indication ${isOverReading ? "over-reads" : "under-reads"} by approximately ${roundedError} feet.`;

    elements.diagramThreeDegreePath.setAttribute("x2", referenceX.toFixed(1));
    elements.diagramThreeDegreePath.setAttribute("y2", String(nominalY));
    elements.diagramNominalPath.setAttribute("x2", aircraftX.toFixed(1));
    elements.diagramNominalPath.setAttribute("y2", String(nominalY));
    elements.diagramHeight.setAttribute("x1", aircraftX.toFixed(1));
    elements.diagramHeight.setAttribute("x2", aircraftX.toFixed(1));
    elements.diagramHeight.setAttribute("y1", String(nominalY));
    elements.diagramMarker.setAttribute("cx", aircraftX.toFixed(1));
    elements.diagramMarker.setAttribute("cy", String(nominalY));
    const putAltitudeLabelLeft = aircraftX > 445;
    elements.diagramAltitudeLabel.setAttribute("x", (aircraftX + (putAltitudeLabelLeft ? -8 : 8)).toFixed(1));
    elements.diagramAltitudeLabel.setAttribute("y", String((nominalY + runwayY) / 2));
    elements.diagramAltitudeLabel.setAttribute("text-anchor", putAltitudeLabelLeft ? "end" : "start");
    elements.diagramDistanceLabel.setAttribute("x", labelX.toFixed(1));
    elements.referenceLegendItem.classList.toggle("hidden", !showReference);
    elements.diagramThreeDegreePath.classList.toggle("hidden", !showReference);
    elements.nominalLegend.textContent = `Selected ${formattedAngle}\u00b0 glide slope`;
    elements.selectedLegendItem.classList.remove("hidden");
    elements.diagramNominalPath.classList.remove("hidden");
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = `${formattedAngle}\u00b0 ILS | ${formattedThresholdDistance} to THR`;
    elements.baroComparison.textContent = comparison;
    const referenceDescription = showReference
      ? "A dashed 3.0 degree comparison is also shown because the selected glide slope is outside the 2.8 to 3.3 degree comparison band."
      : "No dashed 3.0 degree comparison is shown because the selected glide slope is within the 2.8 to 3.3 degree comparison band.";
    const dmeReference = dmeReferenceDescription(dmeReferencePosition, dmeReferenceDistanceNm);
    elements.diagramDescription.textContent = `The selected ${formattedAngle} degree ILS glide slope reaches 2,500 feet radio altitude at an expected DME indication of ${formattedDme}, with the DME reference ${dmeReference}. ${referenceDescription} ${descriptionComparison}`;
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
    setFieldError(elements.angle, elements.angleError, calculation.errors.glideSlopeAngleDeg, "glideSlopeAngleDeg");
    setFieldError(elements.dmeReferencePosition, elements.dmeReferencePositionError, calculation.errors.dmeReferencePosition, "dmeReferencePosition");
    setFieldError(elements.dmeReferenceDistance, elements.dmeReferenceDistanceError, calculation.errors.dmeReferenceDistanceNm, "dmeReferenceDistanceNm");

    if (!calculation.valid) {
      elements.resultPanel.classList.add("is-empty");
      elements.resultPanel.removeAttribute("data-baro-raw");
      elements.resultPanel.removeAttribute("data-distance-raw");
      elements.resultPanel.removeAttribute("data-baro-error-raw");
      elements.baro.textContent = "-- ft";
      elements.distance.textContent = "-- NM";
      elements.dmeReferenceResult.textContent = "Reference at the threshold";
      elements.dmeReferenceResult.classList.remove("is-offset-reference");
      elements.coldWarning.classList.add("hidden");
      resetDiagram();
      return;
    }

    const result = calculation.result;
    elements.resultPanel.classList.remove("is-empty");
    elements.resultPanel.dataset.baroRaw = String(result.expectedBaroAltitudeFtRaw);
    elements.resultPanel.dataset.distanceRaw = String(result.expectedDmeIndicationNmRaw);
    elements.resultPanel.dataset.baroErrorRaw = String(result.barometricErrorFtRaw);
    elements.baro.textContent = core.formatBaroAltitude(result.expectedBaroAltitudeFtRaw);
    elements.distance.textContent = core.formatDmeDistance(result.expectedDmeIndicationNmRaw);
    elements.dmeReferenceResult.textContent = `Reference ${dmeReferenceDescription(
      input.dmeReferencePosition,
      input.dmeReferenceDistanceNm
    )}`;
    elements.dmeReferenceResult.classList.toggle(
      "is-offset-reference",
      input.dmeReferencePosition !== "THRESHOLD"
    );
    elements.coldWarning.classList.toggle("hidden", !result.coldWeatherWarning);
    renderDiagram(
      result,
      input.glideSlopeAngleDeg,
      input.dmeReferencePosition,
      input.dmeReferenceDistanceNm
    );
  }

  function scheduleRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 140);
  }

  [
    [elements.threshold, "thresholdElevationFt"],
    [elements.temperature, "airportTemperatureC"],
    [elements.angle, "glideSlopeAngleDeg"],
    [elements.dmeReferencePosition, "dmeReferencePosition"],
    [elements.dmeReferenceDistance, "dmeReferenceDistanceNm"],
  ].forEach(([field, key]) => {
    field.addEventListener("input", scheduleRender);
    field.addEventListener("change", scheduleRender);
    field.addEventListener("blur", () => {
      touched.add(key);
      render();
    });
  });

  elements.dmeReferencePosition.addEventListener("change", () => {
    const atThreshold = elements.dmeReferencePosition.value === "THRESHOLD";
    elements.dmeReferenceDistance.disabled = atThreshold;
    if (atThreshold) elements.dmeReferenceDistance.value = "0.0";
    render();
  });

  elements.clearButton.addEventListener("click", () => {
    window.clearTimeout(renderTimer);
    touched.clear();
    form.reset();
    elements.threshold.value = "0";
    elements.temperature.value = "15";
    elements.angle.value = "3.0";
    elements.dmeReferencePosition.value = "THRESHOLD";
    elements.dmeReferenceDistance.value = "0.0";
    elements.dmeReferenceDistance.disabled = true;
    render();
    elements.threshold.focus();
  });

  render();
})(typeof globalThis !== "undefined" ? globalThis : window);
