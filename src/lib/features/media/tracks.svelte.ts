import { convertFileSrc } from "@tauri-apps/api/core";
import {
  invokeGetMediaTracks,
  invokePrepareAudioTrack,
  invokeReleaseAudioTrack,
  invokePrepareExternalSubtitle,
  invokePrepareSubtitleTrack,
} from "$lib/features/media/api";
import { findSubtitleSidecars, getFileName } from "$lib/services/files";
import { showToast } from "$lib/components/toast.svelte";
import type { MediaTrack, SubtitleSidecar } from "$lib/shared/types";

export type SubtitleSize = "small" | "default" | "large";

interface PlaybackSnapshot {
  time: number;
  rate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  playing: boolean;
}

const AUDIO_VARIANT_NONCE = Date.now();

export function createTrackSelection(
  getVideoEl: () => HTMLVideoElement | null,
) {
  let filePath = $state("");
  let audioTracks = $state<MediaTrack[]>([]);
  let subtitleTracks = $state<MediaTrack[]>([]);
  let sidecars = $state<SubtitleSidecar[]>([]);
  let selectedAudioTrackIndex = $state<number | null>(null);
  let originalAudioTrackIndex: number | null = null;
  let selectedSubtitleId = $state("off");
  let selectedSubtitleLabel = $state("");
  let activeVideoSrc = $state("");
  let subtitleSrc = $state("");
  let subtitleDelayMs = $state(0);
  let subtitleSize = $state<SubtitleSize>("default");
  let loadingTracks = $state(false);
  let loadingAudioTrack = $state(false);
  let loadingSubtitle = $state(false);
  let trackError = $state("");
  let subtitleError = $state("");

  let loadGeneration = 0;
  let subtitleGeneration = 0;
  let urlNonce = AUDIO_VARIANT_NONCE;
  let pendingPlaybackRestore: PlaybackSnapshot | null = null;
  let activeAudioVariantPath: string | null = null;
  let pendingAudioVariantPath: string | null = null;
  let pendingAudioTrackIndex: number | null = null;
  let awaitingAudioSourceChange = false;
  let retiredAudioVariantPaths: string[] = [];
  let resolveAudioSourceChange: (() => void) | null = null;

  function releaseAudioVariant(path: string) {
    void invokeReleaseAudioTrack(path).catch(() => {});
  }

  function finishAudioSourceChange() {
    resolveAudioSourceChange?.();
    resolveAudioSourceChange = null;
  }

  function releaseRetiredAudioVariants() {
    const retired = retiredAudioVariantPaths;
    retiredAudioVariantPaths = [];
    for (const path of retired) {
      if (path !== activeAudioVariantPath) releaseAudioVariant(path);
    }
  }

  function reset(deferRelease = false) {
    finishAudioSourceChange();
    loadGeneration++;
    subtitleGeneration++;
    const pathsToRelease = [
      activeAudioVariantPath,
      pendingAudioVariantPath,
    ].filter((path): path is string => path !== null);
    if (deferRelease) retiredAudioVariantPaths.push(...pathsToRelease);
    else {
      for (const path of [...retiredAudioVariantPaths, ...pathsToRelease]) {
        releaseAudioVariant(path);
      }
      retiredAudioVariantPaths = [];
    }
    filePath = "";
    audioTracks = [];
    subtitleTracks = [];
    sidecars = [];
    selectedAudioTrackIndex = null;
    originalAudioTrackIndex = null;
    selectedSubtitleId = "off";
    selectedSubtitleLabel = "";
    activeVideoSrc = "";
    subtitleSrc = "";
    subtitleDelayMs = 0;
    loadingTracks = false;
    loadingAudioTrack = false;
    loadingSubtitle = false;
    trackError = "";
    subtitleError = "";
    pendingPlaybackRestore = null;
    activeAudioVariantPath = null;
    pendingAudioVariantPath = null;
    pendingAudioTrackIndex = null;
    awaitingAudioSourceChange = false;
  }

  async function loadFile(path: string) {
    reset(true);
    if (!path) return;

    filePath = path;
    const generation = loadGeneration;
    loadingTracks = true;

    try {
      const [catalog, matches] = await Promise.all([
        invokeGetMediaTracks(path),
        findSubtitleSidecars(path).catch(() => []),
      ]);
      if (generation !== loadGeneration) return;

      audioTracks = catalog.audio;
      subtitleTracks = catalog.subtitles;
      sidecars = matches;
      selectedAudioTrackIndex =
        audioTracks.find((track) => track.isDefault)?.index ??
        audioTracks[0]?.index ??
        null;
      originalAudioTrackIndex = selectedAudioTrackIndex;
      loadingTracks = false;

      const preferredSubtitle = subtitleTracks.find(
        (track) => track.isDefault && track.supported,
      );
      const mediaName = getFileName(path);
      const mediaStem = mediaName
        .slice(0, mediaName.lastIndexOf("."))
        .toLowerCase();
      const exactSidecar = sidecars.find((sidecar) => {
        const name = getFileName(sidecar.path);
        return name.slice(0, name.lastIndexOf(".")).toLowerCase() === mediaStem;
      });
      const preferredSidecar =
        exactSidecar ?? (sidecars.length === 1 ? sidecars[0] : null);
      if (preferredSubtitle) {
        await selectSubtitle(`embedded:${preferredSubtitle.index}`, false);
      } else if (preferredSidecar) {
        await selectSubtitle(`sidecar:${preferredSidecar.path}`, false);
      }
    } catch {
      if (generation === loadGeneration) {
        trackError = "Track information is unavailable";
        loadingTracks = false;
      }
    }
  }

  function capturePlayback(): PlaybackSnapshot | null {
    const video = getVideoEl();
    if (!video) return null;
    return {
      time: Number.isFinite(video.currentTime) ? video.currentTime : 0,
      rate: video.playbackRate,
      volume: video.volume,
      muted: video.muted,
      loop: video.loop,
      playing: !video.paused,
    };
  }

  async function selectAudioTrack(index: number) {
    if (
      index === selectedAudioTrackIndex ||
      loadingAudioTrack ||
      awaitingAudioSourceChange
    ) {
      return;
    }
    const track = audioTracks.find((item) => item.index === index);
    if (!track || !filePath) return;

    const generation = loadGeneration;
    loadingAudioTrack = true;
    trackError = "";
    let awaitingSource = false;
    try {
      const outputPath =
        index === originalAudioTrackIndex
          ? null
          : await invokePrepareAudioTrack(filePath, index);
      if (generation !== loadGeneration) {
        if (outputPath) releaseAudioVariant(outputPath);
        return;
      }

      // Keep the current source playing while FFmpeg prepares the replacement.
      pendingPlaybackRestore = capturePlayback();
      pendingAudioVariantPath = outputPath;
      pendingAudioTrackIndex = index;
      awaitingAudioSourceChange = true;
      awaitingSource = true;
      activeVideoSrc = outputPath
        ? `${convertFileSrc(outputPath)}?track=${++urlNonce}`
        : "";
      await new Promise<void>((resolve) => {
        resolveAudioSourceChange = resolve;
      });
    } catch (error) {
      if (generation === loadGeneration) {
        showToast({
          message: `Could not switch audio track: ${String(error)}`,
          color: "red",
        });
      }
    } finally {
      if (generation === loadGeneration && !awaitingSource) {
        loadingAudioTrack = false;
      }
    }
  }

  function restorePlaybackAfterSourceLoad(video: HTMLVideoElement | null) {
    if (!video) return;
    const snapshot = pendingPlaybackRestore;
    pendingPlaybackRestore = null;

    if (snapshot) {
      video.volume = snapshot.volume;
      video.muted = snapshot.muted;
      video.loop = snapshot.loop;
      video.playbackRate = snapshot.rate;
      if (Number.isFinite(video.duration)) {
        video.currentTime = Math.min(snapshot.time, video.duration);
      } else {
        video.currentTime = snapshot.time;
      }

      if (snapshot.playing) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    }

    if (awaitingAudioSourceChange) {
      const previousPath = activeAudioVariantPath;
      activeAudioVariantPath = pendingAudioVariantPath;
      selectedAudioTrackIndex = pendingAudioTrackIndex;
      pendingAudioVariantPath = null;
      pendingAudioTrackIndex = null;
      awaitingAudioSourceChange = false;
      loadingAudioTrack = false;
      if (previousPath && previousPath !== activeAudioVariantPath) {
        releaseAudioVariant(previousPath);
      }
      finishAudioSourceChange();
    }

    releaseRetiredAudioVariants();
  }

  function onVideoSourceError(): boolean {
    if (!awaitingAudioSourceChange) {
      releaseRetiredAudioVariants();
      return false;
    }
    if (pendingAudioVariantPath) releaseAudioVariant(pendingAudioVariantPath);
    pendingAudioVariantPath = null;
    pendingAudioTrackIndex = null;
    awaitingAudioSourceChange = false;
    loadingAudioTrack = false;
    activeVideoSrc = activeAudioVariantPath
      ? `${convertFileSrc(activeAudioVariantPath)}?track=${++urlNonce}`
      : "";
    loadingAudioTrack = false;
    showToast({
      message: "Could not switch audio track; kept the previous track",
      color: "red",
    });
    finishAudioSourceChange();
    return true;
  }

  async function releaseAllAudioVariants() {
    finishAudioSourceChange();
    const paths = new Set(
      [
        activeAudioVariantPath,
        pendingAudioVariantPath,
        ...retiredAudioVariantPaths,
      ].filter((path): path is string => path !== null),
    );
    activeAudioVariantPath = null;
    pendingAudioVariantPath = null;
    retiredAudioVariantPaths = [];
    await Promise.all(
      [...paths].map((path) => invokeReleaseAudioTrack(path).catch(() => {})),
    );
  }

  async function selectSubtitle(id: string, notifyOnError = true) {
    if (id === "off") {
      subtitleGeneration++;
      selectedSubtitleId = "off";
      selectedSubtitleLabel = "";
      subtitleSrc = "";
      subtitleDelayMs = 0;
      subtitleError = "";
      loadingSubtitle = false;
      return;
    }
    if (loadingSubtitle) return;

    const generation = loadGeneration;
    const request = ++subtitleGeneration;
    loadingSubtitle = true;
    subtitleError = "";
    try {
      let outputPath: string;
      let label: string;
      if (id.startsWith("embedded:")) {
        const index = Number(id.slice("embedded:".length));
        const track = subtitleTracks.find((item) => item.index === index);
        if (!track || !track.supported || !filePath) return;
        outputPath = await invokePrepareSubtitleTrack(filePath, index);
        label = track.title || track.language || `Subtitle ${index + 1}`;
      } else if (id.startsWith("sidecar:")) {
        const path = id.slice("sidecar:".length);
        const sidecar = sidecars.find((item) => item.path === path);
        if (!sidecar) return;
        outputPath = await invokePrepareExternalSubtitle(path);
        label = sidecar.name;
      } else {
        return;
      }

      if (generation !== loadGeneration || request !== subtitleGeneration)
        return;
      selectedSubtitleId = id;
      selectedSubtitleLabel = label;
      subtitleSrc = `${convertFileSrc(outputPath)}?subtitle=${++urlNonce}`;
      subtitleDelayMs = 0;
    } catch (error) {
      if (generation === loadGeneration && request === subtitleGeneration) {
        subtitleError = String(error);
        if (notifyOnError) {
          showToast({
            message: `Could not load subtitles: ${String(error)}`,
            color: "red",
          });
        }
      }
    } finally {
      if (generation === loadGeneration && request === subtitleGeneration) {
        loadingSubtitle = false;
      }
    }
  }

  async function loadExternalSubtitle(path: string) {
    if (!path) return;
    const name = path.slice(
      Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/")) + 1,
    );
    const existing = sidecars.find(
      (item) => item.path.toLowerCase() === path.toLowerCase(),
    );
    if (!existing) sidecars = [...sidecars, { path, name }];
    await selectSubtitle(`sidecar:${existing?.path ?? path}`);
  }

  function adjustSubtitleDelay(deltaMs: number) {
    subtitleDelayMs = Math.max(
      -10_000,
      Math.min(10_000, subtitleDelayMs + deltaMs),
    );
  }

  function setSubtitleSize(size: SubtitleSize) {
    subtitleSize = size;
  }

  return {
    get filePath() {
      return filePath;
    },
    get audioTracks() {
      return audioTracks;
    },
    get subtitleTracks() {
      return subtitleTracks;
    },
    get sidecars() {
      return sidecars;
    },
    get selectedAudioTrackIndex() {
      return selectedAudioTrackIndex;
    },
    get selectedSubtitleId() {
      return selectedSubtitleId;
    },
    get selectedSubtitleLabel() {
      return selectedSubtitleLabel;
    },
    get activeVideoSrc() {
      return activeVideoSrc;
    },
    get subtitleSrc() {
      return subtitleSrc;
    },
    get subtitleDelayMs() {
      return subtitleDelayMs;
    },
    get subtitleSize() {
      return subtitleSize;
    },
    get loadingTracks() {
      return loadingTracks;
    },
    get loadingAudioTrack() {
      return loadingAudioTrack;
    },
    get loadingSubtitle() {
      return loadingSubtitle;
    },
    get trackError() {
      return trackError;
    },
    get subtitleError() {
      return subtitleError;
    },
    loadFile,
    reset,
    selectAudioTrack,
    restorePlaybackAfterSourceLoad,
    onVideoSourceError,
    selectSubtitle,
    loadExternalSubtitle,
    adjustSubtitleDelay,
    setSubtitleSize,
    releaseAllAudioVariants,
  };
}

export type TrackSelectionStore = ReturnType<typeof createTrackSelection>;
