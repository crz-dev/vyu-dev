<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { theme as themeStore } from "$lib/features/theme/theme.svelte";
  import { font as fontStore } from "$lib/features/theme/font.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  let scalePreview = $state(Math.round(appearance.uiScale * 100));

  $effect(() => {
    scalePreview = Math.round(appearance.uiScale * 100);
  });
</script>

<div id="settings-section-appearance" class="settings-section" class:flash>
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

  <SettingsGroup label="Display" icon="display">
    <SettingsRow label="Theme" hint="Choose the app's appearance">
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="OLED True Black"
      hint="Pure black surfaces on OLED displays"
      subrow
      open={themeStore.resolved === "dark"}
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Font" hint="Typeface used across the app">
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

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

    <SettingsRow label="Density" hint="Spacing in settings, menus and lists">
      {#snippet control()}
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
            onclick={() => appearance.setDensity("compact")}>Compact</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Reduced Motion"
      hint="Minimize animations and transitions"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow label="High Contrast" hint="Stronger text and border contrast">
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
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
  </SettingsGroup>

  <SettingsGroup label="Viewer" icon="eye">
    <SettingsRow
      label="Transparency Background"
      hint="Show a checkerboard behind transparent images"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Auto-hide Cursor"
      hint="Hide the cursor when fullscreen controls fade"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={appearance.cursorAutoHide}
            onchange={(e) =>
              appearance.setCursorAutoHide(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={appearance.cursorAutoHide}
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
</div>
