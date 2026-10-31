<script lang="ts">
  import { conversionPrefs } from "$lib/features/media/conversionPrefs.svelte";
  import DangerSettings from "$lib/features/danger/DangerSettings.svelte";
  import DebugSettings from "$lib/features/debug/DebugSettings.svelte";
  import type { DebugFileInfo } from "$lib/features/debug/debugTypes";
  import AppearanceSettings from "$lib/features/settings/AppearanceSettings.svelte";
  import PlaybackSettings from "$lib/features/settings/PlaybackSettings.svelte";
  import EditorSettings from "$lib/features/settings/EditorSettings.svelte";
  import ProcessSettings from "$lib/features/settings/ProcessSettings.svelte";
  import LibrarySettings from "$lib/features/settings/LibrarySettings.svelte";
  import SystemSettings from "$lib/features/system/SystemSettings.svelte";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
  import KeybindsSettings from "$lib/features/keybinds/KeybindsSettings.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { theme as themeStore } from "$lib/features/theme/theme.svelte";
  import { font as fontStore } from "$lib/features/theme/font.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { loopModeStore } from "$lib/features/media/loopMode.svelte";
  import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
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

  let activeSection = $state(loadLastDialogSection("settings") || "appearance");
  let contentEl = $state<HTMLDivElement | null>(null);
  let flashId = $state<string | null>(null);
  let isScrolling = $state(false);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let flashTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    saveLastDialogSection("settings", activeSection);
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

  const sections = [
    { id: "appearance", label: "Appearance" },
    { id: "playback", label: "Playback" },
    { id: "editor", label: "Editor" },
    { id: "process", label: "Conversion" },
    { id: "library", label: "Library" },
    { id: "system", label: "System" },
    { id: "keybinds", label: "Keybinds" },
    { id: "debug", label: "Debug" },
    { id: "danger-zone", label: "Danger Zone" },
  ];

  const sectionDescriptions: Record<string, string> = {
    appearance: "Theme, typography and viewer presentation.",
    playback: "Resume, audio, speed and end-of-file behavior.",
    editor: "Editing safety and image/video export defaults.",
    process: "Quality, output and hardware for conversions.",
    library: "Layout, content, history and privacy.",
    system: "Window, startup, storage and updates.",
    keybinds: "View and customize keyboard shortcuts.",
    debug: "Diagnostics, developer tools and maintenance.",
    "danger-zone": "Destructive actions that cannot be undone.",
  };

  function scrollToSection(id: string) {
    activeSection = id;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    if (flashTimeout) clearTimeout(flashTimeout);
    isScrolling = true;
    const el = document.getElementById(`settings-section-${id}`);
    if (el && contentEl) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      flashId = id;
      flashTimeout = setTimeout(() => {
        if (flashId === id) flashId = null;
      }, 900);
    }
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 700);
  }

  function handleScroll() {
    if (!contentEl || isScrolling) return;
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

  const autoSaveMarkers = true;

  function exportSettings() {
    const data = {
      theme: themeStore.mode,
      darkVariant: themeStore.darkVariant,
      font: fontStore.family,
      uiScale: appearance.uiScale,
      density: appearance.density,
      reducedMotion: appearance.reducedMotion,
      checkerboard: appearance.checkerboard,
      resumeMode: playbackPrefs.resumeMode,
      resumeThreshold: playbackPrefs.resumeThreshold,
      endAction: loopModeStore.loopMode,
      autoplay: playbackPrefs.autoplay,
      rememberSpeed: playbackPrefs.rememberSpeed,
      rememberVolume: playbackPrefs.rememberVolume,
      defaultSpeed: playbackPrefs.defaultSpeed,
      defaultVolume: playbackPrefs.defaultVolume,
      volumeBoost: playbackPrefs.volumeBoost,
      seekStep: playbackPrefs.seekStep,
      keepAudio: playbackPrefs.keepAudio,
      autoSaveMarkers,
      backupMode: editing.backupMode,
      exportQuality: editing.exportQuality,
      imageOutputDir: editing.imageOutputDir,
      videoOutputDir: editing.videoOutputDir,
      imageFormat: editing.imageFormat,
      videoFormat: editing.videoFormat,
      imageQuality: editing.imageQuality,
      keepImageOriginalDate: editing.keepImageOriginalDate,
      keepVideoOriginalDate: editing.keepVideoOriginalDate,
      autoOpenImageExport: editing.autoOpenImageExport,
      autoOpenVideoExport: editing.autoOpenVideoExport,
      rememberEdits: editing.rememberEdits,
      backupDir: editing.backupDir,
      compareEnabled: editing.compareEnabled,
      processQuality: conversionPrefs.quality,
      processDeleteOriginal: conversionPrefs.deleteOriginal,
      processAudioBitrate: conversionPrefs.audioBitrate,
      processOverwrite: conversionPrefs.overwriteExisting,
      processGpu: conversionPrefs.gpuEncoding,
      processHardwareEncoder: conversionPrefs.hardwareEncoder,
      processAutoOpen: conversionPrefs.autoOpenConverted,
      processPreserveMetadata: conversionPrefs.preserveMetadata,
      processCoverArt: conversionPrefs.coverArtMode,
      reopenLastFile: systemPrefs.reopenLastFile,
      alwaysOnTop: systemPrefs.alwaysOnTop,
      keepAwake: systemPrefs.keepAwake,
      pauseOnFocusLoss: systemPrefs.pauseOnFocusLoss,
      batterySaverThumbnails: systemPrefs.batterySaverThumbnails,
      externalApps: systemPrefs.externalApps,
      keybinds: keybindStore.exportConfig(),
      libraryViewMode: library.viewMode,
      libraryDensity: library.density,
      libraryThumbnailSize: library.thumbnailSize,
      libraryDividers: library.dividersOn,
      libraryNames: library.namesOn,
      libraryFileFilters: library.fileFilters,
      libraryRecentFilesLimit: library.recentFilesLimit,
      libraryRecentsDisabled: library.recentsDisabled,
      libraryRecentRetentionDays: library.recentRetentionDays,
      libraryShowFolders: library.showFolders,
      libraryShowThumbnails: library.showThumbnails,
      libraryCollectionCovers: library.showCollectionCovers,
      libraryPrivacyMode: library.privacyMode,
      libraryPrivacyBlur: library.privacyBlur,
      libraryPrivacyHideNames: library.privacyHideNames,
      libraryPrivacyRevealHover: library.privacyRevealHover,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vyu-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  let profileMenuOpen = $state(false);
  let profileNameInput = $state("");
  let profiles = $state<string[]>(["Default"]);
  let activeProfile = $state("Default");
  let profileBtnEl = $state<HTMLButtonElement | null>(null);
  let profileDropdownStyle = $state("");

  function openProfileMenu() {
    if (profileBtnEl) {
      const rect = profileBtnEl.getBoundingClientRect();
      const dropdownWidth = 176;
      const left = Math.max(8, rect.left - dropdownWidth - 8);
      const bottom = window.innerHeight - rect.top + -46;
      profileDropdownStyle = `position: fixed; left: ${left}px; bottom: ${bottom}px;`;
    }
    profileMenuOpen = true;
  }

  function toggleProfileMenu() {
    if (profileMenuOpen) {
      profileMenuOpen = false;
    } else {
      openProfileMenu();
    }
  }
</script>

{#if settingsOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => {
      const target = e.target as HTMLElement;
      if (
        profileMenuOpen &&
        !target.closest(".profile-dropdown") &&
        !target.closest(".profile-btn-wrap")
      ) {
        profileMenuOpen = false;
      }
      if (e.target === e.currentTarget) closeSettings();
    }}
  >
    {#if profileMenuOpen}
      <div class="profile-dropdown" style={profileDropdownStyle}>
        <div class="profile-dropdown-header">
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle
              cx="12"
              cy="7"
              r="4"
            /></svg
          >
          <span>Select Profile</span>
        </div>
        <div class="profile-dropdown-separator"></div>
        {#each profiles as p}
          <button
            class="profile-dropdown-item"
            class:active={activeProfile === p}
            onclick={() => {
              activeProfile = p;
              profileMenuOpen = false;
            }}
          >
            {#if activeProfile === p}
              <svg
                class="profile-check"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polyline points="20 6 9 17 4 12" /></svg
              >
            {:else}
              <svg
                class="profile-check"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"><circle cx="12" cy="12" r="3" /></svg
              >
            {/if}
            {p}
          </button>
        {/each}
        <div class="profile-dropdown-separator"></div>
        <input
          class="profile-dropdown-input"
          bind:value={profileNameInput}
          placeholder="New profile name"
          onkeydown={(e) => {
            if (e.key === "Enter") {
              if (profileNameInput.trim()) {
                profiles = [...profiles, profileNameInput.trim()];
                activeProfile = profileNameInput.trim();
                profileNameInput = "";
                profileMenuOpen = false;
              }
            }
          }}
        />
        <button
          class="profile-dropdown-item save"
          onclick={() => {
            if (profileNameInput.trim()) {
              profiles = [...profiles, profileNameInput.trim()];
              activeProfile = profileNameInput.trim();
              profileNameInput = "";
              profileMenuOpen = false;
            }
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
            ><line x1="12" y1="5" x2="12" y2="19" /><line
              x1="5"
              y1="12"
              x2="19"
              y2="12"
            /></svg
          >
          Save current
        </button>
      </div>
    {/if}
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
          Settings
        </p>
        <p class="delete-subtitle">Configure your media viewer experience</p>
        <button
          class="dialog-close-x"
          onclick={closeSettings}
          aria-label="Close"
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
          bind:this={contentEl}
          onscroll={handleScroll}
        >
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
          <DangerSettings
            flash={flashId === "danger-zone"}
            {clearTimestamps}
            {clearClips}
            {clipDeleteOriginal}
            {toggleClipDeleteOriginal}
          />
        </div>
      </div>

      <div class="delete-actions">
        <div class="settings-footer-left">
          <div class="profile-btn-wrap">
            <button
              class="settings-action-btn"
              bind:this={profileBtnEl}
              onclick={toggleProfileMenu}
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
                ><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle
                  cx="12"
                  cy="7"
                  r="4"
                /></svg
              >
              Profile
            </button>
          </div>
        </div>
        <div class="settings-footer-left">
          <button class="settings-action-btn">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
                points="7 10 12 15 17 10"
              /><line x1="12" y1="15" x2="12" y2="3" /></svg
            >
            Import Settings
          </button>
          <button class="settings-action-btn" onclick={exportSettings}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
                points="7 10 12 15 17 10"
              /><line x1="12" y1="15" x2="12" y2="3" /></svg
            >
            Export Settings
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
