<script lang="ts">
  import { fly } from "svelte/transition";
  import { editing } from "$lib/features/editing/editing.svelte";

  let {
    visible,
    onClose,
    onApply,
    onExport,
    onUndo,
    onReset,
    onMoved,
    styleOverride = "",
  }: {
    visible: boolean;
    onClose: () => void;
    onApply: () => void;
    onExport: () => void;
    onUndo: () => void;
    onReset: () => void;
    onMoved?: () => void;
    styleOverride?: string;
  } = $props();

  let colorRowOpen = $state(false);
  let activeColorTool: "brightness" | "contrast" | "saturation" | "hue" | null =
    $state(null);
  let sliderHovered = $state(false);
  let trackEl: HTMLDivElement | null = $state(null);
  let isDragging = $state(false);
  let localBrightness = $state(1);
  let localContrast = $state(1);
  let localSaturation = $state(1);
  let localHue = $state(0);
  let pinned = $state(false);
  let rotateRowOpen = $state(false);
  let activeRotateTool: "90-right" | "90-left" | "180" | "custom" | null =
    $state(null);
  let rotateTrackEl: HTMLDivElement | null = $state(null);
  let isRotateDragging = $state(false);
  let localRotationAngle = $state(0);
  let flipRowOpen = $state(false);
  let cropRowOpen = $state(false);
  let activeCropTool: "16-9" | "9-16" | "1-1" | "custom" | null = $state(null);

  $effect(() => {
    if (!visible) {
      colorRowOpen = false;
      activeColorTool = null;
      pinned = false;
      rotateRowOpen = false;
      activeRotateTool = null;
      flipRowOpen = false;
      cropRowOpen = false;
      activeCropTool = null;
    }
  });

  $effect(() => {
    localBrightness = editing.snapshot.brightness;
    localContrast = editing.snapshot.contrast;
    localSaturation = editing.snapshot.saturation;
    localHue = editing.snapshot.hue;
  });

  function toggleColorTool(
    tool: "brightness" | "contrast" | "saturation" | "hue",
  ) {
    if (activeColorTool === tool) {
      activeColorTool = null;
    } else {
      activeColorTool = tool;
      colorRowOpen = true;
      rotateRowOpen = false;
      activeRotateTool = null;
      flipRowOpen = false;
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
        editing.setBrightness(snapValue(val));
        break;
      case "contrast":
        localContrast = val;
        editing.setContrast(snapValue(val));
        break;
      case "saturation":
        localSaturation = val;
        editing.setSaturation(snapValue(val));
        break;
      case "hue":
        localHue = val;
        editing.setHue(snapHue(val));
        break;
    }
  }

  function handleTrackPointerDown(e: PointerEvent) {
    if (!trackEl) return;
    editing.pushUndo();
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

  function jumpToValue(val: number) {
    if (!activeColorTool) return;
    editing.pushUndo();
    switch (activeColorTool) {
      case "brightness":
        localBrightness = val;
        editing.setBrightness(snapValue(val));
        break;
      case "contrast":
        localContrast = val;
        editing.setContrast(snapValue(val));
        break;
      case "saturation":
        localSaturation = val;
        editing.setSaturation(snapValue(val));
        break;
      case "hue":
        localHue = val;
        editing.setHue(snapHue(val));
        break;
    }
  }

  function toggleRotateTool(tool: "90-right" | "90-left" | "180" | "custom") {
    if (tool === "custom") {
      if (activeRotateTool === "custom") {
        activeRotateTool = null;
      } else {
        activeRotateTool = "custom";
        localRotationAngle = editing.snapshot.rotation;
        colorRowOpen = false;
        activeColorTool = null;
        flipRowOpen = false;
      }
    } else {
      activeRotateTool = tool;
      colorRowOpen = false;
      activeColorTool = null;
      flipRowOpen = false;
      editing.pushUndo();
      if (tool === "90-right") {
        editing.rotate(90);
      } else if (tool === "90-left") {
        editing.rotate(-90);
      } else if (tool === "180") {
        editing.rotate(180);
      }
    }
  }

  function updateRotationFromX(clientX: number) {
    if (!rotateTrackEl) return;
    const rect = rotateTrackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const angle = Math.round(-180 + pct * 360);
    localRotationAngle = angle;
    editing.setRotation(angle);
  }

  function handleRotateTrackPointerDown(e: PointerEvent) {
    if (!rotateTrackEl) return;
    editing.pushUndo();
    isRotateDragging = true;
    rotateTrackEl.setPointerCapture(e.pointerId);
    updateRotationFromX(e.clientX);
  }

  function handleRotateTrackPointerMove(e: PointerEvent) {
    if (!isRotateDragging || !rotateTrackEl) return;
    e.preventDefault();
    updateRotationFromX(e.clientX);
  }

  function handleRotateTrackPointerUp(e: PointerEvent) {
    if (!isRotateDragging || !rotateTrackEl) return;
    isRotateDragging = false;
    rotateTrackEl.releasePointerCapture(e.pointerId);
  }

  function toggleFlip(direction: "horizontal" | "vertical") {
    editing.pushUndo();
    if (direction === "horizontal") {
      editing.flip();
    } else {
      editing.flipVertical();
    }
  }

  function handleCropClick() {
    if (cropRowOpen) {
      cropRowOpen = false;
      activeCropTool = null;
      if (editing.cropMode) editing.exitCropMode();
    } else {
      cropRowOpen = true;
      activeCropTool = null;
      colorRowOpen = false;
      activeColorTool = null;
      rotateRowOpen = false;
      activeRotateTool = null;
      flipRowOpen = false;
    }
  }

  function selectCropTool(
    tool: "16-9" | "9-16" | "1-1" | "custom",
    ratio: number | null,
  ) {
    activeCropTool = tool;
    editing.pushUndo();
    editing.setCropAspectRatio(ratio);
    if (!editing.cropMode) editing.startCropMode();
  }

  const scrubberTooltipVisible = $derived(
    activeColorTool !== null &&
      (sliderHovered ||
        (activeColorTool === "brightness" &&
          editing.snapshot.brightness !== 1) ||
        (activeColorTool === "contrast" && editing.snapshot.contrast !== 1) ||
        (activeColorTool === "saturation" &&
          editing.snapshot.saturation !== 1) ||
        (activeColorTool === "hue" && editing.snapshot.hue !== 0)),
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

  const rotateScrubberPct = $derived(((localRotationAngle - -180) / 360) * 100);

  const rotateScrubberTooltipVisible = $derived(
    activeRotateTool === "custom" && localRotationAngle !== 0,
  );

  const rotateDisplayValue = $derived(
    `${localRotationAngle > 0 ? "+" : ""}${localRotationAngle}°`,
  );

  const rotateMarkers = [
    { val: -180, pct: 0 },
    { val: 0, pct: 50 },
    { val: 180, pct: 100 },
  ];

  const canUndo = $derived(editing.getCanUndo());
  const hasEdits = $derived(
    editing.getHasEdits() || editing.getCropBounds() !== null,
  );
</script>

{#if visible}
  <div class="edit-menu-wrapper" style={styleOverride}>
    {#if hasEdits}
      <div
        class="edit-actions-bar edit-actions-left"
        transition:fly={{ x: 60, duration: 180, opacity: 0.08 }}
      >
        <button
          class="edit-action-btn blue tooltip-ctrl"
          class:inactive={!canUndo}
          disabled={!canUndo}
          onclick={onUndo}
          data-tooltip="Undo"
          aria-label="Undo"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
          <span class="edit-action-label">Undo</span>
        </button>
        <button
          class="edit-action-btn red tooltip-ctrl"
          disabled={!hasEdits}
          onclick={onReset}
          data-tooltip="Reset"
          aria-label="Reset"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
          <span class="edit-action-label">Reset</span>
        </button>
      </div>
    {/if}

    <div
      class="edit-menu"
      class:pinned
      transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}
    >
      <div
        class="ctx-drag"
        role="button"
        tabindex="0"
        aria-label="Drag to move"
        onmousedown={(e) => {
          e.preventDefault();
          onMoved?.();
          const menu = (e.currentTarget as HTMLElement).closest(
            ".edit-menu-wrapper",
          ) as HTMLElement;
          if (!menu) return;
          const startX = e.clientX;
          const startY = e.clientY;
          const rect = menu.getBoundingClientRect();
          const startLeft = rect.left;
          const startTop = rect.top;
          const savedTransition = menu.style.transition;
          menu.style.transition = "none";

          function onMouseMove(ev: MouseEvent) {
            menu.style.left = `${startLeft + ev.clientX - startX}px`;
            menu.style.top = `${startTop + ev.clientY - startY}px`;
            menu.style.transform = "none";
          }

          function onMouseUp() {
            menu.style.transition = savedTransition;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          }

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        }}
      >
        <button
          class="ctx-pin tooltip-below"
          class:active={pinned}
          data-tooltip={pinned ? "Unpin" : "Pin"}
          onclick={(e) => {
            e.stopPropagation();
            pinned = !pinned;
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={pinned ? "Unpin" : "Pin"}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 2C8 2 6 5 6 9V11L2 15V18H22V15L18 11V9C18 5 16 2 12 2ZM12 18V23"
            />
          </svg>
        </button>
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
        <button
          class="ctx-close tooltip-below"
          data-tooltip="Close"
          onclick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label="Close"
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="edit-menu-row">
        <button
          class="edit-menu-btn red"
          class:sub-open={cropRowOpen || editing.cropMode}
          onclick={handleCropClick}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="speed-mode-icon"
          >
            <path d="M6 2h12v20H6z" opacity="0.3" />
            <path d="M2 6h20M2 18h20M6 2v20M18 2v20" />
          </svg>
          <span>Crop</span>
        </button>
        <button
          class="edit-menu-btn yellow"
          class:sub-open={rotateRowOpen}
          onclick={() => {
            if (rotateRowOpen) {
              rotateRowOpen = false;
              activeRotateTool = null;
            } else {
              if (editing.cropMode) editing.exitCropMode();
              rotateRowOpen = true;
              colorRowOpen = false;
              activeColorTool = null;
              flipRowOpen = false;
              cropRowOpen = false;
              activeCropTool = null;
            }
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 2v6h-6" />
            <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            <path d="M3 22v-6h6" />
            <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          <span>Rotate</span>
        </button>
        <button
          class="edit-menu-btn green"
          class:sub-open={flipRowOpen}
          onclick={() => {
            if (flipRowOpen) {
              flipRowOpen = false;
            } else {
              if (editing.cropMode) editing.exitCropMode();
              flipRowOpen = true;
              colorRowOpen = false;
              activeColorTool = null;
              rotateRowOpen = false;
              activeRotateTool = null;
              cropRowOpen = false;
              activeCropTool = null;
            }
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M12 3v18" />
            <path d="M16 7l4 5-4 5" />
            <path d="M8 7l-4 5 4 5" />
          </svg>
          <span>Flip</span>
        </button>
        <button
          class="edit-menu-btn blue"
          class:sub-open={colorRowOpen}
          onclick={() => {
            if (colorRowOpen) {
              colorRowOpen = false;
              activeColorTool = null;
            } else {
              if (editing.cropMode) editing.exitCropMode();
              colorRowOpen = true;
              rotateRowOpen = false;
              activeRotateTool = null;
              flipRowOpen = false;
              cropRowOpen = false;
              activeCropTool = null;
            }
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path
              d="M12 2a10 10 0 0 1 0 20 10 10 0 0 1 0-20"
              fill="currentColor"
              opacity="0.25"
            />
          </svg>
          <span>Color</span>
        </button>
      </div>

      {#if cropRowOpen}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
          <button
            class="edit-menu-btn red"
            class:active={activeCropTool === "16-9"}
            onclick={() => selectCropTool("16-9", 16 / 9)}
          >
            <span>16:9</span>
          </button>
          <button
            class="edit-menu-btn red"
            class:active={activeCropTool === "9-16"}
            onclick={() => selectCropTool("9-16", 9 / 16)}
          >
            <span>9:16</span>
          </button>
          <button
            class="edit-menu-btn red"
            class:active={activeCropTool === "1-1"}
            onclick={() => selectCropTool("1-1", 1)}
          >
            <span>1:1</span>
          </button>
          <button
            class="edit-menu-btn red"
            class:active={activeCropTool === "custom"}
            onclick={() => selectCropTool("custom", null)}
          >
            <span>Custom</span>
          </button>
        </div>
      {/if}

      {#if colorRowOpen}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
          <button
            class="edit-menu-btn white"
            class:active={activeColorTool === "brightness"}
            onclick={() => toggleColorTool("brightness")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="5" />
              <path
                d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
              />
            </svg>
            <span>Brightness</span>
          </button>
          <button
            class="edit-menu-btn white"
            class:active={activeColorTool === "contrast"}
            onclick={() => toggleColorTool("contrast")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path
                d="M12 2a10 10 0 0 1 0 20z"
                fill="currentColor"
                opacity="0.3"
              />
            </svg>
            <span>Contrast</span>
          </button>
          <button
            class="edit-menu-btn white"
            class:active={activeColorTool === "saturation"}
            onclick={() => toggleColorTool("saturation")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"
                fill="currentColor"
                opacity="0.3"
              />
            </svg>
            <span>Saturation</span>
          </button>
          <button
            class="edit-menu-btn white"
            class:active={activeColorTool === "hue"}
            onclick={() => toggleColorTool("hue")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
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
        <div
          class="color-slider-panel"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
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
            aria-label={activeColorTool
              ? activeColorTool.charAt(0).toUpperCase() +
                activeColorTool.slice(1)
              : "Color"}
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
                class:center-marker={marker.val ===
                  (activeColorTool === "hue" ? 0 : 1)}
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
              role="button"
              tabindex="0"
              aria-label="Scrubber"
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

      {#if rotateRowOpen}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
          <button
            class="edit-menu-btn yellow"
            class:active={activeRotateTool === "90-right"}
            onclick={() => toggleRotateTool("90-right")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
            </svg>
            <span>90 Right</span>
          </button>
          <button
            class="edit-menu-btn yellow"
            class:active={activeRotateTool === "90-left"}
            onclick={() => toggleRotateTool("90-left")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 2v6h6" />
              <path d="M21 12a9 9 0 0 0-15-6.7L3 8" />
            </svg>
            <span>90 Left</span>
          </button>
          <button
            class="edit-menu-btn yellow"
            class:active={activeRotateTool === "180"}
            onclick={() => toggleRotateTool("180")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M21 2v6h-6" />
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M3 22v-6h6" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
            </svg>
            <span>180 Full</span>
          </button>
          <button
            class="edit-menu-btn yellow"
            class:active={activeRotateTool === "custom"}
            onclick={() => toggleRotateTool("custom")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span>Custom</span>
          </button>
        </div>
      {/if}

      {#if activeRotateTool === "custom"}
        <div
          class="color-slider-panel"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
          <div
            class="color-slider-track"
            bind:this={rotateTrackEl}
            role="slider"
            tabindex="0"
            aria-valuemin="-180"
            aria-valuemax="180"
            aria-valuenow={localRotationAngle}
            aria-label="Rotation angle"
            onpointerdown={handleRotateTrackPointerDown}
            onpointermove={handleRotateTrackPointerMove}
            onpointerup={handleRotateTrackPointerUp}
            onpointercancel={handleRotateTrackPointerUp}
          >
            <div
              class="color-slider-fill"
              style="width: {rotateScrubberPct}%"
            ></div>
            {#each rotateMarkers as marker}
              <div
                class="color-slider-marker"
                class:center-marker={marker.val === 0}
                style="left: {marker.pct}%"
                onpointerdown={(e) => e.stopPropagation()}
                onclick={() => {
                  editing.pushUndo();
                  localRotationAngle = marker.val;
                  editing.setRotation(marker.val);
                }}
                onkeydown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    editing.pushUndo();
                    localRotationAngle = marker.val;
                    editing.setRotation(marker.val);
                  }
                }}
                role="button"
                tabindex="0"
                aria-label="Set rotation to {marker.val}"
              ></div>
            {/each}
            <div
              class="color-slider-scrubber"
              style="left: {rotateScrubberPct}%"
              role="button"
              tabindex="0"
              aria-label="Scrubber"
              onpointerdown={(e) => {
                e.stopPropagation();
                if (!rotateTrackEl) return;
                isRotateDragging = true;
                rotateTrackEl.setPointerCapture(e.pointerId);
              }}
            ></div>
          </div>
          {#if rotateScrubberTooltipVisible}
            <div
              class="color-scrubber-tooltip"
              style="left: {rotateScrubberPct}%"
            >
              <span>{rotateDisplayValue}</span>
            </div>
          {/if}
        </div>
      {/if}

      {#if flipRowOpen}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          transition:fly={{ y: -10, duration: 150, opacity: 0.05 }}
        >
          <button
            class="edit-menu-btn green"
            onclick={() => toggleFlip("horizontal")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 3v18" />
              <path d="M16 7l4 5-4 5" />
              <path d="M8 7l-4 5 4 5" />
            </svg>
            <span>Horizontally</span>
          </button>
          <button
            class="edit-menu-btn green"
            onclick={() => toggleFlip("vertical")}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 12h18" />
              <path d="M7 8l5-4 5 4" />
              <path d="M7 16l5 4 5-4" />
            </svg>
            <span>Vertically</span>
          </button>
        </div>
      {/if}
    </div>

    {#if hasEdits}
      <div
        class="edit-actions-bar edit-actions-right"
        transition:fly={{ x: -60, duration: 180, opacity: 0.08 }}
      >
        <button
          class="edit-action-btn yellow tooltip-ctrl"
          disabled={!hasEdits}
          onclick={onExport}
          data-tooltip="Export"
          aria-label="Export"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span class="edit-action-label">Export</span>
        </button>
        <button
          class="edit-action-btn green tooltip-ctrl"
          disabled={!hasEdits}
          onclick={onApply}
          data-tooltip="Apply"
          aria-label="Apply"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span class="edit-action-label">Apply</span>
        </button>
      </div>
    {/if}
  </div>
{/if}
