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
  } from "$lib/features/media/tools";
  import {
    loadShareOutputDir,
    saveShareOutputDir,
  } from "$lib/services/storage";
  import { listen } from "@tauri-apps/api/event";

  let {
    contextMenu,
    isVideo,
    isAudio,
    isPdf,
    timestamps,
    clipBoundaries,
    resumePoint,
    frameCopyToast,
    imageCopyToast,
    clipToast,
    exportToast,
    clipboardToast,
    onOpenExportedFile,
    onSaveClipboardFile,
    onDismissClipboardToast,
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
    ffprobeChecked,
    ffprobeAvailable,
    ffmpegInstalling,
    ffmpegInstallError,
    mediaPropsLoading,
    mediaProps,
    installFfmpegAndWait,
    refreshFfprobeAvailability,
    loadMediaProperties,
    showValue,
    propsCopyPath,
    propsOpenFolder,
    propsCopyAll,
    copyPropValue,
    performDelete,
    runClipAction,
    closeClipDeleteConfirm,
    closeDeleteConfirm,
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
    frameCopyToast: {
      visible: boolean;
      message: string;
      tone: "success" | "error" | "info";
    };
    imageCopyToast: {
      visible: boolean;
      message: string;
      tone: "success" | "error" | "info";
    };
    clipToast: {
      visible: boolean;
      tone: "success" | "error";
      message: string;
      outputDir: string;
    };
    exportToast: {
      visible: boolean;
      phase: "exporting" | "done" | "error";
      message: string;
      outputPath: string;
    };
    clipboardToast: {
      visible: boolean;
      filePath: string;
    };
    onOpenExportedFile: () => void;
    onSaveClipboardFile: () => void;
    onDismissClipboardToast: () => void;
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
    ffprobeChecked: boolean;
    ffprobeAvailable: boolean;
    ffmpegInstalling: boolean;
    ffmpegInstallError: string;
    mediaPropsLoading: boolean;
    mediaProps: MediaProperties | null;
    installFfmpegAndWait: () => void;
    refreshFfprobeAvailability: () => Promise<void>;
    loadMediaProperties: () => Promise<void>;
    showValue: (v: string | undefined) => string;
    propsCopyPath: () => void;
    propsOpenFolder: () => void;
    propsCopyAll: () => void;
    copyPropValue: (value: string) => void;
    performDelete: () => void;
    runClipAction: (mode: "separate" | "merge") => void;
    closeClipDeleteConfirm: () => void;
    closeDeleteConfirm: () => void;
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
  let shareToast = $state<{
    visible: boolean;
    message: string;
    tone: "success" | "error";
    installUrl?: string;
    appName?: string;
    outputDir?: string;
  }>({ visible: false, message: "", tone: "success" });
  let shareToastTimer: ReturnType<typeof setTimeout> | undefined;
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
  }

  // ── Share: Send to handlers ───────────────────────────────────────────────

  function showShareToast(message: string, tone: "success" | "error", outputDir?: string) {
    clearTimeout(shareToastTimer);
    shareToast = { visible: true, message, tone, outputDir };
    shareToastTimer = setTimeout(() => {
      shareToast = { ...shareToast, visible: false };
    }, 4000);
  }

  function showAppNotInstalledToast(appName: string, installUrl: string) {
    clearTimeout(shareToastTimer);
    shareToast = {
      visible: true,
      message: `${appName} not installed \u2014 install?`,
      tone: "error",
      installUrl,
      appName,
    };
    shareToastTimer = setTimeout(() => {
      shareToast = { ...shareToast, visible: false };
    }, 5000);
  }

  async function shareAction(fn: () => Promise<void>, successMsg: string) {
    try {
      await fn();
      showShareToast(successMsg, "success");
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || "Action failed";
      // Detect APP_NOT_FOUND:AppName:InstallUrl pattern from Rust commands
      const appNotFoundMatch = msg.match(
        /^APP_NOT_FOUND:(.+?):(https?:\/\/.+)$/,
      );
      if (appNotFoundMatch) {
        showAppNotInstalledToast(appNotFoundMatch[1], appNotFoundMatch[2]);
      } else {
        console.error("Share action failed:", e);
        showShareToast("Action failed", "error");
      }
    }
    closeShare();
  }

  async function handleSetWallpaper() {
    // Images: direct call. Video/PDF: extract current frame first.
    if (isVideo || isPdf) {
      try {
        const { openPath } = await import("@tauri-apps/plugin-opener");
        await openPath(filePath);
        showShareToast("Opened in default app", "success");
      } catch {
        showShareToast("Failed to open file", "error");
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
      showShareToast("Pick a save location", "error");
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
      showShareToast("Saved as " + format.toUpperCase(), "success", outputDir);
      success = true;
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || "Conversion failed";
      console.error("Save as failed:", e);
      showShareToast(msg, "error");
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
        showShareToast("Converted but couldn't delete original", "error");
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
      showShareToast("No format selected", "error");
      return;
    }

    shareConverting = true;
    let success = false;
    let unlisten: (() => void) | undefined;
    try {
      const sourceExt = fileExt().toLowerCase().replace(".", "");
      // Extract the directory from the chosen output path
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
      showShareToast("Saved as " + outputExt.toUpperCase(), "success", outputDirFromSave);
      success = true;
    } catch (e: any) {
      const msg = typeof e === "string" ? e : e?.message || "Conversion failed";
      console.error("Save as failed:", e);
      showShareToast(msg, "error");
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
        showShareToast("Converted but couldn't delete original", "error");
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
          width="9"
          height="9"
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.51-.2-.98-.54-1.34-.31-.33-.49-.76-.49-1.16 0-.88.72-1.5 1.6-1.5H16c3.31 0 6-2.69 6-6 0-5.17-4.37-9-10-9z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" /><circle
            cx="10.5"
            cy="7.5"
            r="1.5"
            fill="currentColor"
          /><circle cx="15.5" cy="7.5" r="1.5" fill="currentColor" /><circle
            cx="18"
            cy="11"
            r="1.5"
            fill="currentColor"
          /></svg
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
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.1 0 2-.9 2-2 0-.51-.2-.98-.54-1.34-.31-.33-.49-.76-.49-1.16 0-.88.72-1.5 1.6-1.5H16c3.31 0 6-2.69 6-6 0-5.17-4.37-9-10-9z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><circle cx="7.5" cy="11.5" r="1.5" fill="currentColor" /><circle
            cx="10.5"
            cy="7.5"
            r="1.5"
            fill="currentColor"
          /><circle cx="15.5" cy="7.5" r="1.5" fill="currentColor" /><circle
            cx="18"
            cy="11"
            r="1.5"
            fill="currentColor"
          /></svg
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
{/if}

{#if frameCopyToast.visible}
  <div
    class="copy-toast"
    class:error={frameCopyToast.tone === "error"}
    class:info={frameCopyToast.tone === "info"}
    role="status"
    aria-live="polite"
  >
    {frameCopyToast.message}
  </div>
{/if}

{#if imageCopyToast.visible}
  <div
    class="copy-toast"
    class:error={imageCopyToast.tone === "error"}
    class:info={imageCopyToast.tone === "info"}
    role="status"
    aria-live="polite"
  >
    {imageCopyToast.message}
  </div>
{/if}

{#if shareToast.visible}
  <div
    class="copy-toast share-toast-interactive"
    class:error={shareToast.tone === "error"}
    role="status"
    aria-live="polite"
  >
    <span class="share-toast-msg">{shareToast.message}</span>
    <div class="share-toast-actions">
      {#if shareToast.tone === "success" && shareToast.outputDir}
        <button
          class="share-toast-folder"
          onclick={async () => {
            try {
              await invokeOpenDirectory(shareToast.outputDir!);
            } catch (e) {
              console.error("Failed to open share output directory:", e);
            }
          }}
          aria-label="open output folder"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            ><path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          ></button
        >
      {/if}
      {#if shareToast.installUrl}
        <button
          class="share-toast-link"
          onclick={() => {
            if (shareToast.installUrl)
              window.open(shareToast.installUrl, "_blank");
          }}>Get it</button
        >
      {/if}
      <button
        class="share-toast-dismiss"
        aria-label="Dismiss"
        onclick={() => {
          clearTimeout(shareToastTimer);
          shareToast = { ...shareToast, visible: false };
        }}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg
        >
      </button>
    </div>
  </div>
{/if}

{#if clipToast.visible}
  <div
    class="clip-toast"
    class:error={clipToast.tone === "error"}
    role="status"
    aria-live="polite"
  >
    <span>{clipToast.message}</span>
    {#if clipToast.tone === "success"}
      <button
        class="clip-toast-folder"
        onclick={async () => {
          try {
            await invokeOpenDirectory(
              clipToast.outputDir || clipOutputDir || parentFolder(),
            );
          } catch (e) {
            console.error("Failed to open clip output directory:", e);
          }
        }}
        aria-label="open output folder"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          ><path
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            stroke="currentColor"
            stroke-width="2"
          /></svg
        ></button
      >
    {/if}
  </div>
{/if}

{#if exportToast.visible}
  <div
    class="export-toast"
    class:exporting={exportToast.phase === "exporting"}
    class:done={exportToast.phase === "done"}
    class:error={exportToast.phase === "error"}
    role="status"
    aria-live="polite"
  >
    <div class="export-toast-content">
      <span>{exportToast.message}</span>
      {#if exportToast.phase === "done"}
        <button
          class="export-toast-open-btn"
          onclick={onOpenExportedFile}
          title="Open in Vyu"
          aria-label="Open in Vyu"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      {/if}
    </div>
    {#if exportToast.phase === "exporting"}
      <div class="export-toast-progress">
        <div class="export-toast-progress-bar"></div>
      </div>
    {/if}
  </div>
{/if}

{#if clipboardToast.visible}
  <div class="clipboard-toast" role="status" aria-live="polite">
    <span class="clipboard-toast-text"
      >This file is from the clipboard. Save it?</span
    >
    <div class="clipboard-toast-actions">
      <button
        class="clipboard-toast-btn save"
        onclick={onSaveClipboardFile}
        title="Save to folder"
        aria-label="Save to folder"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <button
        class="clipboard-toast-btn dismiss"
        onclick={onDismissClipboardToast}
        title="Dismiss"
        aria-label="Dismiss"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
{/if}

{#if clipDeleteConfirm.visible}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <div class="delete-dialog" role="dialog" aria-modal="true">
      <p class="delete-title">Delete original after export?</p>
      <p class="delete-subtitle">{fileName}</p>
      <div class="delete-actions">
        <button class="delete-cancel" onclick={closeClipDeleteConfirm}
          >Cancel</button
        >
        <button
          class="delete-confirm-btn"
          onclick={() => {
            if (clipDeleteConfirm.mode) runClipAction(clipDeleteConfirm.mode);
          }}>Continue</button
        >
      </div>
    </div>
  </div>
{/if}

{#if deleteConfirm}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <div
      class="delete-dialog delete-file-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div class="delete-header-bar">
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
          <path d="M19 6l-1 14H6L5 6" />
          <path d="M10 11v6M14 11v6" />
          <path d="M9 6V4h6v2" />
        </svg>
        <div>
          <p class="delete-title">Delete file?</p>
          <p class="delete-subtitle">{fileName}</p>
        </div>
      </div>
      <div class="delete-toggles">
        <label class="toggle-row">
          <span class="toggle-label">
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Do not ask again
          </span>
          <input
            type="checkbox"
            checked={deleteNoAsk}
            onchange={(e) => updateDeleteNoAsk(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={deleteNoAsk}
            ><span class="toggle-thumb"></span></span
          >
        </label>
        <label class="toggle-row">
          <span class="toggle-label">
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
              <path
                d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Delete permanently
          </span>
          <input
            type="checkbox"
            checked={deletePermanently}
            onchange={(e) => updateDeletePermanently(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={deletePermanently}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      </div>
      <div class="delete-actions">
        <button class="delete-cancel" onclick={closeDeleteConfirm}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          Cancel
        </button>
        <button class="delete-confirm-btn" onclick={performDelete}>
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
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
          Delete
        </button>
      </div>
    </div>
  </div>
{/if}

{#if corruptionWarning}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <div
      class="delete-dialog corruption-dialog"
      role="dialog"
      aria-modal="true"
    >
      <div class="delete-header-bar">
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
          <path
            d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
        <div>
          <p class="delete-title">File may be corrupted</p>
          <p class="delete-subtitle">{fileName}</p>
        </div>
      </div>
      <p class="corruption-reason">{corruptionReason}</p>
      {#if corruptionFixing}
        <div class="corruption-fixing">
          <div class="corruption-spinner"></div>
          <span>Fixing file...</span>
        </div>
      {/if}
      {#if corruptionFixError}
        <p class="corruption-error">{corruptionFixError}</p>
      {/if}
      <div class="delete-actions">
        <button class="delete-cancel" onclick={dismissCorruption}>
          Dismiss
        </button>
        <button
          class="delete-cancel"
          onclick={fixCopy}
          disabled={corruptionFixing}
        >
          Make fixed copy
        </button>
        <button
          class="delete-confirm-btn"
          onclick={fixReplace}
          disabled={corruptionFixing}
        >
          Fix &amp; replace
        </button>
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
        {#if ffprobeChecked && !ffprobeAvailable}
          <div class="ffprobe-note">
            <p class="ffprobe-title">Advanced metadata needs FFmpeg</p>
            <p class="ffprobe-sub">
              To show Container, Codec, Color, and Frame Rate, install FFmpeg.
              Your files stay local on your device and are not uploaded
              anywhere.
            </p>
            <div class="ffprobe-actions">
              <button
                class="props-btn"
                onclick={installFfmpegAndWait}
                disabled={ffmpegInstalling}
              >
                {ffmpegInstalling ? "Installing FFmpeg..." : "Install FFmpeg"}
              </button>
              <button
                class="props-btn props-btn-secondary"
                onclick={async () => {
                  await refreshFfprobeAvailability();
                  if (ffprobeAvailable) {
                    await loadMediaProperties();
                  }
                }}
                disabled={ffmpegInstalling}
              >
                Retry detection
              </button>
              {#if ffmpegInstalling}
                <div class="ffprobe-progress"><span></span></div>
              {/if}
            </div>
            {#if ffmpegInstallError}
              <p class="ffprobe-error">{ffmpegInstallError}</p>
            {/if}
          </div>
        {:else}
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
        {/if}
        <div
          class="props-row"
          onclick={() => copyPropValue(fileCreated || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileCreated || "Unknown");
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
          <span class="props-v">{fileCreated || "Unknown"}</span>
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(fileModified || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileModified || "Unknown");
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
          <span class="props-v">{fileModified || "Unknown"}</span>
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
          <span class="props-v">{parentFolder() || "Unknown"}</span>
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
          <span class="props-v">{filePath || "Unknown"}</span>
        </div>
      </div>
      <div class="props-actions">
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
      <div class="delete-actions">
        <button class="delete-cancel" onclick={closeProperties}> Close </button>
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
              <button
                class="share-btn"
                onclick={() =>
                  shareAction(() => openInDefaultApp(), "Cast opened")}
              >
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
              <button
                class="share-btn"
                onclick={() => {
                  showShareToast("Transcription coming soon", "success");
                  closeShare();
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  ><path
                    d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                    stroke="currentColor"
                    stroke-width="2"
                  /><path
                    d="M19 10v2a7 7 0 01-14 0v-2"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><line
                    x1="12"
                    y1="19"
                    x2="12"
                    y2="23"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><line
                    x1="8"
                    y1="23"
                    x2="16"
                    y2="23"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /></svg
                >
                Transcriptor
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
                    d="M8.5 16C10 14.8 13 14.3 15.5 15"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><path
                    d="M7 13.5C10 11 14.5 10.5 17 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  /><path
                    d="M6 11C10 7.5 15 7 18.5 9.5"
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
                  ><polygon
                    points="5 3 19 12 5 21 5 3"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
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
                  disabled={shareConverting && convertingFormat !== "mp4"}>MP4</button
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

      <div class="delete-actions">
        <button class="delete-cancel" onclick={closeShare}> Close </button>
      </div>
    </div>
  </div>
{/if}
