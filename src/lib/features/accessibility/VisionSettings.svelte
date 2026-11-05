<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import type { ViewerBackground } from "$lib/features/theme/appearance.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  let scalePreview = $state(Math.round(appearance.uiScale * 100));

  $effect(() => {
    scalePreview = Math.round(appearance.uiScale * 100);
  });

  function setViewerBackground(background: ViewerBackground) {
    appearance.setViewerBackground(background);
  }
</script>

<div id="accessibility-section-vision" class="settings-section" class:flash>
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
      ><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
        cx="12"
        cy="12"
        r="3"
      /></svg
    >
    Vision
  </p>

  <SettingsGroup label="Color & Contrast" icon="eye">
    <SettingsRow
      label="Color Blind Mode"
      hint="Shift colors to improve distinction"
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "none"}
            onclick={() => accessibility.setColorBlindMode("none")}>None</button
          >
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "protanopia"}
            onclick={() => accessibility.setColorBlindMode("protanopia")}
            >Protan</button
          >
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "deuteranopia"}
            onclick={() => accessibility.setColorBlindMode("deuteranopia")}
            >Deuter</button
          >
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "tritanopia"}
            onclick={() => accessibility.setColorBlindMode("tritanopia")}
            >Tritan</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="High Contrast" hint="Maximize text and border contrast">
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="High Contrast"
            checked={appearance.highContrast}
            onchange={(e) =>
              appearance.setHighContrast(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={appearance.highContrast}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Reduce Transparency"
      hint="Use solid surfaces instead of translucent panels"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Reduce Transparency"
            checked={accessibility.reduceTransparency}
            onchange={(e) =>
              accessibility.setReduceTransparency(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.reduceTransparency}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Text & Focus" icon="display">
    <SettingsRow label="Interface Scale" hint="Size of text and controls">
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="80"
            max="150"
            step="5"
            aria-label="Interface scale"
            value={scalePreview}
            oninput={(e) => (scalePreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              appearance.setUiScale(Number(e.currentTarget.value) / 100)}
          />
          <span class="settings-slider-value">{scalePreview}%</span>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Bold Text" hint="Use a heavier weight across the UI">
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Bold Text"
            checked={accessibility.boldText}
            onchange={(e) => accessibility.setBoldText(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.boldText}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Text Spacing" hint="Add extra line and letter spacing">
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Text Spacing"
            checked={accessibility.textSpacing}
            onchange={(e) =>
              accessibility.setTextSpacing(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.textSpacing}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Strong Focus Rings"
      hint="Show clear outlines on keyboard focus"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Strong Focus Rings"
            checked={accessibility.focusRings}
            onchange={(e) =>
              accessibility.setFocusRings(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.focusRings}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Show Tooltips" hint="Hover hints on controls">
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Show Tooltips"
            checked={appearance.showTooltips}
            onchange={(e) =>
              appearance.setShowTooltips(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={appearance.showTooltips}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Motion & Canvas" icon="image">
    <SettingsRow
      label="Reduce Motion"
      hint="Minimize animations and transitions"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Reduce Motion"
            checked={appearance.reducedMotion}
            onchange={(e) =>
              appearance.setReducedMotion(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={appearance.reducedMotion}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Viewer Background"
      hint="Backdrop used behind images and video"
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          <button
            class="pill-btn"
            class:active={appearance.viewerBackground === "theme"}
            onclick={() => setViewerBackground("theme")}>Theme</button
          >
          <button
            class="pill-btn"
            class:active={appearance.viewerBackground === "black"}
            onclick={() => setViewerBackground("black")}>Black</button
          >
          <button
            class="pill-btn"
            class:active={appearance.viewerBackground === "gray"}
            onclick={() => setViewerBackground("gray")}>Gray</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Larger Viewer Controls"
      hint="Enlarge the controls shown over video"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Larger Viewer Controls"
            checked={accessibility.largeControls}
            onchange={(e) =>
              accessibility.setLargeControls(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.largeControls}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
