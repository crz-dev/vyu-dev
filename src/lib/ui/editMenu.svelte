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
    contrast = 1,
    onContrastChange,
    saturation = 1,
    onSaturationChange,
    hue = 0,
    onHueChange,
  }: {
    visible: boolean;
    onRotate: () => void;
    onFlip: () => void;
    onCrop: () => void;
    onApply: () => void;
    cropMode: boolean;
    brightness?: number;
    onBrightnessChange?: (value: number) => void;
    contrast?: number;
    onContrastChange?: (value: number) => void;
    saturation?: number;
    onSaturationChange?: (value: number) => void;
    hue?: number;
    onHueChange?: (value: number) => void;
  } = $props();

  let colorRowOpen = $state(false);
  let activeColorTool: "brightness" | "contrast" | "saturation" | "hue" | null = $state(null);
  let sliderHovered = $state(false);
  let trackEl: HTMLDivElement | null = $state(null);
  let isDragging = $state(false);
  let localBrightness = $state(1);
  let localContrast = $state(1);
  let localSaturation = $state(1);
  let localHue = $state(0);

  $effect(() => {
    if (!visible) {
      colorRowOpen = false;
      activeColorTool = null;
    }
  });

  $effect(() => {
    localBrightness = brightness;
  });

  $effect(() => {
    localContrast = contrast;
  });

  $effect(() => {
    localSaturation = saturation;
  });

  $effect(() => {
    localHue = hue;
  });

  function toggleColorTool(tool: "brightness" | "contrast" | "saturation" | "hue") {
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

  function snapHue(val: number): number {
    if (Math.abs(val) < 3) return 0;
    return val;
  }

  function updateValueFromX(clientX: number) {
    if (!trackEl || !activeColorTool) return;
    const rect = trackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));

    let val: number;
    if (activeColorTool === "hue") {
      val = -180 + pct * 360;
      val = Math.round(val);
    } else {
      val = pct * 2;
      val = Math.round(val * 100) / 100;
    }

    switch (activeColorTool) {
      case "brightness":
        localBrightness = val;
        onBrightnessChange?.(snapValue(val));
        break;
      case "contrast":
        localContrast = val;
        onContrastChange?.(snapValue(val));
        break;
      case "saturation":
        localSaturation = val;
        onSaturationChange?.(snapValue(val));
        break;
      case "hue":
        localHue = val;
        onHueChange?.(snapHue(val));
        break;
    }
  }

  function handleTrackPointerDown(e: PointerEvent) {
    if (!trackEl) return;
    isDragging = true;
    trackEl.setPointerCapture(e.pointerId);
    updateValueFromX(e.clientX);
  }

  function handleTrackPointerMove(e: PointerEvent) {
    if (!isDragging || !trackEl) return;
    e.preventDefault();
    updateValueFromX(e.clientX);
  }

  function handleTrackPointerUp(e: PointerEvent) {
    if (!isDragging || !trackEl) return;
    isDragging = false;
    trackEl.releasePointerCapture(e.pointerId);
  }

  function closeColorTools() {
    activeColorTool = null;
    colorRowOpen = false;
    localBrightness = 1;
    localContrast = 1;
    localSaturation = 1;
    localHue = 0;
    onBrightnessChange?.(1);
    onContrastChange?.(1);
    onSaturationChange?.(1);
    onHueChange?.(0);
  }

  function jumpToValue(val: number) {
    if (!activeColorTool) return;
    switch (activeColorTool) {
      case "brightness":
        localBrightness = val;
        onBrightnessChange?.(snapValue(val));
        break;
      case "contrast":
        localContrast = val;
        onContrastChange?.(snapValue(val));
        break;
      case "saturation":
        localSaturation = val;
        onSaturationChange?.(snapValue(val));
        break;
      case "hue":
        localHue = val;
        onHueChange?.(snapHue(val));
        break;
    }
  }

  const scrubberTooltipVisible = $derived(
    activeColorTool !== null &&
      (sliderHovered ||
        (activeColorTool === "brightness" && brightness !== 1) ||
        (activeColorTool === "contrast" && contrast !== 1) ||
        (activeColorTool === "saturation" && saturation !== 1) ||
        (activeColorTool === "hue" && hue !== 0)),
  );

  const scrubberPct = $derived.by(() => {
    switch (activeColorTool) {
      case "brightness":
        return ((localBrightness - 0) / 2) * 100;
      case "contrast":
        return ((localContrast - 0) / 2) * 100;
      case "saturation":
        return ((localSaturation - 0) / 2) * 100;
      case "hue":
        return ((localHue - -180) / 360) * 100;
      default:
        return 0;
    }
  });

  const displayValue = $derived.by(() => {
    switch (activeColorTool) {
      case "brightness":
        return snapValue(localBrightness).toFixed(2);
      case "contrast":
        return snapValue(localContrast).toFixed(2);
      case "saturation":
        return snapValue(localSaturation).toFixed(2);
      case "hue":
        return String(Math.round(snapHue(localHue)));
      default:
        return "";
    }
  });

  const activeMarkers = $derived.by(() => {
    if (activeColorTool === "hue") {
      return [
        { val: -180, pct: 0 },
        { val: 0, pct: 50 },
        { val: 180, pct: 100 },
      ];
    }
    return [
      { val: 0, pct: 0 },
      { val: 1, pct: 50 },
      { val: 2, pct: 100 },
    ];
  });
</script>

