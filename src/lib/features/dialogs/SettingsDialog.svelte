<script lang="ts">
  import { slide } from "svelte/transition";
  import { invoke } from "@tauri-apps/api/core";
  import { open } from "@tauri-apps/plugin-dialog";
  import { getVersion, getTauriVersion } from "@tauri-apps/api/app";
  import {
    invokeCleanupTempFolder,
    invokeClearBackups,
    invokeGetFfmpegInfo,
    type FfmpegInfo,
  } from "$lib/features/media/api";
  import { conversionPrefs } from "$lib/features/media/conversionPrefs.svelte";
  import { showToast } from "$lib/components/toast.svelte";
  import {
    loadLastDialogSection,
    saveLastDialogSection,
    type HardwareEncoder,
  } from "$lib/services/storage";

  let {
    settingsOpen,
    closeSettings,
  }: {
    settingsOpen: boolean;
    closeSettings: () => void;
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

  let resetConfirmTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    if (resetConfirming) {
      resetConfirmTimeout = setTimeout(() => {
        resetConfirming = false;
        resetConfirmTimeout = null;
      }, 5000);
    }
    return () => {
      if (resetConfirmTimeout) {
        clearTimeout(resetConfirmTimeout);
        resetConfirmTimeout = null;
      }
    };
  });

  const sections = [
    { id: "appearance", label: "Appearance" },
    { id: "playback", label: "Playback" },
    { id: "editor", label: "Editor" },
    { id: "process", label: "Process" },
    { id: "library", label: "Library" },
    { id: "system", label: "System" },
    { id: "keybinds", label: "Keybinds" },
    { id: "debug", label: "Debug" },
    { id: "danger-zone", label: "Danger Zone" },
  ];

  const sectionDescriptions: Record<string, string> = {
    appearance: "Customize how vyu looks and feels.",
    playback: "Control how media plays and behaves.",
    editor: "Configure editing and export preferences.",
    process: "Quality, encoding and output for conversions.",
    library: "Layout, content, history and privacy.",
    system: "System-level app behavior and updates.",
    keybinds: "View and customize keyboard shortcuts.",
    debug: "Dev tools and internal state.",
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
      hardwareAcceleration,
      minimizeToTray,
      startOnLogin,
      keybinds,
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

  import { theme as themeStore } from "$lib/features/theme/theme.svelte";
  import { font as fontStore } from "$lib/features/theme/font.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { loopModeStore } from "$lib/features/media/loopMode.svelte";
  import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
  import { sleepTimer } from "$lib/features/media/sleepTimer.svelte";

  let scalePreview = $state(Math.round(appearance.uiScale * 100));
  let thresholdPreview = $state(playbackPrefs.resumeThreshold);
  let seekPreview = $state(playbackPrefs.seekStep);
  let defaultSpeedPreview = $state(playbackPrefs.defaultSpeed);
  let defaultVolumePreview = $state(playbackPrefs.defaultVolume);
  let sleepPreview = $state(sleepTimer.minutes);
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
    scalePreview = Math.round(appearance.uiScale * 100);
  });

  $effect(() => {
    densityPreview = Math.round((1 - library.density) * 100);
  });

  $effect(() => {
    privacyBlurPreview = library.privacyBlur;
  });

  $effect(() => {
    thresholdPreview = playbackPrefs.resumeThreshold;
  });

  $effect(() => {
    seekPreview = playbackPrefs.seekStep;
  });

  $effect(() => {
    defaultSpeedPreview = playbackPrefs.defaultSpeed;
  });

  $effect(() => {
    defaultVolumePreview = playbackPrefs.defaultVolume;
  });

  $effect(() => {
    sleepPreview = sleepTimer.minutes;
  });

  function formatResumeThreshold(seconds: number): string {
    if (seconds <= 0) return "Any";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  }

  function formatSpeed(speed: number): string {
    return `${Number(speed.toFixed(2))}x`;
  }

  function formatVolume(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  function formatThumbnailDensity(value: number): string {
    if (value >= 67) return "Large";
    if (value <= 33) return "Small";
    return "Medium";
  }

  type LibraryFileKind = keyof typeof library.fileFilters;

  function isLastActiveFileType(kind: LibraryFileKind): boolean {
    return library.fileFilters[kind] && activeFileTypeCount === 1;
  }

  let autoSaveMarkers = $state(true);
  let imageQualityPreview = $state(editing.imageQuality);

  const exportQualityLevels = [
    "fast",
    "balanced",
    "quality",
    "lossless",
  ] as const;
  const exportQualityLabels = ["Fast", "Balanced", "Quality", "Lossless"];
  let exportQualityPreview = $state(
    Math.max(0, exportQualityLevels.indexOf(editing.exportQuality)),
  );
  let processQualityPreview = $state(
    Math.max(0, exportQualityLevels.indexOf(conversionPrefs.quality)),
  );
  let audioBitratePreview = $state(conversionPrefs.audioBitrate);

  $effect(() => {
    imageQualityPreview = editing.imageQuality;
  });

  $effect(() => {
    exportQualityPreview = Math.max(
      0,
      exportQualityLevels.indexOf(editing.exportQuality),
    );
  });

  $effect(() => {
    processQualityPreview = Math.max(
      0,
      exportQualityLevels.indexOf(conversionPrefs.quality),
    );
  });

  $effect(() => {
    audioBitratePreview = conversionPrefs.audioBitrate;
  });

  function exportQualityLabel(index: number): string {
    return exportQualityLabels[index] ?? "Balanced";
  }

  let hardwareAcceleration = $state(true);
  let minimizeToTray = $state(false);
  let startOnLogin = $state(false);

  let thumbnailCacheSizeText = $state("Calculating…");
  let clearingThumbnailCache = $state(false);

  $effect(() => {
    if (settingsOpen) {
      invoke<number>("get_thumbnail_cache_size")
        .then((bytes) => {
          if (bytes > 0) {
            const mb = (bytes / (1024 * 1024)).toFixed(1);
            thumbnailCacheSizeText = `${mb} MB`;
          } else {
            thumbnailCacheSizeText = "Empty";
          }
        })
        .catch(() => {
          thumbnailCacheSizeText = "Unavailable";
        });
    }
  });

  async function handleClearThumbnailCache() {
    clearingThumbnailCache = true;
    try {
      const freed = await invoke<number>("clear_thumbnail_cache");
      thumbnailCacheSizeText = "0 B";
    } catch {
      thumbnailCacheSizeText = "Error";
    }
    clearingThumbnailCache = false;
  }

  async function handleCopyAppInfo() {
    try {
      const [version, tauriVersion] = await Promise.all([
        getVersion(),
        getTauriVersion(),
      ]);
      const text = `Vyu v${version} · Tauri ${tauriVersion} · ${navigator.platform}`;
      await navigator.clipboard.writeText(text);
      showToast({ message: "App info copied", color: "green" });
    } catch {
      showToast({ message: "Failed to copy app info", color: "red" });
    }
  }

  async function handleCleanTempFolder() {
    cleaningTempFolder = true;
    try {
      await invokeCleanupTempFolder();
    } catch {
      // temp cleanup is best-effort
    }
    cleaningTempFolder = false;
  }

  async function handleOpenDevTools() {
    try {
      await invoke("open_devtools");
    } catch {
      // DevTools only available in debug builds unless devtools flag is set
    }
  }

  function handleToggleFlags() {
    flagsOpen = !flagsOpen;
  }

  function handleResetConfirm() {
    if (!resetConfirming) {
      resetConfirming = true;
      return;
    }
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("vyu-")) localStorage.removeItem(key);
    }
    window.location.reload();
  }

  let clearingBackups = $state(false);
  let clearBackupsConfirming = $state(false);

  async function handleClearBackups() {
    if (!clearBackupsConfirming) {
      clearBackupsConfirming = true;
      return;
    }
    clearBackupsConfirming = false;
    clearingBackups = true;
    try {
      const freed = await invokeClearBackups(editing.backupDir || undefined);
      editing.clearBackupState();
      showToast({
        message:
          freed > 0 ? "File backups cleared" : "No file backups to clear",
        color: freed > 0 ? "green" : "yellow",
      });
    } catch {
      showToast({ message: "Failed to clear file backups", color: "red" });
    }
    clearingBackups = false;
  }

  function shortFolderPath(path: string): string {
    if (!path) return "Source folder";
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }

  async function handlePickEditorOutputDir(kind: "image" | "video") {
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

  function handleClearEditorOutputDir(kind: "image" | "video") {
    if (kind === "image") editing.setImageOutputDir("");
    else editing.setVideoOutputDir("");
  }

  async function handlePickBackupDir() {
    const dir = await open({
      directory: true,
      defaultPath: editing.backupDir || undefined,
    });
    if (dir) editing.setBackupDir(dir as string);
  }

  function handleClearBackupDir() {
    editing.setBackupDir("");
  }

  let ffmpegInfo = $state<FfmpegInfo | null>(null);
  let ffmpegLoading = $state(false);

  const detectedEncoders = $derived(ffmpegInfo?.hardwareEncoders ?? []);

  const encoderLabels: Record<string, string> = {
    h264_nvenc: "NVIDIA",
    h264_qsv: "Intel",
    h264_amf: "AMD",
  };

  function encoderLabel(encoder: string): string {
    return encoderLabels[encoder] ?? encoder;
  }

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

  $effect(() => {
    if (settingsOpen) {
      void loadFfmpegInfo();
    }
  });

  let cleaningTempFolder = $state(false);
  let flagsOpen = $state(false);
  let resetConfirming = $state(false);

  type KeybindEntry = { action: string; key: string; id: string };
  let keybinds = $state<KeybindEntry[]>([
    { id: "fullscreen", action: "Fullscreen", key: "F" },
    { id: "play-pause", action: "Play / Pause", key: "Space" },
    { id: "next-file", action: "Next file", key: "Alt + →" },
    { id: "prev-file", action: "Previous file", key: "Alt + ←" },
    { id: "vol-up", action: "Volume up", key: "↑" },
    { id: "vol-down", action: "Volume down", key: "↓" },
    { id: "seek-fwd", action: "Seek forward", key: "→" },
    { id: "seek-bwd", action: "Seek backward", key: "←" },
    { id: "frame-back", action: "Frame step back", key: "," },
    { id: "frame-fwd", action: "Frame step forward", key: "." },
    { id: "compare", action: "Compare with original", key: "C" },
    { id: "nav-first", action: "Navigate to first", key: "Ctrl + ←" },
    { id: "nav-last", action: "Navigate to last", key: "Ctrl + →" },
    { id: "escape", action: "Close dialogs / Exit fullscreen", key: "Esc" },
  ]);

  function resetKeybindsToDefault() {
    keybinds = [
      { id: "fullscreen", action: "Fullscreen", key: "F" },
      { id: "play-pause", action: "Play / Pause", key: "Space" },
      { id: "next-file", action: "Next file", key: "Alt + →" },
      { id: "prev-file", action: "Previous file", key: "Alt + ←" },
      { id: "vol-up", action: "Volume up", key: "↑" },
      { id: "vol-down", action: "Volume down", key: "↓" },
      { id: "seek-fwd", action: "Seek forward", key: "→" },
      { id: "seek-bwd", action: "Seek backward", key: "←" },
      { id: "frame-back", action: "Frame step back", key: "," },
      { id: "frame-fwd", action: "Frame step forward", key: "." },
      { id: "compare", action: "Compare with original", key: "C" },
      { id: "nav-first", action: "Navigate to first", key: "Ctrl + ←" },
      { id: "nav-last", action: "Navigate to last", key: "Ctrl + →" },
      { id: "escape", action: "Close dialogs / Exit fullscreen", key: "Esc" },
    ];
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
          <!-- Appearance -->
          <div
            id="settings-section-appearance"
            class="settings-section"
            class:flash={flashId === "appearance"}
          >
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
                ><circle cx="12" cy="12" r="5" /><path
                  d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                /></svg
              >
              Appearance
            </p>
            <div
              class="settings-card"
              class:has-child={themeStore.resolved === "dark"}
            >
              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
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
                  <div class="settings-label-text">
                    <span class="settings-label">Theme</span>
                    <span class="settings-hint"
                      >Choose the app's appearance</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-3">
                    <button
                      class="pill-btn"
                      class:active={themeStore.mode === "dark"}
                      onclick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        themeStore.setTheme("dark", {
                          x: r.left + r.width / 2,
                          y: r.top + r.height / 2,
                        });
                      }}>Dark</button
                    >
                    <button
                      class="pill-btn"
                      class:active={themeStore.mode === "light"}
                      onclick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        themeStore.setTheme("light", {
                          x: r.left + r.width / 2,
                          y: r.top + r.height / 2,
                        });
                      }}>Light</button
                    >
                    <button
                      class="pill-btn"
                      class:active={themeStore.mode === "system"}
                      onclick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        themeStore.setTheme("system", {
                          x: r.left + r.width / 2,
                          y: r.top + r.height / 2,
                        });
                      }}>System</button
                    >
                  </div>
                </div>
              </div>
              {#if themeStore.resolved === "dark"}
                <div
                  class="settings-row settings-subrow"
                  transition:slide={{
                    duration: appearance.reducedMotion ? 0 : 160,
                  }}
                >
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><circle cx="12" cy="12" r="9" /><path
                        d="M12 3a9 9 0 000 18z"
                        fill="currentColor"
                        stroke="none"
                      /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">OLED True Black</span>
                      <span class="settings-hint"
                        >Pure black surfaces on OLED displays</span
                      >
                    </div>
                  </div>
                  <div class="settings-control">
                    <label class="toggle-row">
                      <input
                        type="checkbox"
                        checked={themeStore.darkVariant === "oled"}
                        onchange={(e) =>
                          themeStore.setDarkVariant(
                            e.currentTarget.checked ? "oled" : "standard",
                          )}
                      />
                      <span
                        class="toggle-track"
                        class:on={themeStore.darkVariant === "oled"}
                        ><span class="toggle-thumb"></span></span
                      >
                    </label>
                  </div>
                </div>
              {/if}
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="4 7 4 4 20 4 20 7" /><line
                    x1="9"
                    y1="20"
                    x2="15"
                    y2="20"
                  /><line x1="12" y1="4" x2="12" y2="20" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Font</span>
                  <span class="settings-hint">Typeface used across the app</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group pill-group-3">
                  <button
                    class="pill-btn"
                    class:active={fontStore.family === "geist"}
                    onclick={() => fontStore.setFont("geist")}>Geist</button
                  >
                  <button
                    class="pill-btn"
                    class:active={fontStore.family === "satoshi"}
                    onclick={() => fontStore.setFont("satoshi")}>Satoshi</button
                  >
                  <button
                    class="pill-btn"
                    class:active={fontStore.family === "system"}
                    onclick={() => fontStore.setFont("system")}>System</button
                  >
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path
                    d="M21 3l-7 7"
                  /><path d="M3 21l7-7" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Interface Scale</span>
                  <span class="settings-hint">Size of text and controls</span>
                </div>
              </div>
              <div class="settings-control settings-slider-control">
                <input
                  type="range"
                  min="80"
                  max="150"
                  step="5"
                  aria-label="Interface scale"
                  value={scalePreview}
                  oninput={(e) =>
                    (scalePreview = Number(e.currentTarget.value))}
                  onchange={(e) =>
                    appearance.setUiScale(Number(e.currentTarget.value) / 100)}
                />
                <span class="settings-slider-value">{scalePreview}%</span>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><line x1="3" y1="6" x2="21" y2="6" /><line
                    x1="3"
                    y1="12"
                    x2="21"
                    y2="12"
                  /><line x1="3" y1="18" x2="21" y2="18" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Density</span>
                  <span class="settings-hint"
                    >Spacing in settings, menus and lists</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group pill-group-2 pill-group-wide">
                  <button
                    class="pill-btn"
                    class:active={appearance.density === "comfortable"}
                    onclick={() => appearance.setDensity("comfortable")}
                    >Comfortable</button
                  >
                  <button
                    class="pill-btn"
                    class:active={appearance.density === "compact"}
                    onclick={() => appearance.setDensity("compact")}
                    >Compact</button
                  >
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect x="3" y="3" width="8" height="8" rx="1" /><rect
                    x="13"
                    y="13"
                    width="8"
                    height="8"
                    rx="1"
                  /><rect x="13" y="3" width="8" height="8" rx="1" /><rect
                    x="3"
                    y="13"
                    width="8"
                    height="8"
                    rx="1"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Transparency Background</span>
                  <span class="settings-hint"
                    >Show a checkerboard behind transparent images</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={appearance.checkerboard}
                    onchange={(e) =>
                      appearance.setCheckerboard(e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={appearance.checkerboard}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="12" cy="12" r="9" /><line
                    x1="10"
                    y1="9"
                    x2="10"
                    y2="15"
                  /><line x1="14" y1="9" x2="14" y2="15" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Reduced Motion</span>
                  <span class="settings-hint"
                    >Minimize animations and transitions</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={appearance.reducedMotion}
                    onchange={(e) =>
                      appearance.setReducedMotion(e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={appearance.reducedMotion}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
          </div>

          <!-- Playback -->
          <div
            id="settings-section-playback"
            class="settings-section"
            class:flash={flashId === "playback"}
          >
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
                ><polygon points="5 3 19 12 5 21 5 3" /></svg
              >
              Playback
            </p>
            <div
              class="settings-card"
              class:has-child={playbackPrefs.resumeMode !== "off"}
            >
              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Resume Playback</span>
                    <span class="settings-hint"
                      >Remember where each file stopped</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-3">
                    <button
                      class="pill-btn"
                      class:active={playbackPrefs.resumeMode === "off"}
                      onclick={() => playbackPrefs.setResumeMode("off")}
                      >Off</button
                    >
                    <button
                      class="pill-btn"
                      class:active={playbackPrefs.resumeMode === "ask"}
                      onclick={() => playbackPrefs.setResumeMode("ask")}
                      >Ask</button
                    >
                    <button
                      class="pill-btn"
                      class:active={playbackPrefs.resumeMode === "always"}
                      onclick={() => playbackPrefs.setResumeMode("always")}
                      >Always</button
                    >
                  </div>
                </div>
              </div>
              {#if playbackPrefs.resumeMode !== "off"}
                <div
                  class="settings-row settings-subrow"
                  transition:slide={{
                    duration: appearance.reducedMotion ? 0 : 160,
                  }}
                >
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><circle cx="12" cy="12" r="9" /><polyline
                        points="12 7 12 12 15 14"
                      /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Resume Threshold</span>
                      <span class="settings-hint"
                        >Only resume after this much playback</span
                      >
                    </div>
                  </div>
                  <div class="settings-control settings-slider-control">
                    <input
                      type="range"
                      min="0"
                      max="900"
                      step="30"
                      aria-label="Resume threshold"
                      value={900 - thresholdPreview}
                      oninput={(e) =>
                        (thresholdPreview =
                          900 - Number(e.currentTarget.value))}
                      onchange={(e) =>
                        playbackPrefs.setResumeThreshold(
                          900 - Number(e.currentTarget.value),
                        )}
                    />
                    <span class="settings-slider-value" style="min-width: 54px"
                      >{formatResumeThreshold(thresholdPreview)}</span
                    >
                  </div>
                </div>
              {/if}
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="12" cy="12" r="9" /><polygon
                    points="10 8 16 12 10 16 10 8"
                    fill="currentColor"
                    stroke="none"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Autoplay Media</span>
                  <span class="settings-hint"
                    >Start playing when a file opens</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={playbackPrefs.autoplay}
                    onchange={(e) =>
                      playbackPrefs.setAutoplay(e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={playbackPrefs.autoplay}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><line
                    x1="18"
                    y1="9"
                    x2="18"
                    y2="15"
                  /><line x1="15" y1="12" x2="21" y2="12" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Volume Boost</span>
                  <span class="settings-hint"
                    >Raise output up to 200%; may clip loud audio</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={playbackPrefs.volumeBoost}
                    onchange={(e) =>
                      playbackPrefs.setVolumeBoost(e.currentTarget.checked)}
                  />
                  <span
                    class="toggle-track"
                    class:on={playbackPrefs.volumeBoost}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
            <div
              class="settings-card"
              class:has-child={!playbackPrefs.rememberVolume}
            >
              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path
                      d="M15.54 8.46a5 5 0 010 7.07"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Remember Volume</span>
                    <span class="settings-hint"
                      >Restore the last volume on launch</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={playbackPrefs.rememberVolume}
                      onchange={(e) =>
                        playbackPrefs.setRememberVolume(
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={playbackPrefs.rememberVolume}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
              {#if !playbackPrefs.rememberVolume}
                <div
                  class="settings-row settings-subrow"
                  transition:slide={{
                    duration: appearance.reducedMotion ? 0 : 160,
                  }}
                >
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><polygon
                        points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                      /><path d="M15.54 8.46a5 5 0 010 7.07" /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Default Volume</span>
                      <span class="settings-hint">Volume applied at launch</span
                      >
                    </div>
                  </div>
                  <div class="settings-control settings-slider-control">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      aria-label="Default volume"
                      value={defaultVolumePreview}
                      oninput={(e) =>
                        (defaultVolumePreview = Number(e.currentTarget.value))}
                      onchange={(e) =>
                        playbackPrefs.setDefaultVolume(
                          Number(e.currentTarget.value),
                        )}
                    />
                    <span class="settings-slider-value"
                      >{formatVolume(defaultVolumePreview)}</span
                    >
                  </div>
                </div>
              {/if}
            </div>
            <div
              class="settings-card"
              class:has-child={!playbackPrefs.rememberSpeed}
            >
              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path d="M20.2 15a8 8 0 10-16.4 0" /><path
                      d="M12 13l3.2-3.2"
                    /><circle
                      cx="12"
                      cy="13"
                      r="1"
                      fill="currentColor"
                      stroke="none"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Remember Speed</span>
                    <span class="settings-hint"
                      >Keep the chosen speed across files</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={playbackPrefs.rememberSpeed}
                      onchange={(e) =>
                        playbackPrefs.setRememberSpeed(e.currentTarget.checked)}
                    />
                    <span
                      class="toggle-track"
                      class:on={playbackPrefs.rememberSpeed}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
              {#if !playbackPrefs.rememberSpeed}
                <div
                  class="settings-row settings-subrow"
                  transition:slide={{
                    duration: appearance.reducedMotion ? 0 : 160,
                  }}
                >
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><path d="M4 21v-7" /><path d="M4 10V3" /><path
                        d="M12 21v-9"
                      /><path d="M12 8V3" /><path d="M20 21v-5" /><path
                        d="M20 12V3"
                      /><line x1="1" y1="14" x2="7" y2="14" /><line
                        x1="9"
                        y1="8"
                        x2="15"
                        y2="8"
                      /><line x1="17" y1="16" x2="23" y2="16" /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Default Speed</span>
                      <span class="settings-hint"
                        >Speed applied when a file opens</span
                      >
                    </div>
                  </div>
                  <div class="settings-control settings-slider-control">
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.05"
                      aria-label="Default speed"
                      value={defaultSpeedPreview}
                      oninput={(e) =>
                        (defaultSpeedPreview = Number(e.currentTarget.value))}
                      onchange={(e) =>
                        playbackPrefs.setDefaultSpeed(
                          Number(e.currentTarget.value),
                        )}
                    />
                    <span class="settings-slider-value"
                      >{formatSpeed(defaultSpeedPreview)}</span
                    >
                  </div>
                </div>
              {/if}
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="13 19 22 12 13 5 13 19" /><polygon
                    points="2 19 11 12 2 5 2 19"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Seek Step</span>
                  <span class="settings-hint"
                    >Arrow-key seek step over video</span
                  >
                </div>
              </div>
              <div class="settings-control settings-slider-control">
                <input
                  type="range"
                  min="1"
                  max="60"
                  step="1"
                  aria-label="Seek step"
                  value={seekPreview}
                  oninput={(e) => (seekPreview = Number(e.currentTarget.value))}
                  onchange={(e) =>
                    playbackPrefs.setSeekStep(Number(e.currentTarget.value))}
                />
                <span class="settings-slider-value">{seekPreview}s</span>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="17 1 21 5 17 9" /><path
                    d="M3 11V9a4 4 0 014-4h14"
                  /><polyline points="7 23 3 19 7 15" /><path
                    d="M21 13v2a4 4 0 01-4 4H3"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">End of Playback</span>
                  <span class="settings-hint"
                    >What happens when a file ends</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group pill-group-4 pill-group-end">
                  <button
                    class="pill-btn"
                    class:active={loopModeStore.loopMode === "stop"}
                    onclick={() => loopModeStore.setMode("stop")}>Stop</button
                  >
                  <button
                    class="pill-btn"
                    class:active={loopModeStore.loopMode === "loop"}
                    onclick={() => loopModeStore.setMode("loop")}>Loop</button
                  >
                  <button
                    class="pill-btn"
                    class:active={loopModeStore.loopMode === "next"}
                    onclick={() => loopModeStore.setMode("next")}>Next</button
                  >
                  <button
                    class="pill-btn"
                    class:active={loopModeStore.loopMode === "shuffle"}
                    onclick={() => loopModeStore.setMode("shuffle")}
                    >Shuffle</button
                  >
                </div>
              </div>
            </div>
            <div class="settings-card" class:has-child={sleepTimer.active}>
              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Sleep Timer</span>
                    <span class="settings-hint"
                      >{sleepTimer.active
                        ? `Stops in ${sleepTimer.label}`
                        : "Stop playback after a set time"}</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={sleepTimer.active}
                      onchange={(e) => {
                        if (e.currentTarget.checked) {
                          sleepTimer.start(sleepPreview);
                        } else {
                          sleepTimer.clear();
                        }
                      }}
                    />
                    <span class="toggle-track" class:on={sleepTimer.active}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
              {#if sleepTimer.active}
                <div
                  class="settings-row settings-subrow"
                  transition:slide={{
                    duration: appearance.reducedMotion ? 0 : 160,
                  }}
                >
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><circle cx="12" cy="12" r="9" /><polyline
                        points="12 7 12 12 15 14"
                      /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Timer Length</span>
                      <span class="settings-hint"
                        >Stop after this many minutes</span
                      >
                    </div>
                  </div>
                  <div class="settings-control settings-slider-control">
                    <input
                      type="range"
                      min="1"
                      max="120"
                      step="1"
                      aria-label="Sleep timer length"
                      value={sleepPreview}
                      oninput={(e) =>
                        (sleepPreview = Number(e.currentTarget.value))}
                      onchange={(e) =>
                        sleepTimer.start(Number(e.currentTarget.value))}
                    />
                    <span class="settings-slider-value">{sleepPreview}m</span>
                  </div>
                </div>
              {/if}
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M3 18v-6a9 9 0 0118 0v6" /><path
                    d="M21 19a2 2 0 01-2 2h-1v-6h3z"
                  /><path d="M3 19a2 2 0 002 2h1v-6H3z" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Background Audio in Library</span
                  >
                  <span class="settings-hint"
                    >Continue audio while the Library is open</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={playbackPrefs.keepAudio}
                    onchange={(e) =>
                      playbackPrefs.setKeepAudio(e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={playbackPrefs.keepAudio}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
          </div>

          <!-- Editor -->
          <div
            id="settings-section-editor"
            class="settings-section"
            class:flash={flashId === "editor"}
          >
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

            <div
              class="settings-card"
              class:has-child={editing.backupMode !== "off"}
            >
              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    /><path
                      d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">File Backups</span>
                    <span class="settings-hint"
                      >Off, ask before applying, or always keep</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-3">
                    <button
                      class="pill-btn"
                      class:active={editing.backupMode === "off"}
                      onclick={() => editing.setBackupMode("off")}>Off</button
                    >
                    <button
                      class="pill-btn"
                      class:active={editing.backupMode === "ask"}
                      onclick={() => editing.setBackupMode("ask")}>Ask</button
                    >
                    <button
                      class="pill-btn"
                      class:active={editing.backupMode === "always"}
                      onclick={() => editing.setBackupMode("always")}
                      >Always</button
                    >
                  </div>
                </div>
              </div>
              {#if editing.backupMode !== "off"}
                <div
                  class="settings-row settings-subrow"
                  transition:slide={{
                    duration: appearance.reducedMotion ? 0 : 160,
                  }}
                >
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><path
                        d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                      /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Backup Folder</span>
                      <span class="settings-hint"
                        >Where original copies are stored</span
                      >
                    </div>
                  </div>
                  <div class="settings-control" style="gap: 6px;">
                    <button
                      class="settings-action-btn blue"
                      title={editing.backupDir || "App data backups"}
                      style="min-width: 0; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                      onclick={handlePickBackupDir}
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
                        ><path
                          d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                        /></svg
                      >
                      {editing.backupDir
                        ? shortFolderPath(editing.backupDir)
                        : "App data backups"}
                    </button>
                    {#if editing.backupDir}
                      <button
                        class="settings-action-btn"
                        title="Use the default backup folder"
                        onclick={handleClearBackupDir}>Clear</button
                      >
                    {/if}
                  </div>
                </div>
              {/if}
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
                  /><polyline points="17 21 17 13 7 13 7 21" /><polyline
                    points="7 3 7 8 15 8"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Remember Unapplied Edits</span>
                  <span class="settings-hint"
                    >Restore pending edits after restarting</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={editing.rememberEdits}
                    onchange={(e) =>
                      editing.setRememberEdits(e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={editing.rememberEdits}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
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
                <div class="settings-label-text">
                  <span class="settings-label">Compare with Original</span>
                  <span class="settings-hint"
                    >Hold C while editing to preview the original</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={editing.compareEnabled}
                    onchange={(e) =>
                      editing.setCompareEnabled(e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={editing.compareEnabled}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                  /><polyline points="9 12 11 14 15 10" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Confirm Before Applying</span>
                  <span class="settings-hint"
                    >Ask before writing edits to the file</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={editing.confirmBeforeApply}
                    onchange={(e) =>
                      editing.setConfirmBeforeApply(e.currentTarget.checked)}
                  />
                  <span
                    class="toggle-track"
                    class:on={editing.confirmBeforeApply}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>

            <div class="settings-subcard">
              <p class="settings-subcard-header">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                  /><circle cx="8.5" cy="8.5" r="1.5" /><polyline
                    points="21 15 16 10 5 21"
                  /></svg
                >
                Images
              </p>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
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
                    /><polyline points="14 2 14 8 20 8" /><circle
                      cx="10"
                      cy="13"
                      r="1.5"
                    /><polyline points="20 18 15.5 13.5 8 21" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Default Export Format</span>
                    <span class="settings-hint"
                      >{editing.imageFormat === "original"
                        ? "Same file format"
                        : editing.imageFormat === "png"
                          ? "Lossless export format"
                          : editing.imageFormat === "jpg"
                            ? "Smaller exports, no transparency"
                            : "Good quality with transparency"}</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-4">
                    <button
                      class="pill-btn"
                      class:active={editing.imageFormat === "original"}
                      onclick={() => editing.setImageFormat("original")}
                      >Original</button
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
                      onclick={() => editing.setImageFormat("webp")}
                      >WebP</button
                    >
                  </div>
                </div>
              </div>
              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path d="M4 21v-7" /><path d="M4 10V3" /><path
                      d="M12 21v-9"
                    /><path d="M12 8V3" /><path d="M20 21v-5" /><path
                      d="M20 12V3"
                    /><line x1="1" y1="14" x2="7" y2="14" /><line
                      x1="9"
                      y1="8"
                      x2="15"
                      y2="8"
                    /><line x1="17" y1="16" x2="23" y2="16" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Default Export Quality</span>
                    <span class="settings-hint"
                      >{editing.imageFormat === "png"
                        ? "PNG quality (lossless 100)"
                        : editing.imageFormat === "jpg"
                          ? "JPEG quality (max 95)"
                          : editing.imageFormat === "webp"
                            ? "WebP quality (max 100)"
                            : "Quality for original format"}</span
                    >
                  </div>
                </div>
                <div class="settings-control settings-slider-control">
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
                  <span class="settings-slider-value"
                    >{imageQualityPreview}%</span
                  >
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Default Output Folder</span>
                    <span class="settings-hint"
                      >Starting folder for exports</span
                    >
                  </div>
                </div>
                <div class="settings-control" style="gap: 6px;">
                  <button
                    class="settings-action-btn blue"
                    title={editing.imageOutputDir ||
                      "Same folder as the original"}
                    style="min-width: 0; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    onclick={() => handlePickEditorOutputDir("image")}
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
                      ><path
                        d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                      /></svg
                    >
                    {shortFolderPath(editing.imageOutputDir)}
                  </button>
                  {#if editing.imageOutputDir}
                    <button
                      class="settings-action-btn"
                      title="Use the source folder"
                      onclick={() => handleClearEditorOutputDir("image")}
                      >Clear</button
                    >
                  {/if}
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                    /><polyline points="15 3 21 3 21 9" /><line
                      x1="10"
                      y1="14"
                      x2="21"
                      y2="3"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Auto-open Exports</span>
                    <span class="settings-hint"
                      >Open the exported file in the viewer</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={editing.autoOpenImageExport}
                      onchange={(e) =>
                        editing.setAutoOpenImageExport(e.currentTarget.checked)}
                    />
                    <span
                      class="toggle-track"
                      class:on={editing.autoOpenImageExport}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="9" /><polyline
                      points="12 7 12 12 15 14"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Keep Original File Date</span>
                    <span class="settings-hint"
                      >Restore the modified date after in-place edits</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={editing.keepImageOriginalDate}
                      onchange={(e) =>
                        editing.setKeepImageOriginalDate(
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={editing.keepImageOriginalDate}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
            </div>

            <div class="settings-subcard">
              <p class="settings-subcard-header">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="23 7 16 12 23 17 23 7" /><rect
                    x="1"
                    y="5"
                    width="15"
                    height="14"
                    rx="2"
                    ry="2"
                  /></svg
                >
                Videos
              </p>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
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
                    /><polyline points="14 2 14 8 20 8" /><polygon
                      points="10 12 16 15 10 18 10 12"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Default Export Format</span>
                    <span class="settings-hint"
                      >{editing.videoFormat === "original"
                        ? "Same file format"
                        : "Format used when exporting edited videos"}</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-4">
                    <button
                      class="pill-btn"
                      class:active={editing.videoFormat === "original"}
                      onclick={() => editing.setVideoFormat("original")}
                      >Original</button
                    >
                    <button
                      class="pill-btn"
                      class:active={editing.videoFormat === "mp4"}
                      onclick={() => editing.setVideoFormat("mp4")}>MP4</button
                    >
                    <button
                      class="pill-btn"
                      class:active={editing.videoFormat === "webm"}
                      onclick={() => editing.setVideoFormat("webm")}
                      >WebM</button
                    >
                    <button
                      class="pill-btn"
                      class:active={editing.videoFormat === "mkv"}
                      onclick={() => editing.setVideoFormat("mkv")}>MKV</button
                    >
                  </div>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polygon
                      points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Default Export Quality</span>
                    <span class="settings-hint"
                      >Quality preset for edited video exports</span
                    >
                  </div>
                </div>
                <div class="settings-control settings-slider-control">
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
                      const level =
                        exportQualityLevels[Number(e.currentTarget.value)];
                      if (level) editing.setExportQuality(level);
                    }}
                  />
                  <span class="settings-slider-value" style="min-width: 62px"
                    >{exportQualityLabel(exportQualityPreview)}</span
                  >
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Default Output Folder</span>
                    <span class="settings-hint"
                      >Starting folder for exports</span
                    >
                  </div>
                </div>
                <div class="settings-control" style="gap: 6px;">
                  <button
                    class="settings-action-btn blue"
                    title={editing.videoOutputDir ||
                      "Same folder as the original"}
                    style="min-width: 0; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
                    onclick={() => handlePickEditorOutputDir("video")}
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
                      ><path
                        d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                      /></svg
                    >
                    {shortFolderPath(editing.videoOutputDir)}
                  </button>
                  {#if editing.videoOutputDir}
                    <button
                      class="settings-action-btn"
                      title="Use the source folder"
                      onclick={() => handleClearEditorOutputDir("video")}
                      >Clear</button
                    >
                  {/if}
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                    /><polyline points="15 3 21 3 21 9" /><line
                      x1="10"
                      y1="14"
                      x2="21"
                      y2="3"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Auto-open Exports</span>
                    <span class="settings-hint"
                      >Open the exported file in the viewer</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={editing.autoOpenVideoExport}
                      onchange={(e) =>
                        editing.setAutoOpenVideoExport(e.currentTarget.checked)}
                    />
                    <span
                      class="toggle-track"
                      class:on={editing.autoOpenVideoExport}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="9" /><polyline
                      points="12 7 12 12 15 14"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Keep Original File Date</span>
                    <span class="settings-hint"
                      >Restore the modified date after in-place edits</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={editing.keepVideoOriginalDate}
                      onchange={(e) =>
                        editing.setKeepVideoOriginalDate(
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={editing.keepVideoOriginalDate}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"
                    /><line x1="4" y1="22" x2="4" y2="15" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Auto-save Markers</span>
                    <span class="settings-hint"
                      >Save timestamps &amp; clips automatically</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={autoSaveMarkers}
                      onchange={(e) =>
                        (autoSaveMarkers = e.currentTarget.checked)}
                    />
                    <span class="toggle-track" class:on={autoSaveMarkers}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- Process -->
          <div
            id="settings-section-process"
            class="settings-section"
            class:flash={flashId === "process"}
          >
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
                ><path
                  d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                /><path d="M14 2v6h6" /><path d="M12 18v-6" /><path
                  d="M9 15l3 3 3-3"
                /></svg
              >
              Process
            </p>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon
                    points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Conversion Quality</span>
                  <span class="settings-hint"
                    >Speed and quality for video and image conversions</span
                  >
                </div>
              </div>
              <div class="settings-control settings-slider-control">
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="1"
                  aria-label="Conversion quality"
                  aria-valuetext={exportQualityLabel(processQualityPreview)}
                  value={processQualityPreview}
                  oninput={(e) =>
                    (processQualityPreview = Number(e.currentTarget.value))}
                  onchange={(e) => {
                    const level =
                      exportQualityLevels[Number(e.currentTarget.value)];
                    if (level) conversionPrefs.setQuality(level);
                  }}
                />
                <span class="settings-slider-value" style="min-width: 62px"
                  >{exportQualityLabel(processQualityPreview)}</span
                >
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path
                    d="M15.54 8.46a5 5 0 010 7.07"
                  /><path d="M19.07 4.93a10 10 0 010 14.14" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Audio Bitrate</span>
                  <span class="settings-hint"
                    >Bitrate for lossy audio outputs</span
                  >
                </div>
              </div>
              <div class="settings-control settings-slider-control">
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
                    conversionPrefs.setAudioBitrate(
                      Number(e.currentTarget.value),
                    )}
                />
                <span class="settings-slider-value" style="min-width: 60px"
                  >{audioBitratePreview} kbps</span
                >
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    rx="2"
                    ry="2"
                  /><circle cx="8.5" cy="8.5" r="1.5" /><polyline
                    points="21 15 16 10 5 21"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Cover Art</span>
                  <span class="settings-hint"
                    >Background for audio-to-video conversion</span
                  >
                </div>
              </div>
              <div class="settings-control">
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
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path
                    d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"
                  /><polyline points="15 3 21 3 21 9" /><line
                    x1="10"
                    y1="14"
                    x2="21"
                    y2="3"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Auto-open Conversions</span>
                  <span class="settings-hint"
                    >Open the converted file in the viewer</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={conversionPrefs.autoOpenConverted}
                    onchange={(e) =>
                      conversionPrefs.setAutoOpenConverted(
                        e.currentTarget.checked,
                      )}
                  />
                  <span
                    class="toggle-track"
                    class:on={conversionPrefs.autoOpenConverted}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
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
                  /><polyline points="14 2 14 8 20 8" /><line
                    x1="12"
                    y1="18"
                    x2="12"
                    y2="12"
                  /><line x1="9" y1="15" x2="15" y2="15" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Overwrite Existing</span>
                  <span class="settings-hint"
                    >Replace same-name outputs instead of adding (1), (2)…</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={conversionPrefs.overwriteExisting}
                    onchange={(e) =>
                      conversionPrefs.setOverwriteExisting(
                        e.currentTarget.checked,
                      )}
                  />
                  <span
                    class="toggle-track"
                    class:on={conversionPrefs.overwriteExisting}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><ellipse cx="12" cy="5" rx="9" ry="3" /><path
                    d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
                  /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Preserve Metadata</span>
                  <span class="settings-hint"
                    >Keep tags and chapters through conversion</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={conversionPrefs.preserveMetadata}
                    onchange={(e) =>
                      conversionPrefs.setPreserveMetadata(
                        e.currentTarget.checked,
                      )}
                  />
                  <span
                    class="toggle-track"
                    class:on={conversionPrefs.preserveMetadata}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="2"
                    ry="2"
                  /><rect x="9" y="9" width="6" height="6" /><line
                    x1="9"
                    y1="1"
                    x2="9"
                    y2="4"
                  /><line x1="15" y1="1" x2="15" y2="4" /><line
                    x1="9"
                    y1="20"
                    x2="9"
                    y2="23"
                  /><line x1="15" y1="20" x2="15" y2="23" /><line
                    x1="20"
                    y1="9"
                    x2="23"
                    y2="9"
                  /><line x1="20" y1="14" x2="23" y2="14" /><line
                    x1="1"
                    y1="9"
                    x2="4"
                    y2="9"
                  /><line x1="1" y1="14" x2="4" y2="14" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">GPU Encoding</span>
                  <span class="settings-hint"
                    >{!ffmpegLoading &&
                    ffmpegInfo &&
                    detectedEncoders.length === 0
                      ? "No hardware H.264 encoder detected"
                      : "Use hardware H.264 when available"}</span
                  >
                </div>
              </div>
              <div class="settings-control">
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
                  <span
                    class="toggle-track"
                    class:on={conversionPrefs.gpuEncoding}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
            {#if conversionPrefs.gpuEncoding && detectedEncoders.length > 0}
              <div
                class="settings-row settings-subrow"
                transition:slide={{
                  duration: appearance.reducedMotion ? 0 : 160,
                }}
              >
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="6" cy="19" r="3" /><path
                      d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"
                    /><circle cx="18" cy="5" r="3" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Hardware Encoder</span>
                    <span class="settings-hint"
                      >Which detected encoder to prefer</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-4">
                    <button
                      class="pill-btn"
                      class:active={conversionPrefs.hardwareEncoder ===
                        "auto" ||
                        !detectedEncoders.includes(
                          conversionPrefs.hardwareEncoder,
                        )}
                      onclick={() => conversionPrefs.setHardwareEncoder("auto")}
                      >Auto</button
                    >
                    {#each detectedEncoders as encoder}
                      <button
                        class="pill-btn"
                        class:active={conversionPrefs.hardwareEncoder ===
                          encoder}
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

            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="4 17 10 11 4 5" /><line
                    x1="12"
                    y1="19"
                    x2="20"
                    y2="19"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">FFmpeg</span>
                  <span class="settings-hint">{ffmpegStatus()}</span>
                </div>
              </div>
              <div class="settings-control">
                <button
                  class="settings-action-btn"
                  title={ffmpegInfo?.ffmpegPath || "FFmpeg path unavailable"}
                  onclick={loadFfmpegInfo}
                  disabled={ffmpegLoading}>Check</button
                >
              </div>
            </div>
          </div>

          <!-- Library -->
          <div
            id="settings-section-library"
            class="settings-section"
            class:flash={flashId === "library"}
          >
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

            <div class="settings-subcard">
              <p class="settings-subcard-header">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect x="3" y="3" width="7" height="7" /><rect
                    x="14"
                    y="3"
                    width="7"
                    height="7"
                  /><rect x="3" y="14" width="7" height="7" /><rect
                    x="14"
                    y="14"
                    width="7"
                    height="7"
                  /></svg
                >
                Layout
              </p>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect x="3" y="3" width="7" height="7" /><rect
                      x="14"
                      y="3"
                      width="7"
                      height="7"
                    /><rect x="3" y="14" width="7" height="7" /><rect
                      x="14"
                      y="14"
                      width="7"
                      height="7"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">View Mode</span>
                    <span class="settings-hint"
                      >Layout used when the library opens</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-4" style="width: 240px">
                    <button
                      class="pill-btn"
                      class:active={library.viewMode === "grid"}
                      onclick={() => library.setViewMode("grid")}>Grid</button
                    >
                    <button
                      class="pill-btn"
                      class:active={library.viewMode === "river"}
                      onclick={() => library.setViewMode("river")}>River</button
                    >
                    <button
                      class="pill-btn"
                      class:active={library.viewMode === "list"}
                      onclick={() => library.setViewMode("list")}>List</button
                    >
                    <button
                      class="pill-btn"
                      class:active={library.viewMode === "filmstrip"}
                      onclick={() => library.setViewMode("filmstrip")}
                      >Filmstrip</button
                    >
                  </div>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="15 3 21 3 21 9" /><polyline
                      points="9 21 3 21 3 15"
                    /><line x1="21" y1="3" x2="14" y2="10" /><line
                      x1="3"
                      y1="21"
                      x2="10"
                      y2="14"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Thumbnail Size</span>
                    <span class="settings-hint"
                      >Item size in grid, river, filmstrip and list views</span
                    >
                  </div>
                </div>
                <div class="settings-control settings-slider-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    aria-label="Thumbnail size"
                    value={densityPreview}
                    oninput={(e) =>
                      (densityPreview = Number(e.currentTarget.value))}
                    onchange={(e) =>
                      library.setDensity(
                        1 - Number(e.currentTarget.value) / 100,
                      )}
                  />
                  <span class="settings-slider-value" style="min-width: 54px"
                    >{formatThumbnailDensity(densityPreview)}</span
                  >
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M12 3l1.9 5.8L20 10l-5 3.6L17 20l-5-3.8L7 20l2-6.4L4 10l6.1-1.2z"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Thumbnail Quality</span>
                    <span class="settings-hint"
                      >Preview resolution; higher quality uses more memory</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <div class="pill-group pill-group-3">
                    <button
                      class="pill-btn"
                      class:active={library.thumbnailSize === 128}
                      onclick={() => library.setThumbnailSize(128)}>Fast</button
                    >
                    <button
                      class="pill-btn"
                      class:active={library.thumbnailSize === 256}
                      onclick={() => library.setThumbnailSize(256)}
                      >Normal</button
                    >
                    <button
                      class="pill-btn"
                      class:active={library.thumbnailSize === 512}
                      onclick={() => library.setThumbnailSize(512)}
                      >Sharp</button
                    >
                  </div>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><line x1="3" y1="6" x2="21" y2="6" /><line
                      x1="3"
                      y1="12"
                      x2="21"
                      y2="12"
                    /><line x1="3" y1="18" x2="21" y2="18" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Section Dividers</span>
                    <span class="settings-hint"
                      >Group files by name, type, size or date</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.dividersOn}
                      onchange={(e) =>
                        library.setDividersOn(e.currentTarget.checked)}
                    />
                    <span class="toggle-track" class:on={library.dividersOn}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="4 7 4 4 20 4 20 7" /><line
                      x1="9"
                      y1="20"
                      x2="15"
                      y2="20"
                    /><line x1="12" y1="4" x2="12" y2="20" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Show File Names</span>
                    <span class="settings-hint"
                      >Display filename labels in library views</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.namesOn}
                      onchange={(e) =>
                        library.setNamesOn(e.currentTarget.checked)}
                    />
                    <span class="toggle-track" class:on={library.namesOn}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
            </div>

            <div class="settings-subcard">
              <p class="settings-subcard-header">
                <svg
                  width="13"
                  height="13"
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
                File Types
              </p>
              <p class="settings-hint" style="margin: 0 8px 6px;">
                At least one type stays visible.
              </p>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect x="3" y="3" width="18" height="18" rx="2" /><circle
                      cx="8.5"
                      cy="8.5"
                      r="1.5"
                    /><polyline points="21 15 16 10 5 21" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Images</span>
                    <span class="settings-hint">Show image files</span>
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.fileFilters.images}
                      disabled={isLastActiveFileType("images")}
                      onchange={(e) =>
                        library.setFileKindVisible(
                          "images",
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={library.fileFilters.images}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect x="2" y="5" width="14" height="14" rx="2" /><polygon
                      points="23 7 16 12 23 17 23 7"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Videos</span>
                    <span class="settings-hint">Show video files</span>
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.fileFilters.videos}
                      disabled={isLastActiveFileType("videos")}
                      onchange={(e) =>
                        library.setFileKindVisible(
                          "videos",
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={library.fileFilters.videos}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path d="M9 18V5l12-2v13" /><circle
                      cx="6"
                      cy="18"
                      r="3"
                    /><circle cx="18" cy="16" r="3" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Audio</span>
                    <span class="settings-hint">Show audio files</span>
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.fileFilters.audio}
                      disabled={isLastActiveFileType("audio")}
                      onchange={(e) =>
                        library.setFileKindVisible(
                          "audio",
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={library.fileFilters.audio}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
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
                    /><polyline points="14 2 14 8 20 8" /><line
                      x1="16"
                      y1="13"
                      x2="8"
                      y2="13"
                    /><line x1="16" y1="17" x2="8" y2="17" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Documents</span>
                    <span class="settings-hint">Show document files</span>
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.fileFilters.documents}
                      disabled={isLastActiveFileType("documents")}
                      onchange={(e) =>
                        library.setFileKindVisible(
                          "documents",
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={library.fileFilters.documents}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
            </div>

            <div class="settings-subcard">
              <p class="settings-subcard-header">
                <svg
                  width="13"
                  height="13"
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
                Browsing
              </p>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Show Folders</span>
                    <span class="settings-hint"
                      >Display folders alongside files</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.showFolders}
                      onchange={(e) =>
                        library.setShowFolders(e.currentTarget.checked)}
                    />
                    <span class="toggle-track" class:on={library.showFolders}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect
                      x="3"
                      y="3"
                      width="18"
                      height="18"
                      rx="2"
                      ry="2"
                    /><circle cx="8.5" cy="8.5" r="1.5" /><circle
                      cx="15.5"
                      cy="8.5"
                      r="1.5"
                    /><circle cx="15.5" cy="15.5" r="1.5" /><circle
                      cx="8.5"
                      cy="15.5"
                      r="1.5"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Show Thumbnails</span>
                    <span class="settings-hint"
                      >Generate previews in library views</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.showThumbnails}
                      onchange={(e) =>
                        library.setShowThumbnails(e.currentTarget.checked)}
                    />
                    <span class="toggle-track" class:on={library.showThumbnails}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><rect x="3" y="3" width="18" height="18" rx="2" /><circle
                      cx="8.5"
                      cy="8.5"
                      r="1.5"
                    /><polyline points="21 15 16 10 5 21" /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Show Collection Covers</span>
                    <span class="settings-hint"
                      >{library.showThumbnails
                        ? "Preview the first item in each collection"
                        : "Requires Show Thumbnails"}</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.showCollectionCovers}
                      disabled={!library.showThumbnails}
                      onchange={(e) =>
                        library.setShowCollectionCovers(
                          e.currentTarget.checked,
                        )}
                    />
                    <span
                      class="toggle-track"
                      class:on={library.showCollectionCovers}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>
            </div>

            <div class="settings-subcard">
              <p class="settings-subcard-header">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="12" cy="12" r="10" /><polyline
                    points="12 6 12 12 16 14"
                  /></svg
                >
                History
              </p>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path d="M3 3v6h6" /><path
                      d="M3.5 9a9 9 0 101.7-4.6L3 9"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Record Recents</span>
                    <span class="settings-hint"
                      >{library.recentsDisabled
                        ? "Recently opened files are not recorded"
                        : library.privacyMode
                          ? "Paused while Privacy Mode is on"
                          : "Remember recently opened files"}</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={!library.recentsDisabled}
                      onchange={(e) =>
                        library.setRecentsDisabled(!e.currentTarget.checked)}
                    />
                    <span
                      class="toggle-track"
                      class:on={!library.recentsDisabled}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              {#if !library.recentsDisabled}
                <div class="settings-row settings-subrow">
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><circle cx="12" cy="12" r="10" /><polyline
                        points="12 6 12 12 16 14"
                      /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Recent Files Limit</span>
                      <span class="settings-hint"
                        >How many recent items to remember</span
                      >
                    </div>
                  </div>
                  <div class="settings-control">
                    <div class="pill-group pill-group-4">
                      <button
                        class="pill-btn"
                        class:active={library.recentFilesLimit === 10}
                        onclick={() => library.setRecentFilesLimit(10)}
                        >10</button
                      >
                      <button
                        class="pill-btn"
                        class:active={library.recentFilesLimit === 25}
                        onclick={() => library.setRecentFilesLimit(25)}
                        >25</button
                      >
                      <button
                        class="pill-btn"
                        class:active={library.recentFilesLimit === 50}
                        onclick={() => library.setRecentFilesLimit(50)}
                        >50</button
                      >
                      <button
                        class="pill-btn"
                        class:active={library.recentFilesLimit === 100}
                        onclick={() => library.setRecentFilesLimit(100)}
                        >100</button
                      >
                    </div>
                  </div>
                </div>

                <div class="settings-row settings-subrow">
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><circle cx="12" cy="12" r="9" /><polyline
                        points="12 7 12 12 15 14"
                      /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Remove After</span>
                      <span class="settings-hint"
                        >Older entries drop off automatically</span
                      >
                    </div>
                  </div>
                  <div class="settings-control">
                    <div class="pill-group pill-group-4">
                      <button
                        class="pill-btn"
                        class:active={library.recentRetentionDays === 0}
                        onclick={() => library.setRecentRetentionDays(0)}
                        >Never</button
                      >
                      <button
                        class="pill-btn"
                        class:active={library.recentRetentionDays === 7}
                        onclick={() => library.setRecentRetentionDays(7)}
                        >7d</button
                      >
                      <button
                        class="pill-btn"
                        class:active={library.recentRetentionDays === 30}
                        onclick={() => library.setRecentRetentionDays(30)}
                        >30d</button
                      >
                      <button
                        class="pill-btn"
                        class:active={library.recentRetentionDays === 90}
                        onclick={() => library.setRecentRetentionDays(90)}
                        >90d</button
                      >
                    </div>
                  </div>
                </div>
              {/if}

              <div class="settings-row settings-subrow">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="3 6 5 6 21 6" /><path
                      d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Clear Recents</span>
                    <span class="settings-hint"
                      >Remove all items from the recent files list</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <button
                    class="settings-action-btn"
                    onclick={() => {
                      library.clearRecentFiles();
                      showToast({
                        message: "Recent files cleared",
                        color: "green",
                      });
                    }}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            <div class="settings-subcard">
              <p class="settings-subcard-header">
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg
                >
                Privacy
              </p>

              <div class="settings-row">
                <div class="settings-label-col">
                  <svg
                    class="settings-row-icon"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                    /></svg
                  >
                  <div class="settings-label-text">
                    <span class="settings-label">Privacy Mode</span>
                    <span class="settings-hint"
                      >Blur thumbnails and pause recents</span
                    >
                  </div>
                </div>
                <div class="settings-control">
                  <label class="toggle-row">
                    <input
                      type="checkbox"
                      checked={library.privacyMode}
                      onchange={(e) =>
                        library.setPrivacyMode(e.currentTarget.checked)}
                    />
                    <span class="toggle-track" class:on={library.privacyMode}
                      ><span class="toggle-thumb"></span></span
                    >
                  </label>
                </div>
              </div>

              {#if library.privacyMode}
                <div class="settings-row settings-subrow">
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><circle cx="12" cy="12" r="3" /><path
                        d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                      /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Blur Strength</span>
                      <span class="settings-hint"
                        >Higher values hide more detail</span
                      >
                    </div>
                  </div>
                  <div class="settings-control settings-slider-control">
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
                </div>

                <div class="settings-row settings-subrow">
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      ><path
                        d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"
                      /><path
                        d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"
                      /><line x1="1" y1="1" x2="23" y2="23" /></svg
                    >
                    <div class="settings-label-text">
                      <span class="settings-label">Hide File Names</span>
                      <span class="settings-hint"
                        >Mask filenames in library views</span
                      >
                    </div>
                  </div>
                  <div class="settings-control">
                    <label class="toggle-row">
                      <input
                        type="checkbox"
                        checked={library.privacyHideNames}
                        onchange={(e) =>
                          library.setPrivacyHideNames(e.currentTarget.checked)}
                      />
                      <span
                        class="toggle-track"
                        class:on={library.privacyHideNames}
                        ><span class="toggle-thumb"></span></span
                      >
                    </label>
                  </div>
                </div>

                <div class="settings-row settings-subrow">
                  <div class="settings-label-col">
                    <svg
                      class="settings-row-icon"
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
                    <div class="settings-label-text">
                      <span class="settings-label">Reveal on Hover</span>
                      <span class="settings-hint"
                        >Show sharp thumbnails when hovering</span
                      >
                    </div>
                  </div>
                  <div class="settings-control">
                    <label class="toggle-row">
                      <input
                        type="checkbox"
                        checked={library.privacyRevealHover}
                        onchange={(e) =>
                          library.setPrivacyRevealHover(
                            e.currentTarget.checked,
                          )}
                      />
                      <span
                        class="toggle-track"
                        class:on={library.privacyRevealHover}
                        ><span class="toggle-thumb"></span></span
                      >
                    </label>
                  </div>
                </div>
              {/if}
            </div>
          </div>

          <!-- System -->
          <div
            id="settings-section-system"
            class="settings-section"
            class:flash={flashId === "system"}
          >
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
                ><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
                  x1="8"
                  y1="21"
                  x2="16"
                  y2="21"
                /><line x1="12" y1="17" x2="12" y2="21" /></svg
              >
              System
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect
                    x="4"
                    y="4"
                    width="16"
                    height="16"
                    rx="2"
                    ry="2"
                  /><rect x="9" y="9" width="6" height="6" /><line
                    x1="9"
                    y1="1"
                    x2="9"
                    y2="4"
                  /><line x1="15" y1="1" x2="15" y2="4" /><line
                    x1="9"
                    y1="20"
                    x2="9"
                    y2="23"
                  /><line x1="15" y1="20" x2="15" y2="23" /><line
                    x1="20"
                    y1="9"
                    x2="23"
                    y2="9"
                  /><line x1="20" y1="14" x2="23" y2="14" /><line
                    x1="1"
                    y1="9"
                    x2="4"
                    y2="9"
                  /><line x1="1" y1="14" x2="4" y2="14" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Hardware Acceleration</span>
                  <span class="settings-hint"
                    >Use GPU for decoding when available</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={hardwareAcceleration}
                    onchange={(e) =>
                      (hardwareAcceleration = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={hardwareAcceleration}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="4 14 10 14 10 20" /><polyline
                    points="20 10 14 10 14 4"
                  /><line x1="14" y1="10" x2="21" y2="3" /><line
                    x1="3"
                    y1="21"
                    x2="10"
                    y2="14"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Minimize to Tray</span>
                  <span class="settings-hint">Keep running in background</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={minimizeToTray}
                    onchange={(e) => (minimizeToTray = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={minimizeToTray}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline
                    points="10 17 15 12 10 7"
                  /><line x1="15" y1="12" x2="3" y2="12" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Start on Login</span>
                  <span class="settings-hint">Launch when system starts</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={startOnLogin}
                    onchange={(e) => (startOnLogin = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={startOnLogin}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
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
                <div class="settings-label-text">
                  <span class="settings-label">Check for Updates</span>
                  <span class="settings-hint"
                    >Verify you are on the latest version</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn yellow">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                    /><polyline points="7 10 12 15 17 10" /><line
                      x1="12"
                      y1="15"
                      x2="12"
                      y2="3"
                    /></svg
                  >
                  Check
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="3 6 5 6 21 6" /><path
                    d="M19 6l-1 14H6L5 6"
                  /><path d="M10 11v6" /><path d="M14 11v6" /><path
                    d="M9 6V4h6v2"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Clear Cache</span>
                  <span class="settings-hint"
                    >{thumbnailCacheSizeText} stored on disk</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button
                  class="settings-action-btn yellow"
                  onclick={handleClearThumbnailCache}
                  disabled={clearingThumbnailCache}
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
                    ><polyline points="3 6 5 6 21 6" /><path
                      d="M19 6l-1 14H6L5 6"
                    /><path d="M10 11v6" /><path d="M14 11v6" /><path
                      d="M9 6V4h6v2"
                    /></svg
                  >
                  {clearingThumbnailCache ? "Clearing…" : "Clear Cache"}
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="1 4 1 10 7 10" /><path
                    d="M3.51 15a9 9 0 102.13-9.36L1 10"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Reset All Settings</span>
                  <span class="settings-hint">Restore factory defaults</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn yellow">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="1 4 1 10 7 10" /><path
                      d="M3.51 15a9 9 0 102.13-9.36L1 10"
                    /></svg
                  >
                  Reset
                </button>
              </div>
            </div>
          </div>

          <!-- Keybinds -->
          <div
            id="settings-section-keybinds"
            class="settings-section"
            class:flash={flashId === "keybinds"}
          >
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
                ><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><path
                  d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"
                /></svg
              >
              Keybinds
            </p>
            {#each keybinds as kb}
              <div class="settings-row">
                <div class="settings-label-col">
                  <div class="settings-label-text">
                    <span class="settings-label">{kb.action}</span>
                  </div>
                </div>
                <div class="settings-control">
                  <button
                    class="help-kbd-btn"
                    title="Click to set custom keybind"
                    onclick={() => {}}
                  >
                    {kb.key}
                  </button>
                </div>
              </div>
            {/each}
            <div class="settings-row keybind-reset-row">
              <div class="settings-label-col">
                <div class="settings-label-text">
                  <span class="settings-hint"
                    >Restore all shortcuts to defaults</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button
                  class="settings-action-btn yellow"
                  onclick={resetKeybindsToDefault}
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
                    ><polyline points="1 4 1 10 7 10" /><path
                      d="M3.51 15a9 9 0 102.13-9.36L1 10"
                    /></svg
                  >
                  Reset to default
                </button>
              </div>
            </div>
          </div>

          <!-- Debug -->
          <div
            id="settings-section-debug"
            class="settings-section"
            class:flash={flashId === "debug"}
          >
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
                ><path d="M12 2L2 7l10 5 10-5-10-5z" /><path
                  d="M2 17l10 5 10-5"
                /><path d="M2 12l10 5 10-5" /></svg
              >
              Debug
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="12" cy="12" r="10" /><line
                    x1="12"
                    y1="16"
                    x2="12"
                    y2="12"
                  /><line x1="12" y1="8" x2="12.01" y2="8" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">App Info</span>
                  <span class="settings-hint"
                    >Version, platform, architecture</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn" onclick={handleCopyAppInfo}>
                  Copy
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
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
                  /><polyline points="14 2 14 8 20 8" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Thumbnail Cache</span>
                  <span class="settings-hint"
                    >{thumbnailCacheSizeText} stored on disk</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button
                  class="settings-action-btn"
                  onclick={handleClearThumbnailCache}
                  disabled={clearingThumbnailCache}
                >
                  {clearingThumbnailCache ? "Clearing\u2026" : "Clear"}
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="3 6 5 6 21 6" /><path
                    d="M19 6l-1 14H6L5 6"
                  /><path d="M10 11v6" /><path d="M14 11v6" /><path
                    d="M9 6V4h6v2"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Temp Folder</span>
                  <span class="settings-hint">Temporary processing files</span>
                </div>
              </div>
              <div class="settings-control">
                <button
                  class="settings-action-btn"
                  onclick={handleCleanTempFolder}
                  disabled={cleaningTempFolder}
                >
                  {cleaningTempFolder ? "Cleaning\u2026" : "Clean"}
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
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
                <div class="settings-label-text">
                  <span class="settings-label">Open Webview DevTools</span>
                  <span class="settings-hint">Inspect the app window</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn" onclick={handleOpenDevTools}
                  >Open</button
                >
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><line x1="8" y1="6" x2="21" y2="6" /><line
                    x1="8"
                    y1="12"
                    x2="21"
                    y2="12"
                  /><line x1="8" y1="18" x2="21" y2="18" /><line
                    x1="3"
                    y1="6"
                    x2="3.01"
                    y2="6"
                  /><line x1="3" y1="12" x2="3.01" y2="12" /><line
                    x1="3"
                    y1="18"
                    x2="3.01"
                    y2="18"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Toggle Flags</span>
                  <span class="settings-hint">View all localStorage keys</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn" onclick={handleToggleFlags}
                  >{flagsOpen ? "Close" : "View"}</button
                >
              </div>
            </div>
            {#if flagsOpen}
              <div class="flags-list">
                {#each Array.from( { length: localStorage.length }, (_, i) => localStorage.key(i), ).filter((k): k is string => k !== null && k.startsWith("vyu-")) as key}
                  <div class="flag-row">
                    <code>{key}</code>
                    <code
                      >{(localStorage.getItem(key) ?? "").slice(0, 120)}</code
                    >
                  </div>
                {/each}
              </div>
            {/if}
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="23 4 23 10 17 10" /><path
                    d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Reset All Settings</span>
                  <span class="settings-hint"
                    >Clear all preferences and reload</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button
                  class="settings-action-btn red"
                  onclick={handleResetConfirm}
                  >{resetConfirming ? "Confirm?" : "Reset"}</button
                >
              </div>
            </div>
          </div>

          <!-- Danger Zone -->
          <div
            id="settings-section-danger-zone"
            class="settings-section"
            class:flash={flashId === "danger-zone"}
          >
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
                ><path
                  d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                /><line x1="12" y1="9" x2="12" y2="13" /><line
                  x1="12"
                  y1="17"
                  x2="12.01"
                  y2="17"
                /></svg
              >
              Danger Zone
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="23 4 23 10 17 10" /><path
                    d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Reset View</span>
                  <span class="settings-hint"
                    >Clear zoom, rotation, crop &amp; flip</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="23 4 23 10 17 10" /><path
                      d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
                    /></svg
                  >
                  Reset
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="12" cy="12" r="10" /><line
                    x1="15"
                    y1="9"
                    x2="9"
                    y2="15"
                  /><line x1="9" y1="9" x2="15" y2="15" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Clear All Timestamps</span>
                  <span class="settings-hint"
                    >Remove every timestamp marker</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="12" cy="12" r="10" /><line
                      x1="15"
                      y1="9"
                      x2="9"
                      y2="15"
                    /><line x1="9" y1="9" x2="15" y2="15" /></svg
                  >
                  Clear
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="6" cy="6" r="3" /><circle
                    cx="6"
                    cy="18"
                    r="3"
                  /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line
                    x1="14.47"
                    y1="14.48"
                    x2="20"
                    y2="20"
                  /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Clear All Clip Boundaries</span>
                  <span class="settings-hint">Remove every segment marker</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><circle cx="6" cy="6" r="3" /><circle
                      cx="6"
                      cy="18"
                      r="3"
                    /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line
                      x1="14.47"
                      y1="14.48"
                      x2="20"
                      y2="20"
                    /><line x1="8.12" y1="8.12" x2="12" y2="12" /></svg
                  >
                  Clear
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="3 6 5 6 21 6" /><path
                    d="M19 6l-1 14H6L5 6"
                  /><path d="M10 11v6" /><path d="M14 11v6" /><path
                    d="M9 6V4h6v2"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Clear All Markers</span>
                  <span class="settings-hint"
                    >Wipe timestamps &amp; clip boundaries</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="3 6 5 6 21 6" /><path
                      d="M19 6l-1 14H6L5 6"
                    /><path d="M10 11v6" /><path d="M14 11v6" /><path
                      d="M9 6V4h6v2"
                    /></svg
                  >
                  Clear All
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="3 6 5 6 21 6" /><path
                    d="M19 6l-1 14H6L5 6"
                  /><path d="M10 11v6" /><path d="M14 11v6" /><path
                    d="M9 6V4h6v2"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Clear File Backups</span>
                  <span class="settings-hint">Delete saved original copies</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <button
                  class="settings-action-btn red"
                  onclick={handleClearBackups}
                  disabled={clearingBackups}
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
                    ><polyline points="3 6 5 6 21 6" /><path
                      d="M19 6l-1 14H6L5 6"
                    /><path d="M10 11v6" /><path d="M14 11v6" /><path
                      d="M9 6V4h6v2"
                    /></svg
                  >
                  {clearingBackups
                    ? "Clearing..."
                    : clearBackupsConfirming
                      ? "Confirm?"
                      : "Clear"}
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polyline points="3 6 5 6 21 6" /><path
                    d="M19 6l-1 14H6L5 6"
                  /><path d="M10 11v6" /><path d="M14 11v6" /><path
                    d="M9 6V4h6v2"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Delete FFmpeg</span>
                  <span class="settings-hint">Remove bundled binary</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="3 6 5 6 21 6" /><path
                      d="M19 6l-1 14H6L5 6"
                    /><path d="M10 11v6" /><path d="M14 11v6" /><path
                      d="M9 6V4h6v2"
                    /></svg
                  >
                  Delete
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg
                  class="settings-row-icon"
                  width="14"
                  height="14"
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
                <div class="settings-label-text">
                  <span class="settings-label">Uninstall</span>
                  <span class="settings-hint">Remove vyu from your system</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><path
                      d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"
                    /><polyline points="7 10 12 15 17 10" /><line
                      x1="12"
                      y1="15"
                      x2="12"
                      y2="3"
                    /></svg
                  >
                  Run Uninstaller
                </button>
              </div>
            </div>
          </div>
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
