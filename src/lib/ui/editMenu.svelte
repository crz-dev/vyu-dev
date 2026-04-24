<script lang="ts">
  import { fly } from "svelte/transition";

  let {
    visible,
    onRotate,
    onFlip,
  }: {
    visible: boolean;
    onRotate: () => void;
    onFlip: () => void;
  } = $props();

  let colorRowOpen = $state(false);

  $effect(() => {
    if (!visible) colorRowOpen = false;
  });
</script>

{#if visible}
  <div
    class="edit-menu"
    transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}
  >
    <div class="edit-menu-row">
      <button class="edit-menu-btn red">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 2h12v20H6z" opacity="0.3"/>
          <path d="M2 6h20M2 18h20M6 2v20M18 2v20"/>
        </svg>
        <span>Crop</span>
      </button>
      <button class="edit-menu-btn yellow" onclick={onRotate}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6"/>
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8"/>
          <path d="M3 22v-6h6"/>
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>
        </svg>
        <span>Rotate</span>
      </button>
      <button class="edit-menu-btn green" onclick={onFlip}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v18"/>
          <path d="M16 7l4 5-4 5"/>
          <path d="M8 7l-4 5 4 5"/>
        </svg>
        <span>Flip</span>
      </button>
      <button class="edit-menu-btn blue" onclick={() => (colorRowOpen = !colorRowOpen)}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20" fill="currentColor" opacity="0.25"/>
        </svg>
        <span>Color</span>
      </button>
    </div>

    {#if colorRowOpen}
      <div class="edit-menu-row" transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}>
        <button class="edit-menu-btn white">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5"/>
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
          </svg>
          <span>Brightness</span>
        </button>
        <button class="edit-menu-btn white">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>Contrast</span>
        </button>
        <button class="edit-menu-btn white">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" opacity="0.3"/>
          </svg>
          <span>Saturation</span>
        </button>
        <button class="edit-menu-btn white">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20"/>
            <path d="M12 12l5-2"/>
            <path d="M12 12l1 5"/>
          </svg>
          <span>Hue</span>
        </button>
      </div>
    {/if}
  </div>
{/if}
