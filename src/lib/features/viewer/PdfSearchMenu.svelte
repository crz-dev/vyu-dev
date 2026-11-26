<script lang="ts">
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    visible,
    query,
    results,
    current,
    onSearch,
    onNext,
    onPrev,
    onClose,
  }: {
    visible: boolean;
    query: string;
    results: number;
    current: number;
    onSearch: (value: string) => void;
    onNext: () => void;
    onPrev: () => void;
    onClose: () => void;
  } = $props();

  let inputEl: HTMLInputElement | null = $state(null);
  let wrapperEl: HTMLDivElement | null = $state(null);
  let pinned = $state(false);
  let moved = $state(false);
  let left = $state(0);
  let top = $state(0);

  $effect(() => {
    if (!visible) return;
    void tick().then(() => {
      inputEl?.focus();
      inputEl?.select();
    });
  });

  function beginDrag(e: MouseEvent) {
    e.preventDefault();
    const menu = wrapperEl;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    moved = true;
    left = rect.left;
    top = rect.top;
    const startX = e.clientX;
    const startY = e.clientY;
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);

    function onMove(ev: MouseEvent) {
      left = Math.max(0, Math.min(maxLeft, rect.left + ev.clientX - startX));
      top = Math.max(0, Math.min(maxTop, rect.top + ev.clientY - startY));
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
</script>

{#if visible}
  <div
    class="edit-menu pdf-search-menu"
    class:pinned
    bind:this={wrapperEl}
    style={moved ? `left:${left}px;top:${top}px;transform:none;` : undefined}
    transition:fly={{ y: -10, duration: 170, opacity: 0.08 }}
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="0"
      aria-label={t("menus.common.dragToMove")}
      onmousedown={beginDrag}
    >
      <button
        class="ctx-pin tooltip-below"
        class:active={pinned}
        data-tooltip={pinned ? t("menus.common.unpin") : t("menus.common.pin")}
        aria-label={pinned ? t("menus.common.unpin") : t("menus.common.pin")}
        onclick={(e) => {
          e.stopPropagation();
          pinned = !pinned;
        }}
        onmousedown={(e) => e.stopPropagation()}
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
        <span>{t("common.search")}</span>
      </span>
      <button
        class="ctx-close tooltip-below"
        data-tooltip={t("common.close")}
        aria-label={t("shell.viewer.pdf.closeFind")}
        onclick={onClose}
        onmousedown={(e) => e.stopPropagation()}
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
      <div class="pdf-search-input-row">
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="11"
            cy="11"
            r="7.5"
            stroke="currentColor"
            stroke-width="2"
          />
          <line
            x1="21"
            y1="21"
            x2="16.65"
            y2="16.65"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
        <input
          bind:this={inputEl}
          class="pdf-search-input"
          type="text"
          placeholder={t("shell.viewer.pdf.findPlaceholder")}
          value={query}
          oninput={(e) => onSearch(e.currentTarget.value)}
          onkeydown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (e.shiftKey) onPrev();
              else onNext();
            }
            if (e.key === "Escape") onClose();
          }}
        />
        {#if query}
          <span class="pdf-search-count">
            {results > 0
              ? `${current}/${results}`
              : t("shell.viewer.pdf.noResults")}
          </span>
        {/if}
      </div>
      <div class="edit-menu-row">
        <button
          class="edit-menu-btn blue"
          disabled={results === 0}
          onclick={onPrev}
        >
          <span>{t("shell.viewer.pdf.previousMatch")}</span>
        </button>
        <button
          class="edit-menu-btn green"
          disabled={results === 0}
          onclick={onNext}
        >
          <span>{t("shell.viewer.pdf.nextMatch")}</span>
        </button>
        <button
          class="edit-menu-btn red"
          disabled={!query}
          onclick={() => onSearch("")}
        >
          <span>{t("shell.viewer.pdf.redactClear")}</span>
        </button>
      </div>
    </div>
  </div>
{/if}
