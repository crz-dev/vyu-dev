import { convertFileSrc } from "@tauri-apps/api/core";
import {
  invokeGetMediaTracks,
  invokePrepareAudioTrack,
  invokeReleaseAudioTrack,
  invokePrepareExternalSubtitle,
  invokePrepareSubtitleTrack,
  invokeReleaseBitmapSubtitle,
} from "$lib/features/media/api";
import { findSubtitleSidecars, getFileName } from "$lib/services/files";
import {
  clearSubtitlePosition,
  loadSubtitlePosition,
  saveSubtitlePosition,
} from "$lib/services/database";
import { subtitlePrefs } from "$lib/features/media/subtitlePrefs.svelte";
import { showToast } from "$lib/components/toast.svelte";
import type {
  MediaTrack,
  SubtitleBackground,
  SubtitleDocument,
  SubtitleOutline,
  SubtitlePreset,
  SubtitleSidecar,
  SubtitleSize,
  SubtitleStyleSettings,
} from "$lib/shared/types";
import { locale } from "$lib/features/i18n/locale.svelte";

interface PlaybackSnapshot {
  time: number;
  rate: number;
  volume: number;
  muted: boolean;
  loop: boolean;
  playing: boolean;
}

const AUDIO_VARIANT_NONCE = Date.now();

// Track inspection spawns ffprobe and reads the folder for sidecars. Catalog
// contents are stable for a path, so revisiting a file can reuse the result.
const TRACK_CATALOG_CACHE_MAX = 50;
const trackCatalogCache = new Map<string, TrackCatalogCacheEntry>();

interface TrackCatalogCacheEntry {
  audio: MediaTrack[];
  subtitles: MediaTrack[];
  sidecars: SubtitleSidecar[];
}

function cacheTrackCatalog(path: string, entry: TrackCatalogCacheEntry): void {
  trackCatalogCache.delete(path);
  trackCatalogCache.set(path, entry);
  while (trackCatalogCache.size > TRACK_CATALOG_CACHE_MAX) {
    const first = trackCatalogCache.keys().next().value;
    if (first === undefined) break;
    trackCatalogCache.delete(first);
  }
}

export function forgetTrackCatalog(path: string): void {
  trackCatalogCache.delete(path);
}

