<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { deleteStore } from "$lib/features/file-actions/deleteFile.svelte";
  import { saveSkipDeleteConfirmation } from "$lib/services/storage";

  let { flash = false }: { flash?: boolean } = $props();

  function setSkipDeleteConfirmations(enabled: boolean) {
    deleteStore.deleteNoAsk = enabled;
    deleteStore.multiDeleteNoAsk = enabled;
    saveSkipDeleteConfirmation(enabled);
  }
</script>

<div id="accessibility-section-motor" class="settings-section" class:flash>
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

  <SettingsGroup label="Targets" icon="mouse">
    <SettingsRow
      label="Large Click Targets"
      hint="Increase button, toggle and pill hit areas"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Large Click Targets"
            checked={accessibility.largeTargets}
            onchange={(e) =>
              accessibility.setLargeTargets(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.largeTargets}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Larger Scrollbars"
      hint="Make scrollbars easier to grab in long lists"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Larger Scrollbars"
            checked={accessibility.largeScrollbars}
            onchange={(e) =>
              accessibility.setLargeScrollbars(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.largeScrollbars}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Large Timeline"
      hint="Increase the seek bar and playhead size"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Large Timeline"
            checked={accessibility.largeTimeline}
            onchange={(e) =>
              accessibility.setLargeTimeline(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.largeTimeline}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Playback Control" icon="play">
    <SettingsRow
      label="Always Show Controls"
      hint="Keep video playback controls visible"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Always Show Controls"
            checked={accessibility.alwaysShowControls}
            onchange={(e) =>
              accessibility.setAlwaysShowControls(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.alwaysShowControls}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Access & Safety" icon="shield">
    <SettingsRow
      label="Keyboard Shortcut Sheet"
      hint="Open the full list of keyboard shortcuts"
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          onclick={() => keybindStore.toggleCheatSheet()}
        >
          View shortcuts
        </button>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Reduce Pan Sensitivity"
      hint="Slow image and PDF dragging for finer control"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Reduce Pan Sensitivity"
            checked={accessibility.reducePanSensitivity}
            onchange={(e) =>
              accessibility.setReducePanSensitivity(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={accessibility.reducePanSensitivity}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Skip Delete Confirmations"
      hint="Delete files without a prompt. Deleted files may not be recoverable."
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Skip Delete Confirmations"
            checked={deleteStore.deleteNoAsk}
            onchange={(e) =>
              setSkipDeleteConfirmations(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={deleteStore.deleteNoAsk}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
