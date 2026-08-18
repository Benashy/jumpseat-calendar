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
    clearButton: document.querySelector("#clearRaButton"),
  };
  const touched = new Set();
  let renderTimer = null;

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

  function render() {
    renderTimer = null;
    const calculation = core.calculateRadioAltimeterPosition(currentInput());
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
      return;
    }

    const result = calculation.result;
    elements.resultPanel.classList.remove("is-empty");
    elements.resultPanel.dataset.baroRaw = String(result.expectedBaroAltitudeFtRaw);
    elements.resultPanel.dataset.distanceRaw = String(result.horizontalDistanceNmRaw);
    elements.baro.textContent = core.formatBaroAltitude(result.expectedBaroAltitudeFtRaw);
    elements.distance.textContent = core.formatHorizontalDistance(result.horizontalDistanceNmRaw);
    elements.support.textContent = "Assumes 2,500 ft RA, 50 ft threshold crossing height and terrain near threshold elevation.";
    elements.coldWarning.classList.toggle("hidden", !result.coldWeatherWarning);
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
    elements.angle.value = "3.0";
    render();
    elements.threshold.focus();
  });

  render();
})(typeof globalThis !== "undefined" ? globalThis : window);
