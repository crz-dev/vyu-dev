<script lang="ts">
  import type { ClipBoundary, CtxMenu, Timestamp } from "$lib/types";

  let {
    contextMenu,
    isVideo,
    timestamps,
    clipBoundaries,
    frameCopyToast,
    imageCopyToast,
    clipToast,
    exportToast,
    onOpenExportedFile,
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
    ctxConvert,
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
    performDelete,
    runClipAction,
    closeClipDeleteConfirm,
    closeDeleteConfirm,
    closeProperties,
    updateDeleteNoAsk,
    updateDeletePermanently,
  }: {
    contextMenu: CtxMenu;
    isVideo: boolean;
    timestamps: Timestamp[];
    clipBoundaries: ClipBoundary[];
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
    onOpenExportedFile: () => void;
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
    ctxConvert: () => void;
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
    mediaProps: any;
    installFfmpegAndWait: () => void;
    refreshFfprobeAvailability: () => Promise<void>;
    loadMediaProperties: () => Promise<void>;
    showValue: (v: string | undefined) => string;
    propsCopyPath: () => void;
    propsOpenFolder: () => void;
    propsCopyAll: () => void;
    performDelete: () => void;
    runClipAction: (mode: "separate" | "merge") => void;
    closeClipDeleteConfirm: () => void;
    closeDeleteConfirm: () => void;
    closeProperties: () => void;
    updateDeleteNoAsk: (v: boolean) => void;
    updateDeletePermanently: (v: boolean) => void;
  } = $props();
</script>

