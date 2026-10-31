<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { showToast } from "$lib/components/toast.svelte";

  let { flash = false }: { flash?: boolean } = $props();

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
    if (value >= 67) return "Large";
    if (value <= 33) return "Small";
    return "Medium";
  }

  function isLastActiveFileType(kind: LibraryFileKind): boolean {
    return library.fileFilters[kind] && activeFileTypeCount === 1;
  }

  function clearRecents() {
    library.clearRecentFiles();
    showToast({ message: "Recent files cleared", color: "green" });
  }

  const fileKinds: { kind: LibraryFileKind; label: string }[] = [
    { kind: "images", label: "Images" },
    { kind: "videos", label: "Videos" },
    { kind: "audio", label: "Audio" },
    { kind: "documents", label: "Docs" },
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
    Library
  </p>

  <SettingsGroup label="Display" icon="layout">
    <SettingsRow
      label="Thumbnail Size"
      hint="Item size and preview resolution in library views"
    >
      {#snippet control()}
        <div class="settings-control-stack">
          <div class="settings-slider-control">
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              aria-label="Thumbnail size"
              value={densityPreview}
              oninput={(e) => (densityPreview = Number(e.currentTarget.value))}
              onchange={(e) =>
                library.setDensity(1 - Number(e.currentTarget.value) / 100)}
            />
            <span class="settings-slider-value" style="min-width: 54px"
              >{formatThumbnailDensity(densityPreview)}</span
            >
          </div>
          <div class="pill-group pill-group-3" aria-label="Preview resolution">
            <button
              class="pill-btn"
              class:active={library.thumbnailSize === 128}
              onclick={() => library.setThumbnailSize(128)}>Fast</button
            >
            <button
              class="pill-btn"
              class:active={library.thumbnailSize === 256}
              onclick={() => library.setThumbnailSize(256)}>Normal</button
            >
            <button
              class="pill-btn"
              class:active={library.thumbnailSize === 512}
              onclick={() => library.setThumbnailSize(512)}>Sharp</button
            >
          </div>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Section Dividers"
      hint="Group files by name, type, size or date"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.dividersOn}
            onchange={(e) => library.setDividersOn(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.dividersOn}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Show File Names"
      hint="Display filename labels in library views"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.namesOn}
            onchange={(e) => library.setNamesOn(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.namesOn}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Visible File Types"
      hint="At least one type stays visible"
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
                )}>{item.label}</button
            >
          {/each}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Show Folders" hint="Display folders alongside files">
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
      label="Show Thumbnails"
      hint="Generate previews in library views"
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

    <SettingsRow
      label="Show Collection Covers"
      hint={library.showThumbnails
        ? "Preview the first item in each collection"
        : "Requires Show Thumbnails"}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={library.showCollectionCovers}
            disabled={!library.showThumbnails}
            onchange={(e) =>
              library.setShowCollectionCovers(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.showCollectionCovers}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="History" icon="clock">
    <SettingsRow
      label="Record Recents"
      hint={library.recentsDisabled
        ? "Recently opened files are not recorded"
        : library.privacyMode
          ? "Paused while Privacy Mode is on"
          : "Remember recently opened files"}
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
      label="Recent Files Limit"
      hint="How many recent items to remember"
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
      label="Remove After"
      hint="Older entries drop off automatically"
      subrow
      open={!library.recentsDisabled}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          {#each [{ value: 0, label: "Never" }, { value: 7, label: "7d" }, { value: 30, label: "30d" }, { value: 90, label: "90d" }] as option}
            <button
              class="pill-btn"
              class:active={library.recentRetentionDays === option.value}
              onclick={() => library.setRecentRetentionDays(option.value)}
              >{option.label}</button
            >
          {/each}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Clear Recent Files"
      hint="Remove all items from the recent files list"
    >
      {#snippet control()}
        <button class="settings-action-btn red" onclick={clearRecents}
          >Clear</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Privacy" icon="shield">
    <SettingsRow label="Privacy Mode" hint="Blur thumbnails and pause recents">
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
      label="Blur Strength"
      hint="Higher values hide more detail"
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
            aria-label="Privacy blur strength"
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
      label="Hide File Names"
      hint="Mask filenames in library views"
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
      label="Reveal on Hover"
      hint="Show sharp thumbnails when hovering"
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
