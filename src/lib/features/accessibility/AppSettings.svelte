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
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

  let sectionsOpen = $state(false);

  function resetAll() {
    resetAccessibilitySettings();
    showToast({
      message: t("settings.accessibility.app.resetAll.toast"),
      color: "green",
    });
  }

  function resetSection(section: AccessibilitySection, label: string) {
    resetAccessibilitySection(section);
    showToast({
      message: t("settings.accessibility.app.reset.toast", { section: label }),
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
    {t("settings.accessibility.app.header")}
  </p>

  <SettingsGroup
    label={t("settings.accessibility.app.group.reset")}
    icon="refresh"
  >
    <SettingsRow
      label={t("settings.accessibility.app.resetAll.label")}
      hint={t("settings.accessibility.app.resetAll.hint")}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label={t("settings.accessibility.app.resetAll.aria")}
          onclick={resetAll}
          >{t("settings.accessibility.app.resetAll.button")}</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.app.resetSections.label")}
      hint={t("settings.accessibility.app.resetSections.hint")}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-expanded={sectionsOpen}
          onclick={() => (sectionsOpen = !sectionsOpen)}
        >
          {sectionsOpen
            ? t("settings.accessibility.app.resetSections.hide")
            : t("settings.accessibility.app.resetSections.show")}
        </button>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.section.vision")}
      hint={t("settings.accessibility.app.hints.vision")}
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label={t("settings.accessibility.app.reset.aria", {
            section: t("settings.accessibility.section.vision"),
          })}
          onclick={() =>
            resetSection("vision", t("settings.accessibility.section.vision"))}
          >{t("settings.accessibility.app.reset.button")}</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.section.hearing")}
      hint={t("settings.accessibility.app.hints.hearing")}
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label={t("settings.accessibility.app.reset.aria", {
            section: t("settings.accessibility.section.hearing"),
          })}
          onclick={() =>
            resetSection(
              "hearing",
              t("settings.accessibility.section.hearing"),
            )}>{t("settings.accessibility.app.reset.button")}</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.section.motor")}
      hint={t("settings.accessibility.app.hints.motor")}
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label={t("settings.accessibility.app.reset.aria", {
            section: t("settings.accessibility.section.motor"),
          })}
          onclick={() =>
            resetSection("motor", t("settings.accessibility.section.motor"))}
          >{t("settings.accessibility.app.reset.button")}</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.section.cognitive")}
      hint={t("settings.accessibility.app.hints.cognitive")}
      subrow
      open={sectionsOpen}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          aria-label={t("settings.accessibility.app.reset.aria", {
            section: t("settings.accessibility.section.cognitive"),
          })}
          onclick={() =>
            resetSection(
              "cognitive",
              t("settings.accessibility.section.cognitive"),
            )}>{t("settings.accessibility.app.reset.button")}</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup
    label={t("settings.accessibility.app.group.system")}
    icon="windows"
  >
    <SettingsRow
      label={t("settings.accessibility.app.inheritWindows.label")}
      hint={t("settings.accessibility.app.inheritWindows.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.app.inheritWindows.aria")}
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

  <SettingsGroup
    label={t("settings.accessibility.app.group.menu")}
    icon="window"
  >
    <SettingsRow
      label={t("settings.accessibility.app.rememberLastTab.label")}
      hint={t("settings.accessibility.app.rememberLastTab.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.app.rememberLastTab.aria")}
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
      label={t("settings.accessibility.app.hideDangerZone.label")}
      hint={t("settings.accessibility.app.hideDangerZone.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.app.hideDangerZone.aria")}
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
