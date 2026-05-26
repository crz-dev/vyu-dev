<script lang="ts">
  import { fly } from "svelte/transition";
  import { open } from "@tauri-apps/plugin-dialog";
  import {
    invokeConvertMedia,
    invokeCompressMedia,
  } from "$lib/features/media/tools";

  let {
    visible,
    onClose,
    isVideo,
    isAudio = false,
    isPdf = false,
    filePath,
    fileName,
    ffprobeChecked,
    ffprobeAvailable,
    ffmpegInstalling,
    ffmpegInstallError,
    installFfmpegAndWait,
    refreshFfprobeAvailability,
    openConvertedFile,
    showInExplorer,
    onMoved,
    styleOverride = "",
  }: {
    visible: boolean;
    onClose: () => void;
    isVideo: boolean;
    isAudio?: boolean;
    isPdf?: boolean;
    filePath: string;
    fileName: string;
    ffprobeChecked: boolean;
    ffprobeAvailable: boolean;
    ffmpegInstalling: boolean;
    ffmpegInstallError: string;
    installFfmpegAndWait: () => void;
    refreshFfprobeAvailability: () => Promise<void>;
    openConvertedFile: (path: string) => Promise<void>;
    showInExplorer: (path: string) => Promise<void>;
    onMoved?: () => void;
    styleOverride?: string;
  } = $props();

  let convertOpen = $state(false);
  let activeConvertTool: "format" | "preset" | null = $state(null);
  let activeFormat = $state<string | null>(null);
  let activePreset = $state<string | null>(null);
  let exportLocation = $state<string | null>(null);
  let converting = $state(false);
  let convertError = $state("");
  let convertOutputPath = $state<string | null>(null);

  let compressOpen = $state(false);
  let activeCompressTool: "target" | "preset" | null = $state(null);
  let activeTarget = $state<string | null>(null);
  let activeCompressPreset = $state<string | null>(null);
  let compressLocation = $state<string | null>(null);
  let compressing = $state(false);
  let compressError = $state("");
  let compressOutputPath = $state<string | null>(null);
  let pinned = $state(false);
  let openTimeout: ReturnType<typeof setTimeout> | null = $state(null);

  const videoFormats = ["MP4", "WebM", "MKV", "GIF"];
  const imageFormats = ["PNG", "JPG", "WebP", "GIF"];
  const audioFormats = ["MP3", "WAV", "FLAC", "OGG", "AAC"];
  const formatOptions = $derived(
    isAudio ? audioFormats : isVideo ? videoFormats : imageFormats,
  );
  const presetOptions = ["Fast", "Balanced", "Quality", "Lossless"];
  const targetOptions = ["This file", "Full folder"];

  const canExport = $derived(
    !!activeFormat && !!activePreset && !!exportLocation && !converting,
  );
  const canExtract = $derived(
    !!activeTarget &&
      !!activeCompressPreset &&
      !!compressLocation &&
      !compressing,
  );
  const needsFfmpeg = $derived(ffprobeChecked && !ffprobeAvailable);

  const convertOutputFolder = $derived.by(() => {
    if (!convertOutputPath) return null;
    const sep = convertOutputPath.includes("\\") ? "\\" : "/";
    const idx = convertOutputPath.lastIndexOf(sep);
    return idx > 0 ? convertOutputPath.slice(0, idx) : convertOutputPath;
  });

  const compressOutputFolder = $derived.by(() => {
    if (!compressOutputPath) return null;
    const sep = compressOutputPath.includes("\\") ? "\\" : "/";
    const idx = compressOutputPath.lastIndexOf(sep);
    return idx > 0 ? compressOutputPath.slice(0, idx) : compressOutputPath;
  });

  $effect(() => {
    if (!visible) {
      if (openTimeout) clearTimeout(openTimeout);
      openTimeout = null;
      convertOpen = false;
      activeConvertTool = null;
      activeFormat = null;
      activePreset = null;
      exportLocation = null;
      converting = false;
      convertError = "";
      convertOutputPath = null;
      compressOpen = false;
      activeCompressTool = null;
      activeTarget = null;
      activeCompressPreset = null;
      compressLocation = null;
      compressing = false;
      compressError = "";
      compressOutputPath = null;
      pinned = false;
    }
  });

  function toggleConvert() {
    if (convertOpen) {
      convertOpen = false;
      activeConvertTool = null;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      compressOpen = false;
      openTimeout = setTimeout(() => {
        convertOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleCompress() {
    if (compressOpen) {
      compressOpen = false;
      activeCompressTool = null;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      convertOpen = false;
      openTimeout = setTimeout(() => {
        compressOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleTool(tool: "format" | "preset") {
    if (activeConvertTool === tool) {
      activeConvertTool = null;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      activeConvertTool = null;
      openTimeout = setTimeout(() => {
        activeConvertTool = tool;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleCompressTool(tool: "target" | "preset") {
    if (activeCompressTool === tool) {
      activeCompressTool = null;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      activeCompressTool = null;
      openTimeout = setTimeout(() => {
        activeCompressTool = tool;
        openTimeout = null;
      }, 100);
    }
  }

  async function handleLocation() {
    const dir = await open({ directory: true });
    if (dir) {
      exportLocation = dir as string;
    }
  }

  async function handleCompressLocation() {
    const dir = await open({ directory: true });
    if (dir) {
      compressLocation = dir as string;
    }
  }

  async function handleExport() {
    if (!canExport || !activeFormat || !activePreset || !exportLocation) return;
    converting = true;
    convertError = "";
    convertOutputPath = null;
    try {
      const output = await invokeConvertMedia(
        filePath,
        exportLocation,
        activeFormat.toLowerCase(),
        activePreset,
      );
      convertOutputPath = output;
    } catch (err) {
      convertError = err instanceof Error ? err.message : String(err);
    } finally {
      converting = false;
    }
  }

  async function handleExtract() {
    if (
      !canExtract ||
      !activeTarget ||
      !activeCompressPreset ||
      !compressLocation
    )
      return;
    compressing = true;
    compressError = "";
    compressOutputPath = null;
    try {
      const target = activeTarget === "This file" ? "file" : "folder";
      const output = await invokeCompressMedia(
        filePath,
        compressLocation,
        target,
        activeCompressPreset,
      );
      compressOutputPath = output;
    } catch (err) {
      compressError = err instanceof Error ? err.message : String(err);
    } finally {
      compressing = false;
    }
  }

  function selectFormat(fmt: string) {
    activeFormat = activeFormat === fmt ? null : fmt;
  }

  function selectPreset(preset: string) {
    activePreset = activePreset === preset ? null : preset;
  }

  function selectTarget(target: string) {
    activeTarget = activeTarget === target ? null : target;
  }

  function selectCompressPreset(preset: string) {
    activeCompressPreset = activeCompressPreset === preset ? null : preset;
  }
</script>

{#if visible}
  <div
    class="process-menu"
    class:pinned
    role="dialog"
    aria-label="Process menu"
    tabindex="-1"
    style={styleOverride}
    transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}
    onclick={() => {
      activeConvertTool = null;
      activeCompressTool = null;
    }}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        activeConvertTool = null;
        activeCompressTool = null;
      }
    }}
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="-1"
      aria-label="Drag to move"
        onmousedown={(e) => {
          e.preventDefault();
          onMoved?.();
          const menu = (e.currentTarget as HTMLElement).closest(
            ".process-menu",
          ) as HTMLElement;
        if (!menu) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = menu.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;
        const savedTransition = menu.style.transition;
        menu.style.transition = "none";

        function onMouseMove(ev: MouseEvent) {
          menu.style.left = `${startLeft + ev.clientX - startX}px`;
          menu.style.top = `${startTop + ev.clientY - startY}px`;
          menu.style.transform = "none";
        }

        function onMouseUp() {
          menu.style.transition = savedTransition;
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
      <span class="ctx-drag-title">
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
        <span>Process</span>
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
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
      <div class="edit-menu-row" style="text-align:center; padding:16px;">
        <span style="font-size:11px; color:var(--text-muted);">Convert/Compress not available for PDFs.<br />Use the context menu to open in default viewer or print.</span>
      </div>
    {:else}
    <div class="edit-menu-row">
      <button
        class="edit-menu-btn blue"
        class:sub-open={compressOpen}
        onclick={toggleConvert}
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
        >
          <path d="M4 8h16" stroke-linecap="round" />
          <path
            d="M16 4l4 4-4 4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path d="M20 16H4" stroke-linecap="round" />
          <path
            d="M8 20l-4-4 4-4"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        Convert
      </button>
      <button
        class="edit-menu-btn yellow"
        class:sub-open={convertOpen}
        onclick={toggleCompress}
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
        >
          <path
            d="M8 3v3a2 2 0 01-2 2H3m18 0h-3a2 2 0 01-2-2V3m0 18v-3a2 2 0 012-2h3M3 16h3a2 2 0 012 2v3"
          />
        </svg>
        Compress
      </button>
    </div>

    {#if convertOpen}
      {#if needsFfmpeg}
        <div
          class="ffprobe-note process-ffmpeg-note"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
          <p class="ffprobe-title">Conversion needs FFmpeg</p>
          <p class="ffprobe-sub">
            To convert or compress media files, install FFmpeg. Your files stay
            local on your device and are not uploaded anywhere.
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
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
          out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
        >
          <button
            class="edit-menu-btn sub"
            class:grey={!activeFormat}
            class:blue={!!activeFormat}
            onclick={(e) => {
              e.stopPropagation();
              toggleTool("format");
            }}
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
            >
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Format
          </button>
          <button
            class="edit-menu-btn sub"
            class:grey={!activePreset}
            class:blue={!!activePreset}
            onclick={(e) => {
              e.stopPropagation();
              toggleTool("preset");
            }}
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
            >
              <circle cx="12" cy="12" r="3" />
              <path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
              />
            </svg>
            Preset
          </button>
          <button
            class="edit-menu-btn sub"
            class:grey={!exportLocation}
            class:yellow={!!exportLocation}
            onclick={() => {
              activeConvertTool = null;
              handleLocation();
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <path
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              />
            </svg>
            Location
          </button>
          <button
            class="edit-menu-btn sub"
            class:grey={!canExport}
            class:green={canExport}
            disabled={!canExport}
            onclick={() => {
              activeConvertTool = null;
              handleExport();
            }}
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
            >
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {converting ? "Converting..." : "Export"}
          </button>
        </div>

        {#if activeConvertTool === "format"}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            {#each formatOptions as opt}
              <button
                class="edit-menu-btn white sub"
                class:inactive={activeFormat !== null && activeFormat !== opt}
                onclick={(e) => {
                  e.stopPropagation();
                  selectFormat(opt);
                }}
              >
                {opt}
              </button>
            {/each}
          </div>
        {/if}

        {#if activeConvertTool === "preset"}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            {#each presetOptions as opt}
              <button
                class="edit-menu-btn white sub"
                class:inactive={activePreset !== null && activePreset !== opt}
                onclick={(e) => {
                  e.stopPropagation();
                  selectPreset(opt);
                }}
              >
                {opt}
              </button>
            {/each}
          </div>
        {/if}

        {#if converting}
          <div
            class="convert-progress"
            transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}
          >
            <span></span>
          </div>
        {/if}

        {#if convertError}
          <p
            class="ffprobe-error"
            style="margin: 0; text-align: center;"
            transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}
          >
            {convertError}
          </p>
        {/if}

        {#if convertOutputPath && convertOutputFolder}
          <div
            class="convert-success-row"
            transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}
          >
            <span class="convert-success-text"
              >Saved to {convertOutputFolder}</span
            >
            <div class="convert-success-actions">
              <button
                class="convert-success-btn yellow"
                onclick={() => {
                  if (convertOutputPath) showInExplorer(convertOutputPath);
                }}
                aria-label="Show in explorer"
                title="Show in explorer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  ><path
                    d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                    stroke="currentColor"
                    stroke-width="2"
                  /></svg
                >
              </button>
              <button
                class="convert-success-btn green"
                onclick={() => {
                  if (convertOutputPath) openConvertedFile(convertOutputPath);
                }}
                aria-label="Open in Vyu"
                title="Open in Vyu"
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
                >
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
              </button>
            </div>
          </div>
        {/if}
      {/if}
    {/if}

    {#if compressOpen}
      <div class="edit-menu-separator"></div>
      <div
        class="edit-menu-row"
        in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
      >
        <button
          class="edit-menu-btn sub"
          class:grey={!activeTarget}
          class:blue={!!activeTarget}
          onclick={(e) => {
            e.stopPropagation();
            toggleCompressTool("target");
          }}
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
          >
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="6" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          Target
        </button>
        <button
          class="edit-menu-btn sub"
          class:grey={!activeCompressPreset}
          class:blue={!!activeCompressPreset}
          onclick={(e) => {
            e.stopPropagation();
            toggleCompressTool("preset");
          }}
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
          >
            <circle cx="12" cy="12" r="3" />
            <path
              d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.6 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
            />
          </svg>
          Preset
        </button>
        <button
          class="edit-menu-btn sub"
          class:grey={!compressLocation}
          class:yellow={!!compressLocation}
          onclick={() => {
            activeCompressTool = null;
            handleCompressLocation();
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            />
          </svg>
          Location
        </button>
        <button
          class="edit-menu-btn sub"
          class:grey={!canExtract}
          class:green={canExtract}
          disabled={!canExtract}
          onclick={() => {
            activeCompressTool = null;
            handleExtract();
          }}
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
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {compressing ? "Compressing..." : "Export"}
        </button>
      </div>

      {#if activeCompressTool === "target"}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
          out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
        >
          {#each targetOptions as opt}
            <button
              class="edit-menu-btn white sub"
              class:inactive={activeTarget !== null && activeTarget !== opt}
              onclick={(e) => {
                e.stopPropagation();
                selectTarget(opt);
              }}
            >
              {opt}
            </button>
          {/each}
        </div>
      {/if}

      {#if activeCompressTool === "preset"}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
          out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
        >
          {#each presetOptions as opt}
            <button
              class="edit-menu-btn white sub"
              class:inactive={activeCompressPreset !== null &&
                activeCompressPreset !== opt}
              onclick={(e) => {
                e.stopPropagation();
                selectCompressPreset(opt);
              }}
            >
              {opt}
            </button>
          {/each}
        </div>
      {/if}

      {#if compressing}
        <div
          class="convert-progress"
          transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}
        >
          <span></span>
        </div>
      {/if}

      {#if compressError}
        <p
          class="ffprobe-error"
          style="margin: 0; text-align: center;"
          transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}
        >
          {compressError}
        </p>
      {/if}

      {#if compressOutputPath && compressOutputFolder}
        <div
          class="convert-success-row"
          transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}
        >
          <span class="convert-success-text"
            >Saved to {compressOutputFolder}</span
          >
          <div class="convert-success-actions">
            <button
              class="convert-success-btn yellow"
              onclick={() => {
                if (compressOutputPath) showInExplorer(compressOutputPath);
              }}
              aria-label="Show in explorer"
              title="Show in explorer"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                ><path
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                  stroke="currentColor"
                  stroke-width="2"
                /></svg
              >
            </button>
          </div>
        </div>
      {/if}
    {/if}
    {/if}
  </div>
{/if}
