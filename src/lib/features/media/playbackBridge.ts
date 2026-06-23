// Playback bridge
import {
  createPlaybackActions,
  createPlaybackUI,
} from "$lib/features/media/playback.svelte";
import { saveVolume, saveSliderMode } from "$lib/services/storage";

export interface PlaybackBridgeDeps {
  getMediaEl: () => HTMLMediaElement | null;
  getPlaying: () => boolean;
  setPlaying: (v: boolean) => void;
  getMuted: () => boolean;
  setMuted: (v: boolean) => void;
  setVolume: (v: number) => void;
  getVolumeSliderMode: () => boolean;
  setVolumeSliderMode: (v: boolean) => void;
  getSpeedSliderMode: () => boolean;
  setSpeedSliderMode: (v: boolean) => void;
  playbackUI: ReturnType<typeof createPlaybackUI>;
}

export function createPlaybackBridge(deps: PlaybackBridgeDeps) {
  const playback = createPlaybackActions(deps.getMediaEl);

  function togglePlay() {
    playback.togglePlay();
    deps.setPlaying(!deps.getPlaying());
  }

  function toggleMute() {
    playback.toggleMute(deps.setMuted, deps.getMuted());
  }

  function setVolume(val: number) {
    playback.setVolume(val, ({ volume, muted }) => {
      deps.setVolume(volume);
      deps.setMuted(muted);
    });
    saveVolume(val);
  }

  function toggleVolumeSliderMode() {
    deps.playbackUI.toggleVolumeSliderMode();
    const next = deps.playbackUI.volumeSliderMode;
    deps.setVolumeSliderMode(next);
    saveSliderMode({
      volume: next,
      speed: deps.getSpeedSliderMode(),
    });
  }

  function toggleSpeedSliderMode() {
    deps.playbackUI.toggleSpeedSliderMode();
    const next = deps.playbackUI.speedSliderMode;
    deps.setSpeedSliderMode(next);
    saveSliderMode({
      volume: deps.getVolumeSliderMode(),
      speed: next,
    });
  }

  return {
    togglePlay,
    toggleMute,
    setVolume,
    toggleVolumeSliderMode,
    toggleSpeedSliderMode,
  };
}
