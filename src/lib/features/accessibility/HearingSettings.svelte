<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { accessibility } from "$lib/features/menus/accessibility.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  let volumeLimitPreview = $state(Math.round(accessibility.volumeLimit * 100));
  let balancePreview = $state(accessibility.balance);

  $effect(() => {
    volumeLimitPreview = Math.round(accessibility.volumeLimit * 100);
  });

  $effect(() => {
    balancePreview = accessibility.balance;
  });

  function balanceLabel(value: number): string {
    if (value <= -0.05) return `L ${Math.round(Math.abs(value) * 100)}%`;
    if (value >= 0.05) return `R ${Math.round(value * 100)}%`;
    return "Center";
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
    Hearing
  </p>

  <SettingsGroup label="Output" icon="volume">
    <SettingsRow
      label="Volume Limit"
      hint="Cap the maximum output level to protect hearing"
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="20"
            max="100"
            step="5"
            aria-label="Volume limit"
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
      label="Mono Audio"
      hint="Combine left and right channels into one"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Mono Audio"
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

    <SettingsRow label="Left / Right Balance" hint="Pan audio between channels">
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="-100"
            max="100"
            step="5"
            aria-label="Left and right balance"
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
      label="Volume Normalization"
      hint="Even out quiet and loud media automatically"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Volume Normalization"
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

  <SettingsGroup label="Clarity" icon="sliders">
    <SettingsRow
      label="Reduce Loud Sounds"
      hint="Limit sudden peaks and loud passages"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Reduce Loud Sounds"
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
      label="Boost Quiet Dialogue"
      hint="Lift speech frequencies for clearer dialogue"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Boost Quiet Dialogue"
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

  <SettingsGroup label="Feedback" icon="info">
    <SettingsRow
      label="Visual Sound Alerts"
      hint="Flash the window edge on play and pause"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Visual Sound Alerts"
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
      label="Audio Cues"
      hint="Play short tones on playback and navigation actions"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label="Audio Cues"
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
