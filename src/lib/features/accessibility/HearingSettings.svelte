<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

  let volumeLimitPreview = $state(Math.round(accessibility.volumeLimit * 100));
  let balancePreview = $state(accessibility.balance);

  $effect(() => {
    volumeLimitPreview = Math.round(accessibility.volumeLimit * 100);
  });

  $effect(() => {
    balancePreview = accessibility.balance;
  });

  function balanceLabel(value: number): string {
    if (value <= -0.05) {
      return t("settings.accessibility.hearing.balance.left", {
        value: Math.round(Math.abs(value) * 100),
      });
    }
    if (value >= 0.05) {
      return t("settings.accessibility.hearing.balance.right", {
        value: Math.round(value * 100),
      });
    }
    return t("settings.accessibility.hearing.balance.center");
  }
</script>

<div id="accessibility-section-hearing" class="settings-section" class:flash>
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
      ><path d="M11 5L6 9H2v6h4l5 4V5z" /><path
        d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"
      /></svg
    >
    {t("settings.accessibility.section.hearing")}
  </p>

  <SettingsGroup
    label={t("settings.accessibility.hearing.group.output")}
    icon="volume"
  >
    <SettingsRow
      label={t("settings.accessibility.hearing.volumeLimit.label")}
      hint={t("settings.accessibility.hearing.volumeLimit.hint")}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="20"
            max="100"
            step="5"
            aria-label={t("settings.accessibility.hearing.volumeLimit.aria")}
            value={volumeLimitPreview}
            oninput={(e) =>
              (volumeLimitPreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              accessibility.setVolumeLimit(Number(e.currentTarget.value) / 100)}
          />
          <span class="settings-slider-value">{volumeLimitPreview}%</span>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.hearing.mono.label")}
      hint={t("settings.accessibility.hearing.mono.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.hearing.mono.aria")}
            checked={accessibility.monoAudio}
            onchange={(e) =>
              accessibility.setMonoAudio(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.monoAudio}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.hearing.balance.label")}
      hint={t("settings.accessibility.hearing.balance.hint")}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="-100"
            max="100"
            step="5"
            aria-label={t("settings.accessibility.hearing.balance.aria")}
            value={Math.round(balancePreview * 100)}
            oninput={(e) =>
              (balancePreview = Number(e.currentTarget.value) / 100)}
            onchange={(e) =>
              accessibility.setBalance(Number(e.currentTarget.value) / 100)}
          />
          <span class="settings-slider-value" style="min-width: 62px"
            >{balanceLabel(balancePreview)}</span
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.hearing.normalize.label")}
      hint={t("settings.accessibility.hearing.normalize.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.hearing.normalize.aria")}
            checked={accessibility.normalizeVolume}
            onchange={(e) =>
              accessibility.setNormalizeVolume(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.normalizeVolume}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup
    label={t("settings.accessibility.hearing.group.clarity")}
    icon="sliders"
  >
    <SettingsRow
      label={t("settings.accessibility.hearing.limitPeaks.label")}
      hint={t("settings.accessibility.hearing.limitPeaks.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.hearing.limitPeaks.aria")}
            checked={accessibility.limitPeaks}
            onchange={(e) =>
              accessibility.setLimitPeaks(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.limitPeaks}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.hearing.boostDialogue.label")}
      hint={t("settings.accessibility.hearing.boostDialogue.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.hearing.boostDialogue.aria")}
            checked={accessibility.boostDialogue}
            onchange={(e) =>
              accessibility.setBoostDialogue(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.boostDialogue}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup
    label={t("settings.accessibility.hearing.group.feedback")}
    icon="info"
  >
    <SettingsRow
      label={t("settings.accessibility.hearing.visualAlerts.label")}
      hint={t("settings.accessibility.hearing.visualAlerts.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.hearing.visualAlerts.aria")}
            checked={accessibility.visualAlerts}
            onchange={(e) =>
              accessibility.setVisualAlerts(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.visualAlerts}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.accessibility.hearing.audioCues.label")}
      hint={t("settings.accessibility.hearing.audioCues.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.accessibility.hearing.audioCues.aria")}
            checked={accessibility.audioCues}
            onchange={(e) =>
              accessibility.setAudioCues(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={accessibility.audioCues}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
