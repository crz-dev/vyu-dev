<script lang="ts">
  import { slide } from "svelte/transition";
  import { open } from "@tauri-apps/plugin-dialog";
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import {
    invokeGetFfmpegInfo,
    type FfmpegInfo,
  } from "$lib/features/media/api";
  import { conversionPrefs } from "$lib/features/media/conversionPrefs.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import type { HardwareEncoder } from "$lib/services/storage";

  let { flash = false }: { flash?: boolean } = $props();

  const exportQualityLevels = [
    "fast",
    "balanced",
    "quality",
    "lossless",
  ] as const;
  const exportQualityLabels = ["Fast", "Balanced", "Quality", "Lossless"];

  let qualityPreview = $state(
    Math.max(0, exportQualityLevels.indexOf(conversionPrefs.quality)),
  );
  let audioBitratePreview = $state(conversionPrefs.audioBitrate);
  let ffmpegInfo = $state<FfmpegInfo | null>(null);
  let ffmpegLoading = $state(false);

  const detectedEncoders = $derived(ffmpegInfo?.hardwareEncoders ?? []);

  const encoderLabels: Record<string, string> = {
    h264_nvenc: "NVIDIA",
    h264_qsv: "Intel",
    h264_amf: "AMD",
  };

  $effect(() => {
    qualityPreview = Math.max(
      0,
      exportQualityLevels.indexOf(conversionPrefs.quality),
    );
  });

  $effect(() => {
    audioBitratePreview = conversionPrefs.audioBitrate;
  });

  async function loadFfmpegInfo() {
    ffmpegLoading = true;
    try {
      ffmpegInfo = await invokeGetFfmpegInfo();
    } catch {
      ffmpegInfo = null;
    }
    ffmpegLoading = false;
  }

  function ffmpegStatus(): string {
    if (ffmpegLoading) return "Checking…";
    if (!ffmpegInfo || ffmpegInfo.ffmpegVersion === "Unavailable") {
      return "Unavailable";
    }
    const version =
      ffmpegInfo.ffmpegVersion.split(/\s+/)[2]?.split("-")[0] ?? "Unknown";
    const hardware =
      ffmpegInfo.hardwareEncoders.length > 0
        ? ffmpegInfo.hardwareEncoders.map(encoderLabel).join(", ")
        : "Software only";
    return `${version} · ${hardware}`;
  }

  function encoderLabel(encoder: string): string {
    return encoderLabels[encoder] ?? encoder;
  }

  function exportQualityLabel(index: number): string {
    return exportQualityLabels[index] ?? "Balanced";
  }

  function shortFolderPath(path: string): string {
    if (!path) return "Source folder";
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }

  async function pickOutputDir() {
    const dir = await open({
      directory: true,
      defaultPath: conversionPrefs.outputDir || undefined,
    });
    if (!dir) return;
    conversionPrefs.setOutputDir(dir as string);
  }

  void loadFfmpegInfo();
</script>

