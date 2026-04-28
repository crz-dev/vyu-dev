<script lang="ts">
  import { fly } from "svelte/transition";
  import { open } from "@tauri-apps/plugin-dialog";
  import { invokeConvertMedia } from "$lib/services/mediaTools";

  let {
    visible,
    onClose,
    isVideo,
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
  }: {
    visible: boolean;
    onClose: () => void;
    isVideo: boolean;
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
  } = $props();

  let convertOpen = $state(false);
  let activeConvertTool: "format" | "preset" | null = $state(null);
  let activeFormat = $state<string | null>(null);
  let activePreset = $state<string | null>(null);
  let exportLocation = $state<string | null>(null);
  let converting = $state(false);
  let convertError = $state("");
  let convertOutputPath = $state<string | null>(null);

  const videoFormats = ["MP4", "WebM", "MKV", "GIF"];
  const imageFormats = ["PNG", "JPG", "WebP", "GIF"];
  const formatOptions = $derived(isVideo ? videoFormats : imageFormats);
  const presetOptions = ["Fast", "Balanced", "Quality", "Lossless"];

  const canExport = $derived(
    !!activeFormat && !!activePreset && !!exportLocation && !converting,
  );
  const needsFfmpeg = $derived(ffprobeChecked && !ffprobeAvailable);

  const outputFolder = $derived.by(() => {
    if (!convertOutputPath) return null;
    const sep = convertOutputPath.includes("\\") ? "\\" : "/";
    const idx = convertOutputPath.lastIndexOf(sep);
    return idx > 0 ? convertOutputPath.slice(0, idx) : convertOutputPath;
  });

  $effect(() => {
    if (!visible) {
      convertOpen = false;
      activeConvertTool = null;
      activeFormat = null;
      activePreset = null;
      exportLocation = null;
      converting = false;
      convertError = "";
      convertOutputPath = null;
    }
  });

  function toggleConvert() {
    convertOpen = !convertOpen;
    if (!convertOpen) {
      activeConvertTool = null;
    }
  }

  function toggleTool(tool: "format" | "preset") {
    if (activeConvertTool === tool) {
      activeConvertTool = null;
    } else {
      activeConvertTool = tool;
    }
  }

  async function handleLocation() {
    const dir = await open({ directory: true });
    if (dir) {
      exportLocation = dir as string;
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

  function selectFormat(fmt: string) {
    activeFormat = activeFormat === fmt ? null : fmt;
  }

  function selectPreset(preset: string) {
    activePreset = activePreset === preset ? null : preset;
  }
</script>

{#if visible}
  <div
    class="process-menu"
    transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}
    onclick={() => (activeConvertTool = null)}
  >
    <div
      class="ctx-drag"
      onmousedown={(e) => {
        e.preventDefault();
        const menu = (e.currentTarget as HTMLElement).closest(
          ".process-menu",
        ) as HTMLElement;
        if (!menu) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = menu.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        function onMouseMove(ev: MouseEvent) {
          menu.style.left = `${startLeft + ev.clientX - startX}px`;
          menu.style.top = `${startTop + ev.clientY - startY}px`;
          menu.style.transform = "none";
        }

        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }}
    >
      <span class="ctx-dot"></span><span class="ctx-dot"></span><span
        class="ctx-dot"
      ></span>
      <button
        class="ctx-close"
        onclick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label="Close"
      >
        <svg
          width="10"
          height="10"
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
      <div class="edit-menu-row">
        <button
          class="edit-menu-btn blue"
          class:active={convertOpen}
          onclick={toggleConvert}
        >
          Convert
        </button>
        <button class="edit-menu-btn yellow">Compress</button>
      </div>

      {#if convertOpen}
        <div
          class="edit-menu-row"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
          <button
            class="edit-menu-btn"
            class:grey={!activeFormat}
            class:blue={!!activeFormat}
            onclick={(e) => {
              e.stopPropagation();
              toggleTool("format");
            }}
          >
            Format
          </button>
          <button
            class="edit-menu-btn"
            class:grey={!activePreset}
            class:blue={!!activePreset}
            onclick={(e) => {
              e.stopPropagation();
              toggleTool("preset");
            }}
          >
            Preset
          </button>
          <button
            class="edit-menu-btn"
            class:grey={!exportLocation}
            class:yellow={!!exportLocation}
            onclick={() => {
              activeConvertTool = null;
              handleLocation();
            }}
          >
            Location
          </button>
          <button
            class="edit-menu-btn"
            class:grey={!canExport}
            class:green={canExport}
            disabled={!canExport}
            onclick={() => {
              activeConvertTool = null;
              handleExport();
            }}
          >
            {converting ? "Converting..." : "Export"}
          </button>
        </div>

        {#if activeConvertTool === "format"}
          <div
            class="edit-menu-row"
            transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
          >
            {#each formatOptions as opt}
              <button
                class="edit-menu-btn white"
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
          <div
            class="edit-menu-row"
            transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
          >
            {#each presetOptions as opt}
              <button
                class="edit-menu-btn white"
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
          <div class="convert-progress" transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}>
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

        {#if convertOutputPath && outputFolder}
          <div
            class="convert-success-row"
            transition:fly={{ y: -6, duration: 120, opacity: 0.05 }}
          >
            <span class="convert-success-text">Saved to {outputFolder}</span>
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
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
              </button>
            </div>
          </div>
        {/if}
      {/if}
    {/if}
  </div>
{/if}
