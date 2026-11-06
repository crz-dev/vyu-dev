<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { profiles } from "$lib/features/profiles/profiles.svelte";

  let { flash = false }: { flash?: boolean } = $props();
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
    Profiles
  </p>

  <SettingsGroup label="Switching" icon="refresh">
    <SettingsRow
      label="Remember Last Profile"
      hint="Reopen the profile you used last"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Remember last profile"
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
      label="Startup Profile"
      hint="Profile to open when Vyu starts"
      subrow
      open={!profiles.preferences.rememberLast}
    >
      {#snippet control()}
        <select
          class="profile-startup-select"
          aria-label="Startup profile"
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
      label="Confirm Before Switching"
      hint="Ask before replacing the current profile settings"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Confirm before switching profiles"
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

  <SettingsGroup label="Library and Accessibility" icon="accessibility">
    <SettingsRow
      label="Profile-Specific Library"
      hint="Keep collections, favorites, recents and layout separate per profile"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Profile-specific library"
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
      label="Universal Accessibility"
      hint="Use the same accessibility settings across every profile"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Universal accessibility"
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