{#if contextMenu.visible}
  <div
    class="context-menu"
    style="left: {contextMenu.x}px; top: {contextMenu.y}px;"
    role="menu"
  >
    <div
      class="ctx-drag"
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
      <span class="ctx-dot" /><span class="ctx-dot" /><span class="ctx-dot" />
    </div>
    {#if !isVideo}
      <button class="ctx-item green" onclick={ctxCopyImage} role="menuitem">
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
      <button class="ctx-item green" onclick={ctxCopyPath} role="menuitem">
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
      <button class="ctx-item blue" onclick={ctxEdit} role="menuitem">
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
      <button class="ctx-item blue" onclick={ctxConvert} role="menuitem">
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
        Convert
      </button>
      <div class="ctx-sep"></div>
      <button class="ctx-item yellow" onclick={ctxShowInExplorer} role="menuitem">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            stroke="currentColor"
            stroke-width="2"
          /></svg
        >
        Show in explorer
      </button>
      <button class="ctx-item yellow" onclick={ctxProperties} role="menuitem">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
            d="M12 10.5V16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
        >
        Properties
      </button>
      <div class="ctx-sep"></div>
      <button class="ctx-item red" onclick={ctxDelete} role="menuitem">
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
          /><path d="M9 6V4h6v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
        >
        Delete
      </button>
    {:else}
      <button class="ctx-item green" onclick={ctxCopyFrame} role="menuitem">
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
      <button class="ctx-item green" onclick={ctxCopyPath} role="menuitem">
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
      <button class="ctx-item blue" onclick={ctxEdit} role="menuitem">
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
      <button class="ctx-item blue" onclick={ctxConvert} role="menuitem">
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
        Convert
      </button>
      <div class="ctx-sep"></div>
      <button class="ctx-item yellow" onclick={ctxShowInExplorer} role="menuitem">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><path
            d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            stroke="currentColor"
            stroke-width="2"
          /></svg
        >
        Show in explorer
      </button>
      <button class="ctx-item yellow" onclick={ctxProperties} role="menuitem">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
          ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
            d="M12 10.5V16"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          /><circle cx="12" cy="7.5" r="1" fill="currentColor" /></svg
        >
        Properties
      </button>
      <div class="ctx-sep"></div>
      {#if timestamps.length > 0 || clipBoundaries.length > 0}
        <button class="ctx-item red" onclick={() => ctxClearMarkers()} role="menuitem">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
            ><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" /><path
              d="M9 9l6 6M15 9l-6 6"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            /></svg
          >
          Delete Markers
        </button>
      {/if}
      <button class="ctx-item red" onclick={ctxDelete} role="menuitem">
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
          /><path d="M9 6V4h6v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg
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
            await invokeOpenDirectory(clipToast.outputDir || clipOutputDir || parentFolder());
          } catch {}
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
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
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
        <button
          class="delete-cancel"
          onclick={closeClipDeleteConfirm}
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
    <div class="delete-dialog" role="dialog" aria-modal="true">
      <p class="delete-title">Delete file?</p>
      <p class="delete-subtitle">{fileName}</p>
      <div class="delete-toggles">
        <label class="toggle-row">
          <span class="toggle-label">Do not ask again</span>
          <input type="checkbox" checked={deleteNoAsk} onchange={(e) => updateDeleteNoAsk(e.currentTarget.checked)} />
          <span class="toggle-track" class:on={deleteNoAsk}
            ><span class="toggle-thumb"></span></span
          >
        </label>
        <label class="toggle-row">
          <span class="toggle-label">Delete permanently</span>
          <input type="checkbox" checked={deletePermanently} onchange={(e) => updateDeletePermanently(e.currentTarget.checked)} />
          <span class="toggle-track" class:on={deletePermanently}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      </div>
      <div class="delete-actions">
        <button class="delete-cancel" onclick={closeDeleteConfirm}
          >Cancel</button
        >
        <button class="delete-confirm-btn" onclick={performDelete}
          >Delete</button
        >
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
      <p class="delete-title">Properties</p>
      <p class="delete-subtitle">{fileName}</p>
      <div class="props-list">
        <div class="props-row">
          <span class="props-k">Type</span>
          <span class="props-v"
            >{isVideo ? "Video" : "Image"} ({fileExt() || "unknown"})</span
          >
        </div>
        <div class="props-row">
          <span class="props-k">Dimensions</span>
          <span class="props-v">{fileDimensions || "Unknown"}</span>
        </div>
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
          <div class="props-row">
            <span class="props-k">Container</span>
            <span class="props-v"
              >{mediaPropsLoading
                ? "Loading..."
                : showValue(mediaProps?.container)}</span
            >
          </div>
          <div class="props-row">
            <span class="props-k">Codec</span>
            <span class="props-v">
              {mediaPropsLoading
                ? "Loading..."
                : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`}
            </span>
          </div>
          <div class="props-row">
            <span class="props-k">Color</span>
            <span class="props-v">
              {mediaPropsLoading
                ? "Loading..."
                : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`}
            </span>
          </div>
          {#if isVideo}
            <div class="props-row">
              <span class="props-k">Duration</span>
              <span class="props-v">{durationDisplay}</span>
            </div>
            <div class="props-row">
              <span class="props-k">Frame rate</span>
              <span class="props-v"
                >{mediaPropsLoading
                  ? "Loading..."
                  : showValue(mediaProps?.frame_rate)}</span
              >
            </div>
          {/if}
        {/if}
        <div class="props-row">
          <span class="props-k">Size</span>
          <span class="props-v">{fileSize || "Unknown"}</span>
        </div>
        <div class="props-row">
          <span class="props-k">Created</span>
          <span class="props-v">{fileCreated || "Unknown"}</span>
        </div>
        <div class="props-row">
          <span class="props-k">Modified</span>
          <span class="props-v">{fileModified || "Unknown"}</span>
        </div>
        <div class="props-row">
          <span class="props-k">Folder</span>
          <span class="props-v">{parentFolder() || "Unknown"}</span>
        </div>
        <div class="props-row">
          <span class="props-k">Path</span>
          <span class="props-v">{filePath || "Unknown"}</span>
        </div>
      </div>
      <div class="props-actions">
        <button class="props-btn" onclick={propsCopyPath}>Copy path</button>
        <button class="props-btn" onclick={propsOpenFolder}
          >Open folder</button
        >
        <button class="props-btn" onclick={propsCopyAll}
          >Copy all properties</button
        >
      </div>
      <div class="delete-actions">
        <button class="delete-cancel" onclick={closeProperties}
          >Close</button
        >
      </div>
    </div>
  </div>
{/if}
