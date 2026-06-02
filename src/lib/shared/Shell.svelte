<script lang="ts">
  import AppMenu from "$lib/features/menus/AppMenu.svelte";
  import MediaBar from "$lib/features/media/MediaBar.svelte";
  import ThumbnailBar from "$lib/features/navigation/ThumbnailBar.svelte";
  import Dialog from "$lib/features/dialogs/Dialog.svelte";
  import Tooltip from "$lib/shared/Tooltip.svelte";
  import EditMenu from "$lib/features/menus/EditMenu.svelte";
  import ProcessMenu from "$lib/features/menus/ProcessMenu.svelte";
  import SettingsDialog from "$lib/features/dialogs/SettingsDialog.svelte";
  import AccessibilityDialog from "$lib/features/dialogs/AccessibilityDialog.svelte";
  import HelpDialog from "$lib/features/dialogs/HelpDialog.svelte";
  import AboutDialog from "$lib/features/dialogs/AboutDialog.svelte";
  import FeedbackDialog from "$lib/features/dialogs/FeedbackDialog.svelte";
  import type { ContextMenu } from "$lib/shared/types";

  let {
    children,
    fileName,
    fileSrc,
    filePath,
    fileList,
    currentIndex,
    isVideo,
    isAudio,
    isPdf,
    fileDimensions,
    fileSize,
    fileInfoLoading,
    isLoadingFile,
    loadingFadingOut,
    anyMenuOpen,
    viewerStateIsFullscreen,
    viewerFsControlsVisible,
    viewerResetFsTimer,
    viewerToggleFullscreen,
    thumbnailBarVisible,
    zoomLevel,
    zoomLocked,
    resetZoom,
    toggleZoomLock,
    clipCount,
    clipMenuResetKey,
    triggerClipSegments,
    clipJobRunning,
    clipDeleteOriginal,
    clipUseCustomPath,
    clipMergeSegments,
    getClipTargetDir,
    toggleClipDeleteOriginal,
    toggleClipPathSelection,
    toggleClipMergeSegments,
    clipJobLabel,
    toggleSlideshowMenu,
    slideshowMenuVisible,
    closeSlideshowMenu,
    toggleThumbnailBar,
    sortMode,
    sortDesc,
    sortMenuVisible,
    toggleSortMenu,
    closeSortMenu,
    onSortChange,
    navigate,
    onRenamed,
    startDrag,
    showFilenameTooltip,
    hideFilenameTooltip,
    closeFile,
    openFileDialog,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    appDropdownVisible,
    toggleAppDropdown,
    closeAppDropdown,
    openSettings,
    openAccessibility,
    openHelp,
    openAbout,
    openFeedback,
    settingsOpen,
    closeSettings,
    accessibilityOpen,
    closeAccessibility,
    helpOpen,
    closeHelp,
    aboutOpen,
    closeAbout,
    feedbackOpen,
    closeFeedback,
    contextMenu,
    onOpenContextMenu,
    editMenuVisible,
    onApply,
    onExport,
    onUndo,
    onReset,
    closeEditMenu,
    processMenuVisible,
    closeProcessMenu,
    ffprobeChecked,
    ffprobeAvailable,
    ffmpegInstalling,
    ffmpegInstallError,
    installFfmpegAndWait,
    refreshFfprobeAvailability,
    openConvertedFile,
    showInExplorer,
    onSelect,
    onOpenExportedFile,
    onSaveClipboardFile,
    onDismissClipboardToast,
    onCloseClipDeleteConfirm,
    onCloseDeleteConfirm,
    onCloseProperties,
    onCloseShare,
    onUpdateDeleteNoAsk,
    onUpdateDeletePermanently,
    onCloseContextMenu,
    tsTooltip,
    tsEditMenuVisible,
    tsEditMenu,
    editingTimestamp,
    editingSegment,
    currentTitle,
    getTitleEditorWidthCh,
    updateEditorTitle,
    closeTimestampEditor,
    onEditorScissor,
    onEditorDeleteTimestamp,
    onEditorDeleteSegment,
    volumeTooltipVisible,
    volumeTooltipX,
    volumeTooltipY,
    speedTooltipVisible,
    speedTooltipX,
    speedTooltipY,
    playbackSpeed,
    muted,
    volume,
    timestamps,
    clipBoundaries,
    resumePoint,
    frameCopyToast,
    imageCopyToast,
    clipToast,
    exportToast,
    clipboardToast,
    clipOutputDir,
    parentFolder,
    invokeOpenDirectory,
    ctxCopyImage,
    ctxCopyFrame,
    ctxCopyPath,
    ctxRotate,
    ctxFlip,
    ctxEdit,
    ctxProcess,
    ctxShowInExplorer,
    ctxProperties,
    ctxShare,
    ctxDelete,
    ctxClearMarkers,
    clipDeleteConfirm,
    deleteConfirm,
    deleteNoAsk,
    deletePermanently,
    propertiesOpen,
    shareOpen,
    fileExt,
    fileCreated,
    fileModified,
    durationDisplay,
    audioBitrateDisplay,
    mediaPropsLoading,
    mediaProps,
    loadMediaProperties,
    showValue,
    propsCopyPath,
    propsOpenFolder,
    propsCopyAll,
    copyPropValue,
    performDelete,
    runClipAction,
    corruptionWarning,
    corruptionReason,
    corruptionFixing,
    corruptionFixError,
    dismissCorruption,
    fixCopy,
    fixReplace,
  }: {
    children: import("svelte").Snippet;
    fileName: string;
    fileSrc: string;
    filePath: string;
    fileList: string[];
    currentIndex: number;
    isVideo: boolean;
    isAudio: boolean;
    isPdf: boolean;
    fileDimensions: string;
    fileSize: string;
    fileInfoLoading: boolean;
    isLoadingFile: boolean;
    loadingFadingOut: boolean;
    anyMenuOpen: boolean;
    viewerStateIsFullscreen: boolean;
    viewerFsControlsVisible: boolean;
    viewerResetFsTimer: () => void;
    viewerToggleFullscreen: () => void;
    thumbnailBarVisible: boolean;
    zoomLevel: number;
    zoomLocked: boolean;
    resetZoom: () => void;
    toggleZoomLock: () => void;
    clipCount: number;
    clipMenuResetKey: number;
    triggerClipSegments: () => void;
    clipJobRunning: boolean;
    clipDeleteOriginal: boolean;
    clipUseCustomPath: boolean;
    clipMergeSegments: boolean;
    getClipTargetDir: () => string;
    toggleClipDeleteOriginal: () => void;
    toggleClipPathSelection: () => void;
    toggleClipMergeSegments: () => void;
    clipJobLabel: string;
    toggleSlideshowMenu: () => void;
    slideshowMenuVisible: boolean;
    closeSlideshowMenu: () => void;
    toggleThumbnailBar: () => void;
    sortMode: "name" | "date-modified" | "date-created" | "size" | "type";
    sortDesc: boolean;
    sortMenuVisible: boolean;
    toggleSortMenu: () => void;
    closeSortMenu: () => void;
    onSortChange: (
      mode: "name" | "date-modified" | "date-created" | "size" | "type",
      desc: boolean,
    ) => void;
    onRenamed: any;
    navigate: (dir: number) => void;
    startDrag: (e: MouseEvent) => void;
    showFilenameTooltip: (e: MouseEvent) => void;
    hideFilenameTooltip: () => void;
    closeFile: () => void;
    openFileDialog: () => void;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    appDropdownVisible: boolean;
    toggleAppDropdown: () => void;
    closeAppDropdown: () => void;
    openSettings: () => void;
    openAccessibility: () => void;
    openHelp: () => void;
    openAbout: () => void;
    openFeedback: () => void;
    settingsOpen: boolean;
    closeSettings: () => void;
    accessibilityOpen: boolean;
    closeAccessibility: () => void;
    helpOpen: boolean;
    closeHelp: () => void;
    aboutOpen: boolean;
    closeAbout: () => void;
    feedbackOpen: boolean;
    closeFeedback: () => void;
    contextMenu: ContextMenu;
    onOpenContextMenu: (e: MouseEvent) => void;
    editMenuVisible: boolean;
    onApply: () => void;
    onExport: () => void;
    onUndo: () => void;
    onReset: () => void;
    closeEditMenu: () => void;
    processMenuVisible: boolean;
    closeProcessMenu: () => void;
    ffprobeChecked: boolean;
    ffprobeAvailable: boolean;
    ffmpegInstalling: boolean;
    ffmpegInstallError: string;
    installFfmpegAndWait: any;
    refreshFfprobeAvailability: any;
    openConvertedFile: (path: string) => Promise<void>;
    showInExplorer: (path: string) => Promise<void>;
    onSelect: (index: number) => void;
    onOpenExportedFile: () => void;
    onSaveClipboardFile: () => void;
    onDismissClipboardToast: () => void;
    onCloseClipDeleteConfirm: () => void;
    onCloseDeleteConfirm: () => void;
    onCloseProperties: () => void;
    onCloseShare: () => void;
    onUpdateDeleteNoAsk: (v: boolean) => void;
    onUpdateDeletePermanently: (v: boolean) => void;
    onCloseContextMenu: () => void;
    tsTooltip: any;
    tsEditMenuVisible: boolean;
    tsEditMenu: any;
    editingTimestamp: any;
    editingSegment: any;
    currentTitle: string;
    getTitleEditorWidthCh: (title: string) => number;
    updateEditorTitle: (v: string) => void;
    closeTimestampEditor: () => void;
    onEditorScissor: (kind: "start" | "end") => void;
    onEditorDeleteTimestamp: () => void;
    onEditorDeleteSegment: () => void;
    volumeTooltipVisible: boolean;
    volumeTooltipX: number;
    volumeTooltipY: number;
    speedTooltipVisible: boolean;
    speedTooltipX: number;
    speedTooltipY: number;
    playbackSpeed: number;
    muted: boolean;
    volume: number;
    timestamps: any[];
    clipBoundaries: any[];
    resumePoint: number | null;
    frameCopyToast: any;
    imageCopyToast: any;
    clipToast: any;
    exportToast: any;
    clipboardToast: any;
    clipOutputDir: string;
    parentFolder: () => string;
    invokeOpenDirectory: (path: string) => Promise<void>;
    ctxCopyImage: () => void;
    ctxCopyFrame: () => void;
    ctxCopyPath: () => void;
    ctxRotate: () => void;
    ctxFlip: () => void;
    ctxEdit: () => void;
    ctxProcess: () => void;
    ctxShowInExplorer: () => void;
    ctxProperties: () => void;
    ctxShare: () => void;
    ctxDelete: () => void;
    ctxClearMarkers: () => void;
    clipDeleteConfirm: any;
    deleteConfirm: boolean;
    deleteNoAsk: boolean;
    deletePermanently: boolean;
    propertiesOpen: boolean;
    shareOpen: boolean;
    fileExt: () => string;
    fileCreated: string;
    fileModified: string;
    durationDisplay: string;
    audioBitrateDisplay: string;
    mediaPropsLoading: boolean;
    mediaProps: any;
    loadMediaProperties: any;
    showValue: (v: string | undefined) => string;
    propsCopyPath: () => void;
    propsOpenFolder: () => void;
    propsCopyAll: () => void;
    copyPropValue: (v: string) => void;
    performDelete: () => void;
    runClipAction: (mode: "separate" | "merge") => void;
    corruptionWarning: boolean;
    corruptionReason: string;
    corruptionFixing: boolean;
    corruptionFixError: string;
    dismissCorruption: () => void;
    fixCopy: () => void;
    fixReplace: () => void;
  } = $props();

  let editMenuMoved = $state(false);
  let processMenuMoved = $state(false);
  let clipMenuMoved = $state(false);
  let clipMenuDismissed = $state(false);

  $effect(() => {
    if (!editMenuVisible) editMenuMoved = false;
  });

  $effect(() => {
    if (!processMenuVisible) processMenuMoved = false;
  });

  $effect(() => {
    if (clipCount === 0) {
      clipMenuMoved = false;
    }
    clipMenuDismissed = false;
  });

  // Reset clip menu state when a clip marker is dragged
  $effect(() => {
    if (clipMenuResetKey > 0) {
      clipMenuDismissed = false;
      clipMenuMoved = false;
    }
  });

  const MENU_WIDTH = $derived(Math.min(398, window.innerWidth - 30));
  const GAP = 8;

  const clipMenuActive = $derived(clipCount > 0 && !clipMenuDismissed);

  const layoutOffsets = $derived.by(() => {
    const editOpen = editMenuVisible && !editMenuMoved;
    const processOpen = processMenuVisible && !processMenuMoved;
    const clipOpen = clipMenuActive && !clipMenuMoved;

    // Edit/process affect each other
    let editOffset = 0;
    let processOffset = 0;

    if (editOpen && processOpen) {
      const halfGap = (MENU_WIDTH + GAP) / 2;
      editOffset = -halfGap;
      processOffset = halfGap;
    }

    // Clip shifts based on edit/process presence
    let clipOffset = 0;
    if (clipOpen) {
      const editOnly = editOpen && !processOpen;
      const processOnly = !editOpen && processOpen;
      const bothOpen = editOpen && processOpen;

      if (editOnly) {
        // edit left, clip right — gap centered
        const halfGap = (MENU_WIDTH + GAP) / 2;
        editOffset = -halfGap;
        clipOffset = halfGap;
      } else if (processOnly) {
        // clip left, process right — gap centered
        const halfGap = (MENU_WIDTH + GAP) / 2;
        clipOffset = -halfGap;
        processOffset = halfGap;
      } else if (bothOpen) {
        // edit left, clip center, process right
        const fullGap = MENU_WIDTH + GAP;
        editOffset = -fullGap;
        clipOffset = 0;
        processOffset = fullGap;
      }
    }

    return { edit: editOffset, clip: clipOffset, process: processOffset };
  });

  const editMenuStyle = $derived.by(() => {
    if (editMenuVisible && !editMenuMoved && layoutOffsets.edit !== 0) {
      return `left: calc(50% + ${layoutOffsets.edit}px);`;
    }
    return "";
  });

  const processMenuStyle = $derived.by(() => {
    if (
      processMenuVisible &&
      !processMenuMoved &&
      layoutOffsets.process !== 0
    ) {
      return `left: calc(50% + ${layoutOffsets.process}px);`;
    }
    return "";
  });

  const clipMenuStyle = $derived.by(() => {
    if (clipMenuActive && !clipMenuMoved && layoutOffsets.clip !== 0) {
      return `left: calc(50% + ${layoutOffsets.clip}px);`;
    }
    return "";
  });
