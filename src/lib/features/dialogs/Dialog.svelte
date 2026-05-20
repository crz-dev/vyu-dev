<script lang="ts">
  import type {
    ClipBoundary,
    ContextMenu,
    MediaProperties,
    VideoMarker,
  } from "$lib/shared/types";

  let {
    contextMenu,
    isVideo,
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
    ctxEdit,
    ctxProcess,
    ctxDelete,
    ctxClearMarkers,
    clipDeleteConfirm,
    deleteConfirm,
    propertiesOpen,
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
    ctxEdit: () => void;
    ctxProcess: () => void;
    ctxClearMarkers: () => void;
    ctxDelete: () => void;
    clipDeleteConfirm: { visible: boolean; mode: "separate" | "merge" | null };
    deleteConfirm: boolean;
    propertiesOpen: boolean;
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
    try {
      const { openPath } = await import("@tauri-apps/plugin-opener");
      await openPath(filePath);
    } catch (e) {
      console.error("Failed to open in default app:", e);
    }
  }

  function printPdf() {
    window.print();
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
        onclick={ctxCopyPath}
        role="menuitem"
        style="animation-delay: 0ms"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /><path
            d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /></svg
        >
        Copy file path
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
        onclick={ctxCopyPath}
        role="menuitem"
        style="animation-delay: 55ms"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /><path
            d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /></svg
        >
        Copy file path
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
            d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
        Edit
      </button>
      <button
        class="ctx-item blue"
        onclick={ctxProcess}
        role="menuitem"
        style="animation-delay: 165ms"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><path
            d="M14 2v6h6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><path
            d="M12 18v-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /><path
            d="M9 15l3 3 3-3"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
        Process
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
        onclick={ctxCopyPath}
        role="menuitem"
        style="animation-delay: 55ms"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /><path
            d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /></svg
        >
        Copy file path
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
            d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
        Edit
      </button>
      <button
        class="ctx-item blue"
        onclick={ctxProcess}
        role="menuitem"
        style="animation-delay: 165ms"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><path
            d="M14 2v6h6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /><path
            d="M12 18v-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /><path
            d="M9 15l3 3 3-3"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          /></svg
        >
        Process
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
