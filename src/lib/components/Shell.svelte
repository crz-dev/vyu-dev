<script lang="ts">
  import AppMenu from "$lib/features/menus/AppMenu.svelte";
  import MediaBar from "$lib/features/media/MediaBar.svelte";
  import ThumbnailBar from "$lib/features/navigation/ThumbnailBar.svelte";
  import LibraryView from "$lib/features/library/LibraryView.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import {
    deleteStore,
    performMultiDelete,
  } from "$lib/features/file-actions/deleteFile.svelte";
  import Dialog from "$lib/features/dialogs/Dialog.svelte";
  import Tooltip from "$lib/components/Tooltip.svelte";
  import EditMenu from "$lib/features/menus/EditMenu.svelte";
  import MarkupMenu from "$lib/features/menus/MarkupMenu.svelte";
  import EffectsMenu from "$lib/features/menus/EffectsMenu.svelte";
  import EqualizerMenu from "$lib/features/menus/EqualizerMenu.svelte";
  import VisualizerMenu from "$lib/features/visualizer/VisualizerMenu.svelte";
  import SettingsDialog from "$lib/features/dialogs/SettingsDialog.svelte";
  import AccessibilityDialog from "$lib/features/dialogs/AccessibilityDialog.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import HelpDialog from "$lib/features/dialogs/HelpDialog.svelte";
  import AboutDialog from "$lib/features/dialogs/AboutDialog.svelte";
  import FeedbackDialog from "$lib/features/dialogs/FeedbackDialog.svelte";
  import ToastStack from "$lib/components/ToastStack.svelte";
  import { fade } from "svelte/transition";
  import type { SortMode } from "$lib/shared/constants";
  import type {
    ContextMenu,
    VideoMarker,
    ClipBoundary,
    MediaProperties,
  } from "$lib/shared/types";
  import type { ClipDeleteConfirmState } from "$lib/features/media/clips.svelte";
  import type {
    MarkerTooltip,
    MarkerEditMenu,
  } from "$lib/features/markers/markers.svelte";

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
    baseZoomLevel,
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
    onFolderRenamed,
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
    openLibrary,
    libraryOpen,
    closeLibrary,
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
    onMarkupApply,
    onMarkupExport,
    closeEditMenu,
    markupMenuVisible,
    closeMarkupMenu,
    effectsMenuVisible,
    closeEffectsMenu,
    equalizerMenuVisible,
    closeEqualizerMenu,
    openConvertedFile,
    showInExplorer,
    onSelect,
    loadFile,
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
    volumeTooltipVertical,
    speedTooltipVisible,
    speedTooltipX,
    speedTooltipY,
    speedTooltipVertical,
    playbackSpeed,
    muted,
    volume,
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
    ctxEdit,
    ctxMarkup,
    ctxEffects,
    ctxEqualizer,
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
    baseZoomLevel: number;
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
    sortMode: SortMode;
    sortDesc: boolean;
    sortMenuVisible: boolean;
    toggleSortMenu: () => void;
    closeSortMenu: () => void;
    onSortChange: (mode: SortMode, desc: boolean) => void;
    onRenamed: (newPath: string) => Promise<void>;
    onFolderRenamed?: (newFolderPath: string) => void;
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
    openLibrary: () => void;
    libraryOpen: boolean;
    closeLibrary: () => void;
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
    onMarkupApply: () => void;
    onMarkupExport: () => void;
    closeEditMenu: () => void;
    markupMenuVisible: boolean;
    closeMarkupMenu: () => void;
    effectsMenuVisible: boolean;
    closeEffectsMenu: () => void;
    equalizerMenuVisible: boolean;
    closeEqualizerMenu: () => void;
    openConvertedFile: (path: string) => Promise<void>;
    showInExplorer: (path: string) => Promise<void>;
    onSelect: (index: number) => void;
    loadFile: (path: string) => Promise<void>;
    onCloseClipDeleteConfirm: () => void;
    onCloseDeleteConfirm: () => void;
    onCloseProperties: () => void;
    onCloseShare: () => void;
    onUpdateDeleteNoAsk: (v: boolean) => void;
    onUpdateDeletePermanently: (v: boolean) => void;
    onCloseContextMenu: () => void;
    tsTooltip: MarkerTooltip;
    tsEditMenuVisible: boolean;
    tsEditMenu: MarkerEditMenu;
    editingTimestamp: VideoMarker | undefined;
    editingSegment: ClipBoundary | undefined;
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
    volumeTooltipVertical: boolean;
    speedTooltipVisible: boolean;
    speedTooltipX: number;
    speedTooltipY: number;
    speedTooltipVertical: boolean;
    playbackSpeed: number;
    muted: boolean;
    volume: number;
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
    ctxEdit: () => void;
    ctxMarkup: () => void;
    ctxEffects: () => void;
    ctxEqualizer: () => void;
    ctxShowInExplorer: () => void;
    ctxProperties: () => void;
    ctxShare: () => void;
    ctxDelete: () => void;
    ctxClearMarkers: () => void;
    clipDeleteConfirm: ClipDeleteConfirmState;
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
    mediaProps: MediaProperties | null;
    loadMediaProperties: () => Promise<void>;
    showValue: (v: string | undefined) => string;
    propsCopyPath: () => void;
    propsOpenFolder: () => void;
    propsCopyAll: () => void;
    copyPropValue: (v: string) => void;
    performDelete: () => void;
    corruptionWarning: boolean;
    corruptionReason: string;
    corruptionFixing: boolean;
    corruptionFixError: string;
    dismissCorruption: () => void;
    fixCopy: () => void;
    fixReplace: () => void;
  } = $props();

  let editMenuMoved = $state(false);
  let markupMenuMoved = $state(false);
  let effectsMenuMoved = $state(false);
  let equalizerMenuMoved = $state(false);
  let clipMenuMoved = $state(false);
  let clipMenuDismissed = $state(false);

  $effect(() => {
    if (!editMenuVisible) editMenuMoved = false;
  });

  $effect(() => {
    if (!markupMenuVisible) markupMenuMoved = false;
  });

  $effect(() => {
    if (!effectsMenuVisible) effectsMenuMoved = false;
  });

  $effect(() => {
    if (!equalizerMenuVisible) equalizerMenuMoved = false;
  });

  // Clear viewer menu selection state when library opens
  const multiDeleteConfirm = $derived(deleteStore.multiDeleteConfirm);
  const multiDeleteCount = $derived(deleteStore.multiDeletePaths.length);
  const multiDeletePermanently = $derived(deleteStore.multiDeletePermanently);
  const multiDeleteNoAsk = $derived(deleteStore.multiDeleteNoAsk);

  function onPerformMultiDelete() {
    performMultiDelete({
      refreshView: () => {
        library.clearSelection();
        library.triggerRescan();
      },
    });
  }

  function onCloseMultiDeleteConfirm() {
    deleteStore.multiDeleteConfirm = false;
    deleteStore.multiDeletePaths = [];
  }

  function onUpdateMultiDeletePermanently(v: boolean) {
    deleteStore.multiDeletePermanently = v;
  }

  function onUpdateMultiDeleteNoAsk(v: boolean) {
    deleteStore.multiDeleteNoAsk = v;
  }

  $effect(() => {
    if (!libraryOpen) {
      library.clearSelection();
    }
  });

  const selectMenuVisible = $derived(libraryOpen && library.selectedCount > 0);
  let selectMenuMoved = $state(false);

  $effect(() => {
    if (!selectMenuVisible) selectMenuMoved = false;
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
    const markupOpen = markupMenuVisible && !markupMenuMoved;
    const effectsOpen = effectsMenuVisible && !effectsMenuMoved;
    const eqOpen = equalizerMenuVisible && !equalizerMenuMoved;
    const clipOpen = clipMenuActive && !clipMenuMoved;

    // Count how many peer menus are open (edit, markup, effects, equalizer)
    const peerCount =
      (editOpen ? 1 : 0) +
      (markupOpen ? 1 : 0) +
      (effectsOpen ? 1 : 0) +
      (eqOpen ? 1 : 0);

    let editOffset = 0;
    let markupOffset = 0;
    let effectsOffset = 0;
    let eqOffset = 0;

    if (peerCount >= 2) {
      const fullGap = MENU_WIDTH + GAP;
      const ordered = [
        editOpen ? "edit" : null,
        markupOpen ? "markup" : null,
        effectsOpen ? "effects" : null,
        eqOpen ? "eq" : null,
      ].filter(Boolean) as string[];
      const center = (ordered.length - 1) / 2;
      const offsets: Record<string, number> = {};
      for (let i = 0; i < ordered.length; i++) {
        offsets[ordered[i]] = (i - center) * fullGap;
      }
      editOffset = offsets["edit"] ?? 0;
      markupOffset = offsets["markup"] ?? 0;
      effectsOffset = offsets["effects"] ?? 0;
      eqOffset = offsets["eq"] ?? 0;
    }

    // Clip shifts based on peer menu presence
    let clipOffset = 0;
    if (clipOpen && peerCount >= 1) {
      if (peerCount === 1) {
        const halfGap = (MENU_WIDTH + GAP) / 2;
        if (editOpen) {
          editOffset = -halfGap;
          clipOffset = halfGap;
        } else if (markupOpen) {
          clipOffset = -halfGap;
          markupOffset = halfGap;
        } else if (effectsOpen) {
          clipOffset = -halfGap;
          effectsOffset = halfGap;
        } else if (eqOpen) {
          clipOffset = -halfGap;
          eqOffset = halfGap;
        }
      } else {
        // clip + 2+ peers: shift clip left
        const fullGap = MENU_WIDTH + GAP;
        clipOffset = -fullGap;
      }
    }

    return {
      edit: editOffset,
      clip: clipOffset,
      markup: markupOffset,
      effects: effectsOffset,
      eq: eqOffset,
    };
  });

  const editMenuStyle = $derived.by(() => {
    if (editMenuVisible && !editMenuMoved && layoutOffsets.edit !== 0) {
      return `left: calc(50% + ${layoutOffsets.edit}px);`;
    }
    return "";
  });

  const markupMenuStyle = $derived.by(() => {
    if (markupMenuVisible && !markupMenuMoved && layoutOffsets.markup !== 0) {
      return `left: calc(50% + ${layoutOffsets.markup}px);`;
    }
    return "";
  });

  const effectsMenuStyle = $derived.by(() => {
    if (
      effectsMenuVisible &&
      !effectsMenuMoved &&
      layoutOffsets.effects !== 0
    ) {
      return `left: calc(50% + ${layoutOffsets.effects}px);`;
    }
    return "";
  });

  const equalizerMenuStyle = $derived.by(() => {
    if (equalizerMenuVisible && !equalizerMenuMoved && layoutOffsets.eq !== 0) {
      return `left: calc(50% + ${layoutOffsets.eq}px);`;
    }
    return "";
  });

  const clipMenuStyle = $derived.by(() => {
    if (clipMenuActive && !clipMenuMoved && layoutOffsets.clip !== 0) {
      return `left: calc(50% + ${layoutOffsets.clip}px);`;
    }
    return "";
  });

  let mainEl = $state<HTMLElement | null>(null);
  let filterEl = $state<HTMLDivElement | null>(null);

  $effect(() => {
    if (filterEl) {
      filterEl.setAttribute("data-colorblind", accessibility.colorBlindMode);
    }
  });
