import {
  loadAutoplay,
  loadDefaultSpeed,
  loadDefaultVolume,
  loadKeepAudio,
  loadRememberSpeed,
  loadRememberVolume,
  loadRelativeSeek,
  loadRelativeSeekStep,
  loadResumeMode,
  loadResumeThreshold,
  loadSeekStep,
  loadVolumeBoost,
  saveAutoplay,
  saveDefaultSpeed,
  saveDefaultVolume,
  saveKeepAudio,
  saveRememberSpeed,
  saveRememberVolume,
  saveRelativeSeek,
  saveRelativeSeekStep,
  saveResumeMode,
  saveResumeThreshold,
  saveSeekStep,
  saveVolumeBoost,
  type ResumeMode,
} from "$lib/services/storage";

export type { ResumeMode };

const SPEED_MIN = 0.1;
const SPEED_MAX = 3;

function clampSpeed(value: number): number {
  return Math.min(
    SPEED_MAX,
    Math.max(SPEED_MIN, Math.round(value / 0.05) * 0.05),
  );
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, Math.round(value * 100) / 100));
}

function createPlaybackPrefs() {
  let resumeMode = $state<ResumeMode>(loadResumeMode());
  let resumeThreshold = $state<number>(loadResumeThreshold());
  let autoplay = $state(loadAutoplay());
  let rememberSpeed = $state(loadRememberSpeed());
  let rememberVolume = $state(loadRememberVolume());
  let defaultSpeed = $state(clampSpeed(loadDefaultSpeed()));
  let defaultVolume = $state(clampVolume(loadDefaultVolume()));
  let volumeBoost = $state(loadVolumeBoost());
  let seekStep = $state(loadSeekStep());
  let relativeSeek = $state(loadRelativeSeek());
  let relativeSeekStep = $state(loadRelativeSeekStep());
  let keepAudio = $state(loadKeepAudio());

  function setResumeMode(mode: ResumeMode) {
    resumeMode = mode;
    saveResumeMode(mode);
  }

  function setResumeThreshold(seconds: number) {
    resumeThreshold = seconds;
    saveResumeThreshold(seconds);
  }

  function setAutoplay(enabled: boolean) {
    autoplay = enabled;
    saveAutoplay(enabled);
  }

  function setRememberSpeed(enabled: boolean) {
    rememberSpeed = enabled;
    saveRememberSpeed(enabled);
  }

  function setRememberVolume(enabled: boolean) {
    rememberVolume = enabled;
    saveRememberVolume(enabled);
  }

  function setDefaultSpeed(speed: number) {
    defaultSpeed = clampSpeed(speed);
    saveDefaultSpeed(defaultSpeed);
  }

  function setDefaultVolume(value: number) {
    defaultVolume = clampVolume(value);
    saveDefaultVolume(defaultVolume);
  }

  function setVolumeBoost(enabled: boolean) {
    volumeBoost = enabled;
    saveVolumeBoost(enabled);
  }

  function setSeekStep(seconds: number) {
    seekStep = seconds;
    saveSeekStep(seconds);
  }

  function setRelativeSeek(enabled: boolean) {
    relativeSeek = enabled;
    saveRelativeSeek(enabled);
  }

  function setRelativeSeekStep(percent: number) {
    relativeSeekStep = Math.min(100, Math.max(1, Math.round(percent)));
    saveRelativeSeekStep(relativeSeekStep);
  }

  function setKeepAudio(enabled: boolean) {
    keepAudio = enabled;
    saveKeepAudio(enabled);
  }

  return {
    get resumeMode() {
      return resumeMode;
    },
    get resumeThreshold() {
      return resumeThreshold;
    },
    get autoplay() {
      return autoplay;
    },
    get rememberSpeed() {
      return rememberSpeed;
    },
    get rememberVolume() {
      return rememberVolume;
    },
    get defaultSpeed() {
      return defaultSpeed;
    },
    get defaultVolume() {
      return defaultVolume;
    },
    get volumeBoost() {
      return volumeBoost;
    },
    get seekStep() {
      return seekStep;
    },
    get relativeSeek() {
      return relativeSeek;
    },
    get relativeSeekStep() {
      return relativeSeekStep;
    },
    get keepAudio() {
      return keepAudio;
    },
    setResumeMode,
    setResumeThreshold,
    setAutoplay,
    setRememberSpeed,
    setRememberVolume,
    setDefaultSpeed,
    setDefaultVolume,
    setVolumeBoost,
    setSeekStep,
    setRelativeSeek,
    setRelativeSeekStep,
    setKeepAudio,
  };
}

export const playbackPrefs = createPlaybackPrefs();
