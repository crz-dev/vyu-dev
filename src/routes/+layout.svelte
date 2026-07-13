<script lang="ts">
  import "../app.css";
  import { theme } from "$lib/features/theme/theme.svelte";

  let { children } = $props();

  let overlayEl = $state<HTMLDivElement | null>(null);
  let expandTimer: ReturnType<typeof setTimeout> | null = null;

  function syncOverlayVars(el: HTMLElement) {
    el.style.setProperty("--theme-target-bg", theme.transition.targetBg);
    el.style.setProperty("--theme-ox", `${theme.transition.originX}px`);
    el.style.setProperty("--theme-oy", `${theme.transition.originY}px`);
  }

  $effect(() => {
    try {
      const t = theme.transition;
      if (!t.active) return;

      const el = overlayEl;
      if (!el) return;

      if (t.phase === "expanding") {
        syncOverlayVars(el);
        el.classList.add("animating");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            el.classList.add("expanding");
          });
        });

        if (expandTimer) clearTimeout(expandTimer);
        expandTimer = setTimeout(() => {
          theme.onExpandComplete();
        }, 400);
      }

      if (t.phase === "fading") {
        el.classList.remove("expanding");
        el.classList.add("fading");

        setTimeout(() => {
          el.classList.remove("animating", "expanding", "fading");
          theme.onTransitionComplete();
        }, 500);
      }

      return () => {
        if (expandTimer) clearTimeout(expandTimer);
      };
    } catch (e) {
      console.error("Theme transition effect failed:", e);
    }
  });
</script>

{#if theme.transition.active}
  <div class="theme-transition-overlay" bind:this={overlayEl}></div>
{/if}

{@render children()}
