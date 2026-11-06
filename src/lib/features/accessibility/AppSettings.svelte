<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import {
    resetAccessibilitySection,
    resetAccessibilitySettings,
    type AccessibilitySection,
  } from "$lib/features/accessibility/accessibilityTransfer";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { showToast } from "$lib/components/toast.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  let sectionsOpen = $state(false);

  function resetAll() {
    resetAccessibilitySettings();
    showToast({ message: "Accessibility settings reset", color: "green" });
  }

  function resetSection(section: AccessibilitySection, label: string) {
    resetAccessibilitySection(section);
    showToast({
      message: `${label} accessibility settings reset`,
      color: "green",
    });
  }
</script>

<div id="accessibility-section-settings" class="settings-section" class:flash>
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
      ><polyline points="1 4 1 10 7 10" /><path
        d="M3.51 15a9 9 0 102.13-9.36L1 10"
      /></svg
    >
    Settings
  </p>

  <SettingsGroup label="Reset" icon="refresh">
    <SettingsRow
      label="Reset All Accessibility Settings"
      hint="Restore every option in this dialog to its default"
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label="Reset all accessibility settings"
          onclick={resetAll}>Reset all</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Reset by Sections" hint="Reset one section at a time">
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-expanded={sectionsOpen}
          onclick={() => (sectionsOpen = !sectionsOpen)}
        >
          {sectionsOpen ? "Hide" : "Show"}
        </button>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Vision"
      hint="Reset color, contrast, text and motion options"
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label="Reset Vision accessibility settings"
          onclick={() => resetSection("vision", "Vision")}>Reset</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Hearing"
      hint="Reset volume, audio processing and feedback options"
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label="Reset Hearing accessibility settings"
          onclick={() => resetSection("hearing", "Hearing")}>Reset</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Motor"
      hint="Reset targets, playback controls and input safety options"
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label="Reset Motor accessibility settings"
          onclick={() => resetSection("motor", "Motor")}>Reset</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Cognitive"
      hint="Reset focus, distraction and library privacy options"
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label="Reset Cognitive accessibility settings"
          onclick={() => resetSection("cognitive", "Cognitive")}>Reset</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="System" icon="windows">
    <SettingsRow
      label="Inherit Windows Settings"
      hint="Follow Windows text size, high contrast and reduced animations"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Inherit Windows settings"
            checked={accessibility.inheritWindows}
            onchange={(e) =>
              accessibility.setInheritWindows(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.inheritWindows}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Menu" icon="window">
    <SettingsRow
      label="Remember Last Tab"
      hint="Reopen Settings and Accessibility where you left them"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Remember last tab"
            checked={appearance.rememberLastTab}
            onchange={(e) =>
              appearance.setRememberLastTab(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={appearance.rememberLastTab}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Hide Danger Zone"
      hint="Hide the destructive actions section from Settings"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Hide danger zone"
            checked={appearance.hideDangerZone}
            onchange={(e) =>
              appearance.setHideDangerZone(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={appearance.hideDangerZone}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
