<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import DangerSettings from "$lib/features/danger/DangerSettings.svelte";
  import DebugSettings from "$lib/features/debug/DebugSettings.svelte";
  import type { DebugFileInfo } from "$lib/features/debug/debugTypes";
  import AppearanceSettings from "$lib/features/settings/AppearanceSettings.svelte";
  import PlaybackSettings from "$lib/features/settings/PlaybackSettings.svelte";
  import EditorSettings from "$lib/features/settings/EditorSettings.svelte";
  import ProcessSettings from "$lib/features/settings/ProcessSettings.svelte";
  import LibrarySettings from "$lib/features/settings/LibrarySettings.svelte";
  import SystemSettings from "$lib/features/system/SystemSettings.svelte";
  import KeybindsSettings from "$lib/features/keybinds/KeybindsSettings.svelte";
  import ProfileFooter from "$lib/features/profiles/ProfileFooter.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import {
    applySettingsSearchFilter,
    buildSettingsIndex,
    searchSettings,
    type SettingsSearchResult,
  } from "$lib/features/settings/settingsSearch";
  import { settingsSearchState } from "$lib/features/settings/settingsSearchState.svelte";
  import {
    loadLastDialogSection,
    saveLastDialogSection,
  } from "$lib/services/storage";

  let {
    settingsOpen,
    closeSettings,
    fileInfo = null,
    clearTimestamps,
    clearClips,
    clipDeleteOriginal,
    toggleClipDeleteOriginal,
  }: {
    settingsOpen: boolean;
    closeSettings: () => void;
    fileInfo?: DebugFileInfo | null;
    clearTimestamps: () => void;
    clearClips: () => void;
    clipDeleteOriginal: boolean;
    toggleClipDeleteOriginal: () => void;
  } = $props();

  const t = locale.t;

  let activeSection = $state(
    appearance.rememberLastTab
      ? loadLastDialogSection("settings") || "appearance"
      : "appearance",
  );
  let contentEl = $state<HTMLDivElement | null>(null);
  let flashId = $state<string | null>(null);
  let isScrolling = $state(false);
  let searchQuery = $state("");
  let searchResults = $state<SettingsSearchResult[]>([]);
  let searchScrollTop = 0;
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let flashTimeout: ReturnType<typeof setTimeout> | null = null;

  onDestroy(() => {
    settingsSearchState.active = false;
  });

  $effect(() => {
    if (appearance.rememberLastTab) {
      saveLastDialogSection("settings", activeSection);
    }
  });

  $effect(() => {
    if (settingsOpen) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`settings-section-${activeSection}`);
        if (el) {
          el.scrollIntoView({ block: "start" });
        }
      });
    }
  });

  const sections = $derived(
    [
      { id: "appearance", label: t("settings.sections.appearance") },
      { id: "playback", label: t("settings.sections.playback") },
      { id: "editor", label: t("settings.sections.editor") },
      { id: "process", label: t("settings.sections.process") },
      { id: "library", label: t("settings.sections.library") },
      { id: "system", label: t("settings.sections.system") },
      { id: "keybinds", label: t("settings.sections.keybinds") },
      { id: "debug", label: t("settings.sections.debug") },
      { id: "danger-zone", label: t("settings.sections.danger") },
    ].filter(
      (section) => !(section.id === "danger-zone" && appearance.hideDangerZone),
    ),
  );

  const sectionDescriptions = $derived<Record<string, string>>({
    appearance: t("settings.sections.appearance.desc"),
    playback: t("settings.sections.playback.desc"),
    editor: t("settings.sections.editor.desc"),
    process: t("settings.sections.process.desc"),
    library: t("settings.sections.library.desc"),
    system: t("settings.sections.system.desc"),
    keybinds: t("settings.sections.keybinds.desc"),
    debug: t("settings.sections.debug.desc"),
    "danger-zone": t("settings.sections.danger.desc"),
  });

  const searchActive = $derived(searchQuery.trim() !== "");

  const searchSections = $derived(
    sections.map((section) => ({
      id: section.id,
      label: section.label,
      description: sectionDescriptions[section.id],
    })),
  );

  $effect(() => {
    if (!sections.some((section) => section.id === activeSection)) {
      activeSection = sections[0]?.id ?? "appearance";
    }
  });

  $effect(() => {
    const query = searchQuery.trim();
    if (!contentEl) return;
    const root = contentEl;
    if (!query) {
      searchResults = [];
      applySettingsSearchFilter(root, [], false);
      return;
    }
    const runSearch = () => {
      const results = searchSettings(
        buildSettingsIndex(root, searchSections),
        query,
      );
      searchResults = results;
      applySettingsSearchFilter(root, results);
    };
    runSearch();

    const observer = new MutationObserver(runSearch);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  });

  function flashSection(id: string) {
    if (flashTimeout) clearTimeout(flashTimeout);
    flashId = id;
    flashTimeout = setTimeout(() => {
      if (flashId === id) flashId = null;
    }, 900);
  }

  function setSearchQuery(value: string) {
    const wasActive = searchActive;
    if (!wasActive && value.trim() && contentEl) {
      searchScrollTop = contentEl.scrollTop;
    }
    searchQuery = value;
    settingsSearchState.active = value.trim() !== "";
    if (!value.trim()) {
      if (wasActive && contentEl) {
        applySettingsSearchFilter(contentEl, [], false);
        void tick().then(() => {
          if (!searchActive && contentEl) contentEl.scrollTop = searchScrollTop;
        });
      }
      return;
    }
    if (contentEl) contentEl.scrollTop = 0;
  }

  async function clearSearch() {
    searchQuery = "";
    settingsSearchState.active = false;
    if (contentEl) applySettingsSearchFilter(contentEl, [], false);
    await tick();
    if (contentEl) contentEl.scrollTop = searchScrollTop;
  }

  async function scrollToSection(id: string) {
    if (searchActive) {
      searchQuery = "";
      settingsSearchState.active = false;
      if (contentEl) applySettingsSearchFilter(contentEl, [], false);
      await tick();
    }
    activeSection = id;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    if (flashTimeout) clearTimeout(flashTimeout);
    isScrolling = true;
    const el = document.getElementById(`settings-section-${id}`);
    if (el && contentEl) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      flashSection(id);
    }
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 700);
  }

  function handleScroll() {
    if (!contentEl || isScrolling || searchActive) return;
    const nearBottom =
      contentEl.scrollTop + contentEl.clientHeight >=
      contentEl.scrollHeight - 8;
    if (nearBottom) {
      activeSection = sections[sections.length - 1].id;
      return;
    }
    const containerRect = contentEl.getBoundingClientRect();
    const threshold = containerRect.top + contentEl.clientHeight * 0.35;
    let current = sections[0].id;
    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(`settings-section-${sections[i].id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold) {
          current = sections[i].id;
          break;
        }
      }
    }
    activeSection = current;
  }
</script>

{#if settingsOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeSettings();
    }}
  >
    <div class="delete-dialog settings-dialog" role="dialog" aria-modal="true">
      <div class="settings-header-bar">
        <p class="delete-title">
          <svg
            class="header-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="12" cy="12" r="3" /><path
              d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
            /></svg
          >
          {t("settings.dialog.title")}
        </p>
        <p class="delete-subtitle">{t("settings.dialog.subtitle")}</p>
        <div class="settings-search-field">
          <svg
            class="settings-search-icon"
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="11" cy="11" r="8" /><line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            /></svg
          >
          <input
            class="settings-search-input"
            type="search"
            placeholder={t("settings.dialog.search.placeholder")}
            aria-label={t("settings.dialog.search.aria")}
            value={searchQuery}
            oninput={(e) => setSearchQuery(e.currentTarget.value)}
            onkeydown={(e) => {
              if (e.key === "Escape" && searchActive) {
                e.preventDefault();
                e.stopPropagation();
                void clearSearch();
              }
            }}
          />
          {#if searchActive}
            <button
              class="settings-search-clear"
              type="button"
              aria-label={t("settings.dialog.search.clear")}
              onclick={() => void clearSearch()}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
              >
            </button>
          {/if}
        </div>
        <button
          class="dialog-close-x"
          onclick={closeSettings}
          aria-label={t("settings.dialog.close")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
          >
        </button>
      </div>

      <div class="settings-layout">
        <nav class="settings-nav">
          {#each sections as sec}
            <button
              class="settings-nav-item"
              class:active={activeSection === sec.id}
              data-section={sec.id}
              onclick={() => scrollToSection(sec.id)}
            >
              {#if sec.id === "appearance"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="12" cy="12" r="5" /><path
                    d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  /></svg
                >
              {:else if sec.id === "playback"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="5 3 19 12 5 21 5 3" /></svg
                >
              {:else if sec.id === "editor"}
                <svg
                  width="14"
                  height="14"
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
              {:else if sec.id === "process"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                  /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path
                    d="M9 15l3 3 3-3"
                  /></svg
                >
              {:else if sec.id === "library"}
                <svg
                  width="14"
                  height="14"
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
              {:else if sec.id === "system"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect
                    x="2"
                    y="3"
                    width="20"
                    height="14"
                    rx="2"
                    ry="2"
                  /><line x1="8" y1="21" x2="16" y2="21" /><line
                    x1="12"
                    y1="17"
                    x2="12"
                    y2="21"
                  /></svg
                >
              {:else if sec.id === "keybinds"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect
                    x="2"
                    y="4"
                    width="20"
                    height="16"
                    rx="2"
                    ry="2"
                  /><path
                    d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"
                  /></svg
                >
              {:else if sec.id === "debug"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M12 2L2 7l10 5 10-5-10-5z" /><path
                    d="M2 17l10 5 10-5"
                  /><path d="M2 12l10 5 10-5" /></svg
                >
              {:else if sec.id === "danger-zone"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  /><line x1="12" y1="9" x2="12" y2="13" /><line
                    x1="12"
                    y1="17"
                    x2="12.01"
                    y2="17"
                  /></svg
                >
              {/if}
              {sec.label}
            </button>
          {/each}
          <div class="settings-nav-spacer"></div>
          <div class="settings-nav-description">
            {#key activeSection}
              <p class="settings-nav-description-text">
                {sectionDescriptions[activeSection] ?? ""}
              </p>
            {/key}
          </div>
        </nav>

        <div
          class="settings-content"
          class:searching={searchActive}
          bind:this={contentEl}
          onscroll={handleScroll}
        >
          {#if searchActive && searchResults.length === 0}
            <div class="settings-search-empty">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="11" cy="11" r="8" /><line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                /></svg
              >
              <p class="settings-search-empty-title">
                {t("settings.dialog.empty.title")}
              </p>
              <p class="settings-search-empty-hint">
                {t("settings.dialog.empty.hint")}
              </p>
            </div>
          {/if}

          <AppearanceSettings flash={flashId === "appearance"} />
          <PlaybackSettings flash={flashId === "playback"} />
          <EditorSettings flash={flashId === "editor"} />
          <ProcessSettings flash={flashId === "process"} />
          <LibrarySettings flash={flashId === "library"} />

          <!-- System -->
          <SystemSettings flash={flashId === "system"} />

          <!-- Keybinds -->
          <KeybindsSettings flash={flashId === "keybinds"} />

          <!-- Debug -->
          <DebugSettings flash={flashId === "debug"} {fileInfo} />

          <!-- Danger Zone -->
          {#if !appearance.hideDangerZone}
            <DangerSettings
              flash={flashId === "danger-zone"}
              {clearTimestamps}
              {clearClips}
              {clipDeleteOriginal}
              {toggleClipDeleteOriginal}
            />
          {/if}
        </div>
      </div>

      <div class="delete-actions">
        <ProfileFooter />
      </div>
    </div>
  </div>
{/if}