</script>

<!-- Daltonization correction filters (Fidaner/Walowit/Yun pipeline).
     Each is a single precomputed matrix: M = I + strength * M_redist * (I - M_machado).
     strength = 0.75. Math in linearRGB (browser handles sRGB conversion via color-interpolation-filters). -->
<svg aria-hidden="true" style="position:absolute;width:0;height:0">
  <defs>
    <filter id="cvd-protanopia" color-interpolation-filters="linearRGB">
      <feColorMatrix
        type="matrix"
        values="1 0 0 0 0 -0.1912 1.1912 0 0 0 0.2273 -0.4088 1.1815 0 0 0 0 0 1 0"
      />
    </filter>
    <filter id="cvd-deuteranopia" color-interpolation-filters="linearRGB">
      <feColorMatrix
        type="matrix"
        values="1 0 0 0 0 -0.3281 1.3281 0 0 0 0.1969 -0.4219 1.225 0 0 0 0 0 1 0"
      />
    </filter>
    <filter id="cvd-tritanopia" color-interpolation-filters="linearRGB">
      <feColorMatrix
        type="matrix"
        values="1.0375 -0.2869 0.2494 0 0 0 1.1759 -0.1759 0 0 0 0 1 0 0 0 0 0 1 0"
      />
    </filter>
  </defs>
