<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import type { ViewerBackground } from "$lib/features/theme/appearance.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

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
    {t("settings.accessibility.section.vision")}
  </p>

  <SettingsGroup
    label={t("settings.accessibility.vision.group.color")}
    icon="eye"
  >
    <SettingsRow
      label={t("settings.accessibility.vision.colorBlind.label")}
      hint={t("settings.accessibility.vision.colorBlind.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4">
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "none"}
            onclick={() => accessibility.setColorBlindMode("none")}
            >{t("settings.accessibility.vision.colorBlind.none")}</button
          >
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "protanopia"}
            onclick={() => accessibility.setColorBlindMode("protanopia")}
            >{t("settings.accessibility.vision.colorBlind.protan")}</button
          >
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "deuteranopia"}
            onclick={() => accessibility.setColorBlindMode("deuteranopia")}
            >{t("settings.accessibility.vision.colorBlind.deuter")}</button
          >
          <button
            class="pill-btn"
            class:active={accessibility.colorBlindMode === "tritanopia"}
            onclick={() => accessibility.setColorBlindMode("tritanopia")}
            >{t("settings.accessibility.vision.colorBlind.tritan")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.vision.highContrast.label")}
      hint={t("settings.accessibility.vision.highContrast.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.vision.highContrast.aria")}
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
      label={t("settings.accessibility.vision.grayscale.label")}
      hint={t("settings.accessibility.vision.grayscale.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.vision.grayscale.aria")}
            checked={accessibility.grayscale}
            onchange={(e) =>
              accessibility.setGrayscale(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.grayscale}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.vision.reduceTransparency.label")}
      hint={t("settings.accessibility.vision.reduceTransparency.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t(
              "settings.accessibility.vision.reduceTransparency.aria",
            )}
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

  <SettingsGroup
    label={t("settings.accessibility.vision.group.text")}
    icon="display"
  >
    <SettingsRow
      label={t("settings.accessibility.vision.boldText.label")}
      hint={t("settings.accessibility.vision.boldText.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.vision.boldText.aria")}
            checked={accessibility.boldText}
            onchange={(e) => accessibility.setBoldText(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.boldText}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.vision.textSpacing.label")}
      hint={t("settings.accessibility.vision.textSpacing.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.vision.textSpacing.aria")}
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
      label={t("settings.accessibility.vision.focusRings.label")}
      hint={t("settings.accessibility.vision.focusRings.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.vision.focusRings.aria")}
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
  </SettingsGroup>

  <SettingsGroup
    label={t("settings.accessibility.vision.group.motion")}
    icon="image"
  >
    <SettingsRow
      label={t("settings.accessibility.vision.reduceMotion.label")}
      hint={t("settings.accessibility.vision.reduceMotion.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.vision.reduceMotion.aria")}
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
      label={t("settings.accessibility.vision.viewerBackground.label")}
      hint={t("settings.accessibility.vision.viewerBackground.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          <button
            class="pill-btn"
            class:active={appearance.viewerBackground === "theme"}
            onclick={() => setViewerBackground("theme")}
            >{t("settings.accessibility.vision.viewerBackground.theme")}</button
          >
          <button
            class="pill-btn"
            class:active={appearance.viewerBackground === "black"}
            onclick={() => setViewerBackground("black")}
            >{t("settings.accessibility.vision.viewerBackground.black")}</button
          >
          <button
            class="pill-btn"
            class:active={appearance.viewerBackground === "gray"}
            onclick={() => setViewerBackground("gray")}
            >{t("settings.accessibility.vision.viewerBackground.gray")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.vision.largeControls.label")}
      hint={t("settings.accessibility.vision.largeControls.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.vision.largeControls.aria")}
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
