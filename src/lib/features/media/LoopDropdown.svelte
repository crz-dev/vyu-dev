<script lang="ts">
  import type { LoopMode } from "$lib/shared/constants";
  import { TS_DROP_ANIM_DELAYS_MS } from "$lib/features/menus/dropAnimations";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    open,
    onClose,
    looping,
    setLoopMode,
    isAudio = true,
  }: {
    open: boolean;
    onClose: () => void;
    looping: LoopMode;
    setLoopMode: (mode: LoopMode) => void;
    isAudio?: boolean;
  } = $props();

  const modes: { mode: LoopMode; key: string }[] = [
    { mode: "stop", key: "media.loop.mode.stop" },
    { mode: "next", key: "media.loop.mode.next" },
    { mode: "loop", key: "media.loop.mode.loop" },
    { mode: "shuffle", key: "media.loop.mode.shuffle" },
  ];

  function animStyle(index: number): string {
    return `animation: tsDropItemPopIn 200ms cubic-bezier(0.22, 0.8, 0.3, 1) backwards; animation-delay: ${TS_DROP_ANIM_DELAYS_MS[index]}ms`;
  }

  function selectMode(mode: LoopMode) {
    setLoopMode(mode);
    onClose();
  }
</script>

{#if open}
  <div class="loop-drop-menu" role="menu">
    <div class="loop-drop-header" style={animStyle(0)}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="2"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>{t("media.loop.afterPlayback")}</span>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="2"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div class="edit-menu-card">
      <div class="loop-drop-grid">
        {#each modes as { mode, key }, i (mode)}
          <button
            class="loop-drop-btn"
            class:active={looping === mode}
            style={animStyle(i + 1)}
            onclick={() => selectMode(mode)}
            role="menuitemradio"
            aria-checked={looping === mode}
          >
            {#if mode === "stop"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <rect
                  x="4"
                  y="4"
                  width="16"
                  height="16"
                  rx="2"
                  stroke="currentColor"
                  stroke-width="2"
                />
              </svg>
            {:else if mode === "next"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path d="M5 4l10 8-10 8V4z" fill="currentColor" />
                <rect
                  x="19"
                  y="4"
                  width="2"
                  height="16"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
            {:else if mode === "loop"}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M17 2L21 6L17 10"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M3 11V9C3 7.9 3.9 7 5 7H21"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
                <path
                  d="M7 22L3 18L7 14"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M21 13V15C21 16.1 20.1 17 19 17H3"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            {:else}
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M3 7h5l9 10h4" />
                <path d="M3 17h5l2-2.2" />
                <path d="M17 5l4 4-4 4" />
                <path d="M17 13l4 4-4 4" />
              </svg>
            {/if}
            {t(key)}
          </button>
        {/each}
        {#if isAudio}
          <button
            class="loop-drop-btn loop-drop-btn-full"
            class:active={looping === "shuffle-songs"}
            style={animStyle(5)}
            onclick={() => selectMode("shuffle-songs")}
            role="menuitemradio"
            aria-checked={looping === "shuffle-songs"}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
            {t("media.loop.mode.shuffleSongs")}
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
