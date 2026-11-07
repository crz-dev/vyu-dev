<script lang="ts">
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { playbackPrefs } from "$lib/features/media/playbackPrefs.svelte";
  import { loopModeStore } from "$lib/features/media/loopMode.svelte";
  import { sleepTimer } from "$lib/features/media/sleepTimer.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

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
  let relativeSeekPreview = $state(playbackPrefs.relativeSeekStep);

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
  $effect(() => {
    relativeSeekPreview = playbackPrefs.relativeSeekStep;
  });

  function formatResumeThreshold(seconds: number): string {
    if (seconds <= 0) return t("settings.playback.threshold.any");
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
    {t("settings.sections.playback")}
  </p>

  <SettingsGroup label={t("settings.playback.group.resume")} icon="rewind">
    <SettingsRow
      label={t("settings.playback.resume.label")}
      hint={t("settings.playback.resume.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          <button
            class="pill-btn"
            class:active={playbackPrefs.resumeMode === "off"}
            onclick={() => playbackPrefs.setResumeMode("off")}
            >{t("settings.playback.resume.off")}</button
          >
          <button
            class="pill-btn"
            class:active={playbackPrefs.resumeMode === "ask"}
            onclick={() => playbackPrefs.setResumeMode("ask")}
            >{t("settings.playback.resume.ask")}</button
          >
          <button
            class="pill-btn"
            class:active={playbackPrefs.resumeMode === "always"}
            onclick={() => playbackPrefs.setResumeMode("always")}
            >{t("settings.playback.resume.always")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.playback.threshold.label")}
      hint={t("settings.playback.threshold.hint")}
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
            aria-label={t("settings.playback.threshold.aria")}
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

  <SettingsGroup label={t("settings.playback.group.audioSpeed")} icon="volume">
    <SettingsRow
      label={t("settings.playback.volumeBoost.label")}
      hint={t("settings.playback.volumeBoost.hint")}
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
      label={t("settings.playback.rememberVolume.label")}
      hint={t("settings.playback.rememberVolume.hint")}
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
      label={t("settings.playback.defaultVolume.label")}
      hint={t("settings.playback.defaultVolume.hint")}
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
            aria-label={t("settings.playback.defaultVolume.aria")}
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
      label={t("settings.playback.backgroundAudio.label")}
      hint={t("settings.playback.backgroundAudio.hint")}
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

    <SettingsRow
      label={t("settings.playback.rememberSpeed.label")}
      hint={t("settings.playback.rememberSpeed.hint")}
    >
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
      label={t("settings.playback.defaultSpeed.label")}
      hint={t("settings.playback.defaultSpeed.hint")}
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
            aria-label={t("settings.playback.defaultSpeed.aria")}
            value={speedPreview}
            oninput={(e) => (speedPreview = Number(e.currentTarget.value))}
            onchange={(e) =>
              playbackPrefs.setDefaultSpeed(Number(e.currentTarget.value))}
          />
          <span class="settings-slider-value">{formatSpeed(speedPreview)}</span>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.playback.relativeSeek.label")}
      hint={t("settings.playback.relativeSeek.hint")}
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            aria-label={t("settings.playback.relativeSeek.aria")}
            checked={playbackPrefs.relativeSeek}
            onchange={(e) =>
              playbackPrefs.setRelativeSeek(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={playbackPrefs.relativeSeek}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.playback.seekStep.label")}
      hint={playbackPrefs.relativeSeek
        ? t("settings.playback.seekStep.hint.relative")
        : t("settings.playback.seekStep.hint.absolute")}
      subrow
    >
      {#snippet control()}
        <div class="settings-slider-control">
          <input
            type="range"
            min="1"
            max={playbackPrefs.relativeSeek ? 100 : 60}
            step="1"
            aria-label={t("settings.playback.seekStep.aria")}
            value={playbackPrefs.relativeSeek
              ? relativeSeekPreview
              : seekPreview}
            oninput={(e) => {
              const value = Number(e.currentTarget.value);
              if (playbackPrefs.relativeSeek) relativeSeekPreview = value;
              else seekPreview = value;
            }}
            onchange={(e) => {
              const value = Number(e.currentTarget.value);
              if (playbackPrefs.relativeSeek)
                playbackPrefs.setRelativeSeekStep(value);
              else playbackPrefs.setSeekStep(value);
            }}
          />
          <span class="settings-slider-value">
            {playbackPrefs.relativeSeek
              ? `${relativeSeekPreview}%`
              : `${seekPreview}s`}
          </span>
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label={t("settings.playback.group.playback")} icon="play">
    <SettingsRow
      label={t("settings.playback.autoplay.label")}
      hint={t("settings.playback.autoplay.hint")}
    >
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

    <SettingsRow
      label={t("settings.playback.end.label")}
      hint={t("settings.playback.end.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-4 pill-group-end">
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "stop"}
            onclick={() => loopModeStore.setMode("stop")}
            >{t("settings.playback.end.stop")}</button
          >
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "loop"}
            onclick={() => loopModeStore.setMode("loop")}
            >{t("settings.playback.end.loop")}</button
          >
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "next"}
            onclick={() => loopModeStore.setMode("next")}
            >{t("settings.playback.end.next")}</button
          >
          <button
            class="pill-btn"
            class:active={loopModeStore.loopMode === "shuffle"}
            onclick={() => loopModeStore.setMode("shuffle")}
            >{t("settings.playback.end.shuffle")}</button
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.playback.sleep.label")}
      hint={sleepTimer.active
        ? t("settings.playback.sleep.active", { time: sleepTimer.label })
        : t("settings.playback.sleep.hint")}
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
      label={t("settings.playback.sleep.length.label")}
      hint={t("settings.playback.sleep.length.hint")}
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
              aria-label={t("settings.playback.sleep.aria")}
              value={sleepMinutesPreview}
              oninput={(e) =>
                (sleepMinutesPreview = Number(e.currentTarget.value))}
              onchange={(e) =>
                handleSleepMinutes(Number(e.currentTarget.value))}
            />
            <span class="settings-slider-value" style="min-width: 54px"
              >{t("settings.playback.sleep.minutes", {
                count: sleepMinutesPreview,
              })}</span
            >
          </div>
          <button class="settings-action-btn" onclick={toggleSleepRunning}>
            {sleepTimer.active
              ? t("settings.playback.sleep.pause")
              : t("settings.playback.sleep.start")}
          </button>
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
