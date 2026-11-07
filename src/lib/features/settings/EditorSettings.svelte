<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { conversionPrefs } from "$lib/features/media/conversionPrefs.svelte";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
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
    "settings.editor.quality.fast",
    "settings.editor.quality.balanced",
    "settings.editor.quality.quality",
    "settings.editor.quality.lossless",
  ];

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
    return t(exportQualityLabels[index] ?? "settings.editor.quality.balanced");
  }

  function shortFolderPath(path: string): string {
    if (!path) return t("settings.editor.sourceFolder");
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
    conversionPrefs.setKeepOriginalDate(enabled);
  }

  async function handlePickBackupDir() {
    const dir = await open({
      directory: true,
      defaultPath: editing.backupDir || undefined,
    });
    if (dir) editing.setBackupDir(dir as string);
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
    {t("settings.sections.editor")}
  </p>

  <SettingsGroup label={t("settings.editor.group.safety")} icon="pencil">
    <SettingsRow
      label={t("settings.editor.rememberEdits.label")}
      hint={t("settings.editor.rememberEdits.hint")}
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
      label={t("settings.editor.confirmApply.label")}
      hint={t("settings.editor.confirmApply.hint")}
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
    <SettingsRow
      label={t("settings.editor.confirmClose.label")}
      hint={t("settings.editor.confirmClose.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.confirmCloseWhileEditing}
            onchange={(e) =>
              systemPrefs.setConfirmCloseWhileEditing(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={systemPrefs.confirmCloseWhileEditing}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
    <SettingsRow
      label={t("settings.editor.backup.label")}
      hint={t("settings.editor.backup.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          <button
            class="pill-btn"
            class:active={editing.backupMode === "off"}
            onclick={() => editing.setBackupMode("off")}
            >{t("settings.editor.backup.off")}</button
          >
          <button
            class="pill-btn"
            class:active={editing.backupMode === "ask"}
            onclick={() => editing.setBackupMode("ask")}
            >{t("settings.editor.backup.ask")}</button
          >
          <button
            class="pill-btn"
            class:active={editing.backupMode === "always"}
            onclick={() => editing.setBackupMode("always")}
            >{t("settings.editor.backup.always")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    {#if editing.backupMode !== "off" || settingsSearchState.active}
      <SettingsRow
        label={t("settings.editor.backup.folder.label")}
        hint={t("settings.editor.backup.folder.hint")}
        subrow
      >
        {#snippet control()}
          <div class="settings-control-inline">
            <button
              class="settings-action-btn blue"
              title={editing.backupDir || t("settings.editor.backup.appData")}
              onclick={handlePickBackupDir}
            >
              {editing.backupDir
                ? shortFolderPath(editing.backupDir)
                : t("settings.editor.backup.appData")}
            </button>
            {#if editing.backupDir}
              <button
                class="settings-action-btn"
                title={t("settings.editor.backup.useDefault")}
                onclick={() => editing.setBackupDir("")}
                >{t("settings.editor.clear")}</button
              >
            {/if}
          </div>
        {/snippet}
      </SettingsRow>
    {/if}
  </SettingsGroup>

  <SettingsGroup label={t("settings.editor.group.exportDefaults")} icon="image">
    <SettingsRow
      label={t("settings.editor.imageFormat.label")}
      hint={editing.imageFormat === "original"
        ? t("settings.editor.imageFormat.hint.original")
        : editing.imageFormat === "png"
          ? t("settings.editor.imageFormat.hint.png")
          : editing.imageFormat === "jpg"
            ? t("settings.editor.imageFormat.hint.jpg")
            : t("settings.editor.imageFormat.hint.webp")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          <button
            class="pill-btn"
            class:active={editing.imageFormat === "original"}
            onclick={() => editing.setImageFormat("original")}
            >{t("settings.editor.imageFormat.original")}</button
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
      label={t("settings.editor.imageQuality.label")}
      hint={editing.imageFormat === "png"
        ? t("settings.editor.imageQuality.hint.png")
        : editing.imageFormat === "jpg"
          ? t("settings.editor.imageQuality.hint.jpg")
          : editing.imageFormat === "webp"
            ? t("settings.editor.imageQuality.hint.webp")
            : t("settings.editor.imageQuality.hint.original")}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="60"
            max={editing.imageQualityMax}
            step="1"
            aria-label={t("settings.editor.imageQuality.aria")}
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
      label={t("settings.editor.imageOutput.label")}
      hint={t("settings.editor.imageOutput.hint")}
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn blue"
            title={editing.imageOutputDir ||
              t("settings.editor.sameAsOriginal")}
            onclick={() => pickOutputDir("image")}
          >
            {shortFolderPath(editing.imageOutputDir)}
          </button>
          {#if editing.imageOutputDir}
            <button
              class="settings-action-btn"
              title={t("settings.editor.useSourceFolder")}
              onclick={() => clearOutputDir("image")}
              >{t("settings.editor.clear")}</button
            >
          {/if}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.editor.videoFormat.label")}
      hint={editing.videoFormat === "original"
        ? t("settings.editor.videoFormat.hint.original")
        : t("settings.editor.videoFormat.hint.other")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          <button
            class="pill-btn"
            class:active={editing.videoFormat === "original"}
            onclick={() => editing.setVideoFormat("original")}
            >{t("settings.editor.videoFormat.original")}</button
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
      label={t("settings.editor.videoQuality.label")}
      hint={t("settings.editor.videoQuality.hint")}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="0"
            max="3"
            step="1"
            aria-label={t("settings.editor.videoQuality.aria")}
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
      label={t("settings.editor.videoOutput.label")}
      hint={t("settings.editor.videoOutput.hint")}
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn blue"
            title={editing.videoOutputDir ||
              t("settings.editor.sameAsOriginal")}
            onclick={() => pickOutputDir("video")}
          >
            {shortFolderPath(editing.videoOutputDir)}
          </button>
          {#if editing.videoOutputDir}
            <button
              class="settings-action-btn"
              title={t("settings.editor.useSourceFolder")}
              onclick={() => clearOutputDir("video")}
              >{t("settings.editor.clear")}</button
            >
          {/if}
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label={t("settings.editor.group.behavior")} icon="refresh">
    <SettingsRow
      label={t("settings.editor.autoOpen.label")}
      hint={t("settings.editor.autoOpen.hint")}
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
      label={t("settings.editor.keepDate.label")}
      hint={t("settings.editor.keepDate.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={editing.keepImageOriginalDate &&
              editing.keepVideoOriginalDate &&
              conversionPrefs.keepOriginalDate}
            onchange={(e) => setKeepOriginalDate(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={editing.keepImageOriginalDate &&
              editing.keepVideoOriginalDate &&
              conversionPrefs.keepOriginalDate}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