</svg>

<main
  bind:this={mainEl}
  class:fullscreen={viewerStateIsFullscreen}
  class:menu-open={anyMenuOpen}
  class:thumbnail-bar-open={thumbnailBarVisible}
  class:is-audio={isAudio}
  class:library-mode={libraryOpen}
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
    {onFolderRenamed}
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
    onOpenLibrary={openLibrary}
    {libraryOpen}
    onCloseLibrary={closeLibrary}
    {parentFolder}
  />

  <div
    bind:this={filterEl}
    style="flex: 1; display: flex; flex-direction: column; overflow: hidden;"
  >
    <div
      style="flex: 1; display: grid; grid-template: 1fr / 1fr; overflow: hidden;"
    >
      {#if libraryOpen}
        <div
          transition:fade={{ duration: 200 }}
          style="grid-area: 1 / 1; display: flex; flex-direction: column; overflow: hidden;"
        >
          <LibraryView
            {fileList}
            {currentIndex}
            selectMode={library.selectedCount > 0}
            onSelect={async (path) => {
              const idx = fileList.indexOf(path);
              if (idx !== -1) {
                onSelect(idx);
              } else {
                await loadFile(path);
              }
              closeLibrary();
            }}
            onClose={closeLibrary}
          />
        </div>
      {:else}
        <div
          transition:fade={{ duration: 200 }}
          style="grid-area: 1 / 1; display: flex; flex-direction: column; overflow: hidden;"
        >
          {@render children?.()}
        </div>
      {/if}
    </div>
  </div>

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
    {baseZoomLevel}
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
    {markupMenuVisible}
    {editMenuMoved}
    {markupMenuMoved}
    {clipMenuMoved}
    {clipMenuResetKey}
    onClipMenuMoved={() => (clipMenuMoved = true)}
    onClipMenuDismissed={() => (clipMenuDismissed = true)}
    clipMenuDismissed
    editMenuStyleOverride={editMenuStyle}
    markupMenuStyleOverride={markupMenuStyle}
    clipMenuStyleOverride={clipMenuStyle}
    fullscreen={viewerStateIsFullscreen}
    {libraryOpen}
    selectedCount={library.selectedCount}
    {selectMenuVisible}
    getSelectedPaths={library.getSelectedPaths}
    onSelectAll={() => library.selectRange(fileList)}
    onCloseSelectMenu={() => library.clearSelection()}
    onSelectMenuMoved={() => (selectMenuMoved = true)}
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
    {mediaPropsLoading}
    {mediaProps}
    {loadMediaProperties}
    {showValue}
    {propsCopyPath}
    {propsOpenFolder}
    {propsCopyAll}
    {copyPropValue}
    {performDelete}
    {parentFolder}
    {invokeOpenDirectory}
    {ctxCopyImage}
    {ctxCopyFrame}
    {ctxCopyPath}
    {ctxRotate}
    {ctxFlip}
    {ctxEdit}
    {ctxMarkup}
    {ctxEffects}
    {ctxEqualizer}
    {ctxShowInExplorer}
    {ctxProperties}
    {ctxShare}
    {ctxDelete}
    {ctxClearMarkers}
    closeClipDeleteConfirm={onCloseClipDeleteConfirm}
    closeDeleteConfirm={onCloseDeleteConfirm}
    {multiDeleteConfirm}
    {multiDeleteCount}
    {multiDeletePermanently}
    {multiDeleteNoAsk}
    performMultiDelete={onPerformMultiDelete}
    closeMultiDeleteConfirm={onCloseMultiDeleteConfirm}
    updateMultiDeletePermanently={onUpdateMultiDeletePermanently}
    updateMultiDeleteNoAsk={onUpdateMultiDeleteNoAsk}
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

  <ToastStack />

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

  <MarkupMenu
    visible={markupMenuVisible}
    onClose={closeMarkupMenu}
    onMoved={() => (markupMenuMoved = true)}
    styleOverride={markupMenuStyle}
    {onUndo}
    {onReset}
    onApply={onMarkupApply}
    onExport={onMarkupExport}
  />

  <EffectsMenu
    visible={effectsMenuVisible}
    onClose={closeEffectsMenu}
    onMoved={() => (effectsMenuMoved = true)}
    styleOverride={effectsMenuStyle}
    {filePath}
  />

  <EqualizerMenu
    visible={equalizerMenuVisible}
    onClose={closeEqualizerMenu}
    onMoved={() => (equalizerMenuMoved = true)}
    styleOverride={equalizerMenuStyle}
    {isVideo}
  />

  <VisualizerMenu type="pulse" />
  <VisualizerMenu type="spectrum" />
  <VisualizerMenu type="heartbeat" />
  <VisualizerMenu type="diamonds" />

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
    {volumeTooltipVertical}
    {speedTooltipVisible}
    {speedTooltipX}
    {speedTooltipY}
    {speedTooltipVertical}
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
