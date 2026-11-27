import {
  loadAudioDevicesGranted,
  loadAudioOutputDevice,
  saveAudioDevicesGranted,
  saveAudioOutputDevice,
} from "$lib/services/storage";

export interface AudioOutputDeviceInfo {
  deviceId: string;
  label: string;
}

type SinkCapableElement = HTMLMediaElement & {
  setSinkId?: (deviceId: string) => Promise<void>;
};

export type AudioOutputError = "" | "permission" | "unavailable";

function contextSupportsSinkId(): boolean {
  return (
    typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype
  );
}

function elementSupportsSinkId(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    "setSinkId" in HTMLMediaElement.prototype
  );
}

// WebView2/Chromium can occasionally surface capture endpoints in the output
// list. Keep clearly input-only labels out of the device picker.
const CAPTURE_LABEL_PATTERN =
  /\b(?:microphone|microphone array|mic|line in|stereo mix|what u hear|wave out mix)\b/i;

// Windows endpoint names can carry Chromium role prefixes and duplicate
// instance numbers (for example "Communications - Speakers (2- USB Audio
// Device)"). Clean the display label while keeping the real device id.
function cleanDeviceLabel(label: string): string {
  const original = label.trim();
  let text = original.replace(/^(?:default|communications)\s*-\s*/i, "");
  text = text.replace(/^\d+\s*-\s*/, "");
  text = text.replace(/\(\s*\d+\s*-\s*/g, "(");
  text = text.replace(/\s+/g, " ").trim();
  return text || original;
}

function createAudioOutput() {
  const supported = contextSupportsSinkId();
  const elementSupported = elementSupportsSinkId();

  let deviceId = $state(loadAudioOutputDevice());
  let devices = $state<AudioOutputDeviceInfo[]>([]);
  let loading = $state(false);
  let restricted = $state(false);
  let allLoaded = $state(loadAudioDevicesGranted());
  let error = $state<AudioOutputError>("");
  let enumerated = $state(false);

  const deviceListed = $derived(
    devices.some((device) => device.deviceId === deviceId),
  );

  const effectiveDeviceId = $derived.by(() => {
    if (!deviceId) return "";
    // Before the first enumeration we keep the saved endpoint so a valid
    // device is applied as soon as the audio context exists.
    if (!enumerated || deviceListed) return deviceId;
    // A restricted list only exposes the default device; the saved endpoint
    // may still exist, so keep routing to it.
    if (restricted) return deviceId;
    return "";
  });

  // The picker can only show endpoints Chromium has listed.
  const selectedDeviceId = $derived(deviceListed ? deviceId : "");

  const savedDeviceMissing = $derived(
    enumerated && !restricted && deviceId !== "" && !deviceListed,
  );

  async function refresh() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.enumerateDevices
    ) {
      error = "unavailable";
      restricted = false;
      return;
    }

    loading = true;
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const seenIds = new Set<string>();
      const seenLabels = new Set<string>();
      const outputs: AudioOutputDeviceInfo[] = [];
      let labelsHidden = false;

      const captureLabels = new Set<string>();
      for (const entry of list) {
        if (entry.kind !== "audioinput") continue;
        const label = entry.label.trim().toLowerCase();
        if (label && label !== "default") captureLabels.add(label);
      }

      for (const entry of list) {
        if (entry.kind !== "audiooutput") continue;
        // Chromium adds synthetic "default" and "communications" endpoints for
        // the OS roles. They duplicate the real endpoints and are not present
        // in Windows sound settings.
        if (
          entry.deviceId === "default" ||
          entry.deviceId === "communications"
        ) {
          continue;
        }
        const rawLabel = entry.label.trim();
        if (
          rawLabel &&
          rawLabel.toLowerCase() !== "default" &&
          captureLabels.has(rawLabel.toLowerCase())
        ) {
          continue;
        }
        if (CAPTURE_LABEL_PATTERN.test(rawLabel)) continue;
        if (!entry.deviceId || seenIds.has(entry.deviceId)) continue;

        const label = cleanDeviceLabel(rawLabel);
        const labelKey = label.toLowerCase();
        if (labelKey && seenLabels.has(labelKey)) continue;

        seenIds.add(entry.deviceId);
        if (labelKey) seenLabels.add(labelKey);
        if (!label) labelsHidden = true;
        outputs.push({ deviceId: entry.deviceId, label });
      }

      devices = outputs;
      enumerated = true;
      // Chromium only exposes the full speaker list once microphone
      // permission has been granted.
      restricted =
        supported && (labelsHidden || (!allLoaded && outputs.length <= 1));
      error = "";
    } catch {
      error = "unavailable";
      restricted = false;
    } finally {
      loading = false;
    }
  }

  async function loadAllDevices() {
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      error = "unavailable";
      return;
    }

    loading = true;
    error = "";
    try {
      // Chromium requires one microphone grant before it exposes every
      // audio output. The stream is stopped immediately; nothing is recorded.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      for (const track of stream.getTracks()) track.stop();
      allLoaded = true;
      saveAudioDevicesGranted(true);
      await refresh();
      if (restricted) error = "permission";
    } catch {
      error = "permission";
    } finally {
      loading = false;
    }
  }

  function setDevice(next: string) {
    deviceId = next;
    saveAudioOutputDevice(next);
  }

  function applyToElement(
    element: HTMLMediaElement | null,
    connectedElement: HTMLMediaElement | null,
  ) {
    if (!element || element === connectedElement) return;
    if (!elementSupported) return;
    const target = element as SinkCapableElement;
    void target.setSinkId?.(effectiveDeviceId).catch(() => {});
  }

  if (typeof navigator !== "undefined" && navigator.mediaDevices) {
    navigator.mediaDevices.addEventListener("devicechange", () => {
      void refresh();
    });
  }
  void refresh();

  return {
    get supported() {
      return supported;
    },
    get deviceId() {
      return deviceId;
    },
    get effectiveDeviceId() {
      return effectiveDeviceId;
    },
    get selectedDeviceId() {
      return selectedDeviceId;
    },
    get devices() {
      return devices;
    },
    get loading() {
      return loading;
    },
    get restricted() {
      return restricted;
    },
    get allLoaded() {
      return allLoaded;
    },
    get error() {
      return error;
    },
    get savedDeviceMissing() {
      return savedDeviceMissing;
    },
    refresh,
    loadAllDevices,
    setDevice,
    applyToElement,
  };
}

export const audioOutput = createAudioOutput();
