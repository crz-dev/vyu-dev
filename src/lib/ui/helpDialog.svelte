<script lang="ts">
  let {
    helpOpen,
    closeHelp,
  }: {
    helpOpen: boolean;
    closeHelp: () => void;
  } = $props();

  const LAST_SECTION_KEY = "vyu-help-last-section";

  let activeSection = $state(
    localStorage.getItem(LAST_SECTION_KEY) ?? "quick-start",
  );
  let contentEl = $state<HTMLDivElement | null>(null);
  let flashId = $state<string | null>(null);
  let isScrolling = $state(false);
  let scrollTimeout = $state<ReturnType<typeof setTimeout> | null>(null);
  let flashTimeout = $state<ReturnType<typeof setTimeout> | null>(null);

  $effect(() => {
    localStorage.setItem(LAST_SECTION_KEY, activeSection);
  });

  $effect(() => {
    if (helpOpen) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`help-section-${activeSection}`);
        if (el) {
          el.scrollIntoView({ block: "start" });
        }
      });
    }
  });

  const sections = [
    { id: "quick-start", label: "Quick start" },
    { id: "keybinds", label: "Keybinds" },
    { id: "tips", label: "Tips" },
    { id: "troubleshooting", label: "Troubleshooting" },
  ];

  const sectionDescriptions: Record<string, string> = {
    "quick-start": "Get up and running with vyu in seconds.",
    keybinds: "View and customize keyboard shortcuts.",
    tips: "Hidden features and power-user tricks.",
    troubleshooting: "Fix common issues quickly.",
  };

  function scrollToSection(id: string) {
    activeSection = id;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    if (flashTimeout) clearTimeout(flashTimeout);
    isScrolling = true;
    const el = document.getElementById(`help-section-${id}`);
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
      const el = document.getElementById(`help-section-${sections[i].id}`);
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

  // Example keybinds state
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
      { id: "nav-first", action: "Navigate to first", key: "Ctrl + ←" },
      { id: "nav-last", action: "Navigate to last", key: "Ctrl + →" },
      { id: "escape", action: "Close dialogs / Exit fullscreen", key: "Esc" },
    ];
  }

  function exportHelpSettings() {
    const data = { keybinds };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vyu-help.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Profile
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

{#if helpOpen}
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
      if (e.target === e.currentTarget) closeHelp();
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
    <div class="delete-dialog help-dialog" role="dialog" aria-modal="true">
      <div class="settings-header-bar">
        <p class="delete-title">Help</p>
        <p class="delete-subtitle">Learn how to use vyu</p>
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
              {#if sec.id === "quick-start"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg
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
                  ><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><path
                    d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"
                  /></svg
                >
              {:else if sec.id === "tips"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  /></svg
                >
              {:else if sec.id === "troubleshooting"}
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg
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
          <!-- Quick start -->
          <div
            id="help-section-quick-start"
            class="settings-section"
            class:flash={flashId === "quick-start"}
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
                ><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg
              >
              Quick start
            </p>
            <div class="settings-row help-text-row">
              <div class="help-text">
                <p>
                  <strong>Open a file</strong> — Click the folder icon in the top bar or press <span class="help-kbd-inline">Ctrl+O</span>.
                </p>
                <p>
                  <strong>Navigate</strong> — Use the arrow buttons or keyboard shortcuts to move between files in the same folder.
                </p>
                <p>
                  <strong>Fullscreen</strong> — Double-click the viewer or press <span class="help-kbd-inline">F</span>.
                </p>
                <p>
                  <strong>Zoom & Pan</strong> — Scroll to zoom, click and drag to pan when zoomed in.
                </p>
              </div>
            </div>
          </div>

          <!-- Keybinds -->
          <div
            id="help-section-keybinds"
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
                  <span class="settings-hint">Restore all shortcuts to defaults</span>
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

          <!-- Tips -->
          <div
            id="help-section-tips"
            class="settings-section"
            class:flash={flashId === "tips"}
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
                ><path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                /></svg
              >
              Tips
            </p>
            <div class="settings-row help-text-row">
              <div class="help-text">
                <p>
                  <strong>Slideshow mode</strong> — Enable automatic playback through a folder with custom timing.
                </p>
                <p>
                  <strong>Timestamps</strong> — Press <span class="help-kbd-inline">T</span> while a video is playing to mark a moment.
                </p>
                <p>
                  <strong>Crop tool</strong> — Enter crop mode in the Edit menu to export a cropped region.
                </p>
                <p>
                  <strong>Drag & drop</strong> — Drop a file directly onto the window to open it instantly.
                </p>
                <p>
                  <strong>Clipboard paste</strong> — Paste an image from your clipboard to view it without saving.
                </p>
              </div>
            </div>
          </div>

          <!-- Troubleshooting -->
          <div
            id="help-section-troubleshooting"
            class="settings-section"
            class:flash={flashId === "troubleshooting"}
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
                ><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg
              >
              Troubleshooting
            </p>
            <div class="settings-row help-text-row">
              <div class="help-text">
                <p>
                  <strong>Video won't play?</strong> — Make sure the file is a supported format (MP4, MKV, WebM, MOV).
                </p>
                <p>
                  <strong>No audio?</strong> — Check that the volume is up and the file contains an audio track.
                </p>
                <p>
                  <strong>FFmpeg missing?</strong> — Install FFmpeg via the prompt in Properties or Process menus for advanced features.
                </p>
                <p>
                  <strong>Performance issues?</strong> — Try disabling hardware acceleration in Settings > System.
                </p>
                <p>
                  <strong>Shortcuts not working?</strong> — Make sure you are not focused on a text field or menu.
                </p>
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
                points="17 8 12 3 7 8"
              /><line x1="12" y1="3" x2="12" y2="15" /></svg
            >
            Import Keybinds
          </button>
          <button
            class="settings-action-btn"
            onclick={exportHelpSettings}
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
              ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
                points="7 10 12 15 17 10"
              /><line x1="12" y1="15" x2="12" y2="3" /></svg
            >
            Export Keybinds
          </button>
        </div>
        <button class="delete-cancel" onclick={closeHelp}>Close</button>
      </div>
    </div>
  </div>
{/if}
