<script lang="ts">
  import "../app.css";
  import { theme } from "$lib/features/theme/theme.svelte";

  let { children } = $props();

  let overlayEl = $state<HTMLDivElement | null>(null);
  let expandTimer: ReturnType<typeof setTimeout> | null = null;

  // Set CSS custom properties on the overlay element
  function syncOverlayVars(el: HTMLElement) {
    el.style.setProperty("--theme-target-bg", theme.transition.targetBg);
    el.style.setProperty("--theme-ox", `${theme.transition.originX}px`);
    el.style.setProperty("--theme-oy", `${theme.transition.originY}px`);
  }

  // React to transition state changes
  $effect(() => {
    const t = theme.transition;
    if (!t.active) return;

    const el = overlayEl;
    if (!el) return;

    if (t.phase === "expanding") {
      syncOverlayVars(el);
      // Force layout, then start animation
      el.classList.add("animating");
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add("expanding");
        });
      });

      // After expand duration (400ms), swap theme and fade
      if (expandTimer) clearTimeout(expandTimer);
      expandTimer = setTimeout(() => {
        theme.onExpandComplete();
      }, 400);
    }

    if (t.phase === "fading") {
      // Remove expanding, add fading
      el.classList.remove("expanding");
      el.classList.add("fading");

      // After fade duration (500ms), cleanup
      setTimeout(() => {
        el.classList.remove("animating", "expanding", "fading");
        theme.onTransitionComplete();
      }, 500);
    }

    return () => {
      if (expandTimer) clearTimeout(expandTimer);
    };
  });
</script>

{#if theme.transition.active}
  <div class="theme-transition-overlay" bind:this={overlayEl}></div>
{/if}

{@render children()}