{#if visible}
  <div class="edit-menu" transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}>
    <div
      class="ctx-drag"
      onmousedown={(e) => {
        e.preventDefault();
        const menu = (e.currentTarget as HTMLElement).closest(".edit-menu") as HTMLElement;
        if (!menu) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = menu.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        function onMouseMove(ev: MouseEvent) {
          menu.style.left = `${startLeft + ev.clientX - startX}px`;
          menu.style.top = `${startTop + ev.clientY - startY}px`;
          menu.style.transform = "none";
        }

        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }}
    >
      <span class="ctx-dot" /><span class="ctx-dot" /><span class="ctx-dot" />
    </div>
    <div class="edit-menu-row">
      <button
        class="edit-menu-btn red"
        class:active={cropMode}
        onclick={() => (cropMode ? viewer.cancelCrop() : onCrop())}
      >
        {#if cropMode}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span>Close</span>
        {:else}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M6 2h12v20H6z" opacity="0.3" />
            <path d="M2 6h20M2 18h20M6 2v20M18 2v20" />
          </svg>
          <span>Crop</span>
        {/if}
      </button>
      <button class="edit-menu-btn yellow" onclick={onRotate}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 2v6h-6" />
          <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
          <path d="M3 22v-6h6" />
          <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
        </svg>
        <span>Rotate</span>
      </button>
      <button class="edit-menu-btn green" onclick={onFlip}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v18" />
          <path d="M16 7l4 5-4 5" />
          <path d="M8 7l-4 5 4 5" />
        </svg>
        <span>Flip</span>
      </button>
      {#if colorRowOpen}
        <button class="edit-menu-btn red brightness-close-btn" onclick={closeColorTools}>
          {#key colorRowOpen}
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            <span>Close</span>
          {/key}
        </button>
      {:else}
        <button class="edit-menu-btn blue" onclick={() => (colorRowOpen = !colorRowOpen)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20" fill="currentColor" opacity="0.25" />
          </svg>
          <span>Color</span>
        </button>
      {/if}
    </div>

    {#if colorRowOpen}
      <div class="edit-menu-row" transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}>
        <button class="edit-menu-btn white" class:active={activeColorTool === "brightness"} onclick={() => toggleColorTool("brightness")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
          <span>Brightness</span>
        </button>
        <button class="edit-menu-btn white" class:active={activeColorTool === "contrast"} onclick={() => toggleColorTool("contrast")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" opacity="0.3" />
          </svg>
          <span>Contrast</span>
        </button>
        <button class="edit-menu-btn white" class:active={activeColorTool === "saturation"} onclick={() => toggleColorTool("saturation")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="currentColor" opacity="0.3" />
          </svg>
          <span>Saturation</span>
        </button>
        <button class="edit-menu-btn white" class:active={activeColorTool === "hue"} onclick={() => toggleColorTool("hue")}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 2a10 10 0 0 1 0 20" />
            <path d="M12 12l5-2" />
            <path d="M12 12l1 5" />
          </svg>
          <span>Hue</span>
        </button>
      </div>
    {/if}

    {#if activeColorTool}
      <div class="color-slider-panel" transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}>
        <div
          class="color-slider-track"
          bind:this={trackEl}
          role="slider"
          tabindex="0"
          aria-valuemin={activeColorTool === "hue" ? -180 : 0}
          aria-valuemax={activeColorTool === "hue" ? 180 : 2}
          aria-valuenow={activeColorTool === "hue"
            ? localHue
            : activeColorTool === "contrast"
              ? localContrast
              : activeColorTool === "saturation"
                ? localSaturation
                : localBrightness}
          aria-label={activeColorTool ? activeColorTool.charAt(0).toUpperCase() + activeColorTool.slice(1) : "Color"}
          onpointerdown={handleTrackPointerDown}
          onpointermove={handleTrackPointerMove}
          onpointerup={handleTrackPointerUp}
          onpointercancel={handleTrackPointerUp}
          onmouseenter={() => (sliderHovered = true)}
          onmouseleave={() => (sliderHovered = false)}
        >
          <div class="color-slider-fill" style="width: {scrubberPct}%"></div>
          {#each activeMarkers as marker}
            <div
              class="color-slider-marker"
              class:center-marker={marker.val === (activeColorTool === "hue" ? 0 : 1)}
              style="left: {marker.pct}%"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={() => jumpToValue(marker.val)}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  jumpToValue(marker.val);
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Set {activeColorTool} to {marker.val}"
            ></div>
          {/each}
          <div
            class="color-slider-scrubber"
            style="left: {scrubberPct}%"
            onpointerdown={(e) => {
              e.stopPropagation();
              if (!trackEl) return;
              isDragging = true;
              trackEl.setPointerCapture(e.pointerId);
            }}
          ></div>
        </div>
        {#if scrubberTooltipVisible}
          <div class="color-scrubber-tooltip" style="left: {scrubberPct}%">
            <span>{displayValue}</span>
          </div>
        {/if}
      </div>
    {/if}

    {#if cropMode}
      <div class="edit-menu-row crop-actions" transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}>
        <button class="edit-menu-btn crop-btn reset" onclick={() => viewer.resetCrop()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span>Reset</span>
        </button>
        <button class="edit-menu-btn crop-btn apply" onclick={onApply}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="speed-mode-icon">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span>Apply</span>
        </button>
      </div>
    {/if}
  </div>
{/if}
