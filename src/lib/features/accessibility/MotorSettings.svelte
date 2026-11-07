<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { deleteStore } from "$lib/features/file-actions/deleteFile.svelte";
  import { saveSkipDeleteConfirmation } from "$lib/services/storage";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

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
    {t("settings.accessibility.section.motor")}
  </p>

  <SettingsGroup
    label={t("settings.accessibility.motor.group.targets")}
    icon="mouse"
  >
    <SettingsRow
      label={t("settings.accessibility.motor.largeTargets.label")}
      hint={t("settings.accessibility.motor.largeTargets.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.motor.largeTargets.aria")}
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
      label={t("settings.accessibility.motor.largeScrollbars.label")}
      hint={t("settings.accessibility.motor.largeScrollbars.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.motor.largeScrollbars.aria")}
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
      label={t("settings.accessibility.motor.largeTimeline.label")}
      hint={t("settings.accessibility.motor.largeTimeline.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.motor.largeTimeline.aria")}
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

  <SettingsGroup
    label={t("settings.accessibility.motor.group.playback")}
    icon="play"
  >
    <SettingsRow
      label={t("settings.accessibility.motor.alwaysShowControls.label")}
      hint={t("settings.accessibility.motor.alwaysShowControls.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t(
              "settings.accessibility.motor.alwaysShowControls.aria",
            )}
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

  <SettingsGroup
    label={t("settings.accessibility.motor.group.access")}
    icon="shield"
  >
    <SettingsRow
      label={t("settings.accessibility.motor.shortcutSheet.label")}
      hint={t("settings.accessibility.motor.shortcutSheet.hint")}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          onclick={() => keybindStore.toggleCheatSheet()}
        >
          {t("settings.accessibility.motor.shortcutSheet.button")}
        </button>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.motor.reducePan.label")}
      hint={t("settings.accessibility.motor.reducePan.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.motor.reducePan.aria")}
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
      label={t("settings.accessibility.motor.skipDelete.label")}
      hint={t("settings.accessibility.motor.skipDelete.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.motor.skipDelete.aria")}
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
