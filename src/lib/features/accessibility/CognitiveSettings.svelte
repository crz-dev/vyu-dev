<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  let { flash = false }: { flash?: boolean } = $props();
</script>

<div id="accessibility-section-cognitive" class="settings-section" class:flash>
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

  <SettingsGroup label="Focus" icon="eye">
    <SettingsRow
      label="Reduce Distractions"
      hint="Hide the thumbnail strip and non-essential metadata"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Reduce Distractions"
            checked={accessibility.reduceDistractions}
            onchange={(e) =>
              accessibility.setReduceDistractions(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.reduceDistractions}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Focus Mode"
      hint="Hide the media bar and player controls, leaving the top bar"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Focus Mode"
            checked={accessibility.focusMode}
            onchange={(e) =>
              accessibility.setFocusMode(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.focusMode}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Hide Media Details"
      hint="Hide resolution, bitrate and file size in the media bar"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Hide Media Details"
            checked={accessibility.hideMediaDetails}
            onchange={(e) =>
              accessibility.setHideMediaDetails(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.hideMediaDetails}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Simplified Menus"
      hint="Hide secondary entries such as Feedback and About"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Simplified Menus"
            checked={accessibility.simplifiedMenus}
            onchange={(e) =>
              accessibility.setSimplifiedMenus(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.simplifiedMenus}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
