<script lang="ts">
  import type {
    ClipBoundary,
    ContextMenu,
    MediaProperties,
    VideoMarker,
  } from "$lib/shared/types";
  import {
    invokePrintFile,
    invokeSendBluetooth,
    invokeSetWallpaper,
    invokeSetLockScreen,
    invokeCreateDesktopShortcut,
    invokeOpenInPhotos,
    invokeOpenInPaint,
    invokeOpenInVlc,
    invokeOpenInSpotify,
    invokeOpenInBrowser,
    invokeOpenWithDialog,
    invokeConvertMedia,
    invokeConvertAudioToWaveformVideo,
    invokeConvertImageToPdf,
    invokeCopyFile,
    invokeCopyFileUnique,
    invokeDeleteFile,
    invokeIdentifySong,
  } from "$lib/features/media/api";
  import {
    loadShareOutputDir,
    saveShareOutputDir,
  } from "$lib/services/storage";
  import { library } from "$lib/features/library/library.svelte";
  import { obscurePath } from "$lib/shared/privacy";
  import { listen } from "@tauri-apps/api/event";
  import { showToast, updateToast } from "$lib/components/toast.svelte";

  let {
    contextMenu,
    isVideo,
    isAudio,
    isPdf,
    timestamps,
    clipBoundaries,
    resumePoint,
    clipOutputDir,
    parentFolder,
    invokeOpenDirectory,
    ctxCopyImage,
    ctxCopyFrame,
    ctxCopyPath,
    ctxRotate,
    ctxFlip,
    ctxShowInExplorer,
    ctxProperties,
    ctxShare,
    ctxEdit,
    ctxMarkup,
    ctxEffects,
    ctxEqualizer,
    ctxClearMarkers,
    ctxDelete,
    clipDeleteConfirm,
    deleteConfirm,
    propertiesOpen,
    shareOpen,
    closeShare,
    deleteNoAsk,
    deletePermanently,
    fileName,
    filePath,
    fileExt,
    fileDimensions,
    fileSize,
    fileCreated,
    fileModified,
    durationDisplay,
    mediaPropsLoading,
    mediaProps,
    loadMediaProperties,
    showValue,
    propsCopyPath,
    propsOpenFolder,
    propsCopyAll,
    copyPropValue,
    performDelete,
    closeClipDeleteConfirm,
    closeDeleteConfirm,
    multiDeleteConfirm = false,
    multiDeleteCount = 0,
    multiDeletePermanently = false,
    performMultiDelete,
    closeMultiDeleteConfirm,
    updateMultiDeletePermanently,
    multiDeleteNoAsk = false,
    updateMultiDeleteNoAsk,
    closeProperties,
    updateDeleteNoAsk,
    updateDeletePermanently,
    onClose,
    corruptionWarning,
    corruptionReason,
    corruptionFixing,
    corruptionFixError,
    dismissCorruption,
    fixCopy,
    fixReplace,
  }: {
    contextMenu: ContextMenu;
    isVideo: boolean;
    isAudio: boolean;
    isPdf: boolean;
    timestamps: VideoMarker[];
    clipBoundaries: ClipBoundary[];
    resumePoint: number | null;
    clipOutputDir: string;
    parentFolder: () => string;
    invokeOpenDirectory: (path: string) => Promise<void>;
    ctxCopyImage: () => void;
    ctxCopyFrame: () => void;
    ctxCopyPath: () => void;
    ctxRotate: () => void;
    ctxFlip: () => void;
    ctxShowInExplorer: () => void;
    ctxProperties: () => void;
    ctxShare: () => void;
    ctxEdit: () => void;
    ctxMarkup: () => void;
    ctxEffects: () => void;
    ctxEqualizer: () => void;
    ctxClearMarkers: () => void;
    ctxDelete: () => void;
    clipDeleteConfirm: { visible: boolean; mode: "separate" | "merge" | null };
    deleteConfirm: boolean;
    propertiesOpen: boolean;
    shareOpen: boolean;
    closeShare: () => void;
    deleteNoAsk: boolean;
    deletePermanently: boolean;
    fileName: string;
    filePath: string;
    fileExt: () => string;
    fileDimensions: string;
    fileSize: string;
    fileCreated: string;
    fileModified: string;
    durationDisplay: string;
    mediaPropsLoading: boolean;
    mediaProps: MediaProperties | null;
    loadMediaProperties: () => Promise<void>;
    showValue: (v: string | undefined) => string;
    propsCopyPath: () => void;
    propsOpenFolder: () => void;
    propsCopyAll: () => void;
    copyPropValue: (value: string) => void;
    performDelete: () => void;
    closeClipDeleteConfirm: () => void;
    closeDeleteConfirm: () => void;
    multiDeleteConfirm?: boolean;
    multiDeleteCount?: number;
    multiDeletePermanently?: boolean;
    performMultiDelete?: () => void;
    closeMultiDeleteConfirm?: () => void;
    updateMultiDeletePermanently?: (v: boolean) => void;
    multiDeleteNoAsk?: boolean;
    updateMultiDeleteNoAsk?: (v: boolean) => void;
    closeProperties: () => void;
    updateDeleteNoAsk: (v: boolean) => void;
    updateDeletePermanently: (v: boolean) => void;
    onClose: () => void;
    corruptionWarning: boolean;
    corruptionReason: string;
    corruptionFixing: boolean;
    corruptionFixError: string;
    dismissCorruption: () => void;
    fixCopy: () => void;
    fixReplace: () => void;
  } = $props();

  let pinned = $state(false);
  let deleteMarkersConfirm = $state(false);
  let deleteMarkersTimer: ReturnType<typeof setTimeout> | null = $state(null);
  let shareOutputDir = $state(loadShareOutputDir());
  let shareDeleteOriginal = $state(false);
  let shareConverting = $state(false);
  let convertingFormat = $state<string | undefined>(undefined);
  let convertProgress = $state<number>(0);

  $effect(() => {
    if (!shareOpen) {
      shareDeleteOriginal = false;
      shareConverting = false;
      convertingFormat = undefined;
      convertProgress = 0;
    }
  });

  $effect(() => {
    if (!contextMenu.visible) {
      pinned = false;
      deleteMarkersConfirm = false;
      if (deleteMarkersTimer) {
        clearTimeout(deleteMarkersTimer);
        deleteMarkersTimer = null;
      }
    }
  });

  async function openInDefaultApp() {
    const { openPath } = await import("@tauri-apps/plugin-opener");
    await openPath(filePath);
  }

  function printPdf() {
    window.print();
    showToast({ message: "Print dialog opened", color: "blue" });
  }

  async function handleShazam() {
    closeShare();
    const toastId = showToast({
      message: "Identifying\u2026",
      color: "blue",
      duration: 0,
    });
    try {
      const result = await invokeIdentifySong(filePath);
      if (result) {
        updateToast(toastId, {
          message: `\uD83C\uDFB5 ${result.title} \u2014 ${result.artist}`,
          color: "blue",
          duration: 3000,
        });
      } else {
        updateToast(toastId, {
          message: "Couldn't identify this song",
          color: "blue",
          duration: 3000,
        });
      }
    } catch {
      updateToast(toastId, {
        message: "Shazam failed \u2014 check your internet connection",
        color: "blue",
        duration: 3000,
      });
    }
  }

  async function shareAction(fn: () => Promise<void>, successMsg: string) {
    try {
      await fn();
      showToast({ message: successMsg, color: "green" });
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Action failed";
      const appNotFoundMatch = msg.match(
        /^APP_NOT_FOUND:(.+?):(https?:\/\/.+)$/,
      );
      if (appNotFoundMatch) {
        const appName = appNotFoundMatch[1];
        const installUrl = appNotFoundMatch[2];
        showToast({
          message: `${appName} not installed \u2014 install?`,
          color: "red",
          duration: 5000,
          actions: [
            {
              label: "Install",
              variant: "accent",
              onClick: () => window.open(installUrl, "_blank"),
            },
          ],
        });
      } else {
        console.error("Share action failed:", e);
        showToast({ message: "Action failed", color: "red" });
      }
    }
    closeShare();
  }

  async function handleSetWallpaper() {
    if (isVideo || isPdf) {
      try {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(filePath);
        showToast({ message: "Opened in default app", color: "green" });
      } catch {
        showToast({ message: "Failed to open file", color: "red" });
      }
      closeShare();
      return;
    }
    await shareAction(() => invokeSetWallpaper(filePath), "Wallpaper set");
  }

  async function handleShareLocation() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const dir = await open({ directory: true });
    if (dir) {
      shareOutputDir = dir as string;
      saveShareOutputDir(shareOutputDir);
    }
  }

  async function handleSaveAs(format: string) {
    const outputDir = shareOutputDir || parentFolder();
    if (!outputDir) {
      showToast({ message: "Pick a save location", color: "yellow" });
      return;
    }
    shareConverting = true;
    let success = false;
    let unlisten: (() => void) | undefined;
    try {
      const sourceExt = fileExt().toLowerCase().replace(".", "");
      const isImage = !isVideo && !isAudio && !isPdf;
      const isWaveformConvert = isAudio && format === "mp4";

      if (isWaveformConvert) {
        convertingFormat = format;
        convertProgress = 0;
        unlisten = await listen<number>("conversion-progress", (event) => {
          convertProgress = event.payload;
        });
      }

      if (sourceExt === format) {
        await invokeCopyFileUnique(filePath, outputDir);
      } else if (isWaveformConvert) {
        await invokeConvertAudioToWaveformVideo(filePath, outputDir);
      } else if (isImage && format === "pdf") {
        await invokeConvertImageToPdf(filePath, outputDir);
      } else {
        await invokeConvertMedia(filePath, outputDir, format, "Balanced");
      }
      showToast({
        message: "Saved as " + format.toUpperCase(),
        color: "green",
        duration: 5000,
        actions: [
          {
            label: "Open in explorer",
            icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            onClick: () => invokeOpenDirectory(outputDir),
          },
        ],
      });
      success = true;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Conversion failed";
      console.error("Save as failed:", e);
      showToast({ message: msg, color: "red" });
    } finally {
      shareConverting = false;
      convertingFormat = undefined;
      convertProgress = 0;
      unlisten?.();
    }
    if (success && shareDeleteOriginal) {
      try {
        await invokeDeleteFile(filePath);
      } catch (e) {
        console.error("Failed to delete original:", e);
        showToast({
          message: "Converted but couldn't delete original",
          color: "red",
        });
      }
    }
    closeShare();
  }

  async function handleSaveAsOther() {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const isImage = !isVideo && !isAudio && !isPdf;

    const f = (name: string, ext: string) => ({ name, extensions: [ext] });

    let filters: { name: string; extensions: string[] }[];
    if (isImage) {
      // Image → other image formats, PSD, PDF
      filters = [
        f("PNG", "png"),
        f("JPG", "jpg"),
        f("GIF", "gif"),
        f("WebP", "webp"),
        f("BMP", "bmp"),
        f("HEIC", "heic"),
        f("AVIF", "avif"),
        f("TIFF", "tiff"),
        f("JXL", "jxl"),
        f("PSD", "psd"),
        f("PDF", "pdf"),
      ];
    } else if (isVideo) {
      // Video → other video formats, audio extraction, GIF
      filters = [
        f("MP4", "mp4"),
        f("MKV", "mkv"),
        f("MOV", "mov"),
        f("AVI", "avi"),
        f("WebM", "webm"),
        f("WMV", "wmv"),
        f("M4V", "m4v"),
        f("MPG", "mpg"),
        f("TS", "ts"),
        f("GIF", "gif"),
        f("MP3", "mp3"),
        f("AAC", "aac"),
        f("WAV", "wav"),
        f("FLAC", "flac"),
        f("M4A", "m4a"),
        f("OGG", "ogg"),
        f("WMA", "wma"),
        f("AIFF", "aiff"),
        f("ALAC", "alac"),
        f("Opus", "opus"),
      ];
    } else {
      // Audio → other audio formats, Opus, MP4 (waveform video)
      filters = [
        f("MP3", "mp3"),
        f("AAC", "aac"),
        f("WAV", "wav"),
        f("FLAC", "flac"),
        f("M4A", "m4a"),
        f("OGG", "ogg"),
        f("WMA", "wma"),
        f("AIFF", "aiff"),
        f("ALAC", "alac"),
        f("Opus", "opus"),
        f("MP4", "mp4"),
      ];
    }

    const stem = fileName.replace(/\.[^.]+$/, "");
    const defaultDir = shareOutputDir || parentFolder() || "";
    const defaultPath = defaultDir ? `${defaultDir}\\${stem}` : stem;

    const outputPath = await save({ defaultPath, filters });
    if (!outputPath) return;

    const outputExt = outputPath.split(".").pop()?.toLowerCase() || "";
    if (!outputExt) {
      showToast({ message: "No format selected", color: "yellow" });
      return;
    }

    shareConverting = true;
    let success = false;
    let unlisten: (() => void) | undefined;
    try {
      const sourceExt = fileExt().toLowerCase().replace(".", "");
      const sep = outputPath.includes("\\") ? "\\" : "/";
      const lastSep = outputPath.lastIndexOf(sep);
      const outputDirFromSave = lastSep > 0 ? outputPath.slice(0, lastSep) : "";

      const isWaveformConvert = isAudio && outputExt === "mp4";

      if (isWaveformConvert) {
        convertingFormat = outputExt;
        convertProgress = 0;
        unlisten = await listen<number>("conversion-progress", (event) => {
          convertProgress = event.payload;
        });
      }

      if (sourceExt === outputExt) {
        await invokeCopyFile(filePath, outputPath);
      } else if (isWaveformConvert) {
        await invokeConvertAudioToWaveformVideo(
          filePath,
          outputDirFromSave,
          outputPath,
        );
      } else if (isImage && outputExt === "pdf") {
        await invokeConvertImageToPdf(filePath, outputDirFromSave, outputPath);
      } else {
        await invokeConvertMedia(
          filePath,
          outputDirFromSave,
          outputExt,
          "Balanced",
          outputPath,
        );
      }
      showToast({
        message: "Saved as " + outputExt.toUpperCase(),
        color: "green",
        duration: 5000,
        actions: [
          {
            label: "Open in explorer",
            icon: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>',
            onClick: () => invokeOpenDirectory(outputDirFromSave),
          },
        ],
      });
      success = true;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : "Conversion failed";
      console.error("Save as failed:", e);
      showToast({ message: msg, color: "red" });
    } finally {
      shareConverting = false;
      convertingFormat = undefined;
      convertProgress = 0;
      unlisten?.();
    }
    if (success && shareDeleteOriginal) {
      try {
        await invokeDeleteFile(filePath);
      } catch (e) {
        console.error("Failed to delete original:", e);
        showToast({
          message: "Converted but couldn't delete original",
          color: "red",
        });
      }
    }
    closeShare();
  }
