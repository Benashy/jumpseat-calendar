(function initialiseRadioAltimeterUi(globalScope) {
  "use strict";

  const core = globalScope.OpsDeckRadioAltimeter;
  const form = document.querySelector("#raForm");
  if (!core || !form) return;

  const PROFILE_DISPLAY_THRESHOLD_FT = 50;
  const PROFILE_OFFSET_Y = 22;
  const MODE_COPY = Object.freeze({
    ILS: {
      angleLabel: "ILS glide slope angle",
      geometryTitle: "ILS geometry",
      selectedPath: "glide slope",
      compactPath: "ILS",
      distanceLabel: "Expected DME indication",
    },
    FLS: {
      angleLabel: "FLS coded slope",
      geometryTitle: "FLS profile",
      selectedPath: "FLS slope",
      compactPath: "FLS",
      distanceLabel: "Approx. ground distance to threshold",
    },
    FINAL_APP: {
      angleLabel: "FINAL APP coded FPA",
      geometryTitle: "FINAL APP profile",
      selectedPath: "coded FPA",
      compactPath: "FINAL APP",
      distanceLabel: "Approx. ground distance to threshold",
    },
  });

  const elements = {
    modeSelector: document.querySelector("#raApproachModeSelector"),
    modeButtons: [...document.querySelectorAll("[data-ra-mode]")],
    modeError: document.querySelector("#raApproachModeError"),
    underTestBadge: document.querySelector("#raUnderTestBadge"),
    threshold: document.querySelector("#raThresholdElevation"),
    temperature: document.querySelector("#raAirportTemperature"),
    angle: document.querySelector("#raGlideSlopeAngle"),
    angleLabel: document.querySelector("#raAngleLabel"),
    dmeReferencePositionField: document.querySelector("#raDmeReferencePositionField"),
    dmeReferenceDistanceField: document.querySelector("#raDmeReferenceDistanceField"),
    dmeReferencePosition: document.querySelector("#raDmeReferencePosition"),
    dmeReferenceDistance: document.querySelector("#raDmeReferenceDistance"),
    thresholdError: document.querySelector("#raThresholdError"),
    temperatureError: document.querySelector("#raTemperatureError"),
    angleError: document.querySelector("#raAngleError"),
    dmeReferencePositionError: document.querySelector("#raDmeReferencePositionError"),
    dmeReferenceDistanceError: document.querySelector("#raDmeReferenceDistanceError"),
    resultPanel: document.querySelector("#raResultPanel"),
    resultEyebrow: document.querySelector("#raResultEyebrow"),
    baro: document.querySelector("#raBaroResult"),
    distance: document.querySelector("#raDistanceResult"),
    distanceLabel: document.querySelector("#raDistanceResultLabel"),
    dmeReferenceResult: document.querySelector("#raDmeReferenceResult"),
    baroComparison: document.querySelector("#raBaroComparison"),
    coldWarning: document.querySelector("#raColdWeatherWarning"),
    coldWarningTitle: document.querySelector("#raColdWeatherWarningTitle"),
    coldWarningText: document.querySelector("#raColdWeatherWarningText"),
    geometry: document.querySelector(".ra-geometry-card"),
    geometryTitle: document.querySelector("#raGeometryTitle"),
    geometryQualifier: document.querySelector("#raGeometryQualifier"),
    diagramDescription: document.querySelector("#raDiagramDescription"),
    referenceLegendItem: document.querySelector("#raReferenceLegendItem"),
    nominalLegend: document.querySelector("#raNominalLegend"),
    selectedLegendItem: document.querySelector("#raSelectedLegendItem"),
    temperatureLegendItem: document.querySelector("#raTemperatureLegendItem"),
    temperatureLegend: document.querySelector("#raTemperatureLegend"),
    temperatureLegendSwatch: document.querySelector(".ra-legend-line.is-temperature"),
    diagramThreeDegreePath: document.querySelector("#raDiagramThreeDegreePath"),
    diagramNominalPath: document.querySelector("#raDiagramNominalPath"),
    diagramTemperaturePath: document.querySelector("#raDiagramTemperaturePath"),
    diagramHeight: document.querySelector("#raDiagramHeight"),
    diagramMarker: document.querySelector("#raDiagramMarker"),
    diagramAltitudeLabel: document.querySelector("#raDiagramAltitudeLabel"),
    diagramDistanceLabel: document.querySelector("#raDiagramDistanceLabel"),
    profileNote: document.querySelector("#raProfileNote"),
    clearButton: document.querySelector("#clearRaButton"),
  };

  const touched = new Set();
  let renderTimer = null;
  let selectedMode = "ILS";

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
      approachMode: selectedMode,
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

  function setMode(mode, { focus = false } = {}) {
    if (!core.APPROACH_MODES.includes(mode)) return;
    selectedMode = mode;
    const isIls = mode === "ILS";

    elements.modeButtons.forEach((button) => {
      const selected = button.dataset.raMode === mode;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });

    elements.underTestBadge.classList.toggle("hidden", isIls);
    elements.dmeReferencePositionField.classList.toggle("hidden", !isIls);
    elements.dmeReferenceDistanceField.classList.toggle("hidden", !isIls);
    elements.dmeReferencePosition.disabled = !isIls;
    elements.dmeReferenceDistance.disabled = !isIls || elements.dmeReferencePosition.value === "THRESHOLD";
    elements.angleLabel.textContent = MODE_COPY[mode].angleLabel;
    elements.distanceLabel.textContent = MODE_COPY[mode].distanceLabel;
    elements.geometryTitle.textContent = MODE_COPY[mode].geometryTitle;
    elements.geometryQualifier.classList.toggle("hidden", isIls);
    touched.delete("approachMode");
    elements.modeError.textContent = "";
    render();
  }

  function resetTemperatureProfile() {
    elements.temperatureLegendItem.classList.add("hidden");
    elements.temperatureLegendSwatch.classList.remove("is-cold", "is-warm", "is-compensated");
    elements.diagramTemperaturePath.classList.add("hidden");
    elements.diagramTemperaturePath.classList.remove("is-cold", "is-warm", "is-compensated");
    elements.profileNote.classList.add("hidden");
    elements.profileNote.classList.remove("is-warning");
    elements.profileNote.textContent = "";
    elements.geometry.classList.remove("is-profile-unavailable");
  }

  function resetDiagram() {
    const copy = MODE_COPY[selectedMode];
    elements.geometry.classList.add("is-empty");
    elements.geometry.classList.remove("is-warning", "is-cold", "is-warm", "is-neutral");
    elements.diagramDescription.textContent = `The selected ${copy.selectedPath} will appear when valid inputs are available.`;
    elements.referenceLegendItem.classList.add("hidden");
    elements.nominalLegend.textContent = `Selected ${copy.selectedPath}`;
    elements.selectedLegendItem.classList.add("hidden");
    elements.diagramThreeDegreePath.classList.add("hidden");
    elements.diagramNominalPath.classList.add("hidden");
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = "Select valid inputs";
    elements.baroComparison.textContent = "Enter valid inputs to calculate the expected QNH indication.";
    resetTemperatureProfile();
  }

  function dmeReferenceDescription(position, distanceNm) {
    if (position === "BEYOND_THRESHOLD") return `${distanceNm.toFixed(1)} NM beyond the threshold`;
    if (position === "BEFORE_THRESHOLD") return `${distanceNm.toFixed(1)} NM before the threshold`;
    return "at the threshold";
  }

  function setTemperatureProfile(result, nominalX, nominalY) {
    resetTemperatureProfile();
    const profile = result.temperatureProfile;
    let endY = nominalY;
    let colourClass = "";
    let legend = "";
    let note = "";
    let warning = false;

    switch (profile) {
      case core.TEMPERATURE_PROFILES.FLS_COMPENSATED_BELOW_ISA:
        colourClass = "is-compensated";
        legend = "Below-ISA correction active";
        note = "FLS temperature correction is active below ISA. Exact corrected profile displacement is not modelled.";
        break;
      case core.TEMPERATURE_PROFILES.FLS_UNCOMPENSATED_ABOVE_ISA:
        endY = nominalY - PROFILE_OFFSET_Y;
        colourClass = "is-warm";
        legend = "Hot-weather profile cue";
        note = "At or above ISA, FLS is not automatically temperature-adjusted. BA EGLL guidance says the flown path may be steeper in hot conditions.";
        break;
      case core.TEMPERATURE_PROFILES.FINAL_APP_BELOW_GENERIC_MINIMUM:
        warning = true;
        note = "FINAL APP is unavailable below the applicable minimum temperature. A published limit may be warmer than ISA -25.";
        elements.geometry.classList.add("is-profile-unavailable");
        break;
      case core.TEMPERATURE_PROFILES.FINAL_APP_BELOW_ISA:
        endY = nominalY + PROFILE_OFFSET_Y;
        colourClass = "is-cold";
        legend = "Cold-weather profile cue";
        note = "FINAL APP is not temperature-compensated. The shallower cold-weather profile is an under-test, cross-source illustration.";
        break;
      case core.TEMPERATURE_PROFILES.FINAL_APP_ABOVE_ISA:
        endY = nominalY - PROFILE_OFFSET_Y;
        colourClass = "is-warm";
        legend = "Hot-weather profile cue";
        note = "FINAL APP is not temperature-compensated. The steeper hot-weather profile is an under-test, cross-source illustration.";
        break;
      default:
        break;
    }

    if (colourClass) {
      elements.diagramTemperaturePath.setAttribute("x2", nominalX.toFixed(1));
      elements.diagramTemperaturePath.setAttribute("y2", String(endY));
      elements.diagramTemperaturePath.classList.add(colourClass);
      elements.diagramTemperaturePath.classList.remove("hidden");
      elements.temperatureLegendSwatch.classList.add(colourClass);
      elements.temperatureLegend.textContent = legend;
      elements.temperatureLegendItem.classList.remove("hidden");
    }

    if (note) {
      elements.profileNote.textContent = note;
      elements.profileNote.classList.toggle("is-warning", warning);
      elements.profileNote.classList.remove("hidden");
    }
  }

  function renderDiagram(result, input) {
    const copy = MODE_COPY[input.approachMode];
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
    const formattedDistance = input.approachMode === "ILS"
      ? core.formatDmeDistance(result.expectedDmeIndicationNmRaw)
      : core.formatDmeDistance(result.horizontalDistanceFromThresholdNmRaw);
    const formattedThresholdDistance = core.formatDmeDistance(
      input.approachMode === "ILS"
        ? result.thresholdSlantDistanceNmRaw
        : result.horizontalDistanceFromThresholdNmRaw
    );
    const formattedAngle = Number(input.glideSlopeAngleDeg).toFixed(1);
    const roundedError = Math.round(Math.abs(result.barometricErrorFtRaw));
    const isMaterial = Math.abs(result.barometricErrorFtRaw) >= PROFILE_DISPLAY_THRESHOLD_FT;
    const isOverReading = result.barometricErrorFtRaw > 0;
    const showReference = core.shouldShowThreeDegreeReference(Number(input.glideSlopeAngleDeg));
    const comparison = !isMaterial
      ? `Temperature effect on expected QNH is less than ${PROFILE_DISPLAY_THRESHOLD_FT} ft`
      : `Expected QNH ${isOverReading ? "over-reads" : "under-reads"} by ${new Intl.NumberFormat("en-GB").format(roundedError)} ft`;
    const descriptionComparison = !isMaterial
      ? `The temperature effect on the expected QNH indication is less than ${PROFILE_DISPLAY_THRESHOLD_FT} feet.`
      : `The expected QNH indication ${isOverReading ? "over-reads" : "under-reads"} by approximately ${roundedError} feet.`;

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
    elements.nominalLegend.textContent = `Selected ${formattedAngle}\u00b0 ${copy.selectedPath}`;
    elements.selectedLegendItem.classList.remove("hidden");
    elements.diagramNominalPath.classList.remove("hidden");
    elements.diagramAltitudeLabel.textContent = "2,500 ft RA";
    elements.diagramDistanceLabel.textContent = `${formattedAngle}\u00b0 ${copy.compactPath} | ${formattedThresholdDistance} to THR`;
    elements.baroComparison.textContent = comparison;

    const referenceDescription = showReference
      ? "A dashed 3.0 degree comparison is shown because the selected angle is outside the 2.8 to 3.3 degree comparison band."
      : "The selected angle is within the 2.8 to 3.3 degree comparison band.";
    const distanceDescription = input.approachMode === "ILS"
      ? `an expected DME indication of ${formattedDistance}, with the DME reference ${dmeReferenceDescription(input.dmeReferencePosition, input.dmeReferenceDistanceNm)}`
      : `an approximate threshold-referenced ground distance of ${formattedDistance}`;
    elements.diagramDescription.textContent = `The selected ${formattedAngle} degree ${copy.selectedPath} reaches 2,500 feet radio altitude at ${distanceDescription}. ${referenceDescription} ${descriptionComparison}`;
    elements.geometry.classList.remove("is-empty");
    elements.geometry.classList.toggle("is-warning", result.coldWeatherWarning);
    elements.geometry.classList.toggle("is-cold", isMaterial && isOverReading);
    elements.geometry.classList.toggle("is-warm", isMaterial && !isOverReading);
    elements.geometry.classList.toggle("is-neutral", !isMaterial);

    if (input.approachMode === "ILS") resetTemperatureProfile();
    else setTemperatureProfile(result, aircraftX, nominalY);
  }

  function renderColdWarning(result) {
    if (!result.coldWeatherWarning) {
      elements.coldWarning.classList.add("hidden");
      return;
    }

    if (result.approachMode === "FINAL_APP") {
      elements.coldWarningTitle.textContent = "FINAL APP unavailable at this temperature";
      elements.coldWarningText.textContent = "The temperature is below the generic ISA -25 limit. A published minimum may be warmer. Use selected vertical guidance and the current BA procedure.";
    } else if (result.approachMode === "FLS") {
      elements.coldWarningTitle.textContent = "Cold-weather procedure applies";
      elements.coldWarningText.textContent = "Confirm the correct airport temperature is entered in PERF APPR and apply the current BA cold-weather procedure.";
    } else {
      elements.coldWarningTitle.textContent = "Cold-temperature correction applies";
      elements.coldWarningText.textContent = "The aerodrome surface temperature is below ISA -25 degrees Celsius. Use the current BA procedure and company Cold Weather Calculator.";
    }
    elements.coldWarning.classList.remove("hidden");
  }

  function render() {
    renderTimer = null;
    const input = currentInput();
    const calculation = core.calculateRadioAltimeterPosition(input);
    elements.modeError.textContent = calculation.errors.approachMode ?? "";
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
      elements.resultPanel.removeAttribute("data-approach-mode");
      elements.baro.textContent = "-- ft";
      elements.distance.textContent = "-- NM";
      elements.dmeReferenceResult.textContent = selectedMode === "ILS"
        ? "Reference at the threshold"
        : "Threshold-referenced estimate";
      elements.dmeReferenceResult.classList.remove("is-offset-reference");
      elements.coldWarning.classList.add("hidden");
      resetDiagram();
      return;
    }

    const result = calculation.result;
    const isIls = result.approachMode === "ILS";
    const distanceRaw = isIls
      ? result.expectedDmeIndicationNmRaw
      : result.horizontalDistanceFromThresholdNmRaw;
    elements.resultPanel.classList.remove("is-empty");
    elements.resultPanel.dataset.baroRaw = String(result.expectedBaroAltitudeFtRaw);
    elements.resultPanel.dataset.distanceRaw = String(distanceRaw);
    elements.resultPanel.dataset.baroErrorRaw = String(result.barometricErrorFtRaw);
    elements.resultPanel.dataset.approachMode = result.approachMode;
    elements.baro.textContent = core.formatBaroAltitude(result.expectedBaroAltitudeFtRaw);
    elements.distance.textContent = core.formatDmeDistance(distanceRaw);
    elements.dmeReferenceResult.textContent = isIls
      ? `Reference ${dmeReferenceDescription(input.dmeReferencePosition, input.dmeReferenceDistanceNm)}`
      : "Threshold-referenced estimate";
    elements.dmeReferenceResult.classList.toggle(
      "is-offset-reference",
      isIls && input.dmeReferencePosition !== "THRESHOLD"
    );
    renderColdWarning(result);
    renderDiagram(result, input);
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

  elements.modeButtons.forEach((button) => {
    button.addEventListener("click", () => setMode(button.dataset.raMode));
    button.addEventListener("keydown", (event) => {
      if (![
        "ArrowLeft",
        "ArrowRight",
        "ArrowUp",
        "ArrowDown",
      ].includes(event.key)) return;
      event.preventDefault();
      const currentIndex = core.APPROACH_MODES.indexOf(selectedMode);
      const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
      const nextIndex = (currentIndex + step + core.APPROACH_MODES.length) % core.APPROACH_MODES.length;
      setMode(core.APPROACH_MODES[nextIndex], { focus: true });
    });
  });

  elements.dmeReferencePosition.addEventListener("change", () => {
    const atThreshold = elements.dmeReferencePosition.value === "THRESHOLD";
    elements.dmeReferenceDistance.disabled = selectedMode !== "ILS" || atThreshold;
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
    setMode("ILS");
    elements.threshold.focus();
  });

  setMode("ILS");
})(typeof globalThis !== "undefined" ? globalThis : window);
