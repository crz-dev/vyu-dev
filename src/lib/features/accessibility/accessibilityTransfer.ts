import { accessibility } from "$lib/features/menus/accessibility.svelte";
import { appearance } from "$lib/features/theme/appearance.svelte";
import { library } from "$lib/features/library/library.svelte";
import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
import { deleteStore } from "$lib/features/file-actions/deleteFile.svelte";
import { saveSkipDeleteConfirmation } from "$lib/services/storage";

const COLOR_BLIND_MODES = [
  "none",
  "protanopia",
  "deuteranopia",
  "tritanopia",
] as const;

const VIEWER_BACKGROUNDS = ["theme", "black", "gray"] as const;

export type AccessibilityExport = Record<string, unknown>;

export function exportAccessibilitySettings(): AccessibilityExport {
  return {
    version: 1,
    colorBlindMode: accessibility.colorBlindMode,
    focusRings: accessibility.focusRings,
    boldText: accessibility.boldText,
    textSpacing: accessibility.textSpacing,
    reduceTransparency: accessibility.reduceTransparency,
    largeControls: accessibility.largeControls,
    largeTargets: accessibility.largeTargets,
    largeTimeline: accessibility.largeTimeline,
    largeScrollbars: accessibility.largeScrollbars,
    alwaysShowControls: accessibility.alwaysShowControls,
    reducePanSensitivity: accessibility.reducePanSensitivity,
    volumeLimit: accessibility.volumeLimit,
    monoAudio: accessibility.monoAudio,
    balance: accessibility.balance,
    normalizeVolume: accessibility.normalizeVolume,
    limitPeaks: accessibility.limitPeaks,
    boostDialogue: accessibility.boostDialogue,
    visualAlerts: accessibility.visualAlerts,
    audioCues: accessibility.audioCues,
    reduceDistractions: accessibility.reduceDistractions,
    focusMode: accessibility.focusMode,
    simplifiedMenus: accessibility.simplifiedMenus,
    hideMediaDetails: accessibility.hideMediaDetails,
    highContrast: appearance.highContrast,
    reducedMotion: appearance.reducedMotion,
    uiScale: appearance.uiScale,
    showTooltips: appearance.showTooltips,
    viewerBackground: appearance.viewerBackground,
    privacyMode: library.privacyMode,
    privacyBlur: library.privacyBlur,
    privacyHideNames: library.privacyHideNames,
    recentsDisabled: library.recentsDisabled,
    showThumbnails: library.showThumbnails,
    pauseOnFocusLoss: systemPrefs.pauseOnFocusLoss,
    seekStep: playbackPrefs.seekStep,
    skipDeleteConfirmations:
      deleteStore.deleteNoAsk || deleteStore.multiDeleteNoAsk,
  };
}

function setBoolean(
  data: Record<string, unknown>,
  key: string,
  setter: (value: boolean) => void,
): void {
  const value = data[key];
  if (typeof value === "boolean") setter(value);
}

