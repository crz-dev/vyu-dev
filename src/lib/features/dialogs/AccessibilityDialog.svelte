<script lang="ts">
  import {
    loadLastDialogSection,
    saveLastDialogSection,
  } from "$lib/services/storage";
  import { accessibility } from "$lib/features/accessibility/accessibility.svelte";

  let {
    accessibilityOpen,
    closeAccessibility,
  }: {
    accessibilityOpen: boolean;
    closeAccessibility: () => void;
  } = $props();

  let activeSection = $state(
    loadLastDialogSection("accessibility") || "vision",
  );
  let contentEl = $state<HTMLDivElement | null>(null);
  let flashId = $state<string | null>(null);
  let isScrolling = $state(false);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let flashTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    saveLastDialogSection("accessibility", activeSection);
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

  const sections = [
    { id: "vision", label: "Vision" },
    { id: "hearing", label: "Hearing" },
    { id: "motor", label: "Motor" },
    { id: "cognitive", label: "Cognitive" },
  ];

  const sectionDescriptions: Record<string, string> = {
    vision: "Adjust visual aids and display preferences.",
    hearing: "Configure audio cues and caption behavior.",
    motor: "Tailor input methods and navigation timing.",
    cognitive: "Reduce distractions and simplify the interface.",
  };

  function scrollToSection(id: string) {
    activeSection = id;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    if (flashTimeout) clearTimeout(flashTimeout);
    isScrolling = true;
    const el = document.getElementById(`accessibility-section-${id}`);
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

  function exportAccessibilitySettings() {
    const data = {
      highContrast,
      largeText,
      reduceMotion,
      colorBlindMode: accessibility.colorBlindMode,
      screenReaderHints,
      focusIndicators,
      appBrightness,
      appContrast,
      invertColors,
      uiScale,
      alwaysShowCaptions,
      visualAudioNotifications,
      volumeNormalization,
      leftRightBalance,
      monoAudio,
      captionStyle,
      dwellClicking,
      keyboardNavigation,
      gestureDelay,
      holdToConfirm,
      removeConfirm,
      reduceDistractions,
      readingMode,
      simplifyInterface,
      autoPauseOnSwitch,
      slideshowPacingAssist,
      focusMode,
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vyu-accessibility.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  let highContrast = $state(false);
  let largeText = $state(false);
  let reduceMotion = $state(false);
  let screenReaderHints = $state(false);
  let focusIndicators = $state(true);
  let appBrightness = $state(1.0);
  let appContrast = $state(1.0);
  let invertColors = $state(false);
  let uiScale = $state(1.0);

  let alwaysShowCaptions = $state(false);
  let visualAudioNotifications = $state(false);
  let volumeNormalization = $state(false);
  let leftRightBalance = $state<"center" | "left" | "right">("center");
  let monoAudio = $state(false);
  let captionStyle = $state<"small" | "medium" | "large" | "background">(
    "medium",
  );

  let dwellClicking = $state(false);
  let keyboardNavigation = $state(true);
  let gestureDelay = $state<"normal" | "long" | "extra-long">("normal");
  let holdToConfirm = $state(false);
  let removeConfirm = $state(false);

  let reduceDistractions = $state(false);
  let readingMode = $state(false);
  let simplifyInterface = $state(false);
  let autoPauseOnSwitch = $state(false);
  let slideshowPacingAssist = $state(false);
  let focusMode = $state(false);

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

{#if accessibilityOpen}
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
      if (e.target === e.currentTarget) closeAccessibility();
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
          Accessibility
        </p>
        <p class="delete-subtitle">Customize how vyu works for you</p>
        <button
          class="dialog-close-x"
          onclick={closeAccessibility}
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
          <!-- Vision -->
          <div
            id="accessibility-section-vision"
            class="settings-section"
            class:flash={flashId === "vision"}
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
                  d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                /><circle cx="12" cy="12" r="3" /></svg
              >
              Vision
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
                    y1="8"
                    x2="12"
                    y2="12"
                  /><line x1="12" y1="16" x2="12.01" y2="16" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">High Contrast</span>
                  <span class="settings-hint"
                    >Maximize contrast across the UI</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={highContrast}
                    onchange={(e) => (highContrast = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={highContrast}
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
                  ><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path
                    d="M12 4v16"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Large Text</span>
                  <span class="settings-hint"
                    >Increase font sizes throughout</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={largeText}
                    onchange={(e) => (largeText = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={largeText}
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
                  ><polygon
                    points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Reduce Motion</span>
                  <span class="settings-hint"
                    >Minimize animations and transitions</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={reduceMotion}
                    onchange={(e) => (reduceMotion = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={reduceMotion}
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
                  ><circle cx="12" cy="12" r="10" /><circle
                    cx="12"
                    cy="12"
                    r="4"
                  /><line x1="4.93" y1="4.93" x2="9.17" y2="9.17" /><line
                    x1="14.83"
                    y1="14.83"
                    x2="19.07"
                    y2="19.07"
                  /><line x1="14.83" y1="9.17" x2="19.07" y2="4.93" /><line
                    x1="14.83"
                    y1="9.17"
                    x2="18.36"
                    y2="5.64"
                  /><line x1="4.93" y1="19.07" x2="9.17" y2="14.83" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Color Blind Mode</span>
                  <span class="settings-hint"
                    >Shift colors to improve distinction</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group pill-group-4">
                  <button
                    class="pill-btn"
                    class:active={accessibility.colorBlindMode === "none"}
                    onclick={() => accessibility.setColorBlindMode("none")}
                    >None</button
                  >
                  <button
                    class="pill-btn"
                    class:active={accessibility.colorBlindMode === "protanopia"}
                    onclick={() =>
                      accessibility.setColorBlindMode("protanopia")}
                    >Protan</button
                  >
                  <button
                    class="pill-btn"
                    class:active={accessibility.colorBlindMode ===
                      "deuteranopia"}
                    onclick={() =>
                      accessibility.setColorBlindMode("deuteranopia")}
                    >Deuter</button
                  >
                  <button
                    class="pill-btn"
                    class:active={accessibility.colorBlindMode === "tritanopia"}
                    onclick={() =>
                      accessibility.setColorBlindMode("tritanopia")}
                    >Tritan</button
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
                  ><path d="M12 2L2 7l10 5 10-5-10-5z" /><path
                    d="M2 17l10 5 10-5"
                  /><path d="M2 12l10 5 10-5" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Screen Reader Hints</span>
                  <span class="settings-hint"
                    >Add ARIA labels and descriptions</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={screenReaderHints}
                    onchange={(e) =>
                      (screenReaderHints = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={screenReaderHints}
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
                  /><line x1="3" y1="9" x2="21" y2="9" /><line
                    x1="9"
                    y1="21"
                    x2="9"
                    y2="9"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Focus Indicators</span>
                  <span class="settings-hint"
                    >Always show keyboard focus rings</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={focusIndicators}
                    onchange={(e) =>
                      (focusIndicators = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={focusIndicators}
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
                  ><circle cx="12" cy="12" r="5" /><path
                    d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">App Brightness</span>
                  <span class="settings-hint"
                    >Dim or brighten the app window</span
                  >
                </div>
              </div>
              <div class="settings-control settings-slider-control">
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  bind:value={appBrightness}
                />
                <span class="settings-slider-value"
                  >{appBrightness.toFixed(1)}x</span
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
                  ><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path
                    d="M12 8h.01"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">App Contrast</span>
                  <span class="settings-hint"
                    >Increase or decrease contrast</span
                  >
                </div>
              </div>
              <div class="settings-control settings-slider-control">
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  bind:value={appContrast}
                />
                <span class="settings-slider-value"
                  >{appContrast.toFixed(1)}x</span
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
                  ><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Invert Colors</span>
                  <span class="settings-hint"
                    >Invert the entire app color scheme</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={invertColors}
                    onchange={(e) => (invertColors = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={invertColors}
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
                  /><line x1="3" y1="9" x2="21" y2="9" /><line
                    x1="9"
                    y1="21"
                    x2="9"
                    y2="9"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">UI Scale</span>
                  <span class="settings-hint">Resize interface elements</span>
                </div>
              </div>
              <div class="settings-control settings-slider-control">
                <input
                  type="range"
                  min="0.8"
                  max="1.5"
                  step="0.1"
                  bind:value={uiScale}
                />
                <span class="settings-slider-value">{uiScale.toFixed(1)}x</span>
              </div>
            </div>
          </div>

          <!-- Hearing -->
          <div
            id="accessibility-section-hearing"
            class="settings-section"
            class:flash={flashId === "hearing"}
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
                ><path d="M11 5L6 9H2v6h4l5 4V5z" /><path
                  d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"
                /></svg
              >
              Hearing
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
                  ><polyline points="4 7 4 4 20 4 20 7" /><line
                    x1="9"
                    y1="20"
                    x2="15"
                    y2="20"
                  /><line x1="12" y1="4" x2="12" y2="20" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Always Show Captions</span>
                  <span class="settings-hint"
                    >Display subtitles when available</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={alwaysShowCaptions}
                    onchange={(e) =>
                      (alwaysShowCaptions = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={alwaysShowCaptions}
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
                  <span class="settings-label">Visual Audio Notifications</span>
                  <span class="settings-hint">Flash on playback events</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={visualAudioNotifications}
                    onchange={(e) =>
                      (visualAudioNotifications = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={visualAudioNotifications}
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
                  ><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path
                    d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Volume Normalization</span>
                  <span class="settings-hint">Keep audio levels consistent</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={volumeNormalization}
                    onchange={(e) =>
                      (volumeNormalization = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={volumeNormalization}
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
                    d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"
                  /><path d="M19 10v2a7 7 0 01-14 0v-2" /><line
                    x1="12"
                    y1="19"
                    x2="12"
                    y2="23"
                  /><line x1="8" y1="23" x2="16" y2="23" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Left / Right Balance</span>
                  <span class="settings-hint">Pan stereo output</span>
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group pill-group-3">
                  <button
                    class="pill-btn"
                    class:active={leftRightBalance === "left"}
                    onclick={() => (leftRightBalance = "left")}>Left</button
                  >
                  <button
                    class="pill-btn"
                    class:active={leftRightBalance === "center"}
                    onclick={() => (leftRightBalance = "center")}>Center</button
                  >
                  <button
                    class="pill-btn"
                    class:active={leftRightBalance === "right"}
                    onclick={() => (leftRightBalance = "right")}>Right</button
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
                  ><path d="M11 5L6 9H2v6h4l5 4V5z" /><line
                    x1="22"
                    y1="9"
                    x2="16"
                    y2="15"
                  /><line x1="16" y1="9" x2="22" y2="15" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Mono Audio</span>
                  <span class="settings-hint"
                    >Combine left and right channels</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={monoAudio}
                    onchange={(e) => (monoAudio = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={monoAudio}
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
                  ><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path
                    d="M12 4v16"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Caption Styling</span>
                  <span class="settings-hint"
                    >Size and background of captions</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group pill-group-4">
                  <button
                    class="pill-btn"
                    class:active={captionStyle === "small"}
                    onclick={() => (captionStyle = "small")}>Small</button
                  >
                  <button
                    class="pill-btn"
                    class:active={captionStyle === "medium"}
                    onclick={() => (captionStyle = "medium")}>Medium</button
                  >
                  <button
                    class="pill-btn"
                    class:active={captionStyle === "large"}
                    onclick={() => (captionStyle = "large")}>Large</button
                  >
                  <button
                    class="pill-btn"
                    class:active={captionStyle === "background"}
                    onclick={() => (captionStyle = "background")}>BG</button
                  >
                </div>
              </div>
            </div>
          </div>

          <!-- Motor -->
          <div
            id="accessibility-section-motor"
            class="settings-section"
            class:flash={flashId === "motor"}
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
                ><rect x="6" y="4" width="12" height="16" rx="2" ry="2" /><line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="8.01"
                /><line x1="12" y1="16" x2="12" y2="16.01" /></svg
              >
              Motor
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
                  ><circle cx="12" cy="12" r="10" /><circle
                    cx="12"
                    cy="12"
                    r="3"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Dwell Clicking</span>
                  <span class="settings-hint">Auto-click after hovering</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={dwellClicking}
                    onchange={(e) => (dwellClicking = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={dwellClicking}
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
                  ><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Keyboard Navigation</span>
                  <span class="settings-hint"
                    >Enhanced tab and arrow key control</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={keyboardNavigation}
                    onchange={(e) =>
                      (keyboardNavigation = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={keyboardNavigation}
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
                  ><circle cx="12" cy="12" r="10" /><polyline
                    points="12 6 12 12 16 14"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Gesture Delay</span>
                  <span class="settings-hint"
                    >Time before a gesture triggers</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <div class="pill-group pill-group-3">
                  <button
                    class="pill-btn"
                    class:active={gestureDelay === "normal"}
                    onclick={() => (gestureDelay = "normal")}>Normal</button
                  >
                  <button
                    class="pill-btn"
                    class:active={gestureDelay === "long"}
                    onclick={() => (gestureDelay = "long")}>Long</button
                  >
                  <button
                    class="pill-btn"
                    class:active={gestureDelay === "extra-long"}
                    onclick={() => (gestureDelay = "extra-long")}>Extra</button
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
                  ><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Hold-to-confirm Destructive</span
                  >
                  <span class="settings-hint"
                    >Require long-press for dangerous actions</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={holdToConfirm}
                    onchange={(e) => (holdToConfirm = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={holdToConfirm}
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
                    d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                  /><line x1="12" y1="9" x2="12" y2="13" /><line
                    x1="12"
                    y1="17"
                    x2="12.01"
                    y2="17"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Remove Confirmations</span>
                  <span class="settings-hint"
                    >Skip warning dialogs entirely</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={removeConfirm}
                    onchange={(e) => (removeConfirm = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={removeConfirm}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
              </div>
            </div>
          </div>

          <!-- Cognitive -->
          <div
            id="accessibility-section-cognitive"
            class="settings-section"
            class:flash={flashId === "cognitive"}
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
                ><path d="M12 2a10 10 0 100 20 10 10 0 000-20z" /><path
                  d="M12 6v6l4 2"
                /></svg
              >
              Cognitive
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
                    d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
                  /><circle cx="12" cy="12" r="3" /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Reduce Distractions</span>
                  <span class="settings-hint"
                    >Hide non-essential UI elements</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={reduceDistractions}
                    onchange={(e) =>
                      (reduceDistractions = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={reduceDistractions}
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
                  ><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path
                    d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Reading Mode</span>
                  <span class="settings-hint"
                    >Simplify layout for readability</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={readingMode}
                    onchange={(e) => (readingMode = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={readingMode}
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
                  /><line x1="3" y1="9" x2="21" y2="9" /><line
                    x1="9"
                    y1="21"
                    x2="9"
                    y2="9"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Simplify Interface</span>
                  <span class="settings-hint">Show only core controls</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={simplifyInterface}
                    onchange={(e) =>
                      (simplifyInterface = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={simplifyInterface}
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
                <div class="settings-label-text">
                  <span class="settings-label">Auto-pause on Switch</span>
                  <span class="settings-hint">Pause when switching files</span>
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={autoPauseOnSwitch}
                    onchange={(e) =>
                      (autoPauseOnSwitch = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={autoPauseOnSwitch}
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
                  ><circle cx="12" cy="12" r="10" /><polyline
                    points="12 6 12 12 16 14"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Slideshow Pacing Assist</span>
                  <span class="settings-hint"
                    >Add longer delays between slides</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={slideshowPacingAssist}
                    onchange={(e) =>
                      (slideshowPacingAssist = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={slideshowPacingAssist}
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
                  ><path d="M1 4l0 16" /><path d="M3 4l0 16" /><path
                    d="M8 4l0 16"
                  /><path d="M16 4l0 16" /><path d="M21 4l0 16" /><path
                    d="M23 4l0 16"
                  /></svg
                >
                <div class="settings-label-text">
                  <span class="settings-label">Focus Mode</span>
                  <span class="settings-hint"
                    >Hide all app elements except topbar</span
                  >
                </div>
              </div>
              <div class="settings-control">
                <label class="toggle-row">
                  <input
                    type="checkbox"
                    checked={focusMode}
                    onchange={(e) => (focusMode = e.currentTarget.checked)}
                  />
                  <span class="toggle-track" class:on={focusMode}
                    ><span class="toggle-thumb"></span></span
                  >
                </label>
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
                points="17 8 12 3 7 8"
              /><line x1="12" y1="3" x2="12" y2="15" /></svg
            >
            Import Accessibility
          </button>
          <button
            class="settings-action-btn"
            onclick={exportAccessibilitySettings}
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
            Export Accessibility
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