</script>

{#if contextMenu.visible}
  <div
    class="context-menu"
    class:pinned
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    role="menu"
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="0"
      aria-label="Drag to move"
      onmousedown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startMenuX = contextMenu.x;
        const startMenuY = contextMenu.y;

        function onMouseMove(ev: MouseEvent) {
          contextMenu.x = startMenuX + ev.clientX - startX;
          contextMenu.y = startMenuY + ev.clientY - startY;
        }

        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }}
    >
      <button
        class="ctx-pin tooltip-below"
        class:active={pinned}
        data-tooltip={pinned ? "Unpin" : "Pin"}
        onclick={(e) => {
          e.stopPropagation();
          pinned = !pinned;
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={pinned ? "Unpin" : "Pin"}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path
            d="M12 2C8 2 6 5 6 9V11L2 15V18H22V15L18 11V9C18 5 16 2 12 2ZM12 18V23"
          />
        </svg>
      </button>
      <span class="ctx-dots">
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
      </span>
      <button
        class="ctx-close tooltip-below"
        data-tooltip="Close"
        onclick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label="Close"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="edit-menu-card">
      {#if isPdf}
        <button
          class="ctx-item green"
          onclick={ctxShare}
          role="menuitem"
          style="animation-delay: 0ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="18"
              cy="5"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="6"
              cy="12"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="18"
              cy="19"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><line
              x1="8.59"
              y1="13.51"
              x2="15.42"
              y2="17.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><line
              x1="15.41"
              y1="6.51"
              x2="8.59"
              y2="10.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Share
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={openInDefaultApp}
          role="menuitem"
          style="animation-delay: 55ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /><polyline
              points="15 3 21 3 21 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /><line
              x1="10"
              y1="14"
              x2="21"
              y2="3"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
          Open in default viewer
        </button>
        <button
          class="ctx-item blue"
          onclick={printPdf}
          role="menuitem"
          style="animation-delay: 110ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="6 9 6 2 18 2 18 9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /><path
              d="M6 12H4a2 2 0 00-2 2v4a2 2 0 002 2h16a2 2 0 002-2v-4a2 2 0 00-2-2h-2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /><rect
              x="6"
              y="14"
              width="12"
              height="8"
              rx="1"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
          Print
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item yellow"
          onclick={ctxShowInExplorer}
          role="menuitem"
          style="animation-delay: 165ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          Show in explorer
        </button>
        <button
          class="ctx-item yellow"
          onclick={ctxProperties}
          role="menuitem"
          style="animation-delay: 220ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M12 10.5V16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
          >
          Properties
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item red"
          onclick={ctxDelete}
          role="menuitem"
          style="animation-delay: 275ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Delete
        </button>
      {:else if isAudio}
        <button
          class="ctx-item green"
          onclick={ctxCopyPath}
          role="menuitem"
          style="animation-delay: 0ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Copy path
        </button>
        <button
          class="ctx-item green"
          onclick={ctxShare}
          role="menuitem"
          style="animation-delay: 55ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="18"
              cy="5"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="6"
              cy="12"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="18"
              cy="19"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><line
              x1="8.59"
              y1="13.51"
              x2="15.42"
              y2="17.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><line
              x1="15.41"
              y1="6.51"
              x2="8.59"
              y2="10.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Share
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={ctxEffects}
          role="menuitem"
          style="animation-delay: 110ms"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5z" />
            <path d="M5 16l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
            <path
              d="M19 14l.75 2.25 2.25.75-2.25.75L19 20l-.75-2.25L16 17l2.25-.75z"
            />
          </svg>
          Effects
        </button>
        <button
          class="ctx-item blue"
          onclick={ctxEqualizer}
          role="menuitem"
          style="animation-delay: 165ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 11v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Equalizer
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item yellow"
          onclick={ctxShowInExplorer}
          role="menuitem"
          style="animation-delay: 220ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          Show in explorer
        </button>
        <button
          class="ctx-item yellow"
          onclick={ctxProperties}
          role="menuitem"
          style="animation-delay: 275ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M12 10.5V16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
          >
          Properties
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item red"
          onclick={ctxDelete}
          role="menuitem"
          style="animation-delay: 330ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Delete
        </button>
      {:else if !isVideo}
        <button
          class="ctx-item green"
          onclick={ctxCopyImage}
          role="menuitem"
          style="animation-delay: 0ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><rect
              x="8"
              y="8"
              width="13"
              height="13"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M4 16V5a1 1 0 011-1h11"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Copy image
        </button>
        <button
          class="ctx-item green"
          onclick={ctxShare}
          role="menuitem"
          style="animation-delay: 55ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="18"
              cy="5"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="6"
              cy="12"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="18"
              cy="19"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><line
              x1="8.59"
              y1="13.51"
              x2="15.42"
              y2="17.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><line
              x1="15.41"
              y1="6.51"
              x2="8.59"
              y2="10.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Share
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={ctxEdit}
          role="menuitem"
          style="animation-delay: 110ms"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><line x1="21" y1="4" x2="14" y2="4" /><line
              x1="10"
              y1="4"
              x2="3"
              y2="4"
            /><line x1="21" y1="12" x2="12" y2="12" /><line
              x1="8"
              y1="12"
              x2="3"
              y2="12"
            /><line x1="21" y1="20" x2="16" y2="20" /><line
              x1="12"
              y1="20"
              x2="3"
              y2="20"
            /><line x1="14" y1="2" x2="14" y2="6" /><line
              x1="8"
              y1="10"
              x2="8"
              y2="14"
            /><line x1="16" y1="18" x2="16" y2="22" /></svg
          >
          Edit
        </button>
        <button
          class="ctx-item blue"
          onclick={ctxMarkup}
          role="menuitem"
          style="animation-delay: 165ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M12 20h9"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
          Markup
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item yellow"
          onclick={ctxShowInExplorer}
          role="menuitem"
          style="animation-delay: 220ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          Show in explorer
        </button>
        <button
          class="ctx-item yellow"
          onclick={ctxProperties}
          role="menuitem"
          style="animation-delay: 275ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M12 10.5V16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
          >
          Properties
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item red"
          onclick={ctxDelete}
          role="menuitem"
          style="animation-delay: 330ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Delete
        </button>
      {:else}
        <button
          class="ctx-item green"
          onclick={ctxCopyFrame}
          role="menuitem"
          style="animation-delay: 0ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><rect
              x="2"
              y="4"
              width="20"
              height="16"
              rx="2"
              stroke="currentColor"
              stroke-width="2"
            /><circle cx="8.5" cy="10.5" r="1.5" fill="currentColor" /><path
              d="M2 17l5-5 4 4 3-3 5 5"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Copy current frame
        </button>
        <button
          class="ctx-item green"
          onclick={ctxShare}
          role="menuitem"
          style="animation-delay: 55ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="18"
              cy="5"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="6"
              cy="12"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><circle
              cx="18"
              cy="19"
              r="3"
              stroke="currentColor"
              stroke-width="2"
            /><line
              x1="8.59"
              y1="13.51"
              x2="15.42"
              y2="17.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><line
              x1="15.41"
              y1="6.51"
              x2="8.59"
              y2="10.49"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Share
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={ctxEdit}
          role="menuitem"
          style="animation-delay: 110ms"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><line x1="21" y1="4" x2="14" y2="4" /><line
              x1="10"
              y1="4"
              x2="3"
              y2="4"
            /><line x1="21" y1="12" x2="12" y2="12" /><line
              x1="8"
              y1="12"
              x2="3"
              y2="12"
            /><line x1="21" y1="20" x2="16" y2="20" /><line
              x1="12"
              y1="20"
              x2="3"
              y2="20"
            /><line x1="14" y1="2" x2="14" y2="6" /><line
              x1="8"
              y1="10"
              x2="8"
              y2="14"
            /><line x1="16" y1="18" x2="16" y2="22" /></svg
          >
          Edit
        </button>
        <button
          class="ctx-item blue"
          onclick={ctxEqualizer}
          role="menuitem"
          style="animation-delay: 165ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M2 12h2M6 8v8M10 5v14M14 9v6M18 7v10M22 11v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Equalizer
        </button>
        <div class="ctx-sep"></div>
        <button
          class="ctx-item yellow"
          onclick={ctxShowInExplorer}
          role="menuitem"
          style="animation-delay: 220ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
          Show in explorer
        </button>
        <button
          class="ctx-item yellow"
          onclick={ctxProperties}
          role="menuitem"
          style="animation-delay: 275ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            /><path
              d="M12 10.5V16"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
          >
          Properties
        </button>
        <div class="ctx-sep"></div>
        {#if timestamps.length > 0 || clipBoundaries.length > 0 || resumePoint !== null}
          <button
            class="ctx-item red"
            class:delete-confirm={deleteMarkersConfirm}
            onclick={() => {
              if (deleteMarkersConfirm) {
                if (deleteMarkersTimer) clearTimeout(deleteMarkersTimer);
                ctxClearMarkers();
              } else {
                deleteMarkersConfirm = true;
                deleteMarkersTimer = setTimeout(() => {
                  deleteMarkersConfirm = false;
                  deleteMarkersTimer = null;
                }, 3000);
              }
            }}
            role="menuitem"
            style="animation-delay: 330ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><circle
                cx="12"
                cy="12"
                r="9"
                stroke="currentColor"
                stroke-width="2"
              /><path
                d="M9 9l6 6M15 9l-6 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            {deleteMarkersConfirm ? "Confirm Delete" : "Delete Markers"}
          </button>
        {/if}
        <button
          class="ctx-item red"
          onclick={ctxDelete}
          role="menuitem"
          style="animation-delay: 330ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><polyline
              points="3 6 5 6 21 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M19 6l-1 14H6L5 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M10 11v6M14 11v6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /><path
              d="M9 6V4h6v2"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Delete
        </button>
      {/if}
    </div>
  </div>
{/if}

{#if deleteConfirm}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={closeDeleteConfirm}
  >
    <div
      class="delete-dialog edit-confirm-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="edit-confirm-header">
        <div class="edit-confirm-header-left">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
          <div>
            <p class="delete-title">Delete file</p>
            <p class="delete-subtitle">{fileName}</p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={closeDeleteConfirm}
          aria-label="Cancel"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="delete-toggles">
        <label class="toggle-row">
          <span class="toggle-label"
            ><svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polyline points="3 6 5 6 21 6" /><path
                d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
              /><path d="M10 11v6" /><path d="M14 11v6" /><path
                d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"
              /></svg
            >Delete permanently</span
          >
          <input
            type="checkbox"
            checked={deletePermanently}
            onchange={(e) => updateDeletePermanently(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={deletePermanently}
            ><span class="toggle-thumb"></span></span
          >
        </label>
        <label class="toggle-row">
          <span class="toggle-label"
            ><svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
              /><path
                d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"
              /><line x1="1" y1="1" x2="23" y2="23" /></svg
            >Don't ask again</span
          >
          <input
            type="checkbox"
            checked={deleteNoAsk}
            onchange={(e) => updateDeleteNoAsk(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={deleteNoAsk}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      </div>
      <div class="delete-actions-card">
        <div class="edit-confirm-actions edit-confirm-actions-horizontal">
          <button class="delete-cancel" onclick={closeDeleteConfirm}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
            >Cancel
          </button>
          <button class="delete-confirm-btn" onclick={performDelete}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polyline points="3 6 5 6 21 6" /><path
                d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
              /><path d="M10 11v6" /><path d="M14 11v6" /><path
                d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"
              /></svg
            >Delete
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if multiDeleteConfirm}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={closeMultiDeleteConfirm}
  >
    <div
      class="delete-dialog edit-confirm-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="edit-confirm-header">
        <div class="edit-confirm-header-left">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
          <div>
            <p class="delete-title">Delete files</p>
            <p class="delete-subtitle">{multiDeleteCount} files</p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={closeMultiDeleteConfirm}
          aria-label="Cancel"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="delete-toggles">
        <label class="toggle-row">
          <span class="toggle-label"
            ><svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polyline points="3 6 5 6 21 6" /><path
                d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
              /><path d="M10 11v6" /><path d="M14 11v6" /><path
                d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"
              /></svg
            >Delete permanently</span
          >
          <input
            type="checkbox"
            checked={multiDeletePermanently}
            onchange={(e) =>
              updateMultiDeletePermanently?.(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={multiDeletePermanently}
            ><span class="toggle-thumb"></span></span
          >
        </label>
        <label class="toggle-row">
          <span class="toggle-label"
            ><svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
              /><path
                d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"
              /><line x1="1" y1="1" x2="23" y2="23" /></svg
            >Don't ask again</span
          >
          <input
            type="checkbox"
            checked={multiDeleteNoAsk}
            onchange={(e) => updateMultiDeleteNoAsk?.(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={multiDeleteNoAsk}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      </div>
      <div class="delete-actions-card">
        <div class="edit-confirm-actions edit-confirm-actions-horizontal">
          <button class="delete-cancel" onclick={closeMultiDeleteConfirm}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
            >Cancel
          </button>
          <button
            class="delete-confirm-btn"
            onclick={() => performMultiDelete?.()}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polyline points="3 6 5 6 21 6" /><path
                d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"
              /><path d="M10 11v6" /><path d="M14 11v6" /><path
                d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"
              /></svg
            >Delete
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if propertiesOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <div class="delete-dialog props-dialog" role="dialog" aria-modal="true">
      <div class="props-header-bar">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.5V16" stroke-linecap="round" />
          <circle cx="12" cy="7.5" r="1" fill="currentColor" />
        </svg>
        <div>
          <p class="delete-title">Properties</p>
          <p class="delete-subtitle">{fileName}</p>
        </div>
        <button
          class="dialog-close-x"
          onclick={closeProperties}
          aria-label="Close"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
          >
        </button>
      </div>
      <div class="props-list">
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              `${isPdf ? "Document (PDF)" : isVideo ? "Video" : "Image"} (${fileExt() || "unknown"})`,
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                `${isPdf ? "Document (PDF)" : isVideo ? "Video" : "Image"} (${fileExt() || "unknown"})`,
              );
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              /><polyline points="14 2 14 8 20 8" /></svg
            >
            Type
          </span>
          <span class="props-v"
            >{isPdf ? "Document (PDF)" : isVideo ? "Video" : "Image"} ({fileExt() ||
              "unknown"})</span
          >
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(fileDimensions || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileDimensions || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg
            >
            Dimensions
          </span>
          <span class="props-v">{fileDimensions || "Unknown"}</span>
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(fileSize || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileSize || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
                points="7 10 12 15 17 10"
              /><line x1="12" y1="15" x2="12" y2="3" /></svg
            >
            Size
          </span>
          <span class="props-v">{fileSize || "Unknown"}</span>
        </div>
        {#if isVideo}
          <div
            class="props-row"
            onclick={() => copyPropValue(durationDisplay)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(durationDisplay);
              }
            }}
            role="button"
            tabindex="0"
          >
            <span class="props-k">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><polyline
                  points="12 6 12 12 16 14"
                /></svg
              >
              Duration
            </span>
            <span class="props-v">{durationDisplay}</span>
          </div>
        {/if}
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              mediaPropsLoading
                ? "Loading..."
                : showValue(mediaProps?.container),
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                mediaPropsLoading
                  ? "Loading..."
                  : showValue(mediaProps?.container),
              );
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
              /></svg
            >
            Container
          </span>
          <span class="props-v"
            >{mediaPropsLoading
              ? "Loading..."
              : showValue(mediaProps?.container)}</span
          >
        </div>
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              mediaPropsLoading
                ? "Loading..."
                : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`,
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                mediaPropsLoading
                  ? "Loading..."
                  : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`,
              );
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
                x1="8"
                y1="21"
                x2="16"
                y2="21"
              /><line x1="12" y1="17" x2="12" y2="21" /></svg
            >
            Codec
          </span>
          <span class="props-v">
            {mediaPropsLoading
              ? "Loading..."
              : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`}
          </span>
        </div>
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              mediaPropsLoading
                ? "Loading..."
                : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`,
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                mediaPropsLoading
                  ? "Loading..."
                  : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`,
              );
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="12" cy="12" r="10" /><line
                x1="14.31"
                y1="8"
                x2="20.05"
                y2="17.94"
              /><line x1="9.69" y1="8" x2="21.17" y2="8" /><line
                x1="7.38"
                y1="12"
                x2="13.12"
                y2="2.06"
              /><line x1="9.69" y1="16" x2="3.95" y2="6.06" /><line
                x1="14.31"
                y1="16"
                x2="2.83"
                y2="16"
              /><line x1="16.62" y1="12" x2="10.88" y2="21.94" /></svg
            >
            Color
          </span>
          <span class="props-v">
            {mediaPropsLoading
              ? "Loading..."
              : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`}
          </span>
        </div>
        {#if isVideo}
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? "Loading..."
                  : showValue(mediaProps?.frame_rate),
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? "Loading..."
                    : showValue(mediaProps?.frame_rate),
                );
              }
            }}
            role="button"
            tabindex="0"
          >
            <span class="props-k">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polygon
                  points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                /></svg
              >
              Frame rate
            </span>
            <span class="props-v"
              >{mediaPropsLoading
                ? "Loading..."
                : showValue(mediaProps?.frame_rate)}</span
            >
          </div>
        {/if}
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              library.privacyMode
                ? "••••••••••••••••••"
                : fileCreated || "Unknown",
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                library.privacyMode
                  ? "••••••••••••••••••"
                  : fileCreated || "Unknown",
              );
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line
                x1="16"
                y1="2"
                x2="16"
                y2="6"
              /><line x1="8" y1="2" x2="8" y2="6" /><line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
              /></svg
            >
            Created
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? "••••••••••••••••••"
              : fileCreated || "Unknown"}</span
          >
        </div>
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              library.privacyMode
                ? "••••••••••••••••••"
                : fileModified || "Unknown",
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                library.privacyMode
                  ? "••••••••••••••••••"
                  : fileModified || "Unknown",
              );
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line
                x1="16"
                y1="2"
                x2="16"
                y2="6"
              /><line x1="8" y1="2" x2="8" y2="6" /><line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
              /></svg
            >
            Modified
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? "••••••••••••••••••"
              : fileModified || "Unknown"}</span
          >
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(parentFolder() || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(parentFolder() || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              ><path
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              /></svg
            >
            Folder
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? obscurePath(parentFolder() || "Unknown")
              : parentFolder() || "Unknown"}</span
          >
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(filePath || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(filePath || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              /><polyline points="14 2 14 8 20 8" /><line
                x1="16"
                y1="13"
                x2="8"
                y2="13"
              /><line x1="16" y1="17" x2="8" y2="17" /><polyline
                points="10 9 9 9 8 9"
              /></svg
            >
            Path
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? obscurePath(filePath || "Unknown")
              : filePath || "Unknown"}</span
          >
        </div>
      </div>
      <div class="props-actions-card">
        <div class="props-actions">
          <button class="props-btn" onclick={propsOpenFolder}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              />
            </svg>
            Open folder
          </button>
          <button class="props-btn" onclick={propsCopyPath}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path
                d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
              />
              <path
                d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
              />
            </svg>
            Copy file path
          </button>
          <button class="props-btn" onclick={propsCopyAll}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <rect x="8" y="8" width="13" height="13" rx="2" />
              <path d="M4 16V5a1 1 0 011-1h11" />
            </svg>
            Copy properties
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if shareOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <div class="delete-dialog share-dialog" role="dialog" aria-modal="true">
      <div class="share-header-bar">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </svg>
        <div>
          <p class="delete-title">Share</p>
          <p class="delete-subtitle">{fileName}</p>
        </div>
        <button class="dialog-close-x" onclick={closeShare} aria-label="Close">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
          >
        </button>
      </div>

      <div class="share-card">
        <div class="share-section">
          <p class="share-section-label">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" /><polyline
                points="16 6 12 2 8 6"
              /><line x1="12" y1="2" x2="12" y2="15" /></svg
            >
            Send to...
          </p>
          <div class="share-grid share-grid-4">
            {#if isVideo || isAudio}
              <button class="share-btn" onclick={() => {}}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><path
                    d="M2 16.1A5 5 0 015.9 20M2 12.05A9 9 0 019.95 20M2 8V6a2 2 0 012-2h16a2 2 0 012 2v12a2 2 0 01-2 2h-6"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /><line
                    x1="2"
                    y1="20"
                    x2="2.01"
                    y2="20"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                >
                Cast
              </button>
            {:else}
              <button
                class="share-btn"
                onclick={() =>
                  shareAction(
                    () => invokePrintFile(filePath),
                    "Print dialog opened",
                  )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><polyline
                    points="6 9 6 2 18 2 18 9"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /><path
                    d="M6 12H4a2 2 0 00-2 2v4a2 2 0 002 2h16a2 2 0 002-2v-4a2 2 0 00-2-2h-2"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /><rect
                    x="6"
                    y="14"
                    width="12"
                    height="8"
                    rx="1"
                    stroke="currentColor"
                    stroke-width="2"
                  /></svg
                >
                Printer
              </button>
            {/if}
            <button
              class="share-btn"
              onclick={() =>
                shareAction(() => openInDefaultApp(), "Shared via device")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                ><path
                  d="M8.5 16.5a5 5 0 017 0"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /><path
                  d="M5.5 13.5a10 10 0 0113 0"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /><path
                  d="M2 10.5a15 15 0 0120 0"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /><circle cx="12" cy="19.5" r="1.5" fill="currentColor" /></svg
              >
              Device
            </button>
            {#if isAudio}
              <button
                class="share-btn"
                onclick={() =>
                  shareAction(
                    () => invokeSendBluetooth(filePath),
                    "Bluetooth wizard opened",
                  )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><polyline
                    points="6.5 6.5 17.5 17.5 12 23 12 1 17.5 6.5 6.5 17.5"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                >
                Bluetooth
              </button>
            {:else}
              <button class="share-btn" onclick={handleSetWallpaper}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><rect
                    x="3"
                    y="3"
                    width="18"
                    height="8"
                    rx="4"
                    stroke="currentColor"
                    stroke-width="2"
                    fill="none"
                  /><line
                    x1="7"
                    y1="11"
                    x2="7"
                    y2="19"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><line
                    x1="7"
                    y1="19"
                    x2="11"
                    y2="19"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                >
                Wallpaper
              </button>
            {/if}
            {#if isAudio}
              <button class="share-btn" onclick={handleShazam}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><path
                    d="M9 18V5l12-2v13"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /><circle
                    cx="6"
                    cy="18"
                    r="3"
                    stroke="currentColor"
                    stroke-width="2"
                  /><circle
                    cx="18"
                    cy="16"
                    r="3"
                    stroke="currentColor"
                    stroke-width="2"
                  /></svg
                >
                Shazam
              </button>
            {:else}
              <button
                class="share-btn"
                onclick={() =>
                  shareAction(
                    () => invokeSetLockScreen(filePath),
                    "Lock screen set",
                  )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><rect
                    x="3"
                    y="11"
                    width="18"
                    height="11"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="2"
                  /><path
                    d="M7 11V7a5 5 0 0110 0v4"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                >
                Lock Screen
              </button>
            {/if}
            <button
              class="share-btn"
              onclick={() =>
                shareAction(
                  () => invokeCreateDesktopShortcut(filePath),
                  "Shortcut created on Desktop",
                )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                ><rect
                  x="2"
                  y="3"
                  width="20"
                  height="14"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="2"
                /><line
                  x1="8"
                  y1="21"
                  x2="16"
                  y2="21"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /><line
                  x1="12"
                  y1="17"
                  x2="12"
                  y2="21"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                /></svg
              >
              Desktop
            </button>
          </div>
        </div>

        <div class="ctx-sep"></div>

        <div class="share-section">
          <p class="share-section-label">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
              /><polyline points="15 3 21 3 21 9" /><line
                x1="10"
                y1="14"
                x2="21"
                y2="3"
              /></svg
            >
            Open with...
          </p>
          <div class="share-grid share-grid-4">
            <button
              class="share-btn-circle"
              onclick={() =>
                shareAction(() => openInDefaultApp(), "Opened in default app")}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                ><path
                  d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /><polyline
                  points="15 3 21 3 21 9"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /><line
                  x1="10"
                  y1="14"
                  x2="21"
                  y2="3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg
              >
              Default app
            </button>
            {#if isAudio}
              <button
                class="share-btn-circle"
                onclick={() =>
                  shareAction(
                    () => invokeOpenInSpotify(filePath),
                    "Copied to Spotify Local Files",
                  )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="2"
                  /><path
                    d="M9 15c2-1.2 4-1.2 6 0"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><path
                    d="M7.5 12.5c3-1.8 6-1.8 9 0"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><path
                    d="M6 10c4-2.4 8-2.4 12 0"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                >
                Spotify
              </button>
            {:else}
              <button
                class="share-btn-circle"
                onclick={() =>
                  shareAction(
                    () => invokeOpenInPhotos(filePath),
                    "Opened in Photos",
                  )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    stroke="currentColor"
                    stroke-width="2"
                  /><circle
                    cx="8.5"
                    cy="8.5"
                    r="1.5"
                    fill="currentColor"
                  /><path
                    d="M21 15l-5-5L5 21"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                >
                Photos
              </button>
            {/if}
            {#if !isVideo && !isAudio}
              <button
                class="share-btn-circle"
                onclick={() =>
                  shareAction(
                    () => invokeOpenInPaint(filePath),
                    "Opened in Paint",
                  )}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><path
                    d="M18.37 2.63a2.12 2.12 0 013 3L14 13l-4 1 1-4 7.37-7.37z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /><path
                    d="M9 14.5c-1.5 1-2.5 2.5-2.5 4a1.5 1.5 0 003 0c0-1.5-1-3-2.5-4z"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  /></svg
                >
                Paint
              </button>
            {:else}
              <button
                class="share-btn-circle"
                onclick={() =>
                  shareAction(() => invokeOpenInVlc(filePath), "Opened in VLC")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="3"
                    stroke="currentColor"
                    stroke-width="2"
                  /><polygon
                    points="8 7 16 12 8 17"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linejoin="round"
                  /></svg
                >
                VLC
              </button>
            {/if}
            <button
              class="share-btn-circle"
              onclick={() =>
                shareAction(
                  () => invokeOpenInBrowser(filePath),
                  "Opened in browser",
                )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                ><circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="2"
                /><line
                  x1="2"
                  y1="12"
                  x2="22"
                  y2="12"
                  stroke="currentColor"
                  stroke-width="2"
                /><path
                  d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"
                  stroke="currentColor"
                  stroke-width="2"
                /></svg
              >
              Browser
            </button>
            <button
              class="share-btn-circle"
              onclick={() =>
                shareAction(
                  () => invokeOpenWithDialog(filePath),
                  "Open With dialog shown",
                )}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                ><circle cx="5" cy="12" r="1.5" fill="currentColor" /><circle
                  cx="12"
                  cy="12"
                  r="1.5"
                  fill="currentColor"
                /><circle cx="19" cy="12" r="1.5" fill="currentColor" /></svg
              >
              Other
            </button>
          </div>
        </div>

        <div class="ctx-sep"></div>

        {#if !isPdf}
          <div class="share-section">
            <p class="share-section-label">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
                  points="7 10 12 15 17 10"
                /><line x1="12" y1="15" x2="12" y2="3" /></svg
              >
              Save as...
            </p>
            {#if isVideo}
              <div class="share-grid share-grid-3">
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("mp4")}
                  disabled={shareConverting}>MP4</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("mkv")}
                  disabled={shareConverting}>MKV</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("webm")}
                  disabled={shareConverting}>WebM</button
                >
              </div>
              <div class="share-grid share-grid-3">
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("mp3")}
                  disabled={shareConverting}>MP3</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("gif")}
                  disabled={shareConverting}>GIF</button
                >
                <button
                  class="share-btn-wide"
                  onclick={handleSaveAsOther}
                  disabled={shareConverting}>Other…</button
                >
              </div>
            {:else if isAudio}
              <div class="share-grid share-grid-3">
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("mp3")}
                  disabled={shareConverting}>MP3</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("wav")}
                  disabled={shareConverting}>WAV</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("flac")}
                  disabled={shareConverting}>FLAC</button
                >
              </div>
              <div class="share-grid share-grid-3">
                <button
                  class="share-btn-wide"
                  class:converting={convertingFormat === "mp4"}
                  style:--progress="{convertProgress}%"
                  onclick={() => handleSaveAs("mp4")}
                  disabled={shareConverting && convertingFormat !== "mp4"}
                  >MP4</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("opus")}
                  disabled={shareConverting}>Opus</button
                >
                <button
                  class="share-btn-wide"
                  onclick={handleSaveAsOther}
                  disabled={shareConverting}>Other…</button
                >
              </div>
            {:else}
              <div class="share-grid share-grid-3">
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("jpg")}
                  disabled={shareConverting}>JPG</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("png")}
                  disabled={shareConverting}>PNG</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("webp")}
                  disabled={shareConverting}>WebP</button
                >
              </div>
              <div class="share-grid share-grid-3">
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("psd")}
                  disabled={shareConverting}>PSD</button
                >
                <button
                  class="share-btn-wide"
                  onclick={() => handleSaveAs("pdf")}
                  disabled={shareConverting}>PDF</button
                >
                <button
                  class="share-btn-wide"
                  onclick={handleSaveAsOther}
                  disabled={shareConverting}>Other…</button
                >
              </div>
            {/if}
          </div>
        {/if}
      </div>

      <div class="share-dest-bar">
        <span class="share-dest-label">
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="margin-right: 4px; flex-shrink: 0;"
            ><path
              d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
            /><polyline points="17 21 17 13 7 13 7 21" /><polyline
              points="7 3 7 8 15 8"
            /></svg
          >
          Save to:
        </span>
        <span
          class="tooltip-above"
          data-tooltip={shareOutputDir || parentFolder()}
        >
          <button class="share-dest-btn" onclick={handleShareLocation}>
            {shareOutputDir || parentFolder()}
          </button>
        </span>
        <button
          class="share-delete-toggle tooltip-above"
          class:is-on={shareDeleteOriginal}
          data-tooltip="Delete original"
          aria-label="Delete original"
          onclick={() => (shareDeleteOriginal = !shareDeleteOriginal)}
        >
          <svg
            width="11"
            height="11"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
            <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}
