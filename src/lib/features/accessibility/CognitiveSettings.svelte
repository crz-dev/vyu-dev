<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  let privacyBlurPreview = $state(library.privacyBlur);

  $effect(() => {
    privacyBlurPreview = library.privacyBlur;
  });
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

  <SettingsGroup label="Library" icon="book">
    <SettingsRow
      label="Privacy Mode"
      hint="Blur thumbnails and hide identifying details"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Privacy Mode"
            checked={library.privacyMode}
            onchange={(e) => library.setPrivacyMode(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.privacyMode}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Blur Strength"
      hint="How strongly library thumbnails are blurred"
      subrow
      open={library.privacyMode}
    >
      {#snippet control()}
        <div class="settings-slider-control">
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
          <span class="settings-slider-value">{privacyBlurPreview}px</span>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Hide File Names"
      hint="Mask names while Privacy Mode is on"
      subrow
      open={library.privacyMode}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Hide File Names"
            checked={library.privacyHideNames}
            onchange={(e) =>
              library.setPrivacyHideNames(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.privacyHideNames}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Hide Recent Files"
      hint="Stop recording recently opened files"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Hide Recent Files"
            checked={library.recentsDisabled}
            onchange={(e) =>
              library.setRecentsDisabled(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={library.recentsDisabled}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Disable Thumbnails"
      hint="Show file placeholders instead of previews"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Disable Thumbnails"
            checked={!library.showThumbnails}
            onchange={(e) =>
              library.setShowThumbnails(!e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={!library.showThumbnails}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Attention" icon="clock">
    <SettingsRow
      label="Pause on Focus Loss"
      hint="Pause playback when the window loses focus"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Pause on Focus Loss"
            checked={systemPrefs.pauseOnFocusLoss}
            onchange={(e) =>
              systemPrefs.setPauseOnFocusLoss(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={systemPrefs.pauseOnFocusLoss}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
