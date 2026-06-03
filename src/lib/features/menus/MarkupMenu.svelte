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
          <span>Eraser</span>
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
            <span>Small</span>
          </button>
          <button class="edit-menu-btn red sub">
            <span>Medium</span>
          </button>
          <button class="edit-menu-btn red sub">
            <span>Large</span>
          </button>
          <button class="edit-menu-btn red sub">
            <span>Custom</span>
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
            <span>Light</span>
          </button>
          <button class="edit-menu-btn yellow sub">
            <span>Medium</span>
          </button>
          <button class="edit-menu-btn yellow sub">
            <span>Bold</span>
          </button>
          <button class="edit-menu-btn yellow sub">
            <span>Custom</span>
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
            <span>Pen</span>
          </button>
          <button class="edit-menu-btn green sub">
            <span>Brush</span>
          </button>
          <button class="edit-menu-btn green sub">
            <span>Marker</span>
          </button>
          <button class="edit-menu-btn green sub">
            <span>Spray</span>
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
            <span>Small</span>
          </button>
          <button class="edit-menu-btn blue sub">
            <span>Medium</span>
          </button>
          <button class="edit-menu-btn blue sub">
            <span>Large</span>
          </button>
          <button class="edit-menu-btn blue sub">
            <span>Bold</span>
          </button>
        </div>
      {/if}
      </div>
    </div>
  </div>
{/if}
