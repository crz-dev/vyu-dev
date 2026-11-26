<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { appearance } from "$lib/features/theme/appearance.svelte";
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
    invokeOpenDefaultApp,
    invokeShareFile,
    invokeOpenInPhotos,
    invokeOpenInPaint,
    invokeOpenInVlc,
    invokeOpenInSpotify,
    invokeOpenInBrowser,
    invokeExtractVideoFrame,
    invokeOpenWithDialog,
    invokeConvertMedia,
    invokeConvertAudioToWaveformVideo,
    invokeConvertImageToPdf,
    invokeCopyFile,
    invokeCopyFileUnique,
    invokeTrashFile,
    invokeIdentifySong,
    invokeBatchStat,
    invokeSetFileModifiedTime,
  } from "$lib/features/media/api";
  import { conversionPrefs } from "$lib/features/media/conversionPrefs.svelte";
  import { queue } from "$lib/features/media/queue.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { bouncePropRows } from "./propRows";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
  import { invokeOpenDefaultAppsSettings } from "$lib/features/system/api";
  import { obscurePath } from "$lib/shared/privacy";
  import { listen } from "@tauri-apps/api/event";
  import { open } from "@tauri-apps/plugin-dialog";
  import { showToast, updateToast } from "$lib/components/toast.svelte";
  import {
    hideFloatingTooltip,
    showFloatingTooltip,
  } from "$lib/services/session";
  import { getFileExt, getParentFolder, joinPath } from "$lib/services/files";
  import {
    BROWSER_UNSUPPORTED_IMAGE_EXTS,
    BROWSER_UNSUPPORTED_VIDEO_EXTS,
    GIF_MAX_DURATION_SECONDS,
  } from "$lib/shared/constants";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let {
    contextMenu,
    isVideo,
    isAudio,
    isPdf,
    isRemote,
    getMediaEl,
    pdfPageCount,
    pdfCurrentPage,
    pdfVersion,
    pdfPageSize,
    pdfDocumentInfo,
    onPdfSaveAs,
    timestamps,
    clipBoundaries,
    resumePoint,
    parentFolder,
    invokeOpenDirectory,
    ctxCopyPdfPage,
    ctxCopyImage,
    ctxCopyFrame,
    ctxCopyPath,
    ctxRotate,
    ctxFlip,
    ctxShowInExplorer,
    ctxShare,
    ctxSearchPdf,
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
    onOpenConverted,
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
    isRemote: boolean;
    getMediaEl: () => HTMLMediaElement | null;
    pdfPageCount: number;
    pdfCurrentPage: number;
    pdfVersion: string;
    pdfPageSize: string;
    pdfDocumentInfo: string;
    onPdfSaveAs: (
      format: "pdf" | "png" | "jpg" | "webp" | "txt",
      outputPath?: string,
    ) => Promise<void>;
    timestamps: VideoMarker[];
    clipBoundaries: ClipBoundary[];
    resumePoint: number | null;
    parentFolder: () => string;
    invokeOpenDirectory: (path: string) => Promise<void>;
    ctxCopyPdfPage: () => void;
    ctxCopyImage: () => void;
    ctxCopyFrame: () => void;
    ctxCopyPath: () => void;
    ctxRotate: () => void;
    ctxFlip: () => void;
    ctxShowInExplorer: () => void;
    ctxShare: () => void;
    ctxSearchPdf: () => void;
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
    onOpenConverted?: (path: string) => void;
    corruptionWarning: boolean;
    corruptionReason: string;
    corruptionFixing: boolean;
    corruptionFixError: string;
    dismissCorruption: () => void;
    fixCopy: () => void;
    fixReplace: () => void;
  } = $props();

  const t = locale.t;
  const tp = locale.tp;

  let overlayFadeMs = $derived(appearance.reducedMotion ? 0 : 120);

  let pinned = $state(false);
  let deleteMarkersConfirm = $state(false);
  let deleteMarkersTimer: ReturnType<typeof setTimeout> | null = $state(null);
  const shareDeleteOriginal = $derived(conversionPrefs.deleteOriginal);

  function unknownValue(): string {
    return t("dialogs.dialog.properties.unknown");
  }

  function fileTypeName(): string {
    if (isPdf) return t("dialogs.dialog.properties.typeDocument");
    if (isVideo) return t("dialogs.dialog.properties.typeVideo");
    return t("dialogs.dialog.properties.typeImage");
  }

  function fileTypeValue(): string {
    return t("dialogs.dialog.properties.typeValue", {
      type: fileTypeName(),
      ext: fileExt() || t("dialogs.dialog.properties.unknownLower"),
    });
  }

  function codecValue(): string {
    const video = showValue(mediaProps?.video_codec);
    const audio = mediaProps?.audio_codec;
    return audio
      ? t("dialogs.dialog.properties.codecValue", { video, audio })
      : video;
  }

  function colorValue(): string {
    const pixel = showValue(mediaProps?.pixel_format);
    const parts = [pixel];
    if (mediaProps?.color_space) parts.push(mediaProps.color_space);
    const base = parts.join(" · ");
    return mediaProps?.bit_depth
      ? t("dialogs.dialog.properties.colorValue", {
          value: base,
          bit: mediaProps.bit_depth,
        })
      : base;
  }

  function conversionPreset(): string {
    switch (conversionPrefs.quality) {
      case "fast":
        return "Fast";
      case "quality":
        return "Quality";
      case "lossless":
        return "Lossless";
      default:
        return "Balanced";
    }
  }

  function conversionOptions() {
    return {
      preserveMetadata: conversionPrefs.preserveMetadata,
      overwrite: conversionPrefs.overwriteExisting,
      gpuEncoding: conversionPrefs.gpuEncoding,
      coverArtMode: conversionPrefs.coverArtMode,
      preset: conversionPreset(),
    };
  }

  function conversionOutputDir(): string {
    return conversionPrefs.outputDir || parentFolder();
  }

  function shortFolderPath(path: string): string {
    if (!path) return "";
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }

  const SHARE_ACTION_TOOLTIP_ID = "share-action-tooltip";

  function saveAsTip(format: string): string {
    return t("dialogs.dialog.share.tooltip.saveAsFormat", { format });
  }

  function shareTipTarget(event: Event): HTMLElement | null {
    return event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-share-tip]")
      : null;
  }

  function relatedShareTipTarget(event: Event): HTMLElement | null {
    const related = (event as MouseEvent | FocusEvent).relatedTarget;
    return related instanceof Element
      ? related.closest<HTMLElement>("[data-share-tip]")
      : null;
  }

  function shareTipDelegation(node: HTMLElement) {
    function show(event: Event) {
      const target = shareTipTarget(event);
      if (!target || target === relatedShareTipTarget(event)) return;
      const text = target.dataset.shareTip;
      if (!text) return;
      hideFloatingTooltip("share-dest-tooltip");
      showFloatingTooltip(
        SHARE_ACTION_TOOLTIP_ID,
        target.getBoundingClientRect(),
        text,
        "above",
      );
    }
    function hide(event: Event) {
      const target = shareTipTarget(event);
      if (!target || target === relatedShareTipTarget(event)) return;
      hideFloatingTooltip(SHARE_ACTION_TOOLTIP_ID);
    }
    node.addEventListener("mouseover", show);
    node.addEventListener("mouseout", hide);
    node.addEventListener("focusin", show);
    node.addEventListener("focusout", hide);
    return {
      destroy() {
        node.removeEventListener("mouseover", show);
        node.removeEventListener("mouseout", hide);
        node.removeEventListener("focusin", show);
        node.removeEventListener("focusout", hide);
        hideFloatingTooltip(SHARE_ACTION_TOOLTIP_ID);
      },
    };
  }

  async function pickShareOutputDir() {
    hideFloatingTooltip("share-dest-tooltip");
    const dir = await open({
      directory: true,
      defaultPath: conversionPrefs.outputDir || undefined,
    });
    if (!dir) return;
    conversionPrefs.setOutputDir(dir as string);
  }

  async function sourceModifiedMs(): Promise<number | null> {
    if (!conversionPrefs.keepOriginalDate) return null;
    try {
      const stat = await invokeBatchStat([filePath]);
      return stat[0]?.mtime_ms ?? null;
    } catch {
      return null;
    }
  }

  async function restoreModifiedTime(
    path: string | null,
    modifiedMs: number | null,
  ) {
    if (!path || modifiedMs === null) return;
    try {
      await invokeSetFileModifiedTime(path, modifiedMs);
    } catch {
      // Preserving the source timestamp is best-effort.
    }
  }
  type ShareConfirmKind =
    | "browser"
    | "wallpaper"
    | "lockScreen"
    | "desktop"
    | "gifLimit";

  let shareConverting = $state(false);
  let pdfSaving = $state(false);
  let convertingFormat = $state<string | undefined>(undefined);
  let convertProgress = $state<number>(0);
  let shareConfirm = $state<ShareConfirmKind | null>(null);
  let shareConfirmTime = $state(0);
  let shareConfirmBrowserFormat = $state<"WebP" | "WebM" | null>(null);
  let pendingGifSave: (() => Promise<void>) | null = null;
  const shareConfirmTitle = $derived(
    shareConfirm === "browser"
      ? t("dialogs.dialog.share.confirm.browserTitle")
      : shareConfirm === "wallpaper"
        ? t("dialogs.dialog.share.confirm.wallpaperTitle")
        : shareConfirm === "lockScreen"
          ? t("dialogs.dialog.share.confirm.lockScreenTitle")
          : shareConfirm === "desktop"
            ? t("dialogs.dialog.share.confirm.desktopTitle")
            : shareConfirm === "gifLimit"
              ? t("dialogs.dialog.share.confirm.gifLimitTitle")
              : "",
  );
  const shareConfirmBody = $derived(
    shareConfirm === "browser"
      ? t("dialogs.dialog.share.confirm.browserConvertBody", {
          format: shareConfirmBrowserFormat ?? "WebP",
        })
      : shareConfirm === "wallpaper"
        ? t(
            isVideo
              ? "dialogs.dialog.share.confirm.wallpaperVideoBody"
              : "dialogs.dialog.share.confirm.wallpaperBody",
          )
        : shareConfirm === "lockScreen"
          ? t(
              isVideo
                ? "dialogs.dialog.share.confirm.lockScreenVideoBody"
                : "dialogs.dialog.share.confirm.lockScreenBody",
            )
          : shareConfirm === "desktop"
            ? t("dialogs.dialog.share.confirm.desktopBody")
            : shareConfirm === "gifLimit"
              ? t("dialogs.dialog.share.confirm.gifLimitBody")
              : "",
  );
  let contextMenuElement = $state<HTMLDivElement | null>(null);

  function clampContextMenuPosition() {
    const menu = contextMenuElement;
    if (!menu) return;
    const maxX = Math.max(0, window.innerWidth - menu.offsetWidth);
    const maxY = Math.max(0, window.innerHeight - menu.offsetHeight);
    contextMenu.x = Math.max(0, Math.min(contextMenu.x, maxX));
    contextMenu.y = Math.max(0, Math.min(contextMenu.y, maxY));
  }

  $effect(() => {
    if (!contextMenu.visible || !contextMenuElement) return;
    const frame = requestAnimationFrame(clampContextMenuPosition);
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    if (!shareOpen) {
      hideFloatingTooltip("share-dest-tooltip");
      hideFloatingTooltip(SHARE_ACTION_TOOLTIP_ID);
      shareConfirm = null;
      shareConfirmBrowserFormat = null;
      pendingGifSave = null;
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

  function toggleQueueCurrent() {
    if (!filePath) return;
    if (queue.has(filePath)) {
      queue.remove(filePath);
      showToast({ message: t("menus.queue.removed"), color: "grey" });
      return;
    }
    queue.enqueue([filePath]);
    showToast({ message: t("menus.queue.addedOne"), color: "green" });
  }

  async function openInDefaultApp() {
    await invokeOpenDefaultApp(filePath);
  }

  async function handleShareFile() {
    try {
      await invokeShareFile(filePath);
    } catch (e) {
      console.error("Share action failed:", e);
      showToast({
        message: t("dialogs.dialog.toast.actionFailed"),
        color: "red",
      });
    }
    closeShare();
  }

  function printPdf() {
    window.print();
    showToast({
      message: t("dialogs.dialog.toast.printOpened"),
      color: "green",
    });
  }

  async function handleShazam() {
    closeShare();
    const toastId = showToast({
      message: t("dialogs.dialog.toast.identifying"),
      color: "blue",
      duration: 0,
    });
    try {
      const result = await invokeIdentifySong(filePath);
      if (result) {
        updateToast(toastId, {
          message: t("dialogs.dialog.toast.songIdentified", {
            title: result.title,
            artist: result.artist,
          }),
          color: "green",
          duration: 3000,
        });
      } else {
        updateToast(toastId, {
          message: t("dialogs.dialog.toast.songUnknown"),
          color: "yellow",
          duration: 3000,
        });
      }
    } catch (e) {
      const message =
        typeof e === "string" && e.toLowerCase().includes("sidecar")
          ? t("dialogs.dialog.toast.songUnavailable")
          : t("dialogs.dialog.toast.shazamFailed");
      updateToast(toastId, {
        message,
        color: "red",
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
            : t("dialogs.dialog.toast.actionFailed");
      const appNotFoundMatch = msg.match(
        /^APP_NOT_FOUND:(.+?):(https?:\/\/.+)$/,
      );
      if (msg.startsWith("NO_DEFAULT_APP")) {
        showToast({
          message: t("dialogs.dialog.toast.noDefaultApp"),
          color: "red",
          duration: 5000,
          actions: [
            {
              label: t("dialogs.dialog.toast.openDefaultApps"),
              variant: "accent",
              onClick: () => {
                void invokeOpenDefaultAppsSettings().catch(() => {});
              },
            },
          ],
        });
      } else if (msg.startsWith("NO_DEFAULT_BROWSER")) {
        showToast({
          message: t("dialogs.dialog.toast.noDefaultBrowser"),
          color: "red",
          duration: 5000,
          actions: [
            {
              label: t("dialogs.dialog.toast.openDefaultApps"),
              variant: "accent",
              onClick: () => {
                void invokeOpenDefaultAppsSettings().catch(() => {});
              },
            },
          ],
        });
      } else if (appNotFoundMatch) {
        const appName = appNotFoundMatch[1];
        const installUrl = appNotFoundMatch[2];
        showToast({
          message: t("dialogs.dialog.toast.appNotInstalled", { name: appName }),
          color: "red",
          duration: 5000,
          actions: [
            {
              label: t("dialogs.dialog.toast.install"),
              variant: "accent",
              onClick: () => window.open(installUrl, "_blank"),
            },
          ],
        });
      } else {
        console.error("Share action failed:", e);
        showToast({
          message: t("dialogs.dialog.toast.actionFailed"),
          color: "red",
        });
      }
    }
    closeShare();
  }

  function browserConversionFormat(): "WebP" | "WebM" | null {
    const ext = fileExt().toLowerCase().replace(".", "");
    if (BROWSER_UNSUPPORTED_IMAGE_EXTS.has(ext)) return "WebP";
    if (BROWSER_UNSUPPORTED_VIDEO_EXTS.has(ext)) return "WebM";
    return null;
  }

  async function openInBrowserDirect() {
    await shareAction(
      () => invokeOpenInBrowser(filePath),
      t("dialogs.dialog.share.toast.browser"),
    );
  }

  function requestBrowserOpen() {
    const format = browserConversionFormat();
    if (!format) {
      void openInBrowserDirect();
      return;
    }
    shareConfirmBrowserFormat = format;
    requestShareConfirm("browser");
  }

  function videoDurationSeconds(): number {
    const duration = getMediaEl()?.duration;
    return typeof duration === "number" && Number.isFinite(duration)
      ? duration
      : 0;
  }

  function videoExceedsGifLimit(): boolean {
    return isVideo && videoDurationSeconds() > GIF_MAX_DURATION_SECONDS;
  }

  function dismissShareConfirm() {
    shareConfirm = null;
    pendingGifSave = null;
  }

  function requestShareConfirm(kind: ShareConfirmKind) {
    hideFloatingTooltip("share-dest-tooltip");
    hideFloatingTooltip(SHARE_ACTION_TOOLTIP_ID);
    shareConfirmTime = getMediaEl()?.currentTime ?? 0;
    shareConfirm = kind;
  }

  async function runShareConfirm() {
    const kind = shareConfirm;
    if (!kind) return;
    shareConfirm = null;
    if (kind === "gifLimit") {
      const pending = pendingGifSave;
      pendingGifSave = null;
      if (pending) await pending();
    } else if (kind === "browser") {
      await openInBrowserDirect();
    } else if (kind === "wallpaper") {
      await setShareWallpaper();
    } else if (kind === "lockScreen") {
      await setShareLockScreen();
    } else {
      await shareAction(
        () => invokeCreateDesktopShortcut(filePath),
        t("dialogs.dialog.share.toast.shortcutCreated"),
      );
    }
  }

  async function setShareWallpaper() {
    if (isVideo) {
      await shareAction(async () => {
        const frame = await invokeExtractVideoFrame(filePath, shareConfirmTime);
        await invokeSetWallpaper(frame);
      }, t("dialogs.dialog.toast.wallpaperSet"));
      return;
    }
    if (isPdf) {
      await shareAction(
        () => invokeOpenDefaultApp(filePath),
        t("dialogs.dialog.toast.openedDefault"),
      );
      return;
    }
    await shareAction(
      () => invokeSetWallpaper(filePath),
      t("dialogs.dialog.toast.wallpaperSet"),
    );
  }

  async function setShareLockScreen() {
    if (isVideo) {
      await shareAction(async () => {
        const frame = await invokeExtractVideoFrame(filePath, shareConfirmTime);
        await invokeSetLockScreen(frame);
      }, t("dialogs.dialog.share.toast.lockScreenSet"));
      return;
    }
    await shareAction(
      () => invokeSetLockScreen(filePath),
      t("dialogs.dialog.share.toast.lockScreenSet"),
    );
  }

  async function finalizeSave(
    success: boolean,
    resultPath: string | null,
    revealDir: string,
    modifiedMs: number | null,
  ) {
    if (success) {
      await restoreModifiedTime(resultPath, modifiedMs);
    }
    if (success && conversionPrefs.openOutputFolder) {
      try {
        await invokeOpenDirectory(revealDir);
      } catch {
        // revealing the output is best-effort
      }
    }
    if (
      success &&
      shareDeleteOriginal &&
      resultPath &&
      resultPath !== filePath
    ) {
      try {
        await invokeTrashFile(filePath);
        library.removeRecent(filePath);
      } catch (e) {
        console.error("Failed to delete original:", e);
        showToast({
          message: t("dialogs.dialog.toast.trashFailed"),
          color: "red",
        });
      }
    }
    if (success && conversionPrefs.autoOpenConverted && resultPath) {
      onOpenConverted?.(resultPath);
    }
  }

  async function runSaveAs(opts: {
    outputDir: string;
    revealDir: string;
    format: string;
    outputPath?: string;
    skipGifLimitWarning?: boolean;
  }) {
    const { outputDir, revealDir, format, outputPath, skipGifLimitWarning } =
      opts;
    if (!skipGifLimitWarning && format === "gif" && videoExceedsGifLimit()) {
      pendingGifSave = () => runSaveAs({ ...opts, skipGifLimitWarning: true });
      requestShareConfirm("gifLimit");
      return;
    }
    const modifiedMs = await sourceModifiedMs();
    shareConverting = true;
    let success = false;
    let resultPath: string | null = null;
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
        if (outputPath) {
          await invokeCopyFile(filePath, outputPath);
          resultPath = outputPath;
        } else if (conversionPrefs.overwriteExisting) {
          const destination = joinPath(outputDir, fileName);
          if (destination !== filePath) {
            await invokeCopyFile(filePath, destination);
          }
          resultPath = destination;
        } else {
          resultPath = await invokeCopyFileUnique(filePath, outputDir);
        }
      } else if (isWaveformConvert) {
        resultPath = await invokeConvertAudioToWaveformVideo(
          filePath,
          outputDir,
          outputPath,
          conversionOptions(),
        );
      } else if (isImage && format === "pdf") {
        resultPath = await invokeConvertImageToPdf(
          filePath,
          outputDir,
          outputPath,
          conversionPrefs.overwriteExisting,
        );
      } else {
        resultPath = await invokeConvertMedia(
          filePath,
          outputDir,
          format,
          conversionPreset(),
          outputPath,
          conversionOptions(),
        );
      }
      showToast({
        message: t("dialogs.dialog.toast.savedAs", {
          format: format.toUpperCase(),
        }),
        color: "green",
        duration: 5000,
      });
      success = true;
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "string"
            ? e
            : t("dialogs.dialog.toast.conversionFailed");
      console.error("Save as failed:", e);
      showToast({ message: msg, color: "red" });
    } finally {
      shareConverting = false;
      convertingFormat = undefined;
      convertProgress = 0;
      unlisten?.();
    }
    await finalizeSave(success, resultPath, revealDir, modifiedMs);
    closeShare();
  }

  type PdfSaveFormat = "pdf" | "png" | "jpg" | "webp" | "txt";

  function pdfShareFileName(format: PdfSaveFormat): string {
    const stem = fileName.replace(/\.[^.]+$/, "");
    if (format === "pdf") return `${stem}_copy.pdf`;
    if (format === "txt") return `${stem}.txt`;
    return `${stem}_p${pdfCurrentPage || 1}.${format}`;
  }

  async function handlePdfShareSaveAs(format: PdfSaveFormat) {
    if (pdfSaving) return;
    pdfSaving = true;
    try {
      const outputDir = conversionPrefs.outputDir;
      const outputPath = outputDir
        ? joinPath(outputDir, pdfShareFileName(format))
        : undefined;
      await onPdfSaveAs(format, outputPath);
    } finally {
      pdfSaving = false;
      closeShare();
    }
  }

  async function handlePdfSaveAsOther() {
    if (pdfSaving) return;
    const { save } = await import("@tauri-apps/plugin-dialog");
    const f = (name: string, ext: string) => ({ name, extensions: [ext] });
    const stem = fileName.replace(/\.[^.]+$/, "");
    const defaultDir = conversionOutputDir();
    const outputPath = await save({
      defaultPath: defaultDir
        ? joinPath(defaultDir, `${stem}_export`)
        : `${stem}_export`,
      filters: [
        f("PDF", "pdf"),
        f("PNG", "png"),
        f("JPG", "jpg"),
        f("WebP", "webp"),
        f("TXT", "txt"),
      ],
    });
    if (!outputPath) return;
    const ext = getFileExt(outputPath);
    if (!["pdf", "png", "jpg", "webp", "txt"].includes(ext)) {
      showToast({
        message: t("dialogs.dialog.toast.noFormat"),
        color: "yellow",
      });
      return;
    }
    pdfSaving = true;
    try {
      await onPdfSaveAs(ext as PdfSaveFormat, outputPath);
    } finally {
      pdfSaving = false;
      closeShare();
    }
  }

  async function handleSaveAs(format: string) {
    const outputDir = conversionPrefs.outputDir;
    if (!outputDir) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const stem = fileName.replace(/\.[^.]+$/, "");
      const startDir = parentFolder();
      const defaultPath = startDir
        ? joinPath(startDir, `${stem}.${format}`)
        : `${stem}.${format}`;
      const outputPath = await save({
        defaultPath,
        filters: [{ name: format.toUpperCase(), extensions: [format] }],
      });
      if (!outputPath) return;
      const pickedDir = getParentFolder(outputPath);
      const pickedExt = getFileExt(outputPath);
      if (!pickedExt) {
        showToast({
          message: t("dialogs.dialog.toast.noFormat"),
          color: "yellow",
        });
        return;
      }
      if (!pickedDir) {
        showToast({
          message: t("dialogs.dialog.toast.pickLocation"),
          color: "yellow",
        });
        return;
      }
      await runSaveAs({
        outputDir: pickedDir,
        revealDir: pickedDir,
        format: pickedExt,
        outputPath,
      });
      return;
    }
    await runSaveAs({ outputDir, revealDir: outputDir, format });
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
    const defaultDir = conversionOutputDir() || "";
    const defaultPath = defaultDir ? `${defaultDir}\\${stem}` : stem;

    const outputPath = await save({ defaultPath, filters });
    if (!outputPath) return;

    const outputExt = getFileExt(outputPath);
    if (!outputExt) {
      showToast({
        message: t("dialogs.dialog.toast.noFormat"),
        color: "yellow",
      });
      return;
    }

    const outputDirFromSave = getParentFolder(outputPath);

    await runSaveAs({
      outputDir: outputDirFromSave,
      revealDir: outputDirFromSave,
      format: outputExt,
      outputPath,
    });
  }
</script>

{#snippet queueMenuItem()}
  {#if !isRemote && filePath}
    <button
      class="ctx-item green"
      onclick={toggleQueueCurrent}
      role="menuitem"
      style="animation-delay: 55ms"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
        ><line
          x1="8"
          y1="6"
          x2="21"
          y2="6"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /><line
          x1="8"
          y1="12"
          x2="21"
          y2="12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /><line
          x1="8"
          y1="18"
          x2="16"
          y2="18"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        /><circle cx="4" cy="6" r="1" fill="currentColor" /><circle
          cx="4"
          cy="12"
          r="1"
          fill="currentColor"
        /><circle cx="4" cy="18" r="1" fill="currentColor" /></svg
      >
      {queue.has(filePath)
        ? t("menus.queue.removeCurrent")
        : t("menus.queue.addCurrent")}
    </button>
  {/if}
{/snippet}

{#if contextMenu.visible}
  <div
    class="context-menu"
    class:pinned
    bind:this={contextMenuElement}
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    role="menu"
    transition:fly={{ y: -4, duration: 160, opacity: 0.08 }}
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="0"
      aria-label={t("dialogs.dialog.menu.drag")}
      onmousedown={(e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startY = e.clientY;
        const startMenuX = contextMenu.x;
        const startMenuY = contextMenu.y;
        const menu = contextMenuElement;
        if (!menu) return;
        const maxX = Math.max(0, window.innerWidth - menu.offsetWidth);
        const maxY = Math.max(0, window.innerHeight - menu.offsetHeight);

        function onMouseMove(ev: MouseEvent) {
          contextMenu.x = Math.max(
            0,
            Math.min(startMenuX + ev.clientX - startX, maxX),
          );
          contextMenu.y = Math.max(
            0,
            Math.min(startMenuY + ev.clientY - startY, maxY),
          );
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
        data-tooltip={pinned
          ? t("dialogs.dialog.menu.unpin")
          : t("dialogs.dialog.menu.pin")}
        onclick={(e) => {
          e.stopPropagation();
          pinned = !pinned;
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={pinned
          ? t("dialogs.dialog.menu.unpin")
          : t("dialogs.dialog.menu.pin")}
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
        data-tooltip={t("dialogs.dialog.menu.close")}
        onclick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={t("dialogs.dialog.menu.close")}
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
          onclick={ctxCopyPdfPage}
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
          {t("dialogs.dialog.menu.copyPage")}
        </button>
        {@render queueMenuItem()}

        <div class="ctx-sep"></div>
        <button
          class="ctx-item blue"
          onclick={ctxSearchPdf}
          role="menuitem"
          style="animation-delay: 110ms"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="11"
              cy="11"
              r="8"
              stroke="currentColor"
              stroke-width="2"
            /><line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          {t("dialogs.dialog.menu.search")}
        </button>
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.markup")}
          </button>
        {/if}
        <div class="ctx-sep"></div>
        {#if !isRemote}
          <button
            class="ctx-item yellow"
            onclick={ctxShare}
            role="menuitem"
            style="animation-delay: 165ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><path
                d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="m12 15-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            {t("dialogs.dialog.menu.share")}
          </button>
        {/if}
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.showInExplorer")}
          </button>
        {/if}
        <div class="ctx-sep"></div>
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.delete")}
          </button>
        {/if}
      {:else if isAudio}
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.copyPath")}
          </button>
          {@render queueMenuItem()}
        {/if}
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
          {t("dialogs.dialog.menu.effects")}
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
          {t("dialogs.dialog.menu.equalizer")}
        </button>
        <div class="ctx-sep"></div>
        {#if !isRemote}
          <button
            class="ctx-item yellow"
            onclick={ctxShare}
            role="menuitem"
            style="animation-delay: 165ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><path
                d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="m12 15-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            {t("dialogs.dialog.menu.share")}
          </button>
        {/if}
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.showInExplorer")}
          </button>
        {/if}
        <div class="ctx-sep"></div>
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.delete")}
          </button>
        {/if}
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
          {t("dialogs.dialog.menu.copyImage")}
        </button>
        {@render queueMenuItem()}

        <div class="ctx-sep"></div>
        {#if !isRemote}
          <button
            class="ctx-item blue"
            onclick={ctxEdit}
            role="menuitem"
            style="animation-delay: 110ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><path
                d="m12 3-1.9 5.8a2 2 0 01-1.3 1.3L3 12l5.8 1.9a2 2 0 011.3 1.3L12 21l1.9-5.8a2 2 0 011.3-1.3L21 12l-5.8-1.9a2 2 0 01-1.3-1.3z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="M5 3v4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M3 5h4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M19 17v4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M17 19h4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            {t("dialogs.dialog.menu.edit")}
          </button>
        {/if}
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.markup")}
          </button>
        {/if}
        <div class="ctx-sep"></div>
        {#if !isRemote}
          <button
            class="ctx-item yellow"
            onclick={ctxShare}
            role="menuitem"
            style="animation-delay: 165ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><path
                d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="m12 15-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            {t("dialogs.dialog.menu.share")}
          </button>
        {/if}
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.showInExplorer")}
          </button>
        {/if}
        <div class="ctx-sep"></div>
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.delete")}
          </button>
        {/if}
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
          {t("dialogs.dialog.menu.copyFrame")}
        </button>
        {@render queueMenuItem()}

        <div class="ctx-sep"></div>
        {#if !isRemote}
          <button
            class="ctx-item blue"
            onclick={ctxEdit}
            role="menuitem"
            style="animation-delay: 110ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><path
                d="m12 3-1.9 5.8a2 2 0 01-1.3 1.3L3 12l5.8 1.9a2 2 0 011.3 1.3L12 21l1.9-5.8a2 2 0 011.3-1.3L21 12l-5.8-1.9a2 2 0 01-1.3-1.3z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="M5 3v4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M3 5h4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M19 17v4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M17 19h4"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            {t("dialogs.dialog.menu.edit")}
          </button>
        {/if}
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
          {t("dialogs.dialog.menu.equalizer")}
        </button>
        <div class="ctx-sep"></div>
        {#if !isRemote}
          <button
            class="ctx-item yellow"
            onclick={ctxShare}
            role="menuitem"
            style="animation-delay: 165ms"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              ><path
                d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="m12 15-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /><path
                d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /><path
                d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
            {t("dialogs.dialog.menu.share")}
          </button>
        {/if}
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.showInExplorer")}
          </button>
        {/if}
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
            {deleteMarkersConfirm
              ? t("dialogs.dialog.menu.confirmDelete")
              : t("dialogs.dialog.menu.deleteMarkers")}
          </button>
        {/if}
        {#if !isRemote}
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
            {t("dialogs.dialog.menu.delete")}
          </button>
        {/if}
      {/if}
    </div>
  </div>
{/if}

{#if deleteConfirm}
  <div
    class="delete-overlay"
    out:fade={{ duration: overlayFadeMs }}
    role="presentation"
    onmousedown={closeDeleteConfirm}
  >
    <div
      class="delete-dialog edit-confirm-dialog delete-confirm-dialog"
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
            <p class="delete-title">{t("dialogs.dialog.delete.title")}</p>
            <p class="delete-subtitle">{fileName}</p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={closeDeleteConfirm}
          aria-label={t("dialogs.dialog.delete.cancel")}
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
            >{t("dialogs.dialog.delete.permanent")}</span
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
            >{t("dialogs.dialog.delete.noAsk")}</span
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
            >{t("dialogs.dialog.delete.cancel")}
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
            >{t("dialogs.dialog.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if multiDeleteConfirm}
  <div
    class="delete-overlay"
    out:fade={{ duration: overlayFadeMs }}
    role="presentation"
    onmousedown={closeMultiDeleteConfirm}
  >
    <div
      class="delete-dialog edit-confirm-dialog delete-confirm-dialog"
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
            <p class="delete-title">{t("dialogs.dialog.delete.multiTitle")}</p>
            <p class="delete-subtitle">
              {tp("dialogs.dialog.delete.fileCount", multiDeleteCount)}
            </p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={closeMultiDeleteConfirm}
          aria-label={t("dialogs.dialog.delete.cancel")}
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
            >{t("dialogs.dialog.delete.permanent")}</span
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
            >{t("dialogs.dialog.delete.noAsk")}</span
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
            >{t("dialogs.dialog.delete.cancel")}
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
            >{t("dialogs.dialog.delete.confirm")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if propertiesOpen}
  <div
    class="delete-overlay"
    out:fade={{ duration: overlayFadeMs }}
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeProperties();
    }}
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
          <p class="delete-title">{t("dialogs.dialog.properties.title")}</p>
          <p class="delete-subtitle">{fileName}</p>
        </div>
        <button
          class="dialog-close-x"
          onclick={closeProperties}
          aria-label={t("dialogs.dialog.menu.close")}
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
      <div class="props-list" use:bouncePropRows>
        <div
          class="props-row"
          onclick={() => copyPropValue(fileTypeValue())}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileTypeValue());
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
            {t("dialogs.dialog.properties.type")}
          </span>
          <span class="props-v">{fileTypeValue()}</span>
        </div>
        {#if isPdf}
          <div
            class="props-row"
            onclick={() => {
              if (pdfDocumentInfo) copyPropValue(pdfDocumentInfo);
            }}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (pdfDocumentInfo) copyPropValue(pdfDocumentInfo);
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
                ><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path
                  d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
                /></svg
              >
              {t("dialogs.dialog.properties.document")}
            </span>
            <span class="props-v">{pdfDocumentInfo || "—"}</span>
          </div>
          <div
            class="props-row"
            onclick={() => copyPropValue(String(pdfPageCount))}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(String(pdfPageCount));
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
                ><path d="M4 4h16v16H4z" /><polyline
                  points="4 4 12 12 20 4"
                /></svg
              >
              {t("dialogs.dialog.properties.pages")}
            </span>
            <span class="props-v">{pdfPageCount}</span>
          </div>
          {#if pdfPageSize}
            <div
              class="props-row"
              onclick={() => copyPropValue(pdfPageSize)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  copyPropValue(pdfPageSize);
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
                {t("dialogs.dialog.properties.pageSize")}
              </span>
              <span class="props-v">{pdfPageSize}</span>
            </div>
          {/if}
          {#if pdfVersion}
            <div
              class="props-row"
              onclick={() => copyPropValue(pdfVersion)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  copyPropValue(pdfVersion);
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
                  ><circle cx="12" cy="12" r="9" /><path
                    d="M12 10.5V16"
                    stroke-linecap="round"
                  /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
                >
                > {t("dialogs.dialog.properties.version")}
              </span>
              <span class="props-v">{pdfVersion}</span>
            </div>
          {/if}
        {:else}
          <div
            class="props-row"
            onclick={() => copyPropValue(fileDimensions || unknownValue())}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(fileDimensions || unknownValue());
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
              {t("dialogs.dialog.properties.dimensions")}
            </span>
            <span class="props-v">{fileDimensions || unknownValue()}</span>
          </div>
        {/if}
        <div
          class="props-row"
          onclick={() => copyPropValue(fileSize || unknownValue())}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileSize || unknownValue());
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
            {t("dialogs.dialog.properties.size")}
          </span>
          <span class="props-v">{fileSize || unknownValue()}</span>
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
              {t("dialogs.dialog.properties.duration")}
            </span>
            <span class="props-v">{durationDisplay}</span>
          </div>
        {/if}
        {#if !isPdf}
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? t("dialogs.dialog.properties.loading")
                  : showValue(mediaProps?.container),
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? t("dialogs.dialog.properties.loading")
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
              {t("dialogs.dialog.properties.container")}
            </span>
            <span class="props-v"
              >{mediaPropsLoading
                ? t("dialogs.dialog.properties.loading")
                : showValue(mediaProps?.container)}</span
            >
          </div>
        {/if}
        {#if !isPdf}
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? t("dialogs.dialog.properties.loading")
                  : codecValue(),
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? t("dialogs.dialog.properties.loading")
                    : codecValue(),
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
              {t("dialogs.dialog.properties.codec")}
            </span>
            <span class="props-v">
              {mediaPropsLoading
                ? t("dialogs.dialog.properties.loading")
                : codecValue()}
            </span>
          </div>
        {/if}
        {#if !isPdf}
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? t("dialogs.dialog.properties.loading")
                  : colorValue(),
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? t("dialogs.dialog.properties.loading")
                    : colorValue(),
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
              {t("dialogs.dialog.properties.color")}
            </span>
            <span class="props-v">
              {mediaPropsLoading
                ? t("dialogs.dialog.properties.loading")
                : colorValue()}
            </span>
          </div>
        {/if}
        {#if isVideo}
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? t("dialogs.dialog.properties.loading")
                  : showValue(mediaProps?.frame_rate),
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? t("dialogs.dialog.properties.loading")
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
              {t("dialogs.dialog.properties.frameRate")}
            </span>
            <span class="props-v"
              >{mediaPropsLoading
                ? t("dialogs.dialog.properties.loading")
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
                : fileCreated || unknownValue(),
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                library.privacyMode
                  ? "••••••••••••••••••"
                  : fileCreated || unknownValue(),
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
            {t("dialogs.dialog.properties.created")}
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? "••••••••••••••••••"
              : fileCreated || unknownValue()}</span
          >
        </div>
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              library.privacyMode
                ? "••••••••••••••••••"
                : fileModified || unknownValue(),
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                library.privacyMode
                  ? "••••••••••••••••••"
                  : fileModified || unknownValue(),
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
            {t("dialogs.dialog.properties.modified")}
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? "••••••••••••••••••"
              : fileModified || unknownValue()}</span
          >
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(parentFolder() || unknownValue())}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(parentFolder() || unknownValue());
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
            {t("dialogs.dialog.properties.folder")}
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? obscurePath(parentFolder() || unknownValue())
              : parentFolder() || unknownValue()}</span
          >
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(filePath || unknownValue())}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(filePath || unknownValue());
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
            {t("dialogs.dialog.properties.filePath")}
          </span>
          <span class="props-v"
            >{library.privacyMode
              ? obscurePath(filePath || unknownValue())
              : filePath || unknownValue()}</span
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
            {t("dialogs.dialog.properties.openFolder")}
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
            {t("dialogs.dialog.properties.copyFilePath")}
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
            {t("dialogs.dialog.properties.copyProperties")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

{#if shareOpen}
  <div
    class="delete-overlay"
    out:fade={{ duration: overlayFadeMs }}
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeShare();
    }}
  >
    <div
      class="delete-dialog share-dialog"
      role="dialog"
      aria-modal="true"
      use:shareTipDelegation
    >
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
          <path
            d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"
          />
          <path
            d="m12 15-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"
          />
          <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
          <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
        </svg>
        <div>
          <p class="delete-title">{t("dialogs.dialog.share.title")}</p>
          <p class="delete-subtitle">{fileName}</p>
        </div>
        <button
          class="dialog-close-x"
          onclick={closeShare}
          aria-label={t("dialogs.dialog.share.close")}
          data-share-tip={t("dialogs.dialog.share.tooltip.close")}
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
            {t("dialogs.dialog.share.sendTo")}
          </p>
          <div class="share-grid share-grid-4">
            {#if isVideo || isAudio}
              <button
                class="share-btn"
                data-share-tip={t("dialogs.dialog.share.tooltip.cast")}
                onclick={() => {}}
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
                {t("dialogs.dialog.share.cast")}
              </button>
            {:else}
              <button
                class="share-btn"
                data-share-tip={t("dialogs.dialog.share.tooltip.printer")}
                onclick={() => {
                  if (isPdf) {
                    window.dispatchEvent(new Event("vyu-print-pdf"));
                    closeShare();
                    return;
                  }
                  shareAction(
                    () => invokePrintFile(filePath),
                    t("dialogs.dialog.toast.printOpened"),
                  );
                }}
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
                {t("dialogs.dialog.share.printer")}
              </button>
            {/if}
            <button
              class="share-btn"
              data-share-tip={t("dialogs.dialog.share.tooltip.device")}
              onclick={handleShareFile}
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
              {t("dialogs.dialog.share.device")}
            </button>
            {#if isAudio}
              <button
                class="share-btn"
                data-share-tip={t("dialogs.dialog.share.tooltip.bluetooth")}
                onclick={() =>
                  shareAction(
                    () => invokeSendBluetooth(filePath),
                    t("dialogs.dialog.share.toast.bluetoothOpened"),
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
                {t("dialogs.dialog.share.bluetooth")}
              </button>
            {:else}
              <button
                class="share-btn"
                data-share-tip={t("dialogs.dialog.share.tooltip.wallpaper")}
                onclick={() => requestShareConfirm("wallpaper")}
              >
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
                {t("dialogs.dialog.share.wallpaper")}
              </button>
            {/if}
            {#if isAudio}
              <button
                class="share-btn"
                data-share-tip={t("dialogs.dialog.share.tooltip.shazam")}
                onclick={handleShazam}
              >
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
                data-share-tip={t("dialogs.dialog.share.tooltip.lockScreen")}
                onclick={() => requestShareConfirm("lockScreen")}
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
                {t("dialogs.dialog.share.lockScreen")}
              </button>
            {/if}
            <button
              class="share-btn"
              data-share-tip={t("dialogs.dialog.share.tooltip.desktop")}
              onclick={() => requestShareConfirm("desktop")}
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
              {t("dialogs.dialog.share.desktop")}
            </button>
          </div>
        </div>

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
            {t("dialogs.dialog.share.openWith")}
          </p>
          <div class="share-grid share-grid-4">
            <button
              class="share-btn-circle"
              data-share-tip={t("dialogs.dialog.share.tooltip.openDefault")}
              onclick={() =>
                shareAction(
                  () => openInDefaultApp(),
                  t("dialogs.dialog.toast.openedDefault"),
                )}
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
              {t("dialogs.dialog.share.defaultApp")}
            </button>
            {#if isAudio}
              <button
                class="share-btn-circle"
                data-share-tip={t("dialogs.dialog.share.tooltip.openApp", {
                  app: "Spotify",
                })}
                onclick={() =>
                  shareAction(
                    () =>
                      invokeOpenInSpotify(
                        filePath,
                        systemPrefs.externalApps.spotify || undefined,
                      ),
                    t("dialogs.dialog.share.toast.spotifyLocal"),
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
                data-share-tip={t("dialogs.dialog.share.tooltip.openApp", {
                  app: t("dialogs.dialog.share.photos"),
                })}
                onclick={() =>
                  shareAction(
                    () => invokeOpenInPhotos(filePath),
                    t("dialogs.dialog.share.toast.photos"),
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
                {t("dialogs.dialog.share.photos")}
              </button>
            {/if}
            {#if !isVideo && !isAudio}
              <button
                class="share-btn-circle"
                data-share-tip={t("dialogs.dialog.share.tooltip.openApp", {
                  app: t("dialogs.dialog.share.paint"),
                })}
                onclick={() =>
                  shareAction(
                    () =>
                      invokeOpenInPaint(
                        filePath,
                        systemPrefs.externalApps.paint || undefined,
                      ),
                    t("dialogs.dialog.share.toast.paint"),
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
                {t("dialogs.dialog.share.paint")}
              </button>
            {:else}
              <button
                class="share-btn-circle"
                data-share-tip={t("dialogs.dialog.share.tooltip.openApp", {
                  app: "VLC",
                })}
                onclick={() =>
                  shareAction(
                    () =>
                      invokeOpenInVlc(
                        filePath,
                        systemPrefs.externalApps.vlc || undefined,
                      ),
                    t("dialogs.dialog.share.toast.vlc"),
                  )}
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
              data-share-tip={t("dialogs.dialog.share.tooltip.openApp", {
                app: t("dialogs.dialog.share.browser"),
              })}
              onclick={requestBrowserOpen}
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
              {t("dialogs.dialog.share.browser")}
            </button>
            <button
              class="share-btn-circle"
              data-share-tip={t("dialogs.dialog.share.tooltip.chooseApp")}
              onclick={() =>
                shareAction(
                  () => invokeOpenWithDialog(filePath),
                  t("dialogs.dialog.share.toast.openWithShown"),
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
              {t("dialogs.dialog.share.other")}
            </button>
          </div>
        </div>

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
            {t("dialogs.dialog.share.saveAs")}
          </p>
          {#if isPdf}
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("PDF")}
                onclick={() => handlePdfShareSaveAs("pdf")}
                disabled={pdfSaving}>PDF</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("PNG")}
                onclick={() => handlePdfShareSaveAs("png")}
                disabled={pdfSaving}>PNG</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("TXT")}
                onclick={() => handlePdfShareSaveAs("txt")}
                disabled={pdfSaving}>TXT</button
              >
            </div>
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("JPG")}
                onclick={() => handlePdfShareSaveAs("jpg")}
                disabled={pdfSaving}>JPG</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("WebP")}
                onclick={() => handlePdfShareSaveAs("webp")}
                disabled={pdfSaving}>WebP</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={t("dialogs.dialog.share.tooltip.chooseFormat")}
                onclick={handlePdfSaveAsOther}
                disabled={pdfSaving}
                >{t("dialogs.dialog.share.otherFormat")}</button
              >
            </div>
          {:else if isVideo}
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("MP4")}
                onclick={() => handleSaveAs("mp4")}
                disabled={shareConverting}>MP4</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("MKV")}
                onclick={() => handleSaveAs("mkv")}
                disabled={shareConverting}>MKV</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("WebM")}
                onclick={() => handleSaveAs("webm")}
                disabled={shareConverting}>WebM</button
              >
            </div>
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("MP3")}
                onclick={() => handleSaveAs("mp3")}
                disabled={shareConverting}>MP3</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("GIF")}
                onclick={() => handleSaveAs("gif")}
                disabled={shareConverting}>GIF</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={t("dialogs.dialog.share.tooltip.chooseFormat")}
                onclick={handleSaveAsOther}
                disabled={shareConverting}
                >{t("dialogs.dialog.share.otherFormat")}</button
              >
            </div>
          {:else if isAudio}
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("MP3")}
                onclick={() => handleSaveAs("mp3")}
                disabled={shareConverting}>MP3</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("WAV")}
                onclick={() => handleSaveAs("wav")}
                disabled={shareConverting}>WAV</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("FLAC")}
                onclick={() => handleSaveAs("flac")}
                disabled={shareConverting}>FLAC</button
              >
            </div>
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                class:converting={convertingFormat === "mp4"}
                style:--progress="{convertProgress}%"
                data-share-tip={saveAsTip("MP4")}
                onclick={() => handleSaveAs("mp4")}
                disabled={shareConverting && convertingFormat !== "mp4"}
                >MP4</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("Opus")}
                onclick={() => handleSaveAs("opus")}
                disabled={shareConverting}>Opus</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={t("dialogs.dialog.share.tooltip.chooseFormat")}
                onclick={handleSaveAsOther}
                disabled={shareConverting}
                >{t("dialogs.dialog.share.otherFormat")}</button
              >
            </div>
          {:else}
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("JPG")}
                onclick={() => handleSaveAs("jpg")}
                disabled={shareConverting}>JPG</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("PNG")}
                onclick={() => handleSaveAs("png")}
                disabled={shareConverting}>PNG</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("WebP")}
                onclick={() => handleSaveAs("webp")}
                disabled={shareConverting}>WebP</button
              >
            </div>
            <div class="share-grid share-grid-3">
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("PSD")}
                onclick={() => handleSaveAs("psd")}
                disabled={shareConverting}>PSD</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={saveAsTip("PDF")}
                onclick={() => handleSaveAs("pdf")}
                disabled={shareConverting}>PDF</button
              >
              <button
                class="share-btn-wide"
                data-share-tip={t("dialogs.dialog.share.tooltip.chooseFormat")}
                onclick={handleSaveAsOther}
                disabled={shareConverting}
                >{t("dialogs.dialog.share.otherFormat")}</button
              >
            </div>
          {/if}
        </div>
      </div>

      <div class="share-dest-bar">
        <button
          class="share-dest-btn"
          class:is-set={!!conversionPrefs.outputDir}
          aria-label={conversionPrefs.outputDir ||
            t("dialogs.dialog.share.outputFolder")}
          onclick={pickShareOutputDir}
          onmouseenter={(e) => {
            const path = conversionPrefs.outputDir;
            hideFloatingTooltip(SHARE_ACTION_TOOLTIP_ID);
            showFloatingTooltip(
              "share-dest-tooltip",
              e.currentTarget.getBoundingClientRect(),
              path
                ? t("dialogs.dialog.share.tooltip.savedTo", { path })
                : t("dialogs.dialog.share.tooltip.outputFolder"),
              "above",
            );
          }}
          onmouseleave={() => hideFloatingTooltip("share-dest-tooltip")}
          oncontextmenu={(e) => {
            e.preventDefault();
            hideFloatingTooltip("share-dest-tooltip");
            if (conversionPrefs.outputDir) conversionPrefs.setOutputDir("");
          }}
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
            ><path
              d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
            /><polyline points="17 21 17 13 7 13 7 21" /><polyline
              points="7 3 7 8 15 8"
            /></svg
          >
          <span class="share-dest-name">
            {conversionPrefs.outputDir
              ? shortFolderPath(conversionPrefs.outputDir)
              : t("dialogs.dialog.share.outputFolder")}
          </span>
        </button>
        <span
          class="share-dest-clear-slot"
          class:is-open={!!conversionPrefs.outputDir}
        >
          <button
            class="share-dest-btn share-dest-clear"
            data-share-tip={t("dialogs.dialog.share.clearOutputFolder")}
            aria-label={t("dialogs.dialog.share.clearOutputFolder")}
            tabindex={conversionPrefs.outputDir ? 0 : -1}
            onclick={() => {
              hideFloatingTooltip("share-dest-tooltip");
              hideFloatingTooltip(SHARE_ACTION_TOOLTIP_ID);
              conversionPrefs.setOutputDir("");
            }}
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
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </span>
        {#if !isPdf}
          <button
            class="share-delete-toggle"
            class:is-on={shareDeleteOriginal}
            data-share-tip={t("dialogs.dialog.share.moveOriginalToTrash")}
            aria-label={t("dialogs.dialog.share.moveOriginalToTrash")}
            onclick={() =>
              conversionPrefs.setDeleteOriginal(
                !conversionPrefs.deleteOriginal,
              )}
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
        {/if}
      </div>
    </div>
  </div>
  <div
    id="share-dest-tooltip"
    class="filename-tooltip share-dest-path-tooltip"
    style="position: fixed; opacity: 0; left: 0; top: 0; pointer-events: none; z-index: 9999"
  ></div>
  <div
    id="share-action-tooltip"
    class="filename-tooltip share-action-tooltip"
    style="position: fixed; opacity: 0; left: 0; top: 0; pointer-events: none; z-index: 9999"
  ></div>
  {#if shareConfirm}
    <div
      class="delete-overlay share-confirm-overlay"
      out:fade={{ duration: overlayFadeMs }}
      role="presentation"
      onmousedown={(e) => {
        if (e.target === e.currentTarget) dismissShareConfirm();
      }}
    >
      <div
        class="delete-dialog edit-confirm-dialog share-confirm-dialog"
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
              style="color: var(--yellow)"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 10.5V16" />
              <circle cx="12" cy="7.5" r="1" fill="currentColor" />
            </svg>
            <div>
              <p class="delete-title">{shareConfirmTitle}</p>
              <p class="delete-subtitle">{fileName}</p>
            </div>
          </div>
          <button
            class="edit-confirm-header-close"
            onclick={dismissShareConfirm}
            aria-label={t("common.close")}
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
        <div class="edit-confirm-body-box">{shareConfirmBody}</div>
        <div class="edit-confirm-actions edit-confirm-actions-horizontal">
          <button class="delete-cancel" onclick={dismissShareConfirm}
            >{t("common.cancel")}</button
          >
          <button class="edit-confirm-btn-primary" onclick={runShareConfirm}
            >{t("common.confirm")}</button
          >
        </div>
      </div>
    </div>
  {/if}
{/if}
