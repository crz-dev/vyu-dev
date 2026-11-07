<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import {
    invokeGetFfmpegInfo,
    type FfmpegInfo,
  } from "$lib/features/media/api";
  import { conversionPrefs } from "$lib/features/media/conversionPrefs.svelte";
  import { settingsSearchState } from "$lib/features/settings/settingsSearchState.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

  const exportQualityLevels = [
    "fast",
    "balanced",
    "quality",
    "lossless",
  ] as const;
  const exportQualityLabels = [
    "settings.process.quality.fast",
    "settings.process.quality.balanced",
    "settings.process.quality.quality",
    "settings.process.quality.lossless",
  ];

  let qualityPreview = $state(
    Math.max(0, exportQualityLevels.indexOf(conversionPrefs.quality)),
  );
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
    if (ffmpegLoading) return t("settings.process.status.checking");
    if (!ffmpegInfo || ffmpegInfo.ffmpegVersion === "Unavailable") {
      return t("settings.process.status.unavailable");
    }
    const version =
      ffmpegInfo.ffmpegVersion.split(/\s+/)[2]?.split("-")[0] ??
      t("settings.process.status.unknown");
    const hardware =
      ffmpegInfo.hardwareEncoders.length > 0
        ? ffmpegInfo.hardwareEncoders.map(encoderLabel).join(", ")
        : t("settings.process.status.softwareOnly");
    return `${version} · ${hardware}`;
  }

  function encoderLabel(encoder: string): string {
    return encoderLabels[encoder] ?? encoder;
  }

  function exportQualityLabel(index: number): string {
    return t(exportQualityLabels[index] ?? "settings.process.quality.balanced");
  }

  function shortFolderPath(path: string): string {
    if (!path) return t("settings.process.sourceFolder");
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
    {t("settings.sections.process")}
  </p>

  <SettingsGroup label={t("settings.process.group.quality")} icon="sliders">
    <SettingsRow
      label={t("settings.process.quality.label")}
      hint={t("settings.process.quality.hint")}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            aria-label={t("settings.process.quality.aria")}
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
  </SettingsGroup>

  <SettingsGroup label={t("settings.process.group.output")} icon="folder">
    <SettingsRow
      label={t("settings.process.output.label")}
      hint={t("settings.process.output.hint")}
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn blue"
            title={conversionPrefs.outputDir ||
              t("settings.process.sameAsOriginal")}
            onclick={pickOutputDir}
          >
            {shortFolderPath(conversionPrefs.outputDir)}
          </button>
          {#if conversionPrefs.outputDir}
            <button
              class="settings-action-btn"
              title={t("settings.process.useSourceFolder")}
              onclick={() => conversionPrefs.setOutputDir("")}
              >{t("settings.process.clear")}</button
            >
          {/if}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.process.openOutput.label")}
      hint={t("settings.process.openOutput.hint")}
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
      label={t("settings.process.autoOpen.label")}
      hint={t("settings.process.autoOpen.hint")}
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
      label={t("settings.process.overwrite.label")}
      hint={t("settings.process.overwrite.hint")}
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
      label={t("settings.process.deleteOriginal.label")}
      hint={t("settings.process.deleteOriginal.hint")}
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

  <SettingsGroup label={t("settings.process.group.advanced")} icon="cpu">
    <SettingsRow
      label={t("settings.process.coverArt.label")}
      hint={t("settings.process.coverArt.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-2">
          <button
            class="pill-btn"
            class:active={conversionPrefs.coverArtMode === "cover"}
            onclick={() => conversionPrefs.setCoverArtMode("cover")}
            >{t("settings.process.coverArt.cover")}</button
          >
          <button
            class="pill-btn"
            class:active={conversionPrefs.coverArtMode === "waveform"}
            onclick={() => conversionPrefs.setCoverArtMode("waveform")}
            >{t("settings.process.coverArt.waveform")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.process.metadata.label")}
      hint={t("settings.process.metadata.hint")}
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
      label={t("settings.process.gpu.label")}
      hint={!ffmpegLoading && ffmpegInfo && detectedEncoders.length === 0
        ? t("settings.process.gpu.hint.missing")
        : t("settings.process.gpu.hint.available")}
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

    <SettingsRow
      label={t("settings.process.ffmpeg.label")}
      hint={ffmpegStatus()}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          title={ffmpegInfo?.ffmpegPath ||
            t("settings.process.ffmpeg.pathUnavailable")}
          onclick={loadFfmpegInfo}
          disabled={ffmpegLoading}>{t("settings.process.ffmpeg.check")}</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