<div id="settings-section-process" class="settings-section" class:flash>
  <p class="settings-section-header">
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      ><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><path
        d="M14 2v6h6"
      /><path d="M12 18v-6" /><path d="M9 15l3 3 3-3" /></svg
    >
    Conversion
  </p>

  <SettingsGroup label="Quality & Format" icon="sliders">
    <SettingsRow
      label="Conversion Quality"
      hint="Speed and quality for video and image conversions"
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            aria-label="Conversion quality"
            aria-valuetext={exportQualityLabel(qualityPreview)}
            value={qualityPreview}
            oninput={(e) => (qualityPreview = Number(e.currentTarget.value))}
            onchange={(e) => {
              const level = exportQualityLevels[Number(e.currentTarget.value)];
              if (level) conversionPrefs.setQuality(level);
            }}
          />
          <span class="settings-slider-value" style="min-width: 62px"
            >{exportQualityLabel(qualityPreview)}</span
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Audio Bitrate" hint="Bitrate for lossy audio outputs">
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="64"
            max="320"
            step="64"
            aria-label="Audio bitrate"
            value={audioBitratePreview}
            oninput={(e) =>
              (audioBitratePreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              conversionPrefs.setAudioBitrate(Number(e.currentTarget.value))}
          />
          <span class="settings-slider-value" style="min-width: 60px"
            >{audioBitratePreview} kbps</span
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Cover Art"
      hint="Background for audio-to-video conversion"
    >
      {#snippet control()}
        <div class="pill-group pill-group-2">
          <button
            class="pill-btn"
            class:active={conversionPrefs.coverArtMode === "cover"}
            onclick={() => conversionPrefs.setCoverArtMode("cover")}
            >Cover</button
          >
          <button
            class="pill-btn"
            class:active={conversionPrefs.coverArtMode === "waveform"}
            onclick={() => conversionPrefs.setCoverArtMode("waveform")}
            >Waveform</button
          >
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Output" icon="folder">
    <SettingsRow
      label="Default Output Folder"
      hint="Where conversions are saved"
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn blue"
            title={conversionPrefs.outputDir || "Same folder as the original"}
            onclick={pickOutputDir}
          >
            {shortFolderPath(conversionPrefs.outputDir)}
          </button>
          {#if conversionPrefs.outputDir}
            <button
              class="settings-action-btn"
              title="Use the source folder"
              onclick={() => conversionPrefs.setOutputDir("")}>Clear</button
            >
          {/if}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Open Output Folder"
      hint="Reveal the folder after a conversion finishes"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={conversionPrefs.openOutputFolder}
            onchange={(e) =>
              conversionPrefs.setOpenOutputFolder(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={conversionPrefs.openOutputFolder}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Auto-open Conversions"
      hint="Open the converted file in the viewer"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={conversionPrefs.autoOpenConverted}
            onchange={(e) =>
              conversionPrefs.setAutoOpenConverted(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={conversionPrefs.autoOpenConverted}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Overwrite Existing"
      hint="Replace same-name outputs instead of adding (1), (2)…"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={conversionPrefs.overwriteExisting}
            onchange={(e) =>
              conversionPrefs.setOverwriteExisting(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={conversionPrefs.overwriteExisting}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Delete Original After Conversion"
      hint="Moves the source to the recycle bin once the output is written"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={conversionPrefs.deleteOriginal}
            onchange={(e) =>
              conversionPrefs.setDeleteOriginal(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={conversionPrefs.deleteOriginal}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Compatibility & Diagnostics" icon="cpu">
    <SettingsRow
      label="Preserve Metadata"
      hint="Keep tags and chapters through conversion"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={conversionPrefs.preserveMetadata}
            onchange={(e) =>
              conversionPrefs.setPreserveMetadata(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={conversionPrefs.preserveMetadata}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Keep Original File Date"
      hint="Apply the source modified date to converted files"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={conversionPrefs.keepOriginalDate}
            onchange={(e) =>
              conversionPrefs.setKeepOriginalDate(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={conversionPrefs.keepOriginalDate}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="GPU Encoding"
      hint={!ffmpegLoading && ffmpegInfo && detectedEncoders.length === 0
        ? "No hardware H.264 encoder detected"
        : "Use hardware H.264 when available"}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={conversionPrefs.gpuEncoding}
            disabled={!conversionPrefs.gpuEncoding &&
              !ffmpegLoading &&
              ffmpegInfo !== null &&
              detectedEncoders.length === 0}
            onchange={(e) =>
              conversionPrefs.setGpuEncoding(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={conversionPrefs.gpuEncoding}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    {#if conversionPrefs.gpuEncoding && detectedEncoders.length > 0}
      <div
        class="settings-row settings-subrow"
        transition:slide={{ duration: appearance.reducedMotion ? 0 : 160 }}
      >
        <div class="settings-label-col">
          <div class="settings-label-text">
            <span class="settings-label">Hardware Encoder</span>
            <span class="settings-hint">Which detected encoder to prefer</span>
          </div>
        </div>
        <div class="settings-control">
          <div class="pill-group pill-group-4">
            <button
              class="pill-btn"
              class:active={conversionPrefs.hardwareEncoder === "auto" ||
                !detectedEncoders.includes(conversionPrefs.hardwareEncoder)}
              onclick={() => conversionPrefs.setHardwareEncoder("auto")}
              >Auto</button
            >
            {#each detectedEncoders as encoder}
              <button
                class="pill-btn"
                class:active={conversionPrefs.hardwareEncoder === encoder}
                onclick={() =>
                  conversionPrefs.setHardwareEncoder(
                    encoder as HardwareEncoder,
                  )}>{encoderLabel(encoder)}</button
              >
            {/each}
          </div>
        </div>
      </div>
    {/if}

    <SettingsRow label="FFmpeg" hint={ffmpegStatus()}>
      {#snippet control()}
        <button
          class="settings-action-btn"
          title={ffmpegInfo?.ffmpegPath || "FFmpeg path unavailable"}
          onclick={loadFfmpegInfo}
          disabled={ffmpegLoading}>Check</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
