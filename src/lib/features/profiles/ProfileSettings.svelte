<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { profiles } from "$lib/features/profiles/profiles.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;
</script>

<div id="accessibility-section-profiles" class="settings-section" class:flash>
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
      ><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle
        cx="9"
        cy="7"
        r="4"
      /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path
        d="M16 3.13a4 4 0 010 7.75"
      /></svg
    >
    {t("settings.profiles.header")}
  </p>

  <SettingsGroup label={t("settings.profiles.group.switching")} icon="refresh">
    <SettingsRow
      label={t("settings.profiles.rememberLast.label")}
      hint={t("settings.profiles.rememberLast.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.profiles.rememberLast.aria")}
            checked={profiles.preferences.rememberLast}
            onchange={(e) => profiles.setRememberLast(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={profiles.preferences.rememberLast}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.profiles.startup.label")}
      hint={t("settings.profiles.startup.hint")}
      subrow
      open={!profiles.preferences.rememberLast}
    >
      {#snippet control()}
        <select
          class="profile-startup-select"
          aria-label={t("settings.profiles.startup.aria")}
          value={profiles.preferences.startupProfileId ?? profiles.activeId}
          onchange={(e) => profiles.setStartupProfile(e.currentTarget.value)}
        >
          {#each profiles.list as profile (profile.id)}
            <option value={profile.id}>{profile.name}</option>
          {/each}
        </select>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.profiles.confirmSwitch.label")}
      hint={t("settings.profiles.confirmSwitch.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.profiles.confirmSwitch.aria")}
            checked={profiles.preferences.confirmSwitch}
            onchange={(e) => profiles.setConfirmSwitch(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={profiles.preferences.confirmSwitch}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup
    label={t("settings.profiles.group.library")}
    icon="accessibility"
  >
    <SettingsRow
      label={t("settings.profiles.libraryIsolation.label")}
      hint={t("settings.profiles.libraryIsolation.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.profiles.libraryIsolation.aria")}
            checked={profiles.preferences.libraryIsolation}
            onchange={(e) =>
              profiles.setLibraryIsolation(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={profiles.preferences.libraryIsolation}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.profiles.universalAccessibility.label")}
      hint={t("settings.profiles.universalAccessibility.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.profiles.universalAccessibility.aria")}
            checked={profiles.preferences.universalAccessibility}
            onchange={(e) =>
              profiles.setUniversalAccessibility(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={profiles.preferences.universalAccessibility}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
