<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { showToast } from "$lib/components/toast.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

  type LibraryFileKind = keyof typeof library.fileFilters;

  let densityPreview = $state(Math.round((1 - library.density) * 100));
  let privacyBlurPreview = $state(library.privacyBlur);

  const activeFileTypeCount = $derived(
    [
      library.fileFilters.images,
      library.fileFilters.videos,
      library.fileFilters.audio,
      library.fileFilters.documents,
    ].filter(Boolean).length,
  );

  $effect(() => {
    densityPreview = Math.round((1 - library.density) * 100);
  });

  $effect(() => {
    privacyBlurPreview = library.privacyBlur;
  });

  function formatThumbnailDensity(value: number): string {
    if (value >= 67) return t("settings.library.density.large");
    if (value <= 33) return t("settings.library.density.small");
    return t("settings.library.density.medium");
  }

  function isLastActiveFileType(kind: LibraryFileKind): boolean {
    return library.fileFilters[kind] && activeFileTypeCount === 1;
  }

  function clearRecents() {
    library.clearRecentFiles();
    showToast({
      message: t("settings.library.recents.cleared"),
      color: "green",
    });
  }

  const fileKinds: { kind: LibraryFileKind; labelKey: string }[] = [
    { kind: "images", labelKey: "settings.library.fileTypes.images" },
    { kind: "videos", labelKey: "settings.library.fileTypes.videos" },
    { kind: "audio", labelKey: "settings.library.fileTypes.audio" },
    { kind: "documents", labelKey: "settings.library.fileTypes.docs" },
  ];
</script>

<div id="settings-section-library" class="settings-section" class:flash>
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
      ><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path
        d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
      /></svg
    >
    {t("settings.sections.library")}
  </p>

  <SettingsGroup label={t("settings.library.group.display")} icon="layout">
    <SettingsRow
      label={t("settings.library.thumbnailSize.label")}
      hint={t("settings.library.thumbnailSize.hint")}
    >
      {#snippet control()}
        <div class="settings-control-stack">
          <div class="settings-slider-control">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              aria-label={t("settings.library.thumbnailSize.aria")}
              value={densityPreview}
              oninput={(e) => (densityPreview = Number(e.currentTarget.value))}
              onchange={(e) =>
                library.setDensity(1 - Number(e.currentTarget.value) / 100)}
            />
            <span class="settings-slider-value" style="min-width: 54px"
              >{formatThumbnailDensity(densityPreview)}</span
            >
          </div>
          <div
            class="pill-group pill-group-3"
            aria-label={t("settings.library.previewResolution.aria")}
          >
            <button
              class="pill-btn"
              class:active={library.thumbnailSize === 128}
              onclick={() => library.setThumbnailSize(128)}
              >{t("settings.library.preview.fast")}</button
            >
            <button
              class="pill-btn"
              class:active={library.thumbnailSize === 256}
              onclick={() => library.setThumbnailSize(256)}
              >{t("settings.library.preview.normal")}</button
            >
            <button
              class="pill-btn"
              class:active={library.thumbnailSize === 512}
              onclick={() => library.setThumbnailSize(512)}
              >{t("settings.library.preview.sharp")}</button
            >
          </div>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.fileTypes.label")}
      hint={t("settings.library.fileTypes.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          {#each fileKinds as item}
            <button
              class="pill-btn"
              class:active={library.fileFilters[item.kind]}
              disabled={isLastActiveFileType(item.kind)}
              aria-pressed={library.fileFilters[item.kind]}
              onclick={() =>
                library.setFileKindVisible(
                  item.kind,
                  !library.fileFilters[item.kind],
                )}>{t(item.labelKey)}</button
            >
          {/each}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.showFolders.label")}
      hint={t("settings.library.showFolders.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.showFolders}
            onchange={(e) => library.setShowFolders(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.showFolders}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.showThumbnails.label")}
      hint={t("settings.library.showThumbnails.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.showThumbnails}
            onchange={(e) => library.setShowThumbnails(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.showThumbnails}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label={t("settings.library.group.history")} icon="clock">
    <SettingsRow
      label={t("settings.library.recents.label")}
      hint={library.recentsDisabled
        ? t("settings.library.recents.hint.disabled")
        : library.privacyMode
          ? t("settings.library.recents.hint.paused")
          : t("settings.library.recents.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={!library.recentsDisabled}
            onchange={(e) =>
              library.setRecentsDisabled(!e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={!library.recentsDisabled}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.recents.limit.label")}
      hint={t("settings.library.recents.limit.hint")}
      subrow
      open={!library.recentsDisabled}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          {#each [10, 25, 50, 100] as limit}
            <button
              class="pill-btn"
              class:active={library.recentFilesLimit === limit}
              onclick={() => library.setRecentFilesLimit(limit)}>{limit}</button
            >
          {/each}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.recents.retention.label")}
      hint={t("settings.library.recents.retention.hint")}
      subrow
      open={!library.recentsDisabled}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          {#each [7, 30, 90, 0] as value}
            <button
              class="pill-btn"
              class:active={library.recentRetentionDays === value}
              onclick={() => library.setRecentRetentionDays(value)}
              >{value === 0
                ? t("settings.library.recents.retention.never")
                : `${value}d`}</button
            >
          {/each}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.recents.clear.label")}
      hint={t("settings.library.recents.clear.hint")}
    >
      {#snippet control()}
        <button class="settings-action-btn yellow" onclick={clearRecents}
          >{t("settings.library.recents.clear.button")}</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label={t("settings.library.group.privacy")} icon="shield">
    <SettingsRow
      label={t("settings.library.privacy.mode.label")}
      hint={t("settings.library.privacy.mode.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.privacyMode}
            onchange={(e) => library.setPrivacyMode(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.privacyMode}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.privacy.blur.label")}
      hint={t("settings.library.privacy.blur.hint")}
      subrow
      open={library.privacyMode}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="4"
            max="32"
            step="2"
            aria-label={t("settings.library.privacy.blur.aria")}
            value={privacyBlurPreview}
            oninput={(e) =>
              (privacyBlurPreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              library.setPrivacyBlur(Number(e.currentTarget.value))}
          />
          <span class="settings-slider-value" style="min-width: 54px"
            >{privacyBlurPreview}px</span
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.privacy.hideNames.label")}
      hint={t("settings.library.privacy.hideNames.hint")}
      subrow
      open={library.privacyMode}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.privacyHideNames}
            onchange={(e) =>
              library.setPrivacyHideNames(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.privacyHideNames}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.library.privacy.revealHover.label")}
      hint={t("settings.library.privacy.revealHover.hint")}
      subrow
      open={library.privacyMode}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.privacyRevealHover}
            onchange={(e) =>
              library.setPrivacyRevealHover(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.privacyRevealHover}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
