<script lang="ts">
  import "../app.css";
  import { theme } from "$lib/features/theme/theme.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";

  let { children } = $props();

  appearance.init();

  let overlayEl = $state<HTMLDivElement | null>(null);
  let expandTimer: ReturnType<typeof setTimeout> | null = null;
  let fadeTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers() {
    if (expandTimer) {
      clearTimeout(expandTimer);
      expandTimer = null;
    }
    if (fadeTimer) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
  }

  function syncOverlayVars(el: HTMLElement) {
    el.style.setProperty("--theme-target-bg", theme.transition.targetBg);
    el.style.setProperty("--theme-ox", `${theme.transition.originX}px`);
    el.style.setProperty("--theme-oy", `${theme.transition.originY}px`);
  }

  $effect(() => {
    try {
      const t = theme.transition;
      if (!t.active) {
        clearTimers();
        return;
      }

      const el = overlayEl;
      if (!el) {
        clearTimers();
        return;
      }
      const id = t.id;

      if (t.phase === "expanding") {
        clearTimers();
        el.classList.remove("animating", "fading", "expanding");
        syncOverlayVars(el);
        void el.offsetWidth;
        el.classList.add("animating");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (theme.transition.id !== id) return;
            el.classList.add("expanding");
          });
        });

        expandTimer = setTimeout(() => {
          expandTimer = null;
          theme.onExpandComplete(id);
        }, 400);
      }

      if (t.phase === "fading") {
        clearTimers();
        el.classList.remove("expanding");
        el.classList.add("fading");

        fadeTimer = setTimeout(() => {
          fadeTimer = null;
          if (theme.transition.id !== id) return;
          el.classList.remove("animating", "expanding", "fading");
          theme.onTransitionComplete(id);
        }, 500);
      }

      return clearTimers;
    } catch (e) {
      console.error("Theme transition effect failed:", e);
    }
  });
</script>

{#if theme.transition.active}
  <div class="theme-transition-overlay" bind:this={overlayEl}></div>
{/if}

{@render children()}
