(function initialiseRadioAltimeterUi(globalScope) {
  "use strict";

  const core = globalScope.OpsDeckRadioAltimeter;
  const form = document.querySelector("#raForm");
  if (!core || !form) return;

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
    support: document.querySelector("#raResultSupport"),
    coldWarning: document.querySelector("#raColdWeatherWarning"),
    geometry: document.querySelector(".ra-geometry-card"),
    diagramDescription: document.querySelector("#raDiagramDescription"),
    diagramPath: document.querySelector("#raDiagramPath"),
    diagramHeight: document.querySelector("#raDiagramHeight"),
    diagramMarker: document.querySelector("#raDiagramMarker"),
    diagramAltitudeLabel: document.querySelector("#raDiagramAltitudeLabel"),
    diagramDistanceLabel: document.querySelector("#raDiagramDistanceLabel"),
    clearButton: document.querySelector("#clearRaButton"),
  };
  const touched = new Set();
  let renderTimer = null;

  for (let temperature = -60; temperature <= 60; temperature += 1) {
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
    elements.geometry.classList.remove("is-warning");
    elements.diagramDescription.textContent = "Approach geometry will appear when the required inputs are valid.";
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = "Select valid inputs";
  }

  function renderDiagram(result, glidepathAngleDeg) {
    const minimumDistanceNm = 5.7;
    const maximumDistanceNm = 9.3;
    const minimumX = 220;
    const maximumX = 330;
    const clampedDistance = Math.min(maximumDistanceNm, Math.max(minimumDistanceNm, result.slantDistanceNmRaw));
    const aircraftX = minimumX + (
      (clampedDistance - minimumDistanceNm) /
      (maximumDistanceNm - minimumDistanceNm)
    ) * (maximumX - minimumX);
    const labelX = (34 + aircraftX) / 2;
    const formattedDistance = core.formatSlantDistance(result.slantDistanceNmRaw);
    const formattedAngle = Number(glidepathAngleDeg).toFixed(1);

    elements.diagramPath.setAttribute("x2", aircraftX.toFixed(1));
    elements.diagramHeight.setAttribute("x1", aircraftX.toFixed(1));
    elements.diagramHeight.setAttribute("x2", aircraftX.toFixed(1));
    elements.diagramMarker.setAttribute("cx", aircraftX.toFixed(1));
    elements.diagramAltitudeLabel.setAttribute("x", aircraftX.toFixed(1));
    elements.diagramDistanceLabel.setAttribute("x", labelX.toFixed(1));
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = `${formattedAngle} degrees / ${formattedDistance}`;
    elements.diagramDescription.textContent = `Estimated ${formattedAngle} degree approach geometry at 2,500 feet radio altitude and ${formattedDistance} slant distance from the threshold.`;
    elements.geometry.classList.remove("is-empty");
    elements.geometry.classList.toggle("is-warning", result.coldWeatherWarning);
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
      elements.baro.textContent = "-- ft";
      elements.distance.textContent = "-- NM";
      elements.support.textContent = "Enter threshold elevation and airport temperature to calculate.";
      elements.coldWarning.classList.add("hidden");
      resetDiagram();
      return;
    }

    const result = calculation.result;
    elements.resultPanel.classList.remove("is-empty");
    elements.resultPanel.dataset.baroRaw = String(result.expectedBaroAltitudeFtRaw);
    elements.resultPanel.dataset.distanceRaw = String(result.slantDistanceNmRaw);
    elements.baro.textContent = core.formatBaroAltitude(result.expectedBaroAltitudeFtRaw);
    elements.distance.textContent = core.formatSlantDistance(result.slantDistanceNmRaw);
    elements.support.textContent = "Uses 2,500 ft RA and a 50 ft threshold crossing height.";
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
