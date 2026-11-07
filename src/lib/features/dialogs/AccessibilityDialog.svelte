<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import VisionSettings from "$lib/features/accessibility/VisionSettings.svelte";
  import HearingSettings from "$lib/features/accessibility/HearingSettings.svelte";
  import MotorSettings from "$lib/features/accessibility/MotorSettings.svelte";
  import CognitiveSettings from "$lib/features/accessibility/CognitiveSettings.svelte";
  import AppSettings from "$lib/features/accessibility/AppSettings.svelte";
  import ProfileSettings from "$lib/features/profiles/ProfileSettings.svelte";
  import ProfileFooter from "$lib/features/profiles/ProfileFooter.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
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
  import { locale } from "$lib/features/i18n/locale.svelte";

  let {
    accessibilityOpen,
    closeAccessibility,
  }: {
    accessibilityOpen: boolean;
    closeAccessibility: () => void;
  } = $props();

  const t = locale.t;

  let activeSection = $state(
    appearance.rememberLastTab
      ? loadLastDialogSection("accessibility") || "vision"
      : "vision",
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
      saveLastDialogSection("accessibility", activeSection);
    }
  });

  $effect(() => {
    if (accessibilityOpen) {
      requestAnimationFrame(() => {
        const el = document.getElementById(
          `accessibility-section-${activeSection}`,
        );
        if (el) {
          el.scrollIntoView({ block: "start" });
        }
      });
    }
  });

  const sections = $derived([
    { id: "vision", label: t("dialogs.accessibility.sections.vision") },
    { id: "hearing", label: t("dialogs.accessibility.sections.hearing") },
    { id: "motor", label: t("dialogs.accessibility.sections.motor") },
    {
      id: "cognitive",
      label: t("dialogs.accessibility.sections.cognitive"),
    },
    { id: "profiles", label: t("dialogs.accessibility.sections.profiles") },
    { id: "settings", label: t("dialogs.accessibility.sections.settings") },
  ]);

  const sectionDescriptions = $derived<Record<string, string>>({
    vision: t("dialogs.accessibility.sections.vision.desc"),
    hearing: t("dialogs.accessibility.sections.hearing.desc"),
    motor: t("dialogs.accessibility.sections.motor.desc"),
    cognitive: t("dialogs.accessibility.sections.cognitive.desc"),
    profiles: t("dialogs.accessibility.sections.profiles.desc"),
    settings: t("dialogs.accessibility.sections.settings.desc"),
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
    const query = searchQuery.trim();
    if (!contentEl) return;
    const root = contentEl;
    if (!query) {
      searchResults = [];
      applySettingsSearchFilter(root, [], false, "accessibility");
      return;
    }
    const runSearch = () => {
      const results = searchSettings(
        buildSettingsIndex(root, searchSections, "accessibility"),
        query,
      );
      searchResults = results;
      applySettingsSearchFilter(root, results, true, "accessibility");
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
        applySettingsSearchFilter(contentEl, [], false, "accessibility");
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
    if (contentEl)
      applySettingsSearchFilter(contentEl, [], false, "accessibility");
    await tick();
    if (contentEl) contentEl.scrollTop = searchScrollTop;
  }

  async function scrollToSection(id: string) {
    if (searchActive) {
      searchQuery = "";
      settingsSearchState.active = false;
      if (contentEl)
        applySettingsSearchFilter(contentEl, [], false, "accessibility");
      await tick();
    }
    activeSection = id;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    if (flashTimeout) clearTimeout(flashTimeout);
    isScrolling = true;
    const el = document.getElementById(`accessibility-section-${id}`);
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
      const el = document.getElementById(
        `accessibility-section-${sections[i].id}`,
      );
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

{#if accessibilityOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeAccessibility();
    }}
  >
    <div
      class="delete-dialog accessibility-dialog"
      role="dialog"
      aria-modal="true"
    >
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
            ><circle cx="12" cy="4" r="2" /><path d="M12 6v6" /><path
              d="M8 12h8"
            /><path d="M7 22l5-10 5 10" /><path d="M3 16l4-4" /><path
              d="M21 16l-4-4"
            /></svg
          >
          {t("dialogs.accessibility.title")}
        </p>
        <p class="delete-subtitle">{t("dialogs.accessibility.subtitle")}</p>
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
            placeholder={t("dialogs.accessibility.search.placeholder")}
            aria-label={t("dialogs.accessibility.search.aria")}
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
              aria-label={t("dialogs.accessibility.search.clear")}
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
          onclick={closeAccessibility}
          aria-label={t("dialogs.accessibility.close")}
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
              {#if sec.id === "vision"}
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
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                  /><circle cx="12" cy="12" r="3" /></svg
                >
              {:else if sec.id === "hearing"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M11 5L6 9H2v6h4l5 4V5z" /><path
                    d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"
                  /></svg
                >
              {:else if sec.id === "motor"}
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
                    x="6"
                    y="4"
                    width="12"
                    height="16"
                    rx="2"
                    ry="2"
                  /><line x1="12" y1="8" x2="12" y2="8.01" /><line
                    x1="12"
                    y1="16"
                    x2="12"
                    y2="16.01"
                  /></svg
                >
              {:else if sec.id === "cognitive"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><path
                    d="M12 6v6l4 2"
                  /></svg
                >
              {:else if sec.id === "profiles"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle
                    cx="9"
                    cy="7"
                    r="4"
                  /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path
                    d="M16 3.13a4 4 0 010 7.75"
                  /></svg
                >
              {:else if sec.id === "settings"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><line x1="4" y1="21" x2="4" y2="14" /><line
                    x1="4"
                    y1="10"
                    x2="4"
                    y2="3"
                  /><line x1="12" y1="21" x2="12" y2="12" /><line
                    x1="12"
                    y1="8"
                    x2="12"
                    y2="3"
                  /><line x1="20" y1="21" x2="20" y2="16" /><line
                    x1="20"
                    y1="12"
                    x2="20"
                    y2="3"
                  /><line x1="1" y1="14" x2="7" y2="14" /><line
                    x1="9"
                    y1="8"
                    x2="15"
                    y2="8"
                  /><line x1="17" y1="16" x2="23" y2="16" /></svg
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
                {t("dialogs.accessibility.empty.title")}
              </p>
              <p class="settings-search-empty-hint">
                {t("dialogs.accessibility.empty.hint")}
              </p>
            </div>
          {/if}

          <VisionSettings flash={flashId === "vision"} />
          <HearingSettings flash={flashId === "hearing"} />
          <MotorSettings flash={flashId === "motor"} />
          <CognitiveSettings flash={flashId === "cognitive"} />
          <ProfileSettings flash={flashId === "profiles"} />
          <AppSettings flash={flashId === "settings"} />
        </div>
      </div>

      <div class="delete-actions">
        <ProfileFooter />
      </div>
    </div>
  </div>
{/if}