export function applyAccessibilityImport(raw: unknown): void {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid accessibility settings file");
  }
  const data = raw as Record<string, unknown>;

  const colorBlindMode = data.colorBlindMode;
  if (
    typeof colorBlindMode === "string" &&
    COLOR_BLIND_MODES.includes(
      colorBlindMode as (typeof COLOR_BLIND_MODES)[number],
    )
  ) {
    accessibility.setColorBlindMode(
      colorBlindMode as (typeof COLOR_BLIND_MODES)[number],
    );
  }

  setBoolean(data, "focusRings", accessibility.setFocusRings);
  setBoolean(data, "boldText", accessibility.setBoldText);
  setBoolean(data, "textSpacing", accessibility.setTextSpacing);
  setBoolean(data, "reduceTransparency", accessibility.setReduceTransparency);
  setBoolean(data, "largeControls", accessibility.setLargeControls);
  setBoolean(data, "largeTargets", accessibility.setLargeTargets);
  setBoolean(data, "largeTimeline", accessibility.setLargeTimeline);
  setBoolean(data, "largeScrollbars", accessibility.setLargeScrollbars);
  setBoolean(data, "alwaysShowControls", accessibility.setAlwaysShowControls);
  setBoolean(
    data,
    "reducePanSensitivity",
    accessibility.setReducePanSensitivity,
  );
  setBoolean(data, "monoAudio", accessibility.setMonoAudio);
  setBoolean(data, "normalizeVolume", accessibility.setNormalizeVolume);
  setBoolean(data, "limitPeaks", accessibility.setLimitPeaks);
  setBoolean(data, "boostDialogue", accessibility.setBoostDialogue);
  setBoolean(data, "visualAlerts", accessibility.setVisualAlerts);
  setBoolean(data, "audioCues", accessibility.setAudioCues);
  setBoolean(data, "reduceDistractions", accessibility.setReduceDistractions);
  setBoolean(data, "focusMode", accessibility.setFocusMode);
  setBoolean(data, "simplifiedMenus", accessibility.setSimplifiedMenus);
  setBoolean(data, "hideMediaDetails", accessibility.setHideMediaDetails);

  if (typeof data.volumeLimit === "number") {
    accessibility.setVolumeLimit(data.volumeLimit);
  }
  if (typeof data.balance === "number") {
    accessibility.setBalance(data.balance);
  }

  setBoolean(data, "highContrast", appearance.setHighContrast);
  setBoolean(data, "reducedMotion", appearance.setReducedMotion);
  setBoolean(data, "showTooltips", appearance.setShowTooltips);

  if (typeof data.uiScale === "number") {
    appearance.setUiScale(data.uiScale);
  }

  const viewerBackground = data.viewerBackground;
  if (
    typeof viewerBackground === "string" &&
    VIEWER_BACKGROUNDS.includes(
      viewerBackground as (typeof VIEWER_BACKGROUNDS)[number],
    )
  ) {
    appearance.setViewerBackground(
      viewerBackground as (typeof VIEWER_BACKGROUNDS)[number],
    );
  }

  setBoolean(data, "privacyMode", library.setPrivacyMode);
  setBoolean(data, "privacyHideNames", library.setPrivacyHideNames);
  setBoolean(data, "recentsDisabled", library.setRecentsDisabled);
  setBoolean(data, "showThumbnails", library.setShowThumbnails);
  setBoolean(data, "pauseOnFocusLoss", systemPrefs.setPauseOnFocusLoss);

  if (typeof data.privacyBlur === "number") {
    library.setPrivacyBlur(data.privacyBlur);
  }

  if (typeof data.seekStep === "number" && Number.isFinite(data.seekStep)) {
    playbackPrefs.setSeekStep(Math.min(60, Math.max(1, data.seekStep)));
  }

  if (typeof data.skipDeleteConfirmations === "boolean") {
    setSkipDeleteConfirmations(data.skipDeleteConfirmations);
  }
}

function setSkipDeleteConfirmations(enabled: boolean): void {
  deleteStore.deleteNoAsk = enabled;
  deleteStore.multiDeleteNoAsk = enabled;
  saveSkipDeleteConfirmation(enabled);
}

export function resetAccessibilitySettings(): void {
  accessibility.reset();
  appearance.setHighContrast(false);
  appearance.setReducedMotion(false);
  appearance.setUiScale(1);
  appearance.setShowTooltips(true);
  appearance.setViewerBackground("theme");

  library.setPrivacyMode(false);
  library.setPrivacyBlur(12);
  library.setPrivacyHideNames(false);
  library.setRecentsDisabled(false);
  library.setShowThumbnails(true);

  systemPrefs.setPauseOnFocusLoss(false);
  playbackPrefs.setSeekStep(5);
  setSkipDeleteConfirmations(false);
}