</script>

<main
  class:fullscreen={viewerStateIsFullscreen}
  class:menu-open={anyMenuOpen}
  class:thumbnail-bar-open={thumbnailBarVisible}
  class:is-audio={isAudio}
  class:fs-controls-hidden={viewerStateIsFullscreen &&
    thumbnailBarVisible &&
    !viewerFsControlsVisible}
  onmousemove={viewerStateIsFullscreen ? viewerResetFsTimer : undefined}
  ondrop={(e) => e.preventDefault()}
  ondragover={(e) => e.preventDefault()}
  oncontextmenu={onOpenContextMenu}
>
  <AppMenu
    {fileName}
    {fileSrc}
    {filePath}
    {onRenamed}
    {startDrag}
    {showFilenameTooltip}
    {hideFilenameTooltip}
    {closeFile}
    {openFileDialog}
    {minimizeWindow}
    {maximizeWindow}
    {closeWindow}
    dropdownVisible={appDropdownVisible}
    onToggleDropdown={toggleAppDropdown}
    onCloseDropdown={closeAppDropdown}
    onOpenSettings={openSettings}
    onOpenAccessibility={openAccessibility}
    onOpenHelp={openHelp}
    onOpenAbout={openAbout}
    onOpenFeedback={openFeedback}
  />

  {@render children?.()}

  <MediaBar
    fileListLength={fileList.length}
    {currentIndex}
    {fileDimensions}
    {fileSize}
    {fileInfoLoading}
    {fileName}
    {fileSrc}
    {zoomLevel}
    {zoomLocked}
    {resetZoom}
    {toggleZoomLock}
    toggleFullscreen={viewerToggleFullscreen}
    {isVideo}
    {isAudio}
    {isPdf}
    {durationDisplay}
    {audioBitrateDisplay}
    {clipCount}
    {triggerClipSegments}
    {clipJobRunning}
    {clipDeleteOriginal}
    {clipUseCustomPath}
    {clipMergeSegments}
    {getClipTargetDir}
    {toggleClipDeleteOriginal}
    {toggleClipPathSelection}
    {toggleClipMergeSegments}
    {clipJobLabel}
    {toggleSlideshowMenu}
    {slideshowMenuVisible}
    {closeSlideshowMenu}
    {thumbnailBarVisible}
    {toggleThumbnailBar}
    {sortMode}
    {sortDesc}
    {sortMenuVisible}
    {toggleSortMenu}
    {closeSortMenu}
    {onSortChange}
    {editMenuVisible}
    {processMenuVisible}
    {editMenuMoved}
    {processMenuMoved}
    {clipMenuMoved}
    {clipMenuResetKey}
    onClipMenuMoved={() => (clipMenuMoved = true)}
    onClipMenuDismissed={() => (clipMenuDismissed = true)}
    clipMenuDismissed
    editMenuStyleOverride={editMenuStyle}
    processMenuStyleOverride={processMenuStyle}
    clipMenuStyleOverride={clipMenuStyle}
    fullscreen={viewerStateIsFullscreen}
  />

  <ThumbnailBar
    {fileList}
    {currentIndex}
    visible={thumbnailBarVisible}
    {onSelect}
    fullscreen={viewerStateIsFullscreen}
  />

  {#if isLoadingFile}
    <div class="border-sweep" class:fading={loadingFadingOut}></div>
  {/if}

  <Dialog
    {contextMenu}
    {isVideo}
    {isAudio}
    {isPdf}
    {timestamps}
    {clipBoundaries}
    {resumePoint}
    {frameCopyToast}
    {imageCopyToast}
    {clipToast}
    {exportToast}
    {clipboardToast}
    {onOpenExportedFile}
    {onSaveClipboardFile}
    {onDismissClipboardToast}
    {clipDeleteConfirm}
    {deleteConfirm}
    {propertiesOpen}
    {deleteNoAsk}
    {deletePermanently}
    {fileName}
    {filePath}
    {fileExt}
    {fileDimensions}
    {fileSize}
    {fileCreated}
    {fileModified}
    {durationDisplay}
    {ffprobeChecked}
    {ffprobeAvailable}
    {ffmpegInstalling}
    {ffmpegInstallError}
    {mediaPropsLoading}
    {mediaProps}
    {installFfmpegAndWait}
    {refreshFfprobeAvailability}
    {loadMediaProperties}
    {showValue}
    {propsCopyPath}
    {propsOpenFolder}
    {propsCopyAll}
    {copyPropValue}
    {performDelete}
    {runClipAction}
    {parentFolder}
    {invokeOpenDirectory}
    {ctxCopyImage}
    {ctxCopyFrame}
    {ctxCopyPath}
    {ctxRotate}
    {ctxFlip}
    {ctxEdit}
    {ctxProcess}
    {ctxShowInExplorer}
    {ctxProperties}
    {ctxShare}
    {ctxDelete}
    {ctxClearMarkers}
    closeClipDeleteConfirm={onCloseClipDeleteConfirm}
    closeDeleteConfirm={onCloseDeleteConfirm}
    closeProperties={onCloseProperties}
    closeShare={onCloseShare}
    {shareOpen}
    updateDeleteNoAsk={onUpdateDeleteNoAsk}
    updateDeletePermanently={onUpdateDeletePermanently}
    onClose={onCloseContextMenu}
    {clipOutputDir}
    {corruptionWarning}
    {corruptionReason}
    {corruptionFixing}
    {corruptionFixError}
    {dismissCorruption}
    {fixCopy}
    {fixReplace}
  />

  <EditMenu
    visible={editMenuVisible}
    onClose={closeEditMenu}
    onMoved={() => (editMenuMoved = true)}
    styleOverride={editMenuStyle}
    {onApply}
    {onExport}
    {onUndo}
    {onReset}
  />

  <ProcessMenu
    visible={processMenuVisible}
    onClose={closeProcessMenu}
    onMoved={() => (processMenuMoved = true)}
    styleOverride={processMenuStyle}
    {isVideo}
    {isAudio}
    {isPdf}
    {filePath}
    {fileName}
    {ffprobeChecked}
    {ffprobeAvailable}
    {ffmpegInstalling}
    {ffmpegInstallError}
    {installFfmpegAndWait}
    {refreshFfprobeAvailability}
    {openConvertedFile}
    {showInExplorer}
  />

  {#key settingsOpen}
    <SettingsDialog {settingsOpen} closeSettings={() => closeSettings()} />
  {/key}
  {#key accessibilityOpen}
    <AccessibilityDialog
      {accessibilityOpen}
      closeAccessibility={() => closeAccessibility()}
    />
  {/key}
  {#key helpOpen}
    <HelpDialog {helpOpen} closeHelp={() => closeHelp()} />
  {/key}
  {#key aboutOpen}
    <AboutDialog {aboutOpen} closeAbout={() => closeAbout()} />
  {/key}
  {#key feedbackOpen}
    <FeedbackDialog {feedbackOpen} closeFeedback={() => closeFeedback()} />
  {/key}

  <Tooltip
    {tsTooltip}
    {tsEditMenuVisible}
    {volumeTooltipVisible}
    {volumeTooltipX}
    {volumeTooltipY}
    {speedTooltipVisible}
    {speedTooltipX}
    {speedTooltipY}
    {playbackSpeed}
    {muted}
    {volume}
    {tsEditMenu}
    {editingTimestamp}
    {editingSegment}
    {currentTitle}
    {updateEditorTitle}
    {closeTimestampEditor}
    {onEditorScissor}
    {onEditorDeleteTimestamp}
    {onEditorDeleteSegment}
  />
</main>
