<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import LanguageSelect from "$lib/features/i18n/LanguageSelect.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { theme as themeStore } from "$lib/features/theme/theme.svelte";
  import { font as fontStore } from "$lib/features/theme/font.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

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
    {t("settings.appearance.header")}
  </p>

  <SettingsGroup label={t("settings.appearance.display")} icon="display">
    <SettingsRow
      label={t("settings.appearance.language.label")}
      hint={t("settings.appearance.language.hint")}
    >
      {#snippet control()}
        <LanguageSelect />
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.appearance.theme.label")}
      hint={t("settings.appearance.theme.hint")}
    >
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
            }}>{t("settings.appearance.theme.dark")}</button
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
            }}>{t("settings.appearance.theme.light")}</button
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
            }}>{t("settings.appearance.theme.system")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.appearance.oled.label")}
      hint={t("settings.appearance.oled.hint")}
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

    <SettingsRow
      label={t("settings.appearance.font.label")}
      hint={t("settings.appearance.font.hint")}
    >
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
            onclick={() => fontStore.setFont("system")}
            >{t("settings.appearance.theme.system")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.appearance.scale.label")}
      hint={t("settings.appearance.scale.hint")}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="80"
            max="225"
            step="5"
            aria-label={t("settings.appearance.scale.aria")}
            value={scalePreview}
            oninput={(e) => (scalePreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              appearance.setUiScale(Number(e.currentTarget.value) / 100)}
          />
          <span class="settings-slider-value">{scalePreview}%</span>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.appearance.density.label")}
      hint={t("settings.appearance.density.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-2 pill-group-wide">
          <button
            class="pill-btn"
            class:active={appearance.density === "comfortable"}
            onclick={() => appearance.setDensity("comfortable")}
            >{t("settings.appearance.density.comfortable")}</button
          >
          <button
            class="pill-btn"
            class:active={appearance.density === "compact"}
            onclick={() => appearance.setDensity("compact")}
            >{t("settings.appearance.density.compact")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label={t("settings.appearance.viewer")} icon="eye">
    <SettingsRow
      label={t("settings.appearance.transparency.label")}
      hint={t("settings.appearance.transparency.hint")}
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
      label={t("settings.appearance.transition.label")}
      hint={t("settings.appearance.transition.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          <button
            class="pill-btn"
            class:active={appearance.fileTransition === "none"}
            onclick={() => appearance.setFileTransition("none")}
            >{t("settings.appearance.transition.none")}</button
          >
          <button
            class="pill-btn"
            class:active={appearance.fileTransition === "fade"}
            onclick={() => appearance.setFileTransition("fade")}
            >{t("settings.appearance.transition.fade")}</button
          >
          <button
            class="pill-btn"
            class:active={appearance.fileTransition === "slide"}
            onclick={() => appearance.setFileTransition("slide")}
            >{t("settings.appearance.transition.slide")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.appearance.cursor.label")}
      hint={t("settings.appearance.cursor.hint")}
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
  </SettingsGroup>
</div>