export function clearTrackCatalog(): void {
  trackCatalogCache.clear();
}

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
  let activeVideoSrc = $state("");
  let subtitleDocument = $state.raw<SubtitleDocument | null>(null);
  let subtitleOffsetX = $state(0);
  let subtitleOffsetY = $state(0);
  let subtitleDelayMs = $state(0);
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
  let bitmapImages: string[] = [];
  let positionSaveTimer: ReturnType<typeof setTimeout> | null = null;

  function releaseBitmapPaths(paths: string[]) {
    if (paths.length > 0) {
      void invokeReleaseBitmapSubtitle(paths).catch(() => {});
    }
  }

  function releaseBitmapImages() {
    const images = bitmapImages;
    bitmapImages = [];
    releaseBitmapPaths(images);
  }

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
    releaseBitmapImages();
    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer);
      positionSaveTimer = null;
    }
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
    activeVideoSrc = "";
    subtitleDocument = null;
    subtitleOffsetX = 0;
    subtitleOffsetY = 0;
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
      const cached = trackCatalogCache.get(path);
      let audio: MediaTrack[];
      let subtitles: MediaTrack[];
      let matches: SubtitleSidecar[];

      if (cached) {
        // Refresh LRU order.
        trackCatalogCache.delete(path);
        trackCatalogCache.set(path, cached);
        audio = cached.audio;
        subtitles = cached.subtitles;
        matches = cached.sidecars;
      } else {
        const [catalog, found] = await Promise.all([
          invokeGetMediaTracks(path),
          findSubtitleSidecars(path).catch(() => [] as SubtitleSidecar[]),
        ]);
        if (generation !== loadGeneration) return;
        audio = catalog.audio;
        subtitles = catalog.subtitles;
        matches = found;
        cacheTrackCatalog(path, { audio, subtitles, sidecars: matches });
      }

      audioTracks = audio;
      subtitleTracks = subtitles;
      sidecars = matches;
      selectedAudioTrackIndex =
        audioTracks.find((track) => track.isDefault)?.index ??
        audioTracks[0]?.index ??
        null;
      originalAudioTrackIndex = selectedAudioTrackIndex;
      loadingTracks = false;

      if (generation !== loadGeneration) return;
      const position = await loadSubtitlePosition(path);
      if (generation !== loadGeneration) return;
      subtitleOffsetX = position?.x ?? 0;
      subtitleOffsetY = position?.y ?? 0;

      const preferredSubtitle =
        subtitleTracks.find(
          (track) => track.isDefault && track.supported && !track.bitmap,
        ) ?? subtitleTracks.find((track) => track.isDefault && track.supported);
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
        trackError = locale.t("media.tracks.unavailable");
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
          message: locale.t("media.tracks.switchError", {
            error: String(error),
          }),
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
      message: locale.t("media.tracks.switchKeptPrevious"),
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
      releaseBitmapImages();
      selectedSubtitleId = "off";
      subtitleDocument = null;
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
      let document: SubtitleDocument;
      if (id.startsWith("embedded:")) {
        const index = Number(id.slice("embedded:".length));
        const track = subtitleTracks.find((item) => item.index === index);
        if (!track || !track.supported || !filePath) return;
        document = await invokePrepareSubtitleTrack(filePath, index);
      } else if (id.startsWith("sidecar:")) {
        const path = id.slice("sidecar:".length);
        const sidecar = sidecars.find((item) => item.path === path);
        if (!sidecar) return;
        document = await invokePrepareExternalSubtitle(path);
      } else {
        return;
      }

      if (generation !== loadGeneration || request !== subtitleGeneration) {
        const current = new Set(bitmapImages);
        releaseBitmapPaths(
          document.images.filter((path) => !current.has(path)),
        );
        return;
      }
      const nextImages = document.kind === "bitmap" ? [...document.images] : [];
      const keep = new Set(nextImages);
      const stale = bitmapImages.filter((path) => !keep.has(path));
      bitmapImages = nextImages;
      releaseBitmapPaths(stale);
      selectedSubtitleId = id;
      subtitleDocument = document;
      subtitleDelayMs = 0;
    } catch (error) {
      if (generation === loadGeneration && request === subtitleGeneration) {
        subtitleError = String(error);
        if (notifyOnError) {
          showToast({
            message: locale.t("media.subtitles.loadError", {
              error: String(error),
            }),
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
    const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
    const existing = sidecars.find(
      (item) => item.path.toLowerCase() === path.toLowerCase(),
    );
    if (!existing) {
      sidecars = [
        ...sidecars,
        { path, name, bitmap: ext === "sup" || ext === "idx" || ext === "sub" },
      ];
    }
    await selectSubtitle(`sidecar:${existing?.path ?? path}`);
  }

  function adjustSubtitleDelay(deltaMs: number) {
    subtitleDelayMs = Math.max(
      -10_000,
      Math.min(10_000, subtitleDelayMs + deltaMs),
    );
  }

  function clampOffset(value: number): number {
    return Math.max(-50, Math.min(50, value));
  }

  function setSubtitleOffset(x: number, y: number) {
    const nextX = clampOffset(x);
    const nextY = clampOffset(y);
    subtitleOffsetX = nextX;
    subtitleOffsetY = nextY;
    if (positionSaveTimer) clearTimeout(positionSaveTimer);
    positionSaveTimer = null;
    const path = filePath;
    if (!path) return;
    positionSaveTimer = setTimeout(() => {
      positionSaveTimer = null;
      void saveSubtitlePosition(path, nextX, nextY);
    }, 250);
  }

  function resetSubtitlePosition() {
    if (positionSaveTimer) {
      clearTimeout(positionSaveTimer);
      positionSaveTimer = null;
    }
    subtitleOffsetX = 0;
    subtitleOffsetY = 0;
    if (filePath) void clearSubtitlePosition(filePath);
  }

  function setSubtitlePreset(preset: SubtitlePreset) {
    if (preset === "custom") {
      subtitlePrefs.enableCustom();
      return;
    }
    subtitlePrefs.setPreset(preset);
  }

  function setSubtitleUseFileStyles(enabled: boolean) {
    subtitlePrefs.setUseFileStyles(enabled);
  }

  function setSubtitleCustomColor(index: number, color: string) {
    subtitlePrefs.setCustomColor(index, color);
  }

  function setSubtitleSize(size: SubtitleSize) {
    subtitlePrefs.setSize(size);
  }

  function setSubtitleFont(fontFamily: string) {
    subtitlePrefs.setFontFamily(fontFamily);
  }

  function setSubtitleColor(textColor: string) {
    subtitlePrefs.setTextColor(textColor);
  }

  function setSubtitleOutline(outline: SubtitleOutline) {
    subtitlePrefs.setOutline(outline);
  }

  function setSubtitleBackground(background: SubtitleBackground) {
    subtitlePrefs.setBackground(background);
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
    get activeVideoSrc() {
      return activeVideoSrc;
    },
    get subtitleDocument() {
      return subtitleDocument;
    },
    get subtitleOffsetX() {
      return subtitleOffsetX;
    },
    get subtitleOffsetY() {
      return subtitleOffsetY;
    },
    get subtitleDelayMs() {
      return subtitleDelayMs;
    },
    get subtitleStyle(): SubtitleStyleSettings {
      return subtitlePrefs.settings;
    },
    get subtitleCustomColors() {
      return subtitlePrefs.customColors;
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
    setSubtitleOffset,
    resetSubtitlePosition,
    setSubtitlePreset,
    setSubtitleUseFileStyles,
    setSubtitleCustomColor,
    setSubtitleSize,
    setSubtitleFont,
    setSubtitleColor,
    setSubtitleOutline,
    setSubtitleBackground,
    releaseAllAudioVariants,
  };
}

export type TrackSelectionStore = ReturnType<typeof createTrackSelection>;
