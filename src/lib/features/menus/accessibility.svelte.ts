// Accessibility state — color blind filter and viewer accessibility preferences
import {
  loadA11yAlwaysShowControls,
  loadA11yAudioCues,
  loadA11yBalance,
  loadA11yBoldText,
  loadA11yBoostDialogue,
  loadA11yFocusMode,
  loadA11yFocusRings,
  loadA11yHideMediaDetails,
  loadA11yLargeControls,
  loadA11yLargeScrollbars,
  loadA11yLargeTargets,
  loadA11yLargeTimeline,
  loadA11yLimitPeaks,
  loadA11yMonoAudio,
  loadA11yNormalizeVolume,
  loadA11yReduceDistractions,
  loadA11yReducePanSensitivity,
  loadA11yReduceTransparency,
  loadA11ySimplifiedMenus,
  loadA11yTextSpacing,
  loadA11yVisualAlerts,
  loadA11yVolumeLimit,
  loadColorBlindMode,
  saveA11yAlwaysShowControls,
  saveA11yAudioCues,
  saveA11yBalance,
  saveA11yBoldText,
  saveA11yBoostDialogue,
  saveA11yFocusMode,
  saveA11yFocusRings,
  saveA11yHideMediaDetails,
  saveA11yLargeControls,
  saveA11yLargeScrollbars,
  saveA11yLargeTargets,
  saveA11yLargeTimeline,
  saveA11yLimitPeaks,
  saveA11yMonoAudio,
  saveA11yNormalizeVolume,
  saveA11yReduceDistractions,
  saveA11yReducePanSensitivity,
  saveA11yReduceTransparency,
  saveA11ySimplifiedMenus,
  saveA11yTextSpacing,
  saveA11yVisualAlerts,
  saveA11yVolumeLimit,
  saveColorBlindMode,
} from "$lib/services/storage";

export type ColorBlindMode =
  | "none"
  | "protanopia"
  | "deuteranopia"
  | "tritanopia";

export type VisualAlertKind = "play" | "pause";

function clampVolumeLimit(value: number): number {
  const snapped = Math.round(value * 20) / 20;
  return Math.min(1, Math.max(0.2, snapped));
}

function clampBalance(value: number): number {
  const snapped = Math.round(value * 20) / 20;
  return Math.min(1, Math.max(-1, snapped));
}

