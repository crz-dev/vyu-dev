<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;
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
    {t("settings.accessibility.section.cognitive")}
  </p>

  <SettingsGroup
    label={t("settings.accessibility.cognitive.group.focus")}
    icon="eye"
  >
    <SettingsRow
      label={t("settings.accessibility.cognitive.reduceDistractions.label")}
      hint={t("settings.accessibility.cognitive.reduceDistractions.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t(
              "settings.accessibility.cognitive.reduceDistractions.aria",
            )}
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
      label={t("settings.accessibility.cognitive.focusMode.label")}
      hint={t("settings.accessibility.cognitive.focusMode.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.cognitive.focusMode.aria")}
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
      label={t("settings.accessibility.cognitive.hideDetails.label")}
      hint={t("settings.accessibility.cognitive.hideDetails.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.cognitive.hideDetails.aria")}
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
      label={t("settings.accessibility.cognitive.simplifiedMenus.label")}
      hint={t("settings.accessibility.cognitive.simplifiedMenus.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t(
              "settings.accessibility.cognitive.simplifiedMenus.aria",
            )}
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
