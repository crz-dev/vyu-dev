<script lang="ts">
  let {
    settingsOpen,
    closeSettings,
  }: {
    settingsOpen: boolean;
    closeSettings: () => void;
  } = $props();

  let activeSection = $state("appearance");
  let contentEl = $state<HTMLDivElement | null>(null);
  let flashId = $state<string | null>(null);
  let isScrolling = $state(false);
  let scrollTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  const sections = [
    { id: "appearance", label: "Appearance" },
    { id: "playback", label: "Playback" },
    { id: "editor", label: "Editor" },
    { id: "process", label: "Process" },
    { id: "system", label: "System" },
    { id: "actions", label: "Actions" },
  ];

  function scrollToSection(id: string) {
    activeSection = id;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    isScrolling = true;
    const el = document.getElementById(`settings-section-${id}`);
    if (el && contentEl) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      flashId = id;
      setTimeout(() => {
        if (flashId === id) flashId = null;
      }, 900);
    }
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 700);
  }

  function handleScroll() {
    if (!contentEl || isScrolling) return;
    // If near bottom, highlight last section
    const nearBottom = contentEl.scrollTop + contentEl.clientHeight >= contentEl.scrollHeight - 8;
    if (nearBottom) {
      activeSection = sections[sections.length - 1].id;
      return;
    }
    const ids = sections.map((s) => s.id);
    for (let i = ids.length - 1; i >= 0; i--) {
      const el = document.getElementById(`settings-section-${ids[i]}`);
      if (el) {
        const top = el.getBoundingClientRect().top - contentEl.getBoundingClientRect().top + contentEl.scrollTop;
        if (top <= contentEl.scrollTop + 16) {
          activeSection = ids[i];
          break;
        }
      }
    }
  }

  function exportSettings() {
    const data = {
      theme,
      uiMode,
      transition,
      allowZoomOut,
      alwaysShowControls,
      volumeBoost,
      resumePlayback,
      defaultLoop,
      showTimeRemaining,
      rememberVolume,
      autoplayNext,
      autoSaveMarkers,
      defaultQuality,
      defaultFormat,
      confirmDelete,
      preserveMetadata,
      gpuEncoding,
      overwriteExisting,
      includeSubtitles,
      hardwareAcceleration,
      minimizeToTray,
      startOnLogin,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vyu-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Appearance
  let theme = $state<"dark" | "light" | "system">("dark");
  let uiMode = $state<"simple" | "advanced">("advanced");
  let transition = $state<"none" | "fade" | "slide">("fade");
  let allowZoomOut = $state(false);
  let alwaysShowControls = $state(false);

  // Playback
  let volumeBoost = $state(false);
  let resumePlayback = $state(true);
  let defaultLoop = $state<"loop" | "stop" | "next" | "shuffle">("loop");
  let showTimeRemaining = $state(false);
  let rememberVolume = $state(true);
  let autoplayNext = $state(false);

  // Editor
  let autoSaveMarkers = $state(true);
  let defaultQuality = $state<"fast" | "balanced" | "quality" | "lossless">("balanced");
  let defaultFormat = $state<"original" | "mp4" | "webm" | "mkv">("original");
  let confirmDelete = $state(true);
  let preserveMetadata = $state(true);

  // Process
  let gpuEncoding = $state(true);
  let overwriteExisting = $state(false);
  let includeSubtitles = $state(false);

  // System
  let hardwareAcceleration = $state(true);
  let minimizeToTray = $state(false);
  let startOnLogin = $state(false);
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
        <p class="delete-title">Settings</p>
        <p class="delete-subtitle">Configure your media viewer experience</p>
      </div>

      <div class="settings-layout">
        <nav class="settings-nav">
          {#each sections as sec}
            <button
              class="settings-nav-item"
              class:active={activeSection === sec.id}
              onclick={() => scrollToSection(sec.id)}
            >
              {#if sec.id === "appearance"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              {:else if sec.id === "playback"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              {:else if sec.id === "editor"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              {:else if sec.id === "process"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>
              {:else if sec.id === "system"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              {:else if sec.id === "actions"}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {/if}
              {sec.label}
            </button>
          {/each}
        </nav>

        <div class="settings-content" bind:this={contentEl} onscroll={handleScroll}>
          <!-- Appearance -->
          <div id="settings-section-appearance" class="settings-section" class:flash={flashId === "appearance"}>
            <p class="settings-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
              Appearance
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Theme</span>
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group">
                  <button class="pill-btn" class:active={theme === "dark"} onclick={() => (theme = "dark")}>Dark</button>
                  <button class="pill-btn" class:active={theme === "light"} onclick={() => (theme = "light")}>Light</button>
                  <button class="pill-btn" class:active={theme === "system"} onclick={() => (theme = "system")}>System</button>
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">UI Mode</span>
                  <span class="settings-hint">Simple hides advanced controls</span>
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group">
                  <button class="pill-btn" class:active={uiMode === "simple"} onclick={() => (uiMode = "simple")}>Simple</button>
                  <button class="pill-btn" class:active={uiMode === "advanced"} onclick={() => (uiMode = "advanced")}>Advanced</button>
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Transition</span>
                  <span class="settings-hint">Animation style when switching media</span>
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group">
                  <button class="pill-btn" class:active={transition === "none"} onclick={() => (transition = "none")}>None</button>
                  <button class="pill-btn" class:active={transition === "fade"} onclick={() => (transition = "fade")}>Fade</button>
                  <button class="pill-btn" class:active={transition === "slide"} onclick={() => (transition = "slide")}>Slide</button>
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Zoom Out</span>
                  <span class="settings-hint">Allow zooming below 100%</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={allowZoomOut} onchange={(e) => (allowZoomOut = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={allowZoomOut}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Always Show Controls</span>
                  <span class="settings-hint">Keep overlays visible in fullscreen</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={alwaysShowControls} onchange={(e) => (alwaysShowControls = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={alwaysShowControls}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Playback -->
          <div id="settings-section-playback" class="settings-section" class:flash={flashId === "playback"}>
            <p class="settings-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Playback
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Volume Boost</span>
                  <span class="settings-hint">Allow volume up to 200%</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={volumeBoost} onchange={(e) => (volumeBoost = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={volumeBoost}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Resume Playback</span>
                  <span class="settings-hint">Remember position for each file</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={resumePlayback} onchange={(e) => (resumePlayback = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={resumePlayback}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 014-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 01-4 4H3"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Default Loop</span>
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group">
                  <button class="pill-btn" class:active={defaultLoop === "loop"} onclick={() => (defaultLoop = "loop")}>Loop</button>
                  <button class="pill-btn" class:active={defaultLoop === "stop"} onclick={() => (defaultLoop = "stop")}>Stop</button>
                  <button class="pill-btn" class:active={defaultLoop === "next"} onclick={() => (defaultLoop = "next")}>Next</button>
                  <button class="pill-btn" class:active={defaultLoop === "shuffle"} onclick={() => (defaultLoop = "shuffle")}>Shuffle</button>
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Show Time Remaining</span>
                  <span class="settings-hint">Display countdown instead of elapsed</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={showTimeRemaining} onchange={(e) => (showTimeRemaining = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={showTimeRemaining}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Remember Volume</span>
                  <span class="settings-hint">Restore last used volume on launch</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={rememberVolume} onchange={(e) => (rememberVolume = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={rememberVolume}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Auto-play Next</span>
                  <span class="settings-hint">Load next file automatically</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={autoplayNext} onchange={(e) => (autoplayNext = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={autoplayNext}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Editor -->
          <div id="settings-section-editor" class="settings-section" class:flash={flashId === "editor"}>
            <p class="settings-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              Editor
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Auto-save Markers</span>
                  <span class="settings-hint">Save timestamps &amp; clips automatically</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={autoSaveMarkers} onchange={(e) => (autoSaveMarkers = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={autoSaveMarkers}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Default Quality</span>
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group">
                  <button class="pill-btn" class:active={defaultQuality === "fast"} onclick={() => (defaultQuality = "fast")}>Fast</button>
                  <button class="pill-btn" class:active={defaultQuality === "balanced"} onclick={() => (defaultQuality = "balanced")}>Balanced</button>
                  <button class="pill-btn" class:active={defaultQuality === "quality"} onclick={() => (defaultQuality = "quality")}>Quality</button>
                  <button class="pill-btn" class:active={defaultQuality === "lossless"} onclick={() => (defaultQuality = "lossless")}>Lossless</button>
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Default Format</span>
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group">
                  <button class="pill-btn" class:active={defaultFormat === "original"} onclick={() => (defaultFormat = "original")}>Original</button>
                  <button class="pill-btn" class:active={defaultFormat === "mp4"} onclick={() => (defaultFormat = "mp4")}>MP4</button>
                  <button class="pill-btn" class:active={defaultFormat === "webm"} onclick={() => (defaultFormat = "webm")}>WebM</button>
                  <button class="pill-btn" class:active={defaultFormat === "mkv"} onclick={() => (defaultFormat = "mkv")}>MKV</button>
                </div>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Confirm Before Delete</span>
                  <span class="settings-hint">Show warning before removing files</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={confirmDelete} onchange={(e) => (confirmDelete = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={confirmDelete}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Preserve Metadata</span>
                  <span class="settings-hint">Keep EXIF and tags on export</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={preserveMetadata} onchange={(e) => (preserveMetadata = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={preserveMetadata}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
          </div>

          <!-- Process -->
          <div id="settings-section-process" class="settings-section" class:flash={flashId === "process"}>
            <p class="settings-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><path d="M14 2v6h6"/><path d="M12 18v-6"/><path d="M9 15l3 3 3-3"/></svg>
              Process
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">GPU Encoding</span>
                  <span class="settings-hint">Accelerate exports with hardware</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={gpuEncoding} onchange={(e) => (gpuEncoding = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={gpuEncoding}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Overwrite Existing</span>
                  <span class="settings-hint">Replace files with same name</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={overwriteExisting} onchange={(e) => (overwriteExisting = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={overwriteExisting}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Include Subtitles</span>
                  <span class="settings-hint">Burn in captions when exporting</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={includeSubtitles} onchange={(e) => (includeSubtitles = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={includeSubtitles}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
          </div>

          <!-- System -->
          <div id="settings-section-system" class="settings-section" class:flash={flashId === "system"}>
            <p class="settings-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              System
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Hardware Acceleration</span>
                  <span class="settings-hint">Use GPU for decoding when available</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={hardwareAcceleration} onchange={(e) => (hardwareAcceleration = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={hardwareAcceleration}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Minimize to Tray</span>
                  <span class="settings-hint">Keep running in background</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={minimizeToTray} onchange={(e) => (minimizeToTray = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={minimizeToTray}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Start on Login</span>
                  <span class="settings-hint">Launch when system starts</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input type="checkbox" checked={startOnLogin} onchange={(e) => (startOnLogin = e.currentTarget.checked)} />
                  <span class="toggle-track" class:on={startOnLogin}><span class="toggle-thumb"></span></span>
                </label>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Check for Updates</span>
                  <span class="settings-hint">Verify you are on the latest version</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn blue">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Check
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Clear Cache</span>
                  <span class="settings-hint">Remove temporary media data</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  Clear
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Reset All Settings</span>
                  <span class="settings-hint">Restore factory defaults</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
                  Reset
                </button>
              </div>
            </div>
          </div>

          <!-- Actions -->
          <div id="settings-section-actions" class="settings-section" class:flash={flashId === "actions"}>
            <p class="settings-section-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              Global Actions
            </p>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Reset View</span>
                  <span class="settings-hint">Clear zoom, rotation, crop &amp; flip</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn yellow">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10"/></svg>
                  Reset
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Clear All Timestamps</span>
                  <span class="settings-hint">Remove every timestamp marker</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn blue">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  Clear
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Clear All Clip Boundaries</span>
                  <span class="settings-hint">Remove every segment marker</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn blue">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>
                  Clear
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Clear All Markers</span>
                  <span class="settings-hint">Wipe timestamps &amp; clip boundaries</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  Clear All
                </button>
              </div>
            </div>
            <div class="settings-row">
              <div class="settings-label-col">
                <svg class="settings-row-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M4 9h10a6 6 0 016 6v0"/></svg>
                <div class="settings-label-text">
                  <span class="settings-label">Undo All Edits</span>
                  <span class="settings-hint">Revert every adjustment to defaults</span>
                </div>
              </div>
              <div class="settings-control">
                <button class="settings-action-btn red">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 14 4 9 9 4"/><path d="M4 9h10a6 6 0 016 6v0"/></svg>
                  Undo
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="delete-actions">
        <button class="settings-action-btn" onclick={exportSettings}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Export Settings
        </button>
        <button class="delete-cancel" onclick={closeSettings}>Close</button>
      </div>
    </div>
  </div>
{/if}
