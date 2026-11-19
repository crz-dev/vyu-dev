<script lang="ts">
  import { fly } from "svelte/transition";
  import { sleepTimer } from "$lib/features/media/sleepTimer.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    visible,
    onClose,
  }: {
    visible: boolean;
    onClose: () => void;
  } = $props();

  const presets = [15, 30, 45, 60, 90];
  let minutesPreview = $state(sleepTimer.minutes);

  $effect(() => {
    if (visible) minutesPreview = sleepTimer.minutes;
  });

  function startTimer() {
    sleepTimer.start(minutesPreview);
    onClose();
  }

  function stopTimer() {
    sleepTimer.clear();
    onClose();
  }

  function formatMinutes(value: number): string {
    return t("menus.sleep.minutes", { count: value });
  }

  function handleWindowMouseDown(e: MouseEvent) {
    if (
      visible &&
      !(e.target as HTMLElement).closest(".sleep-timer-menu") &&
      !(e.target as HTMLElement).closest(".sleep-timer-indicator")
    ) {
      onClose();
    }
  }
</script>

<svelte:window onmousedown={handleWindowMouseDown} />

{#if visible}
  <div
    class="sleep-timer-menu"
    role="dialog"
    tabindex="-1"
    aria-label={t("menus.sleep.title")}
    transition:fly={{ y: 8, duration: 150, opacity: 0.08 }}
    onkeydown={(e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }}
  >
    <div class="sleep-timer-header">
      <span class="sleep-timer-title">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        {t("menus.sleep.title")}
      </span>
      <button
        class="sleep-timer-close"
        onclick={onClose}
        aria-label={t("menus.common.close")}
      >
        <svg
          width="9"
          height="9"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          aria-hidden="true"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    {#if sleepTimer.active}
      <div class="sleep-timer-countdown">
        <span class="sleep-timer-remaining">{sleepTimer.label}</span>
        <span class="sleep-timer-hint"
          >{sleepTimer.closeApp
            ? t("menus.sleep.closeAppActive")
            : t("menus.sleep.activeHint")}</span
        >
      </div>
    {:else}
      <p class="sleep-timer-hint">{t("menus.sleep.hint")}</p>
    {/if}

    <div class="sleep-timer-presets">
      {#each presets as preset (preset)}
        <button
          class="sleep-preset-btn"
          class:active={minutesPreview === preset}
          onclick={() => (minutesPreview = preset)}
          aria-label={t("menus.sleep.setPreset", { count: preset })}
        >
          {preset}m
        </button>
      {/each}
    </div>

    <div class="sleep-timer-slider">
      <input
        type="range"
        min="5"
        max="120"
        step="5"
        aria-label={t("menus.sleep.lengthAria")}
        value={minutesPreview}
        oninput={(e) => (minutesPreview = Number(e.currentTarget.value))}
      />
      <span class="sleep-timer-minutes">{formatMinutes(minutesPreview)}</span>
    </div>

    <button
      class="sleep-timer-option"
      class:on={sleepTimer.closeApp}
      onclick={() => sleepTimer.setCloseApp(!sleepTimer.closeApp)}
      aria-pressed={sleepTimer.closeApp}
    >
      <span>{t("menus.sleep.closeApp")}</span>
      <span class="sleep-timer-switch" aria-hidden="true">
        <span class="sleep-timer-knob"></span>
      </span>
    </button>

    <div class="sleep-timer-actions">
      <button class="sleep-timer-start" onclick={startTimer}>
        {sleepTimer.active ? t("menus.sleep.restart") : t("menus.sleep.start")}
      </button>
      {#if sleepTimer.active}
        <button class="sleep-timer-stop" onclick={stopTimer}>
          {t("menus.sleep.stop")}
        </button>
      {/if}
    </div>
  </div>
{/if}
