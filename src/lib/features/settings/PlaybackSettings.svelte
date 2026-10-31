<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
  import { loopModeStore } from "$lib/features/media/loopMode.svelte";
  import { sleepTimer } from "$lib/features/media/sleepTimer.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  let sleepEnabled = $state(sleepTimer.active);
  let sleepMinutesPreview = $state(sleepTimer.minutes);

  function toggleSleepTimer(enabled: boolean) {
    sleepEnabled = enabled;
    if (!enabled) sleepTimer.clear();
  }

  function handleSleepMinutes(value: number) {
    sleepMinutesPreview = value;
    if (sleepTimer.active) sleepTimer.start(value);
  }

  function toggleSleepRunning() {
    if (sleepTimer.active) sleepTimer.clear();
    else sleepTimer.start(sleepMinutesPreview);
  }

  let thresholdPreview = $state(playbackPrefs.resumeThreshold);
  let speedPreview = $state(playbackPrefs.defaultSpeed);
  let volumePreview = $state(playbackPrefs.defaultVolume);
  let seekPreview = $state(playbackPrefs.seekStep);

  $effect(() => {
    thresholdPreview = playbackPrefs.resumeThreshold;
  });
  $effect(() => {
    speedPreview = playbackPrefs.defaultSpeed;
  });
  $effect(() => {
    volumePreview = playbackPrefs.defaultVolume;
  });
  $effect(() => {
    seekPreview = playbackPrefs.seekStep;
  });

  function formatResumeThreshold(seconds: number): string {
    if (seconds <= 0) return "Any";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
  }

  function formatSpeed(speed: number): string {
    return `${Number(speed.toFixed(2))}x`;
  }

  function formatVolume(value: number): string {
    return `${Math.round(value * 100)}%`;
  }
</script>

<div id="settings-section-playback" class="settings-section" class:flash>
  <p class="settings-section-header">
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3" /></svg
    >
    Playback
  </p>

  <SettingsGroup label="Resume" icon="rewind">
    <SettingsRow
      label="Resume Playback"
      hint="Remember where each file stopped"
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          <button
            class="pill-btn"
            class:active={playbackPrefs.resumeMode === "off"}
            onclick={() => playbackPrefs.setResumeMode("off")}>Off</button
          >
          <button
            class="pill-btn"
            class:active={playbackPrefs.resumeMode === "ask"}
            onclick={() => playbackPrefs.setResumeMode("ask")}>Ask</button
          >
          <button
            class="pill-btn"
            class:active={playbackPrefs.resumeMode === "always"}
            onclick={() => playbackPrefs.setResumeMode("always")}>Always</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Resume Threshold"
      hint="Only resume after this much playback"
      subrow
      open={playbackPrefs.resumeMode !== "off"}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="0"
            max="900"
            step="30"
            aria-label="Resume threshold"
            value={900 - thresholdPreview}
            oninput={(e) =>
              (thresholdPreview = 900 - Number(e.currentTarget.value))}
            onchange={(e) =>
              playbackPrefs.setResumeThreshold(
                900 - Number(e.currentTarget.value),
              )}
          />
          <span class="settings-slider-value" style="min-width: 54px"
            >{formatResumeThreshold(thresholdPreview)}</span
          >
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Audio & Speed" icon="volume">
    <SettingsRow
      label="Volume Boost"
      hint="Raise output up to 200%; may clip loud audio"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={playbackPrefs.volumeBoost}
            onchange={(e) =>
              playbackPrefs.setVolumeBoost(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={playbackPrefs.volumeBoost}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Remember Volume"
      hint="Restore the last volume on launch"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={playbackPrefs.rememberVolume}
            onchange={(e) =>
              playbackPrefs.setRememberVolume(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={playbackPrefs.rememberVolume}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Default Volume"
      hint="Volume used when Vyu opens"
      subrow
      open={!playbackPrefs.rememberVolume}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            aria-label="Default volume"
            value={volumePreview}
            oninput={(e) => (volumePreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              playbackPrefs.setDefaultVolume(Number(e.currentTarget.value))}
          />
          <span class="settings-slider-value"
            >{formatVolume(volumePreview)}</span
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Background Audio in Library"
      hint="Continue audio while the Library is open"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={playbackPrefs.keepAudio}
            onchange={(e) =>
              playbackPrefs.setKeepAudio(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={playbackPrefs.keepAudio}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Remember Speed" hint="Restore the last playback speed">
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={playbackPrefs.rememberSpeed}
            onchange={(e) =>
              playbackPrefs.setRememberSpeed(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={playbackPrefs.rememberSpeed}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Default Speed"
      hint="Speed used when a file opens"
      subrow
      open={!playbackPrefs.rememberSpeed}
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            aria-label="Default playback speed"
            value={speedPreview}
            oninput={(e) => (speedPreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              playbackPrefs.setDefaultSpeed(Number(e.currentTarget.value))}
          />
          <span class="settings-slider-value">{formatSpeed(speedPreview)}</span>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="Seek Step" hint="Seconds moved by arrow seeks">
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="1"
            max="60"
            step="1"
            aria-label="Seek step"
            value={seekPreview}
            oninput={(e) => (seekPreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              playbackPrefs.setSeekStep(Number(e.currentTarget.value))}
          />
          <span class="settings-slider-value">{seekPreview}s</span>
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Playback" icon="play">
    <SettingsRow label="Autoplay Media" hint="Start playing when a file opens">
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={playbackPrefs.autoplay}
            onchange={(e) => playbackPrefs.setAutoplay(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={playbackPrefs.autoplay}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow label="End of Playback" hint="What happens when a file ends">
      {#snippet control()}
        <div class="pill-group pill-group-4 pill-group-end">
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "stop"}
            onclick={() => loopModeStore.setMode("stop")}>Stop</button
          >
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "loop"}
            onclick={() => loopModeStore.setMode("loop")}>Loop</button
          >
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "next"}
            onclick={() => loopModeStore.setMode("next")}>Next</button
          >
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "shuffle"}
            onclick={() => loopModeStore.setMode("shuffle")}>Shuffle</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Sleep Timer"
      hint={sleepTimer.active
        ? `Stops playback in ${sleepTimer.label}`
        : "Stop playback after a set time"}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={sleepEnabled}
            onchange={(e) => toggleSleepTimer(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={sleepEnabled}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Timer Length"
      hint="How long until playback stops"
      subrow
      open={sleepEnabled}
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <div class="settings-slider-control">
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              aria-label="Sleep timer length"
              value={sleepMinutesPreview}
              oninput={(e) =>
                (sleepMinutesPreview = Number(e.currentTarget.value))}
              onchange={(e) =>
                handleSleepMinutes(Number(e.currentTarget.value))}
            />
            <span class="settings-slider-value" style="min-width: 54px"
              >{sleepMinutesPreview} min</span
            >
          </div>
          <button class="settings-action-btn" onclick={toggleSleepRunning}>
            {sleepTimer.active ? "Pause" : "Start"}
          </button>
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
