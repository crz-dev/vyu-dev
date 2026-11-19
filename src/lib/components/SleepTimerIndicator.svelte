<script lang="ts">
  import { fly } from "svelte/transition";
  import { sleepTimer } from "$lib/features/media/sleepTimer.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let { onOpen }: { onOpen: () => void } = $props();
</script>

{#if sleepTimer.active}
  <button
    class="sleep-timer-indicator tooltip-above"
    class:closing={sleepTimer.closeApp}
    transition:fly={{ y: 8, duration: 180, opacity: 0.08 }}
    onclick={onOpen}
    data-tooltip={sleepTimer.closeApp
      ? t("menus.sleep.indicatorCloseApp", { time: sleepTimer.label })
      : t("menus.sleep.indicatorAria", { time: sleepTimer.label })}
    aria-label={t("menus.sleep.indicatorAria", { time: sleepTimer.label })}
  >
    <svg
      width="11"
      height="11"
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
    <span>{sleepTimer.label}</span>
    {#if sleepTimer.closeApp}
      <svg
        class="sleep-timer-power"
        width="9"
        height="9"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2.2"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path d="M12 2v10" />
        <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
      </svg>
    {/if}
  </button>
{/if}
