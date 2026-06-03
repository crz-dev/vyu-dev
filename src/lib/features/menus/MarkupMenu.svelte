<script lang="ts">
  import { fly } from "svelte/transition";

  let {
    visible,
    onClose,
    onMoved,
    styleOverride = "",
  }: {
    visible: boolean;
    onClose: () => void;
    onMoved?: () => void;
    styleOverride?: string;
  } = $props();

  let eraserRowOpen = $state(false);
  let highlightRowOpen = $state(false);
  let drawRowOpen = $state(false);
  let textRowOpen = $state(false);
  let pinned = $state(false);
  let openTimeout: ReturnType<typeof setTimeout> | null = $state(null);

  $effect(() => {
    if (!visible) {
      if (openTimeout) clearTimeout(openTimeout);
      openTimeout = null;
      eraserRowOpen = false;
      highlightRowOpen = false;
      drawRowOpen = false;
      textRowOpen = false;
      pinned = false;
    }
  });

  function closeAllRows() {
    eraserRowOpen = false;
    highlightRowOpen = false;
    drawRowOpen = false;
    textRowOpen = false;
  }

  function toggleEraser() {
    if (eraserRowOpen) {
      closeAllRows();
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      openTimeout = setTimeout(() => {
        eraserRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleHighlight() {
    if (highlightRowOpen) {
      closeAllRows();
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      openTimeout = setTimeout(() => {
        highlightRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleDraw() {
    if (drawRowOpen) {
      closeAllRows();
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      openTimeout = setTimeout(() => {
        drawRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleText() {
    if (textRowOpen) {
      closeAllRows();
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      closeAllRows();
      openTimeout = setTimeout(() => {
        textRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }
</script>

{#if visible}
  <div class="markup-menu-wrapper" style={styleOverride}>
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
            <path
              d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            />
            <path d="M2 22l1-4 3 3-1 4H2z" opacity="0.5" />
          </svg>
          <span>Highlight</span>
        </button>
        <button
          class="edit-menu-btn green"
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 20H7L3 16l9-9 8 8-4 4" />
              <path d="M6.5 13.5l5-5" />
            </svg>
            <span>Remove</span>
          </button>
          <button class="edit-menu-btn red sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
            </svg>
            <span>Layer</span>
          </button>
          <button class="edit-menu-btn red sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
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
          <button class="edit-menu-btn yellow sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="13.5" cy="6.5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="17" cy="12" r="2.5" />
              <circle cx="12" cy="18" r="2.5" />
            </svg>
            <span>Color</span>
          </button>
          <button class="edit-menu-btn yellow sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Thickness</span>
          </button>
          <button class="edit-menu-btn yellow sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
            </svg>
            <span>Opacity</span>
          </button>
          <button class="edit-menu-btn yellow sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="5" />
              <rect x="6" y="6" width="12" height="12" rx="2" opacity="0.5" />
            </svg>
            <span>Mode</span>
          </button>
        </div>
      {/if}

      {#if drawRowOpen}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
          out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
        >
          <button class="edit-menu-btn green sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="13.5" cy="6.5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="17" cy="12" r="2.5" />
              <circle cx="12" cy="18" r="2.5" />
            </svg>
            <span>Color</span>
          </button>
          <button class="edit-menu-btn green sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="4" y1="21" x2="4" y2="14" />
              <line x1="4" y1="10" x2="4" y2="3" />
              <line x1="12" y1="21" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12" y2="3" />
              <line x1="20" y1="21" x2="20" y2="16" />
              <line x1="20" y1="12" x2="20" y2="3" />
              <line x1="1" y1="14" x2="7" y2="14" />
              <line x1="9" y1="8" x2="15" y2="8" />
              <line x1="17" y1="16" x2="23" y2="16" />
            </svg>
            <span>Thickness</span>
          </button>
          <button class="edit-menu-btn green sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 2.69l5.66 5.66a8 8 0 11-11.31 0z" />
            </svg>
            <span>Opacity</span>
          </button>
          <button class="edit-menu-btn green sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <circle cx="17.5" cy="6.5" r="3.5" />
              <polygon points="7 21 12 14 17 21" />
            </svg>
            <span>Shapes</span>
          </button>
        </div>
      {/if}

      {#if textRowOpen}
        <div class="edit-menu-separator"></div>
        <div
          class="edit-menu-row"
          in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
          out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
        >
          <button class="edit-menu-btn blue sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="13.5" cy="6.5" r="2.5" />
              <circle cx="6" cy="12" r="2.5" />
              <circle cx="17" cy="12" r="2.5" />
              <circle cx="12" cy="18" r="2.5" />
            </svg>
            <span>Color</span>
          </button>
          <button class="edit-menu-btn blue sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="4 7 4 4 20 4 20 7" />
              <line x1="9" y1="20" x2="15" y2="20" />
              <line x1="12" y1="4" x2="12" y2="20" />
              <path d="M2 7h2" />
              <path d="M20 7h2" />
            </svg>
            <span>Font</span>
          </button>
          <button class="edit-menu-btn blue sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 4h8a4 4 0 010 8h-4a4 4 0 000 8h8" />
              <line x1="4" y1="12" x2="8" y2="12" />
            </svg>
            <span>Style</span>
          </button>
          <button class="edit-menu-btn blue sub">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="17" y1="10" x2="3" y2="10" />
              <line x1="21" y1="6" x2="3" y2="6" />
              <line x1="21" y1="14" x2="3" y2="14" />
              <line x1="17" y1="18" x2="3" y2="18" />
            </svg>
            <span>Alignment</span>
          </button>
        </div>
      {/if}
      </div>
    </div>
  </div>
{/if}
