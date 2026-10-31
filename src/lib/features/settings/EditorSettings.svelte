<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const exportQualityLevels = [
    "fast",
    "balanced",
    "quality",
    "lossless",
  ] as const;
  const exportQualityLabels = ["Fast", "Balanced", "Quality", "Lossless"];

  let imageQualityPreview = $state(editing.imageQuality);
  let exportQualityPreview = $state(
    Math.max(0, exportQualityLevels.indexOf(editing.exportQuality)),
  );

  $effect(() => {
    imageQualityPreview = editing.imageQuality;
  });

  $effect(() => {
    exportQualityPreview = Math.max(
      0,
      exportQualityLevels.indexOf(editing.exportQuality),
    );
  });

  function exportQualityLabel(index: number): string {
    return exportQualityLabels[index] ?? "Balanced";
  }

  function shortFolderPath(path: string): string {
    if (!path) return "Source folder";
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }

  async function pickOutputDir(kind: "image" | "video") {
    const current =
      kind === "image" ? editing.imageOutputDir : editing.videoOutputDir;
    const dir = await open({
      directory: true,
      defaultPath: current || undefined,
    });
    if (!dir) return;
    if (kind === "image") editing.setImageOutputDir(dir as string);
    else editing.setVideoOutputDir(dir as string);
  }

  function clearOutputDir(kind: "image" | "video") {
    if (kind === "image") editing.setImageOutputDir("");
    else editing.setVideoOutputDir("");
  }

  function setAutoOpenExport(enabled: boolean) {
    editing.setAutoOpenImageExport(enabled);
    editing.setAutoOpenVideoExport(enabled);
  }

  function setKeepOriginalDate(enabled: boolean) {
    editing.setKeepImageOriginalDate(enabled);
    editing.setKeepVideoOriginalDate(enabled);
  }
</script>

<div id="settings-section-editor" class="settings-section" class:flash>
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
      ><path d="M12 20h9" /><path
        d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
      /></svg
    >
    Editor
  </p>

  <SettingsGroup label="Editing Safety" icon="pencil">
    <SettingsRow
      label="Remember Unapplied Edits"
      hint="Restore pending edits after restarting"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={editing.rememberEdits}
            onchange={(e) => editing.setRememberEdits(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={editing.rememberEdits}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Compare with Original"
      hint="Hold C while editing to preview the original"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={editing.compareEnabled}
            onchange={(e) => editing.setCompareEnabled(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={editing.compareEnabled}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Confirm Before Applying"
      hint="Ask before writing edits to the file"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={editing.confirmBeforeApply}
            onchange={(e) =>
              editing.setConfirmBeforeApply(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={editing.confirmBeforeApply}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Export" icon="image">
    <SettingsRow
      label="Image Format"
      hint={editing.imageFormat === "original"
        ? "Same file format"
        : editing.imageFormat === "png"
          ? "Lossless export format"
          : editing.imageFormat === "jpg"
            ? "Smaller exports, no transparency"
            : "Good quality with transparency"}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          <button
            class="pill-btn"
            class:active={editing.imageFormat === "original"}
            onclick={() => editing.setImageFormat("original")}>Original</button
          >
          <button
            class="pill-btn"
            class:active={editing.imageFormat === "png"}
            onclick={() => editing.setImageFormat("png")}>PNG</button
          >
          <button
            class="pill-btn"
            class:active={editing.imageFormat === "jpg"}
            onclick={() => editing.setImageFormat("jpg")}>JPG</button
          >
          <button
            class="pill-btn"
            class:active={editing.imageFormat === "webp"}
            onclick={() => editing.setImageFormat("webp")}>WebP</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Image Quality"
      hint={editing.imageFormat === "png"
        ? "PNG quality (lossless 100)"
        : editing.imageFormat === "jpg"
          ? "JPEG quality (max 95)"
          : editing.imageFormat === "webp"
            ? "WebP quality (max 100)"
            : "Quality for original format"}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="60"
            max={editing.imageQualityMax}
            step="1"
            aria-label="Image export quality"
            value={imageQualityPreview}
            disabled={editing.imageFormat === "png"}
            class:slider-locked={editing.imageFormat === "png"}
            oninput={(e) =>
              (imageQualityPreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              editing.setImageQuality(Number(e.currentTarget.value))}
          />
          <span class="settings-slider-value">{imageQualityPreview}%</span>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Image Output Folder"
      hint="Starting folder for image exports"
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn blue"
            title={editing.imageOutputDir || "Same folder as the original"}
            onclick={() => pickOutputDir("image")}
          >
            {shortFolderPath(editing.imageOutputDir)}
          </button>
          {#if editing.imageOutputDir}
            <button
              class="settings-action-btn"
              title="Use the source folder"
              onclick={() => clearOutputDir("image")}>Clear</button
            >
          {/if}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Video Format"
      hint={editing.videoFormat === "original"
        ? "Same file format"
        : "Format used when exporting edited videos"}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          <button
            class="pill-btn"
            class:active={editing.videoFormat === "original"}
            onclick={() => editing.setVideoFormat("original")}>Original</button
          >
          <button
            class="pill-btn"
            class:active={editing.videoFormat === "mp4"}
            onclick={() => editing.setVideoFormat("mp4")}>MP4</button
          >
          <button
            class="pill-btn"
            class:active={editing.videoFormat === "webm"}
            onclick={() => editing.setVideoFormat("webm")}>WebM</button
          >
          <button
            class="pill-btn"
            class:active={editing.videoFormat === "mkv"}
            onclick={() => editing.setVideoFormat("mkv")}>MKV</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Video Quality"
      hint="Quality preset for edited video exports"
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            aria-label="Video export quality"
            aria-valuetext={exportQualityLabel(exportQualityPreview)}
            value={exportQualityPreview}
            oninput={(e) =>
              (exportQualityPreview = Number(e.currentTarget.value))}
            onchange={(e) => {
              const level = exportQualityLevels[Number(e.currentTarget.value)];
              if (level) editing.setExportQuality(level);
            }}
          />
          <span class="settings-slider-value" style="min-width: 62px"
            >{exportQualityLabel(exportQualityPreview)}</span
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Video Output Folder"
      hint="Starting folder for video exports"
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn blue"
            title={editing.videoOutputDir || "Same folder as the original"}
            onclick={() => pickOutputDir("video")}
          >
            {shortFolderPath(editing.videoOutputDir)}
          </button>
          {#if editing.videoOutputDir}
            <button
              class="settings-action-btn"
              title="Use the source folder"
              onclick={() => clearOutputDir("video")}>Clear</button
            >
          {/if}
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Export Behavior" icon="refresh">
    <SettingsRow
      label="Auto-open Exports"
      hint="Open finished images and videos in the viewer"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={editing.autoOpenImageExport && editing.autoOpenVideoExport}
            onchange={(e) => setAutoOpenExport(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={editing.autoOpenImageExport &&
              editing.autoOpenVideoExport}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Keep Original File Date"
      hint="Restore the modified date after in-place edits"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={editing.keepImageOriginalDate &&
              editing.keepVideoOriginalDate}
            onchange={(e) => setKeepOriginalDate(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={editing.keepImageOriginalDate &&
              editing.keepVideoOriginalDate}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