function createAccessibility() {
  const saved = loadColorBlindMode();
  let colorBlindMode = $state<ColorBlindMode>(saved);

  let focusRings = $state(loadA11yFocusRings());
  let boldText = $state(loadA11yBoldText());
  let textSpacing = $state(loadA11yTextSpacing());
  let reduceTransparency = $state(loadA11yReduceTransparency());
  let largeControls = $state(loadA11yLargeControls());
  let largeTargets = $state(loadA11yLargeTargets());
  let largeTimeline = $state(loadA11yLargeTimeline());
  let largeScrollbars = $state(loadA11yLargeScrollbars());
  let alwaysShowControls = $state(loadA11yAlwaysShowControls());
  let reducePanSensitivity = $state(loadA11yReducePanSensitivity());

  let volumeLimit = $state(loadA11yVolumeLimit());
  let monoAudio = $state(loadA11yMonoAudio());
  let balance = $state(loadA11yBalance());
  let normalizeVolume = $state(loadA11yNormalizeVolume());
  let limitPeaks = $state(loadA11yLimitPeaks());
  let boostDialogue = $state(loadA11yBoostDialogue());
  let visualAlerts = $state(loadA11yVisualAlerts());
  let audioCues = $state(loadA11yAudioCues());

  let reduceDistractions = $state(loadA11yReduceDistractions());
  let focusMode = $state(loadA11yFocusMode());
  let simplifiedMenus = $state(loadA11ySimplifiedMenus());
  let hideMediaDetails = $state(loadA11yHideMediaDetails());

  let visualAlertTick = $state(0);
  let visualAlertKind = $state<VisualAlertKind>("play");

  function applyRootAttributes() {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.a11yFocus = focusRings ? "true" : "false";
    root.dataset.a11yBold = boldText ? "true" : "false";
    root.dataset.a11ySpacing = textSpacing ? "true" : "false";
    root.dataset.a11yOpaque = reduceTransparency ? "true" : "false";
    root.dataset.a11yLargeControls = largeControls ? "true" : "false";
    root.dataset.a11yLargeTargets = largeTargets ? "true" : "false";
    root.dataset.a11yLargeTimeline = largeTimeline ? "true" : "false";
    root.dataset.a11yLargeScrollbars = largeScrollbars ? "true" : "false";
    root.dataset.a11yAlwaysControls = alwaysShowControls ? "true" : "false";
    root.dataset.a11yReduceDistractions = reduceDistractions ? "true" : "false";
    root.dataset.a11yFocusMode = focusMode ? "true" : "false";
  }

  function setColorBlindMode(mode: ColorBlindMode) {
    colorBlindMode = mode;
    saveColorBlindMode(mode);
  }

  function setFocusRings(enabled: boolean) {
    focusRings = enabled;
    saveA11yFocusRings(enabled);
    applyRootAttributes();
  }

  function setBoldText(enabled: boolean) {
    boldText = enabled;
    saveA11yBoldText(enabled);
    applyRootAttributes();
  }

  function setTextSpacing(enabled: boolean) {
    textSpacing = enabled;
    saveA11yTextSpacing(enabled);
    applyRootAttributes();
  }

  function setReduceTransparency(enabled: boolean) {
    reduceTransparency = enabled;
    saveA11yReduceTransparency(enabled);
    applyRootAttributes();
  }

  function setLargeControls(enabled: boolean) {
    largeControls = enabled;
    saveA11yLargeControls(enabled);
    applyRootAttributes();
  }

  function setLargeTargets(enabled: boolean) {
    largeTargets = enabled;
    saveA11yLargeTargets(enabled);
    applyRootAttributes();
  }

  function setLargeTimeline(enabled: boolean) {
    largeTimeline = enabled;
    saveA11yLargeTimeline(enabled);
    applyRootAttributes();
  }

  function setLargeScrollbars(enabled: boolean) {
    largeScrollbars = enabled;
    saveA11yLargeScrollbars(enabled);
    applyRootAttributes();
  }

  function setAlwaysShowControls(enabled: boolean) {
    alwaysShowControls = enabled;
    saveA11yAlwaysShowControls(enabled);
    applyRootAttributes();
  }

  function setReducePanSensitivity(enabled: boolean) {
    reducePanSensitivity = enabled;
    saveA11yReducePanSensitivity(enabled);
  }

  function setVolumeLimit(limit: number) {
    volumeLimit = clampVolumeLimit(limit);
    saveA11yVolumeLimit(volumeLimit);
  }

  function setMonoAudio(enabled: boolean) {
    monoAudio = enabled;
    saveA11yMonoAudio(enabled);
  }

  function setBalance(value: number) {
    balance = clampBalance(value);
    saveA11yBalance(balance);
  }

  function setNormalizeVolume(enabled: boolean) {
    normalizeVolume = enabled;
    saveA11yNormalizeVolume(enabled);
  }

  function setLimitPeaks(enabled: boolean) {
    limitPeaks = enabled;
    saveA11yLimitPeaks(enabled);
  }

  function setBoostDialogue(enabled: boolean) {
    boostDialogue = enabled;
    saveA11yBoostDialogue(enabled);
  }

  function setVisualAlerts(enabled: boolean) {
    visualAlerts = enabled;
    saveA11yVisualAlerts(enabled);
  }

  function setAudioCues(enabled: boolean) {
    audioCues = enabled;
    saveA11yAudioCues(enabled);
  }

  function setReduceDistractions(enabled: boolean) {
    reduceDistractions = enabled;
    saveA11yReduceDistractions(enabled);
    applyRootAttributes();
  }

  function setFocusMode(enabled: boolean) {
    focusMode = enabled;
    saveA11yFocusMode(enabled);
    applyRootAttributes();
  }

  function setSimplifiedMenus(enabled: boolean) {
    simplifiedMenus = enabled;
    saveA11ySimplifiedMenus(enabled);
  }

  function setHideMediaDetails(enabled: boolean) {
    hideMediaDetails = enabled;
    saveA11yHideMediaDetails(enabled);
  }

  function pulseVisualAlert(kind: VisualAlertKind) {
    visualAlertKind = kind;
    visualAlertTick += 1;
  }

  function reset() {
    setColorBlindMode("none");
    setFocusRings(false);
    setBoldText(false);
    setTextSpacing(false);
    setReduceTransparency(false);
    setLargeControls(false);
    setLargeTargets(false);
    setLargeTimeline(false);
    setLargeScrollbars(false);
    setAlwaysShowControls(false);
    setReducePanSensitivity(false);
    setVolumeLimit(1);
    setMonoAudio(false);
    setBalance(0);
    setNormalizeVolume(false);
    setLimitPeaks(false);
    setBoostDialogue(false);
    setVisualAlerts(false);
    setAudioCues(false);
    setReduceDistractions(false);
    setFocusMode(false);
    setSimplifiedMenus(false);
    setHideMediaDetails(false);
    applyRootAttributes();
  }

  applyRootAttributes();

  return {
    get colorBlindMode() {
      return colorBlindMode;
    },
    get focusRings() {
      return focusRings;
    },
    get boldText() {
      return boldText;
    },
    get textSpacing() {
      return textSpacing;
    },
    get reduceTransparency() {
      return reduceTransparency;
    },
    get largeControls() {
      return largeControls;
    },
    get largeTargets() {
      return largeTargets;
    },
    get largeTimeline() {
      return largeTimeline;
    },
    get largeScrollbars() {
      return largeScrollbars;
    },
    get alwaysShowControls() {
      return alwaysShowControls;
    },
    get reducePanSensitivity() {
      return reducePanSensitivity;
    },
    get volumeLimit() {
      return volumeLimit;
    },
    get monoAudio() {
      return monoAudio;
    },
    get balance() {
      return balance;
    },
    get normalizeVolume() {
      return normalizeVolume;
    },
    get limitPeaks() {
      return limitPeaks;
    },
    get boostDialogue() {
      return boostDialogue;
    },
    get visualAlerts() {
      return visualAlerts;
    },
    get audioCues() {
      return audioCues;
    },
    get reduceDistractions() {
      return reduceDistractions;
    },
    get focusMode() {
      return focusMode;
    },
    get simplifiedMenus() {
      return simplifiedMenus;
    },
    get hideMediaDetails() {
      return hideMediaDetails;
    },
    get visualAlertTick() {
      return visualAlertTick;
    },
    get visualAlertKind() {
      return visualAlertKind;
    },
    setColorBlindMode,
    setFocusRings,
    setBoldText,
    setTextSpacing,
    setReduceTransparency,
    setLargeControls,
    setLargeTargets,
    setLargeTimeline,
    setLargeScrollbars,
    setAlwaysShowControls,
    setReducePanSensitivity,
    setVolumeLimit,
    setMonoAudio,
    setBalance,
    setNormalizeVolume,
    setLimitPeaks,
    setBoostDialogue,
    setVisualAlerts,
    setAudioCues,
    setReduceDistractions,
    setFocusMode,
    setSimplifiedMenus,
    setHideMediaDetails,
    pulseVisualAlert,
    reset,
    applyRootAttributes,
  };
}

export const accessibility = createAccessibility();
