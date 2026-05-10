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
    fileDimensions,
    fileSize,
    fileInfoLoading,
    isLoadingFile,
    loadingFadingOut,
    anyMenuOpen,
    viewerStateIsFullscreen,
    viewerResetFsTimer,
    viewerToggleFullscreen,
    thumbnailBarVisible,
    zoomLevel,
    resetZoom,
    clipCount,
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
    ctxDelete,
    ctxClearMarkers,
    clipDeleteConfirm,
    deleteConfirm,
    deleteNoAsk,
    deletePermanently,
    propertiesOpen,
    fileExt,
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
    runClipAction,
  }: {
    children: import("svelte").Snippet;
    fileName: string;
    fileSrc: string;
    filePath: string;
    fileList: string[];
    currentIndex: number;
    isVideo: boolean;
    isAudio: boolean;
    fileDimensions: string;
    fileSize: string;
    fileInfoLoading: boolean;
    isLoadingFile: boolean;
    loadingFadingOut: boolean;
    anyMenuOpen: boolean;
    viewerStateIsFullscreen: boolean;
    viewerResetFsTimer: () => void;
    viewerToggleFullscreen: () => void;
    thumbnailBarVisible: boolean;
    zoomLevel: number;
    resetZoom: () => void;
    clipCount: number;
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
    ctxDelete: () => void;
    ctxClearMarkers: () => void;
    clipDeleteConfirm: any;
    deleteConfirm: boolean;
    deleteNoAsk: boolean;
    deletePermanently: boolean;
    propertiesOpen: boolean;
    fileExt: () => string;
    fileCreated: string;
    fileModified: string;
    durationDisplay: string;
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
  } = $props();
</script>

<main
  class:fullscreen={viewerStateIsFullscreen}
  class:menu-open={anyMenuOpen}
  class:thumbnail-bar-open={thumbnailBarVisible}
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
    {resetZoom}
    toggleFullscreen={viewerToggleFullscreen}
    {isVideo}
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
    {timestamps}
    {clipBoundaries}
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
    {ctxDelete}
    {ctxClearMarkers}
    closeClipDeleteConfirm={onCloseClipDeleteConfirm}
    closeDeleteConfirm={onCloseDeleteConfirm}
    closeProperties={onCloseProperties}
    updateDeleteNoAsk={onUpdateDeleteNoAsk}
    updateDeletePermanently={onUpdateDeletePermanently}
    onClose={onCloseContextMenu}
    {clipOutputDir}
  />

  <EditMenu
    visible={editMenuVisible}
    onClose={closeEditMenu}
    {onApply}
    {onExport}
    {onUndo}
    {onReset}
  />

  <ProcessMenu
    visible={processMenuVisible}
    onClose={closeProcessMenu}
    {isVideo}
    {isAudio}
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
