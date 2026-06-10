<script lang="ts">
  import { fly } from "svelte/transition";
  import {
    markup,
    DRAW_COLORS,
    HIGHLIGHT_COLORS,
  } from "$lib/features/markup/markup.svelte";

  let {
    visible,
    onClose,
    onMoved,
    onUndo,
    onReset,
    onApply,
    onExport,
    styleOverride = "",
  }: {
    visible: boolean;
    onClose: () => void;
    onMoved?: () => void;
    onUndo: () => void;
    onReset: () => void;
    onApply: () => void;
    onExport: () => void;
    styleOverride?: string;
  } = $props();

  let eraserRowOpen = $state(false);
  let highlightRowOpen = $state(false);
  let drawRowOpen = $state(false);
  let textRowOpen = $state(false);
  let shapesRowOpen = $state(false);
  let highlightModeRowOpen = $state(false);
  let pinned = $state(false);
  let openTimeout: ReturnType<typeof setTimeout> | null = $state(null);
  let resetConfirming = $state(false);
  let resetConfirmTimeout: ReturnType<typeof setTimeout> | null = $state(null);

  // Text sub-tool state
  let activeTextTool: "color" | "font" | "style" | "alignment" | null =
    $state(null);
  let textFontDropdownOpen = $state(false);

  const TEXT_FONTS = [
    "Arial",
    "Times New Roman",
    "Segoe UI",
    "Verdana",
    "Georgia",
    "Courier New",
  ];
  const TEXT_APP_FONTS = ["Geist", "Satoshi"];

  // Draw sub-tool state
  let activeDrawTool: "color" | "thickness" | "opacity" | null = $state(null);
  let thicknessTrackEl: HTMLDivElement | null = $state(null);
  let isThicknessDragging = $state(false);
  let localThickness = $state(3);
  let opacityTrackEl: HTMLDivElement | null = $state(null);
  let isOpacityDragging = $state(false);
  let localOpacity = $state(1);

  // Highlight sub-tool state
  let activeHighlightTool: "color" | "thickness" | "opacity" | null =
    $state(null);
  let highlightThicknessTrackEl: HTMLDivElement | null = $state(null);
  let isHighlightThicknessDragging = $state(false);
  let localHighlightThickness = $state(20);
  let highlightOpacityTrackEl: HTMLDivElement | null = $state(null);
  let isHighlightOpacityDragging = $state(false);
  let localHighlightOpacity = $state(0.4);

  $effect(() => {
    if (!visible) {
      if (openTimeout) clearTimeout(openTimeout);
      openTimeout = null;
      if (resetConfirmTimeout) clearTimeout(resetConfirmTimeout);
      resetConfirmTimeout = null;
      resetConfirming = false;
      eraserRowOpen = false;
      highlightRowOpen = false;
      drawRowOpen = false;
      textRowOpen = false;
      shapesRowOpen = false;
      highlightModeRowOpen = false;
      pinned = false;
      activeDrawTool = null;
      activeHighlightTool = null;
      activeTextTool = null;
      textFontDropdownOpen = false;
      markup.setActiveTool("freehand");
      markup.setRoundedCorner(false);
      markup.setPathMode(false);
      markup.textActive = false;
    }
  });

  $effect(() => {
    localThickness = markup.drawThickness;
  });

  $effect(() => {
    localOpacity = markup.drawOpacity;
  });

  $effect(() => {
    localHighlightThickness = markup.highlightThickness;
  });

  $effect(() => {
    localHighlightOpacity = markup.highlightOpacity;
  });

  function closeAllRows() {
    eraserRowOpen = false;
    highlightRowOpen = false;
    drawRowOpen = false;
    textRowOpen = false;
    shapesRowOpen = false;
  }

  function closeDrawSubTools() {
    activeDrawTool = null;
  }

  function closeHighlightSubTools() {
    activeHighlightTool = null;
  }

  function closeTextSubTools() {
    activeTextTool = null;
    textFontDropdownOpen = false;
  }

  function toggleEraser() {
    if (eraserRowOpen) {
      closeAllRows();
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      closeDrawSubTools();
      closeHighlightSubTools();
      closeTextSubTools();
      openTimeout = setTimeout(() => {
        eraserRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleHighlight() {
    if (highlightRowOpen) {
      closeAllRows();
      closeHighlightSubTools();
      markup.highlightActive = false;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      closeDrawSubTools();
      closeHighlightSubTools();
      closeTextSubTools();
      markup.drawActive = false;
      markup.textActive = false;
      openTimeout = setTimeout(() => {
        highlightRowOpen = true;
        markup.highlightActive = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleDraw() {
    if (drawRowOpen) {
      closeAllRows();
      closeDrawSubTools();
      markup.drawActive = false;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      closeDrawSubTools();
      closeHighlightSubTools();
      closeTextSubTools();
      markup.highlightActive = false;
      markup.textActive = false;
      openTimeout = setTimeout(() => {
        drawRowOpen = true;
        markup.drawActive = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleText() {
    if (textRowOpen) {
      closeAllRows();
      closeTextSubTools();
      markup.textActive = false;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      closeDrawSubTools();
      closeHighlightSubTools();
      closeTextSubTools();
      markup.drawActive = false;
      markup.highlightActive = false;
      markup.textActive = true;
      openTimeout = setTimeout(() => {
        textRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleShapes() {
    if (shapesRowOpen) {
      shapesRowOpen = false;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeTextSubTools();
      markup.textActive = false;
      markup.highlightActive = false;
      markup.drawActive = true;
      shapesRowOpen = false;
      openTimeout = setTimeout(() => {
        shapesRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleDrawSubTool(tool: "color" | "thickness" | "opacity") {
    if (activeDrawTool === tool) {
      activeDrawTool = null;
    } else {
      activeDrawTool = tool;
    }
  }

  function toggleHighlightSubTool(tool: "color" | "thickness" | "opacity") {
    if (activeHighlightTool === tool) {
      activeHighlightTool = null;
    } else {
      activeHighlightTool = tool;
      highlightModeRowOpen = false;
    }
  }

  function toggleHighlightMode() {
    if (highlightModeRowOpen) {
      highlightModeRowOpen = false;
    } else {
      highlightModeRowOpen = true;
      activeHighlightTool = null;
    }
  }

  function toggleTextSubTool(tool: "color" | "font" | "style" | "alignment") {
    if (activeTextTool === tool) {
      activeTextTool = null;
      textFontDropdownOpen = false;
    } else {
      activeTextTool = tool;
      textFontDropdownOpen = false;
    }
  }

  // Thickness slider
  function updateThicknessFromX(clientX: number) {
    if (!thicknessTrackEl) return;
    const rect = thicknessTrackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const val = Math.round(1 + pct * 19);
    localThickness = val;
    markup.setDrawThickness(val);
  }

  function handleThicknessPointerDown(e: PointerEvent) {
    if (!thicknessTrackEl) return;
    isThicknessDragging = true;
    thicknessTrackEl.setPointerCapture(e.pointerId);
    updateThicknessFromX(e.clientX);
  }

  function handleThicknessPointerMove(e: PointerEvent) {
    if (!isThicknessDragging || !thicknessTrackEl) return;
    e.preventDefault();
    updateThicknessFromX(e.clientX);
  }

  function handleThicknessPointerUp(e: PointerEvent) {
    if (!isThicknessDragging || !thicknessTrackEl) return;
    isThicknessDragging = false;
    thicknessTrackEl.releasePointerCapture(e.pointerId);
  }

  const thicknessScrubberPct = $derived(((localThickness - 1) / 19) * 100);

  // Opacity slider
  function updateOpacityFromX(clientX: number) {
    if (!opacityTrackEl) return;
    const rect = opacityTrackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const val = Math.round(pct * 100) / 100;
    const clamped = Math.max(0, Math.min(1, val));
    localOpacity = clamped;
    markup.setDrawOpacity(clamped);
  }

  function handleOpacityPointerDown(e: PointerEvent) {
    if (!opacityTrackEl) return;
    isOpacityDragging = true;
    opacityTrackEl.setPointerCapture(e.pointerId);
    updateOpacityFromX(e.clientX);
  }

  function handleOpacityPointerMove(e: PointerEvent) {
    if (!isOpacityDragging || !opacityTrackEl) return;
    e.preventDefault();
    updateOpacityFromX(e.clientX);
  }

  function handleOpacityPointerUp(e: PointerEvent) {
    if (!isOpacityDragging || !opacityTrackEl) return;
    isOpacityDragging = false;
    opacityTrackEl.releasePointerCapture(e.pointerId);
  }

  const opacityScrubberPct = $derived((localOpacity / 1) * 100);

  // Highlight thickness slider
  function updateHighlightThicknessFromX(clientX: number) {
    if (!highlightThicknessTrackEl) return;
    const rect = highlightThicknessTrackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const val = Math.round(pct * 40);
    localHighlightThickness = val;
    markup.setHighlightThickness(val);
  }

  function handleHighlightThicknessPointerDown(e: PointerEvent) {
    if (!highlightThicknessTrackEl) return;
    isHighlightThicknessDragging = true;
    highlightThicknessTrackEl.setPointerCapture(e.pointerId);
    updateHighlightThicknessFromX(e.clientX);
  }

  function handleHighlightThicknessPointerMove(e: PointerEvent) {
    if (!isHighlightThicknessDragging || !highlightThicknessTrackEl) return;
    e.preventDefault();
    updateHighlightThicknessFromX(e.clientX);
  }

  function handleHighlightThicknessPointerUp(e: PointerEvent) {
    if (!isHighlightThicknessDragging || !highlightThicknessTrackEl) return;
    isHighlightThicknessDragging = false;
    highlightThicknessTrackEl.releasePointerCapture(e.pointerId);
  }

  const highlightThicknessScrubberPct = $derived(
    (localHighlightThickness / 40) * 100,
  );

  // Highlight opacity slider
  function updateHighlightOpacityFromX(clientX: number) {
    if (!highlightOpacityTrackEl) return;
    const rect = highlightOpacityTrackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const val = Math.round(pct * 100) / 100;
    const clamped = Math.max(0, Math.min(0.8, val));
    localHighlightOpacity = clamped;
    markup.setHighlightOpacity(clamped);
  }

  function handleHighlightOpacityPointerDown(e: PointerEvent) {
    if (!highlightOpacityTrackEl) return;
    isHighlightOpacityDragging = true;
    highlightOpacityTrackEl.setPointerCapture(e.pointerId);
    updateHighlightOpacityFromX(e.clientX);
  }

  function handleHighlightOpacityPointerMove(e: PointerEvent) {
    if (!isHighlightOpacityDragging || !highlightOpacityTrackEl) return;
    e.preventDefault();
    updateHighlightOpacityFromX(e.clientX);
  }

  function handleHighlightOpacityPointerUp(e: PointerEvent) {
    if (!isHighlightOpacityDragging || !highlightOpacityTrackEl) return;
    isHighlightOpacityDragging = false;
    highlightOpacityTrackEl.releasePointerCapture(e.pointerId);
  }

  const highlightOpacityScrubberPct = $derived(
    (localHighlightOpacity / 0.8) * 100,
  );

  const highlightThicknessMarkers = [
    { val: 0, pct: 0 },
    { val: 20, pct: 50 },
    { val: 40, pct: 100 },
  ];

  const highlightOpacityMarkers = [
    { val: 0, pct: 0 },
    { val: 0.4, pct: 50 },
    { val: 0.8, pct: 100 },
  ];

  function jumpToHighlightThickness(val: number) {
    localHighlightThickness = val;
    markup.setHighlightThickness(val);
  }

  function jumpToHighlightOpacity(val: number) {
    localHighlightOpacity = val;
    markup.setHighlightOpacity(val);
  }

  const thicknessMarkers = [
    { val: 1, pct: 0 },
    { val: 10, pct: ((10 - 1) / 19) * 100 },
    { val: 20, pct: 100 },
  ];

  const opacityMarkers = [
    { val: 0, pct: 0 },
    { val: 0.5, pct: 50 },
    { val: 1, pct: 100 },
  ];

  function jumpToThickness(val: number) {
    localThickness = val;
    markup.setDrawThickness(val);
  }

  function jumpToOpacity(val: number) {
    localOpacity = val;
    markup.setDrawOpacity(val);
  }

  const canUndo = $derived(markup.strokes.length > 0);
  const hasEdits = $derived(markup.strokes.length > 0);
</script>

{#if visible}
  <div class="markup-menu-wrapper" style={styleOverride}>
    <div
      class="edit-actions-bar edit-actions-left"
      class:has-edits={hasEdits}
      in:fly={{ x: 60, duration: 180, opacity: 0.08 }}
      out:fly={{ y: -26, duration: 190, opacity: 0.08 }}
    >
        <button
          class="edit-action-btn red tooltip-ctrl"
          class:confirming={resetConfirming}
          disabled={!hasEdits}
          onclick={() => {
            if (resetConfirming) {
              if (resetConfirmTimeout) {
                clearTimeout(resetConfirmTimeout);
                resetConfirmTimeout = null;
              }
              resetConfirming = false;
              markup.clearAllStrokes();
            } else {
              resetConfirming = true;
              resetConfirmTimeout = setTimeout(() => {
                resetConfirming = false;
                resetConfirmTimeout = null;
              }, 3000);
            }
          }}
          data-tooltip={resetConfirming ? "Confirm reset" : "Reset"}
          aria-label={resetConfirming ? "Confirm reset" : "Reset"}
        >
          {#if resetConfirming}
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
              <circle cx="12" cy="12" r="10" />
              <path d="M12 16v0" />
              <path d="M12 8v4" />
            </svg>
            <span class="edit-action-label">Confirm</span>
          {:else}
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
          {/if}
        </button>
        <button
          class="edit-action-btn blue tooltip-ctrl"
          class:inactive={!canUndo}
          disabled={!canUndo}
          onclick={() => markup.undoLastStroke()}
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
    </div>

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
            ".markup-menu-wrapper",
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
        <span class="ctx-drag-title">
          <span class="ctx-dots">
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
          </span>
          <span>Markup</span>
          <span class="ctx-dots">
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
          </span>
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

      <div class="edit-menu-card">
        <div class="edit-menu-row">
          <button
            class="edit-menu-btn red"
            class:sub-open={highlightRowOpen || drawRowOpen || textRowOpen}
            onclick={toggleEraser}
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
              <path d="M20 20H7L3 16l9-9 8 8-4 4" />
              <path d="M6.5 13.5l5-5" />
            </svg>
            <span>Erase</span>
          </button>
          <button
            class="edit-menu-btn yellow"
            class:active={markup.highlightActive}
            class:sub-open={eraserRowOpen || drawRowOpen || textRowOpen}
            onclick={toggleHighlight}
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
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              <path d="M2 22l1-4 3 3-1 4H2z" opacity="0.5" />
            </svg>
            <span>Highlight</span>
          </button>
          <button
            class="edit-menu-btn green"
            class:active={markup.drawActive}
            class:sub-open={eraserRowOpen || highlightRowOpen || textRowOpen}
            onclick={toggleDraw}
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
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
              <path d="M2 2l7.586 7.586" />
              <circle cx="11" cy="11" r="2" />
            </svg>
            <span>Draw</span>
          </button>
          <button
            class="edit-menu-btn blue"
            class:sub-open={eraserRowOpen || highlightRowOpen || drawRowOpen}
            onclick={toggleText}
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
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
            </svg>
            <span>Text</span>
          </button>
        </div>

        {#if eraserRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button class="edit-menu-btn red sub">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="8" y1="8" x2="16" y2="16" />
                <line x1="16" y1="8" x2="8" y2="16" />
              </svg>
              <span>Remove</span>
            </button>
            <button class="edit-menu-btn red sub">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="5 9 2 12 5 15" />
                <polyline points="9 5 12 2 15 5" />
                <polyline points="15 19 12 22 9 19" />
                <polyline points="19 9 22 12 19 15" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <line x1="12" y1="2" x2="12" y2="22" />
              </svg>
              <span>Move</span>
            </button>
            <button class="edit-menu-btn red sub">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Hide</span>
            </button>
            <button class="edit-menu-btn red sub">
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
              </svg>
              <span>Clear all</span>
            </button>
          </div>
        {/if}

        {#if highlightRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button
              class="edit-menu-btn yellow sub"
              class:active={activeHighlightTool === "color"}
              onclick={() => toggleHighlightSubTool("color")}
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
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.66 0 3-1.34 3-3 0-.55-.15-1.07-.44-1.51-.29-.44-.46-.96-.46-1.49 0-1.1.9-2 2-2H18.5c2.49 0 4.5-2.01 4.5-4.5C23 6.08 18.08 2 12 2z"
                />
                <circle
                  cx="7.5"
                  cy="10"
                  r="1.5"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="16.5"
                  cy="8"
                  r="1.5"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
              <span>Color</span>
            </button>
            <button
              class="edit-menu-btn yellow sub"
              class:active={activeHighlightTool === "thickness"}
              onclick={() => toggleHighlightSubTool("thickness")}
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
              >
                <line x1="3" y1="8" x2="21" y2="8" stroke-width="2" />
                <line x1="3" y1="16" x2="21" y2="16" stroke-width="4" />
              </svg>
              <span>Thickness</span>
            </button>
            <button
              class="edit-menu-btn yellow sub"
              class:active={activeHighlightTool === "opacity"}
              onclick={() => toggleHighlightSubTool("opacity")}
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
              >
                <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
              </svg>
              <span>Opacity</span>
            </button>
            <button
              class="edit-menu-btn yellow sub"
              class:active={highlightModeRowOpen}
              onclick={toggleHighlightMode}
              data-tooltip="Mode"
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
              >
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <rect x="6" y="6" width="12" height="12" rx="2" opacity="0.5" />
              </svg>
              <span>Mode</span>
            </button>
          </div>

          {#if highlightModeRowOpen}
            <div class="edit-menu-separator"></div>
            <div
              class="edit-menu-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <button
                class="edit-menu-btn yellow sub"
                class:active={markup.highlightMode === "free"}
                onclick={() => markup.setHighlightMode("free")}
                data-tooltip="Freehand"
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
                >
                  <path d="M3 14 Q6 8 9 14 T15 14 T21 14" />
                </svg>
                <span>Free</span>
              </button>
              <button
                class="edit-menu-btn yellow sub"
                class:active={markup.highlightMode === "straight"}
                onclick={() => markup.setHighlightMode("straight")}
                data-tooltip="Straight"
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
                >
                  <line x1="4" y1="20" x2="20" y2="4" />
                </svg>
                <span>Straight</span>
              </button>
            </div>
          {/if}

          {#if activeHighlightTool === "color"}
            <div
              class="markup-color-cards-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div class="markup-color-card">
                {#each HIGHLIGHT_COLORS as color, i}
                  <button
                    class="markup-color-swatch"
                    class:active={markup.highlightColor === color}
                    style="background: {color}"
                    onclick={() => {
                      markup.setHighlightColor(color);
                    }}
                    aria-label={`Color ${i + 1}`}
                  ></button>
                {/each}
              </div>
              <div class="markup-color-card">
                {#each markup.highlightCustomColors as color, i}
                  <label
                    class="markup-color-swatch"
                    class:markup-color-swatch-empty={!color}
                    class:active={markup.highlightColor === color &&
                      color !== ""}
                    style={color ? `background: ${color}` : ""}
                    aria-label={`Custom color ${i + 1}`}
                    oncontextmenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markup.setHighlightCustomColor(i, "");
                    }}
                  >
                    <input
                      type="color"
                      value={color || "#f5c518"}
                      oninput={(e) => {
                        markup.setHighlightCustomColor(
                          i,
                          (e.target as HTMLInputElement).value,
                        );
                      }}
                      class="markup-color-native-input"
                    />
                  </label>
                {/each}
              </div>
            </div>
          {/if}

          {#if activeHighlightTool === "thickness"}
            <div
              class="markup-slider-panel"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div
                class="color-slider-track"
                bind:this={highlightThicknessTrackEl}
                style="--track-thickness: {Math.max(
                  2,
                  localHighlightThickness,
                )}px"
                role="slider"
                tabindex="0"
                aria-valuemin={0}
                aria-valuemax={40}
                aria-valuenow={localHighlightThickness}
                aria-label="Highlight thickness"
                onpointerdown={handleHighlightThicknessPointerDown}
                onpointermove={handleHighlightThicknessPointerMove}
                onpointerup={handleHighlightThicknessPointerUp}
                onpointercancel={handleHighlightThicknessPointerUp}
              >
                <div
                  class="color-slider-fill"
                  style="width: {highlightThicknessScrubberPct}%"
                ></div>
                {#each highlightThicknessMarkers as marker}
                  <div
                    class="color-slider-marker"
                    class:center-marker={marker.val === 24}
                    style="left: {marker.pct}%"
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={() => jumpToHighlightThickness(marker.val)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        jumpToHighlightThickness(marker.val);
                      }
                    }}
                    role="button"
                    tabindex="0"
                    aria-label="Set thickness to {marker.val}"
                  ></div>
                {/each}
                <div
                  class="color-slider-scrubber"
                  style="left: {highlightThicknessScrubberPct}%"
                  role="button"
                  tabindex="0"
                  aria-label="Scrubber"
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    if (!highlightThicknessTrackEl) return;
                    isHighlightThicknessDragging = true;
                    highlightThicknessTrackEl.setPointerCapture(e.pointerId);
                  }}
                ></div>
              </div>
              <div
                class="color-scrubber-tooltip"
                style="left: {highlightThicknessScrubberPct}%"
              >
                <span>{localHighlightThickness}px</span>
              </div>
            </div>
          {/if}

          {#if activeHighlightTool === "opacity"}
            <div
              class="markup-slider-panel"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div
                class="color-slider-track"
                bind:this={highlightOpacityTrackEl}
                style="--track-opacity: {Math.max(0.1, localHighlightOpacity)}"
                role="slider"
                tabindex="0"
                aria-valuemin={0}
                aria-valuemax={0.8}
                aria-valuenow={localHighlightOpacity}
                aria-label="Highlight opacity"
                onpointerdown={handleHighlightOpacityPointerDown}
                onpointermove={handleHighlightOpacityPointerMove}
                onpointerup={handleHighlightOpacityPointerUp}
                onpointercancel={handleHighlightOpacityPointerUp}
              >
                <div
                  class="color-slider-fill"
                  style="width: {highlightOpacityScrubberPct}%"
                ></div>
                {#each highlightOpacityMarkers as marker}
                  <div
                    class="color-slider-marker"
                    class:center-marker={marker.val === 0.4}
                    style="left: {marker.pct}%"
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={() => jumpToHighlightOpacity(marker.val)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        jumpToHighlightOpacity(marker.val);
                      }
                    }}
                    role="button"
                    tabindex="0"
                    aria-label="Set opacity to {Math.round(marker.val * 100)}%"
                  ></div>
                {/each}
                <div
                  class="color-slider-scrubber"
                  style="left: {highlightOpacityScrubberPct}%"
                  role="button"
                  tabindex="0"
                  aria-label="Scrubber"
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    if (!highlightOpacityTrackEl) return;
                    isHighlightOpacityDragging = true;
                    highlightOpacityTrackEl.setPointerCapture(e.pointerId);
                  }}
                ></div>
              </div>
              <div
                class="color-scrubber-tooltip"
                style="left: {highlightOpacityScrubberPct}%"
              >
                <span>{Math.round(localHighlightOpacity * 100)}%</span>
              </div>
            </div>
          {/if}
        {/if}

        {#if drawRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button
              class="edit-menu-btn green sub"
              class:active={activeDrawTool === "color"}
              onclick={() => toggleDrawSubTool("color")}
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
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.66 0 3-1.34 3-3 0-.55-.15-1.07-.44-1.51-.29-.44-.46-.96-.46-1.49 0-1.1.9-2 2-2H18.5c2.49 0 4.5-2.01 4.5-4.5C23 6.08 18.08 2 12 2z"
                />
                <circle
                  cx="7.5"
                  cy="10"
                  r="1.5"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="16.5"
                  cy="8"
                  r="1.5"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
              <span>Color</span>
            </button>
            <button
              class="edit-menu-btn green sub"
              class:active={activeDrawTool === "thickness"}
              onclick={() => toggleDrawSubTool("thickness")}
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
              >
                <line x1="3" y1="8" x2="21" y2="8" stroke-width="2" />
                <line x1="3" y1="16" x2="21" y2="16" stroke-width="4" />
              </svg>
              <span>Thickness</span>
            </button>
            <button
              class="edit-menu-btn green sub"
              class:active={activeDrawTool === "opacity"}
              onclick={() => toggleDrawSubTool("opacity")}
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
              >
                <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
              </svg>
              <span>Opacity</span>
            </button>
            <button
              class="edit-menu-btn green sub"
              class:sub-open={shapesRowOpen}
              onclick={toggleShapes}
              aria-label="Shapes"
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
              >
                <rect x="3" y="3" width="7" height="7" />
                <circle cx="17.5" cy="6.5" r="3.5" />
                <polygon points="7 21 12 14 17 21" />
              </svg>
              <span>Shapes</span>
            </button>
          </div>

          {#if shapesRowOpen}
            <div class="edit-menu-separator"></div>
            <div
              class="edit-menu-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <button
                class="edit-menu-btn sub"
                class:green={markup.roundedCorner}
                class:grey={!markup.roundedCorner}
                class:active={markup.roundedCorner}
                onclick={() => {
                  markup.toggleSelectedCornerRadius();
                }}
                aria-pressed={markup.roundedCorner}
                aria-label="Rounded shapes"
                data-tooltip="Rounded shapes"
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
                >
                  <rect
                    x="3"
                    y="3"
                    width="18"
                    height="18"
                    stroke-dasharray="2 2"
                    opacity="0.45"
                  />
                  <path d="M3 9 V5 Q3 3 5 3 H9" />
                </svg>
              </button>
              <div class="edit-menu-divider"></div>
              <button
                class="edit-menu-btn green sub"
                class:active={markup.activeTool === "square"}
                onclick={() => markup.setActiveTool("square")}
                aria-label="Square"
                data-tooltip="Square"
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
                >
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
              </button>
              <button
                class="edit-menu-btn green sub"
                class:active={markup.activeTool === "circle"}
                onclick={() => markup.setActiveTool("circle")}
                aria-label="Circle"
                data-tooltip="Circle"
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
                >
                  <circle cx="12" cy="12" r="9" />
                </svg>
              </button>
              <button
                class="edit-menu-btn green sub"
                class:active={markup.activeTool === "triangle"}
                onclick={() => markup.setActiveTool("triangle")}
                aria-label="Triangle"
                data-tooltip="Triangle"
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
                >
                  <polygon points="12,3 22,21 2,21" />
                </svg>
              </button>
              <div class="edit-menu-divider"></div>
              <button
                class="edit-menu-btn green sub"
                class:active={markup.activeTool === "line"}
                onclick={() => markup.setActiveTool("line")}
                aria-label="Line"
                data-tooltip="Line"
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
                >
                  <line x1="4" y1="12" x2="20" y2="12" />
                </svg>
              </button>
              <button
                class="edit-menu-btn green sub"
                class:active={markup.activeTool === "arrow"}
                onclick={() => markup.setActiveTool("arrow")}
                aria-label="Arrow"
                data-tooltip="Arrow"
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
                >
                  <line x1="4" y1="12" x2="20" y2="12" />
                  <polyline points="14,6 20,12 14,18" />
                </svg>
              </button>
              <button
                class="edit-menu-btn green sub"
                class:active={markup.activeTool === "bidirectional-arrow"}
                onclick={() => markup.setActiveTool("bidirectional-arrow")}
                aria-label="Bidirectional arrow"
                data-tooltip="Bidirectional"
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
                >
                  <polyline points="8,6 2,12 8,18" />
                  <line x1="2" y1="12" x2="22" y2="12" />
                  <polyline points="16,6 22,12 16,18" />
                </svg>
              </button>
              <div class="edit-menu-divider"></div>
              <button
                class="edit-menu-btn sub"
                class:green={markup.pathMode}
                class:grey={!markup.pathMode}
                class:active={markup.pathMode}
                onclick={() => {
                  markup.setPathMode(!markup.pathMode);
                }}
                aria-pressed={markup.pathMode}
                aria-label="Path"
                data-tooltip="Freeform lines"
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
                >
                  <path d="M3 14 Q6 8 9 14 T15 14 T21 14" />
                </svg>
              </button>
            </div>
          {/if}

          {#if activeDrawTool === "color"}
            <div
              class="markup-color-cards-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div class="markup-color-card">
                {#each DRAW_COLORS as color, i}
                  <button
                    class="markup-color-swatch"
                    class:active={markup.drawColor === color}
                    style="background: {color}"
                    onclick={() => {
                      markup.setDrawColor(color);
                    }}
                    aria-label={`Color ${i + 1}`}
                  ></button>
                {/each}
              </div>
              <div class="markup-color-card">
                {#each markup.customColors as color, i}
                  <label
                    class="markup-color-swatch"
                    class:markup-color-swatch-empty={!color}
                    class:active={markup.drawColor === color && color !== ""}
                    style={color ? `background: ${color}` : ""}
                    aria-label={`Custom color ${i + 1}`}
                    oncontextmenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markup.setCustomColor(i, "");
                    }}
                  >
                    <input
                      type="color"
                      value={color || "#000000"}
                      oninput={(e) => {
                        markup.setCustomColor(
                          i,
                          (e.target as HTMLInputElement).value,
                        );
                      }}
                      class="markup-color-native-input"
                    />
                  </label>
                {/each}
              </div>
            </div>
          {/if}

          {#if activeDrawTool === "thickness"}
            <div
              class="markup-slider-panel"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div
                class="color-slider-track"
                bind:this={thicknessTrackEl}
                style="--track-thickness: {Math.max(2, localThickness)}px"
                role="slider"
                tabindex="0"
                aria-valuemin={1}
                aria-valuemax={20}
                aria-valuenow={localThickness}
                aria-label="Thickness"
                onpointerdown={handleThicknessPointerDown}
                onpointermove={handleThicknessPointerMove}
                onpointerup={handleThicknessPointerUp}
                onpointercancel={handleThicknessPointerUp}
              >
                <div
                  class="color-slider-fill"
                  style="width: {thicknessScrubberPct}%"
                ></div>
                {#each thicknessMarkers as marker}
                  <div
                    class="color-slider-marker"
                    class:center-marker={marker.val === 10}
                    style="left: {marker.pct}%"
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={() => jumpToThickness(marker.val)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        jumpToThickness(marker.val);
                      }
                    }}
                    role="button"
                    tabindex="0"
                    aria-label="Set thickness to {marker.val}"
                  ></div>
                {/each}
                <div
                  class="color-slider-scrubber"
                  style="left: {thicknessScrubberPct}%"
                  role="button"
                  tabindex="0"
                  aria-label="Scrubber"
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    if (!thicknessTrackEl) return;
                    isThicknessDragging = true;
                    thicknessTrackEl.setPointerCapture(e.pointerId);
                  }}
                ></div>
              </div>
              <div
                class="color-scrubber-tooltip"
                style="left: {thicknessScrubberPct}%"
              >
                <span>{localThickness}px</span>
              </div>
            </div>
          {/if}

          {#if activeDrawTool === "opacity"}
            <div
              class="markup-slider-panel"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div
                class="color-slider-track"
                bind:this={opacityTrackEl}
                style="--track-opacity: {Math.max(0.1, localOpacity)}"
                role="slider"
                tabindex="0"
                aria-valuemin={0.1}
                aria-valuemax={1}
                aria-valuenow={localOpacity}
                aria-label="Opacity"
                onpointerdown={handleOpacityPointerDown}
                onpointermove={handleOpacityPointerMove}
                onpointerup={handleOpacityPointerUp}
                onpointercancel={handleOpacityPointerUp}
              >
                <div
                  class="color-slider-fill"
                  style="width: {opacityScrubberPct}%"
                ></div>
                {#each opacityMarkers as marker}
                  <div
                    class="color-slider-marker"
                    class:center-marker={marker.val === 0.5}
                    style="left: {marker.pct}%"
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={() => jumpToOpacity(marker.val)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        jumpToOpacity(marker.val);
                      }
                    }}
                    role="button"
                    tabindex="0"
                    aria-label="Set opacity to {Math.round(marker.val * 100)}%"
                  ></div>
                {/each}
                <div
                  class="color-slider-scrubber"
                  style="left: {opacityScrubberPct}%"
                  role="button"
                  tabindex="0"
                  aria-label="Scrubber"
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    if (!opacityTrackEl) return;
                    isOpacityDragging = true;
                    opacityTrackEl.setPointerCapture(e.pointerId);
                  }}
                ></div>
              </div>
              <div
                class="color-scrubber-tooltip"
                style="left: {opacityScrubberPct}%"
              >
                <span>{Math.round(localOpacity * 100)}%</span>
              </div>
            </div>
          {/if}
        {/if}

        {#if textRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button
              class="edit-menu-btn blue sub"
              class:active={activeTextTool === "color"}
              onclick={() => toggleTextSubTool("color")}
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
              >
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.66 0 3-1.34 3-3 0-.55-.15-1.07-.44-1.51-.29-.44-.46-.96-.46-1.49 0-1.1.9-2 2-2H18.5c2.49 0 4.5-2.01 4.5-4.5C23 6.08 18.08 2 12 2z"
                />
                <circle
                  cx="7.5"
                  cy="10"
                  r="1.5"
                  fill="currentColor"
                  stroke="none"
                />
                <circle
                  cx="16.5"
                  cy="8"
                  r="1.5"
                  fill="currentColor"
                  stroke="none"
                />
              </svg>
              <span>Color</span>
            </button>
            <button
              class="edit-menu-btn blue sub"
              class:active={activeTextTool === "font"}
              onclick={() => toggleTextSubTool("font")}
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
              >
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20" />
                <line x1="12" y1="4" x2="12" y2="20" />
                <path d="M2 7h2" />
                <path d="M20 7h2" />
              </svg>
              <span>Font</span>
            </button>
            <button
              class="edit-menu-btn blue sub"
              class:active={activeTextTool === "style"}
              onclick={() => toggleTextSubTool("style")}
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
              >
                <path
                  d="M5 4v16M5 12h4a4 4 0 0 0 0-8H5M5 12h4a4 4 0 0 1 0 8H5"
                />
                <line x1="16" y1="6" x2="16" y2="18" />
                <line x1="14" y1="6" x2="18" y2="6" />
                <line x1="14" y1="18" x2="18" y2="18" />
              </svg>
              <span>Style</span>
            </button>
            <button
              class="edit-menu-btn blue sub"
              class:active={activeTextTool === "alignment"}
              onclick={() => toggleTextSubTool("alignment")}
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
              >
                <line x1="17" y1="10" x2="3" y2="10" />
                <line x1="21" y1="6" x2="3" y2="6" />
                <line x1="21" y1="14" x2="3" y2="14" />
                <line x1="17" y1="18" x2="3" y2="18" />
              </svg>
              <span>Alignment</span>
            </button>
          </div>

          {#if activeTextTool === "color"}
            <div
              class="text-color-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div class="markup-color-card">
                {#each DRAW_COLORS as color, i}
                  <button
                    class="markup-color-swatch"
                    class:active={markup.textColor === color}
                    style="background: {color}"
                    onclick={() => markup.setTextColor(color)}
                    aria-label={`Color ${i + 1}`}
                  ></button>
                {/each}
              </div>
              <div class="markup-color-card">
                {#each markup.textCustomColors as color, i}
                  <label
                    class="markup-color-swatch"
                    class:markup-color-swatch-empty={!color}
                    class:active={markup.textColor === color && color !== ""}
                    style={color ? `background: ${color}` : ""}
                    aria-label={`Custom color ${i + 1}`}
                    oncontextmenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      markup.setTextCustomColor(i, "");
                    }}
                  >
                    <input
                      type="color"
                      value={color || "#000000"}
                      oninput={(e) => {
                        markup.setTextCustomColor(
                          i,
                          (e.target as HTMLInputElement).value,
                        );
                      }}
                      class="markup-color-native-input"
                    />
                  </label>
                {/each}
              </div>
              <button
                class="text-bg-color-btn"
                class:active={markup.textBgEnabled}
                onclick={() => markup.setTextBgEnabled(!markup.textBgEnabled)}
                data-tooltip="Background color"
                aria-label="Toggle text background"
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
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <line x1="7" y1="8" x2="17" y2="8" />
                  <line x1="7" y1="12" x2="14" y2="12" />
                  <line x1="7" y1="16" x2="11" y2="16" />
                </svg>
              </button>
            </div>
          {/if}

          {#if activeTextTool === "font"}
            <div
              class="text-font-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <span class="text-font-label">Font:</span>
              <div class="text-font-anchor">
                <button
                  class="text-font-btn"
                  onclick={() => {
                    textFontDropdownOpen = !textFontDropdownOpen;
                  }}
                >
                  <span
                    style="font-family: '{markup.textFontFamily}', sans-serif"
                  >
                    {markup.textFontFamily}
                  </span>
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {#if textFontDropdownOpen}
                  <div
                    class="text-font-dropdown"
                    in:fly={{ y: -6, duration: 120, opacity: 0.08 }}
                    out:fly={{ y: -6, duration: 80, opacity: 0.08 }}
                  >
                    {#each TEXT_FONTS as font}
                      <button
                        class="text-font-item"
                        class:active={markup.textFontFamily === font}
                        onclick={() => {
                          markup.setTextFontFamily(font);
                          textFontDropdownOpen = false;
                        }}
                      >
                        <span style="font-family: '{font}', sans-serif"
                          >{font}</span
                        >
                      </button>
                    {/each}
                    <div class="text-font-separator"></div>
                    {#each TEXT_APP_FONTS as font}
                      <button
                        class="text-font-item"
                        class:active={markup.textFontFamily === font}
                        onclick={() => {
                          markup.setTextFontFamily(font);
                          textFontDropdownOpen = false;
                        }}
                      >
                        <span style="font-family: '{font}', sans-serif"
                          >{font}</span
                        >
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
              <div class="edit-menu-divider"></div>
              <span class="text-font-label">Size:</span>
              <button
                class="text-size-btn"
                onclick={() => markup.setTextFontSize(markup.textFontSize - 1)}
                aria-label="Decrease font size"
              >
                <svg
                  width="7"
                  height="7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
              <input
                type="number"
                class="text-size-input"
                value={markup.textFontSize}
                min="6"
                max="72"
                oninput={(e) => {
                  const val = parseInt((e.target as HTMLInputElement).value);
                  if (!isNaN(val)) markup.setTextFontSize(val);
                }}
              />
              <button
                class="text-size-btn"
                onclick={() => markup.setTextFontSize(markup.textFontSize + 1)}
                aria-label="Increase font size"
              >
                <svg
                  width="7"
                  height="7"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          {/if}

          {#if activeTextTool === "style"}
            <div
              class="edit-menu-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <button
                class="edit-menu-btn blue sub text-style-btn"
                class:active={markup.textBold}
                onclick={() => markup.setTextBold(!markup.textBold)}
                data-tooltip="Bold"
                aria-label="Bold"
              >
                <span style="font-weight: 700">B</span>
              </button>
              <button
                class="edit-menu-btn blue sub text-style-btn"
                class:active={markup.textItalic}
                onclick={() => markup.setTextItalic(!markup.textItalic)}
                data-tooltip="Italic"
                aria-label="Italic"
              >
                <span style="font-style: italic">I</span>
              </button>
              <button
                class="edit-menu-btn blue sub text-style-btn"
                class:active={markup.textUnderline}
                onclick={() => markup.setTextUnderline(!markup.textUnderline)}
                data-tooltip="Underline"
                aria-label="Underline"
              >
                <span style="text-decoration: underline">U</span>
              </button>
              <button
                class="edit-menu-btn blue sub text-style-btn"
                class:active={markup.textStrikethrough}
                onclick={() =>
                  markup.setTextStrikethrough(!markup.textStrikethrough)}
                data-tooltip="Strikethrough"
                aria-label="Strikethrough"
              >
                <span style="text-decoration: line-through">S</span>
              </button>
            </div>
          {/if}

          {#if activeTextTool === "alignment"}
            <div
              class="edit-menu-row"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <button
                class="edit-menu-btn blue sub"
                class:active={markup.textAlign === "left"}
                onclick={() => markup.setTextAlign("left")}
                data-tooltip="Left"
                aria-label="Align left"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="15" y2="12" />
                  <line x1="3" y1="18" x2="18" y2="18" />
                </svg>
              </button>
              <button
                class="edit-menu-btn blue sub"
                class:active={markup.textAlign === "center"}
                onclick={() => markup.setTextAlign("center")}
                data-tooltip="Center"
                aria-label="Align center"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="6" y1="12" x2="18" y2="12" />
                  <line x1="4" y1="18" x2="20" y2="18" />
                </svg>
              </button>
              <button
                class="edit-menu-btn blue sub"
                class:active={markup.textAlign === "right"}
                onclick={() => markup.setTextAlign("right")}
                data-tooltip="Right"
                aria-label="Align right"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="9" y1="12" x2="21" y2="12" />
                  <line x1="6" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                class="edit-menu-btn blue sub"
                class:active={markup.textAlign === "justify"}
                onclick={() => markup.setTextAlign("justify")}
                data-tooltip="Justify"
                aria-label="Justify"
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                >
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
            </div>
          {/if}
        {/if}
      </div>
    </div>

    <div
      class="edit-actions-bar edit-actions-right"
      class:has-edits={hasEdits}
      in:fly={{ x: -60, duration: 180, opacity: 0.08 }}
      out:fly={{ y: -26, duration: 190, opacity: 0.08 }}
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
  </div>
{/if}
