<script lang="ts">
  import { fly } from "svelte/transition";
  import { viewer } from "$lib/core/viewer.svelte";

  let {
    visible,
    onRotate,
    onFlip,
    onCrop,
    onApply,
    cropMode,
    brightness = 1,
    onBrightnessChange,
  }: {
    visible: boolean;
    onRotate: () => void;
    onFlip: () => void;
    onCrop: () => void;
    onApply: () => void;
    cropMode: boolean;
    brightness?: number;
    onBrightnessChange?: (value: number) => void;
  } = $props();

  let colorRowOpen = $state(false);
  let activeColorTool: "brightness" | null = $state(null);
  let sliderHovered = $state(false);
  let sliderEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (!visible) {
      colorRowOpen = false;
      activeColorTool = null;
    }
  });

  function toggleColorTool(tool: "brightness") {
    if (activeColorTool === tool) {
      activeColorTool = null;
    } else {
      activeColorTool = tool;
      colorRowOpen = true;
    }
  }

  function snapValue(val: number): number {
    if (Math.abs(val - 1) < 0.03) return 1;
    return val;
  }

  function handleSliderInput(e: Event) {
    const val = snapValue(parseFloat((e.target as HTMLInputElement).value));
    onBrightnessChange?.(val);
  }

  function closeBrightness() {
    activeColorTool = null;
    onBrightnessChange?.(1);
  }

  const scrubberTooltipVisible = $derived(activeColorTool === "brightness" && (sliderHovered || brightness !== 1));
  const scrubberPct = $derived(((brightness - 0) / (2 - 0)) * 100);
</script>

{#if visible}
  <div
    class="edit-menu"
    transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}
  >
    <div class="edit-menu-row">
      <button class="edit-menu-btn red" class:active={cropMode} onclick={() => cropMode ? viewer.cancelCrop() : onCrop()}>
        {#if cropMode}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          <span>Close</span>
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M6 2h12v20H6z" opacity="0.3"/>
            <path d="M2 6h20M2 18h20M6 2v20M18 2v20"/>
          </svg>
          <span>Crop</span>
        {/if}
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
      {#if activeColorTool === "brightness"}
        <button class="edit-menu-btn red brightness-close-btn" onclick={closeBrightness}>
          {#key activeColorTool}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span>Close</span>
          {/key}
        </button>
      {:else}
        <button class="edit-menu-btn blue" onclick={() => (colorRowOpen = !colorRowOpen)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20" fill="currentColor" opacity="0.25"/>
          </svg>
          <span>Color</span>
        </button>
      {/if}
    </div>

    {#if colorRowOpen}
      <div class="edit-menu-row" transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}>
        <button class="edit-menu-btn white" class:active={activeColorTool === "brightness"} onclick={() => toggleColorTool("brightness")}>
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

    {#if activeColorTool === "brightness"}
      <div class="color-slider-panel" transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}>
        <div class="color-slider-track">
          <input
            type="range"
            class="color-slider"
            bind:this={sliderEl}
            min="0"
            max="2"
            step="0.01"
            value={brightness}
            oninput={handleSliderInput}
            onmouseenter={() => (sliderHovered = true)}
            onmouseleave={() => (sliderHovered = false)}
          />
          <div class="color-slider-scrubber" style="left: {scrubberPct}%"></div>
        </div>
        {#if scrubberTooltipVisible}
          <div class="color-scrubber-tooltip" style="left: {scrubberPct}%">
            <span>{brightness.toFixed(2)}</span>
          </div>
        {/if}
      </div>
    {/if}

    {#if cropMode}
      <div class="edit-menu-row crop-actions" transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}>
        <button class="edit-menu-btn crop-btn reset" onclick={() => viewer.resetCrop()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          <span>Reset</span>
        </button>
        <button class="edit-menu-btn crop-btn apply" onclick={onApply}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span>Apply</span>
        </button>
      </div>
    {/if}
  </div>
{/if}
