<script lang="ts">
  import { fly } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { cubicOut } from "svelte/easing";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import { queue } from "$lib/features/media/queue.svelte";
  import { saveQueueAsPlaylist } from "$lib/features/playlists/playlistActions";
  import { getFileName, getParentFolder } from "$lib/services/files";
  import { showToast } from "$lib/components/toast.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;
  const tp = locale.tp;

  let {
    visible,
    onClose,
    fileList = [],
    currentIndex = 0,
    thumbnailBarVisible = false,
  }: {
    visible: boolean;
    onClose: () => void;
    fileList?: string[];
    currentIndex?: number;
    thumbnailBarVisible?: boolean;
  } = $props();

  let pinned = $state(false);
  let menuElement = $state<HTMLElement | null>(null);
  let listEl: HTMLDivElement | null = $state(null);

  let scrollThumbTop = $state(0);
  let scrollThumbHeight = $state(0);
  let showScrollbar = $state(false);
  let scrollHideTimer: ReturnType<typeof setTimeout> | undefined;

  let dragIndex = $state<number | null>(null);
  let dropIndex = $state<number | null>(null);
  let dragPointerId: number | null = null;
  let clearConfirm = $state(false);
  let clearTimer: ReturnType<typeof setTimeout> | undefined;
  let savingPlaylist = $state(false);

  let intervalTrackEl: HTMLDivElement | null = $state(null);
  let intervalDragging = $state(false);

  function refreshScrollbarMetrics(): boolean {
    const el = listEl;
    if (!el) {
      showScrollbar = false;
      return false;
    }
    const maxScroll = el.scrollHeight - el.clientHeight;
    if (maxScroll <= 1) {
      showScrollbar = false;
      return false;
    }
    const thumbHeight = Math.max(
      24,
      el.clientHeight * (el.clientHeight / el.scrollHeight),
    );
    const maxTop = el.clientHeight - thumbHeight;
    scrollThumbHeight = thumbHeight;
    scrollThumbTop =
      maxScroll > 0 ? (el.scrollTop / maxScroll) * Math.max(0, maxTop) : 0;
    return true;
  }

  function handleListScroll() {
    if (!refreshScrollbarMetrics()) return;
    showScrollbar = true;
    if (scrollHideTimer) clearTimeout(scrollHideTimer);
    scrollHideTimer = setTimeout(() => {
      showScrollbar = false;
    }, 800);
  }

  $effect(() => {
    if (!visible) {
      showScrollbar = false;
      clearConfirm = false;
      if (clearTimer) clearTimeout(clearTimer);
      return;
    }
    showScrollbar = false;
    const frame = requestAnimationFrame(() => {
      void queue.length;
      refreshScrollbarMetrics();
    });
    return () => cancelAnimationFrame(frame);
  });

  $effect(() => {
    void queue.length;
    const frame = requestAnimationFrame(refreshScrollbarMetrics);
    return () => cancelAnimationFrame(frame);
  });

  let showEmpty = $state(queue.length === 0);

  $effect(() => {
    if (queue.length > 0) {
      showEmpty = false;
      return;
    }
    if (showEmpty) return;
    const timer = setTimeout(() => {
      showEmpty = true;
    }, 220);
    return () => clearTimeout(timer);
  });

  $effect(() => {
    return () => {
      if (scrollHideTimer) clearTimeout(scrollHideTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
  });

  function resetDrag() {
    dragIndex = null;
    dropIndex = null;
    dragPointerId = null;
  }

  function handleDragPointerDown(e: PointerEvent, index: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    dragPointerId = e.pointerId;
    dragIndex = index;
    dropIndex = index;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handleDragPointerMove(e: PointerEvent) {
    if (dragIndex === null || dragPointerId !== e.pointerId || !listEl) {
      return;
    }
    e.preventDefault();
    const rows = listEl.querySelectorAll<HTMLElement>(".queue-row");
    let target = rows.length - 1;
    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (e.clientY < rect.top + rect.height / 2) {
        target = i;
        break;
      }
    }
    dropIndex = target;
  }

  function handleDragPointerUp(e: PointerEvent) {
    if (dragIndex === null) return;
    if (dropIndex !== null) queue.move(dragIndex, dropIndex);
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture can already be gone after a cancel.
    }
    resetDrag();
  }

  function intervalPct(value: number): number {
    if (value <= 5) {
      return ((value - 1) / 4) * 50;
    }
    return 50 + ((value - 5) / 5) * 50;
  }

  function intervalFromPct(pct: number): number {
    if (pct <= 50) {
      return 1 + (pct / 50) * 4;
    }
    return 5 + ((pct - 50) / 50) * 5;
  }

  function updateIntervalFromX(clientX: number) {
    if (!intervalTrackEl) return;
    const rect = intervalTrackEl.getBoundingClientRect();
    const pct = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100),
    );
    slideshow.intervalSec = Math.max(
      1,
      Math.min(10, Math.round(intervalFromPct(pct))),
    );
  }

  function handleIntervalPointerDown(e: PointerEvent) {
    if (!intervalTrackEl) return;
    intervalDragging = true;
    intervalTrackEl.setPointerCapture(e.pointerId);
    updateIntervalFromX(e.clientX);
  }

  function handleIntervalPointerMove(e: PointerEvent) {
    if (!intervalDragging) return;
    e.preventDefault();
    updateIntervalFromX(e.clientX);
  }

  function handleIntervalPointerUp(e: PointerEvent) {
    if (!intervalDragging) return;
    intervalDragging = false;
    try {
      intervalTrackEl?.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture can already be gone after a cancel.
    }
  }

  function clampMenuPosition() {
    const menu = menuElement;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const left = Math.max(0, Math.min(rect.left, maxLeft));
    const top = Math.max(0, Math.min(rect.top, maxTop));
    if (left !== rect.left) {
      menu.style.left = `${left}px`;
      menu.style.transform = "none";
    }
    if (top !== rect.top) {
      menu.style.top = `${top}px`;
      menu.style.bottom = "auto";
    }
  }

  $effect(() => {
    if (!visible || !menuElement) return;
    void thumbnailBarVisible;
    const frame = requestAnimationFrame(clampMenuPosition);
    return () => cancelAnimationFrame(frame);
  });

  function handleWindowMouseDown(e: MouseEvent) {
    if (
      visible &&
      !pinned &&
      !(e.target as HTMLElement).closest(".queue-menu") &&
      !(e.target as HTMLElement).closest(".queue-btn")
    ) {
      onClose();
    }
  }

  function togglePlayback() {
    if (queue.length === 0) return;
    if (!slideshow.active) {
      void queue.startPlayback().then((ok) => {
        if (!ok) {
          showToast({ message: t("menus.queue.playFailed"), color: "red" });
        }
      });
    } else if (slideshow.paused) {
      slideshow.resume();
    } else {
      slideshow.pause();
    }
  }

  function stopPlayback() {
    slideshow.stop();
  }

  function playQueued(path: string) {
    void queue
      .playNow(path, { preservePlayback: slideshow.active })
      .then((ok) => {
        if (!ok) {
          showToast({ message: t("menus.queue.playFailed"), color: "red" });
        }
      });
  }

  function removeQueued(path: string) {
    queue.remove(path);
    if (queue.length === 0 && slideshow.active) slideshow.stop();
  }

  function clearQueue() {
    if (!clearConfirm) {
      clearConfirm = true;
      if (clearTimer) clearTimeout(clearTimer);
      clearTimer = setTimeout(() => {
        clearConfirm = false;
      }, 3000);
      return;
    }
    if (clearTimer) clearTimeout(clearTimer);
    clearConfirm = false;
    queue.clear();
    slideshow.stop();
  }

  async function savePlaylist() {
    if (savingPlaylist) return;
    savingPlaylist = true;
    try {
      await saveQueueAsPlaylist();
    } finally {
      savingPlaylist = false;
    }
  }

  function queueFolder() {
    const start = Math.max(0, Math.min(currentIndex, fileList.length - 1));
    const ordered =
      start > 0
        ? [...fileList.slice(start), ...fileList.slice(0, start)]
        : fileList;
    const added = queue.enqueue(ordered);
    if (added > 0) {
      showToast({
        message: tp("menus.queue.added", added),
        color: "green",
      });
    }
  }

  function folderLabel(path: string): string {
    const parent = getParentFolder(path);
    if (!parent) return "";
    return (
      parent
        .replace(/[\\/]+$/, "")
        .split(/[\\/]/)
        .pop() ?? ""
    );
  }
</script>

<svelte:window onmousedown={handleWindowMouseDown} />

{#if visible}
  <div
    class="queue-menu edit-menu"
    class:above-thumbnails={thumbnailBarVisible}
    class:pinned
    bind:this={menuElement}
    transition:fly={{ y: 8, duration: 180, opacity: 0.05 }}
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="0"
      aria-label={t("menus.common.dragToMove")}
      onmousedown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const menu = (e.currentTarget as HTMLElement).closest(
          ".queue-menu",
        ) as HTMLElement;
        if (!menu) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = menu.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;
        const maxLeft = Math.max(0, window.innerWidth - rect.width);
        const maxTop = Math.max(0, window.innerHeight - rect.height);

        function onMouseMove(ev: MouseEvent) {
          menu.style.left = `${Math.max(0, Math.min(startLeft + ev.clientX - startX, maxLeft))}px`;
          menu.style.top = `${Math.max(0, Math.min(startTop + ev.clientY - startY, maxTop))}px`;
          menu.style.bottom = "auto";
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
      <button
        class="ctx-pin"
        class:active={pinned}
        title={pinned ? t("menus.common.unpin") : t("menus.common.pin")}
        onclick={(e) => {
          e.stopPropagation();
          pinned = !pinned;
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={pinned ? t("menus.common.unpin") : t("menus.common.pin")}
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
      <span class="ctx-drag-title queue-header-title">
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
        <span
          >{t("menus.queue.title")}{queue.length > 0
            ? ` (${queue.length})`
            : ""}</span
        >
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
      </span>
      <button
        class="ctx-close"
        title={t("menus.common.close")}
        onclick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={t("menus.common.close")}
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

    <div class="edit-menu-card queue-body">
      <div class="queue-list-wrap">
        <div
          class="queue-list"
          role="list"
          bind:this={listEl}
          onscroll={handleListScroll}
        >
          {#each queue.items as path, index (path)}
            <div
              class="queue-row"
              class:dragging={dragIndex === index}
              class:drop-target={dropIndex === index && dragIndex !== index}
              role="listitem"
              in:fly={{
                y: 6,
                duration: 160,
                delay: Math.min(index, 10) * 16,
                opacity: 0,
                easing: cubicOut,
              }}
              out:fly={{ y: -10, duration: 180, opacity: 0, easing: cubicOut }}
              animate:flip={{ duration: 220, easing: cubicOut }}
            >
              <span
                class="queue-drag-handle"
                role="button"
                tabindex="-1"
                aria-label={t("menus.queue.reorder")}
                title={t("menus.queue.reorder")}
                onpointerdown={(e) => handleDragPointerDown(e, index)}
                onpointermove={handleDragPointerMove}
                onpointerup={handleDragPointerUp}
                onpointercancel={handleDragPointerUp}
              >
                <svg
                  width="8"
                  height="12"
                  viewBox="0 0 8 12"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <circle cx="2" cy="2" r="1" />
                  <circle cx="6" cy="2" r="1" />
                  <circle cx="2" cy="6" r="1" />
                  <circle cx="6" cy="6" r="1" />
                  <circle cx="2" cy="10" r="1" />
                  <circle cx="6" cy="10" r="1" />
                </svg>
              </span>
              <span class="queue-index">{index + 1}</span>
              <button
                class="queue-row-main"
                onclick={() => playQueued(path)}
                title={t("menus.queue.playNow")}
              >
                <span class="queue-row-name">{getFileName(path)}</span>
                <span class="queue-row-folder">{folderLabel(path)}</span>
              </button>
              <button
                class="queue-row-remove"
                onclick={() => removeQueued(path)}
                aria-label={t("menus.queue.remove")}
                title={t("menus.queue.remove")}
              >
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.5"
                  stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg
                >
              </button>
            </div>
          {/each}
        </div>
        <div
          class="queue-scrollbar"
          class:visible={showScrollbar}
          aria-hidden="true"
        >
          <span style="top: {scrollThumbTop}px; height: {scrollThumbHeight}px;"
          ></span>
        </div>
      </div>

      {#if showEmpty}
        <div
          class="queue-empty"
          in:fly={{ y: -4, duration: 160, opacity: 0, easing: cubicOut }}
        >
          <span class="queue-empty-title">{t("menus.queue.empty")}</span>
        </div>
      {/if}

      {#if fileList.length > 0 || queue.length > 0}
        <div class="queue-utility-row">
          {#if fileList.length > 0}
            <button class="queue-utility-btn folder" onclick={queueFolder}>
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path
                  d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
                />
              </svg>
              <span>{t("menus.queue.addFolder")}</span>
            </button>
          {/if}
          {#if queue.length > 0}
            <button
              class="queue-utility-btn danger"
              class:confirm={clearConfirm}
              onclick={clearQueue}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              <span
                >{clearConfirm
                  ? t("menus.queue.confirmClear")
                  : t("menus.queue.clear")}</span
              >
            </button>
          {/if}
        </div>
      {/if}

      <div class="queue-interval-row">
        <div class="queue-interval-label">
          <span class="queue-control-label"
            >{t("menus.slideshow.interval")}</span
          >
          <span class="queue-interval-value">{slideshow.intervalSec}s</span>
        </div>
        <div
          class="color-slider-track queue-interval-track"
          bind:this={intervalTrackEl}
          role="slider"
          tabindex="0"
          aria-valuemin={1}
          aria-valuemax={10}
          aria-valuenow={slideshow.intervalSec}
          aria-label={t("menus.slideshow.intervalAria")}
          onpointerdown={handleIntervalPointerDown}
          onpointermove={handleIntervalPointerMove}
          onpointerup={handleIntervalPointerUp}
          onpointercancel={handleIntervalPointerUp}
        >
          <div
            class="color-slider-fill"
            style="width: {intervalPct(slideshow.intervalSec)}%"
          ></div>
          <div
            class="color-slider-scrubber"
            style="left: {intervalPct(slideshow.intervalSec)}%"
            role="button"
            tabindex="0"
            aria-label={t("menus.common.scrubber")}
          ></div>
        </div>
      </div>

      <div class="queue-footer-actions">
        <div class="queue-actions" class:two={slideshow.active}>
          {#if !slideshow.active}
            <button
              class="queue-action-btn play"
              onclick={togglePlayback}
              disabled={queue.length === 0}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polygon points="5 3 19 12 5 21 5 3" /></svg
              >
              {t("menus.queue.play")}
            </button>
          {:else}
            <button class="queue-action-btn pause" onclick={togglePlayback}>
              {#if slideshow.paused}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon points="5 3 19 12 5 21 5 3" /></svg
                >
                {t("menus.queue.resume")}
              {:else}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><rect x="6" y="4" width="4" height="16" /><rect
                    x="14"
                    y="4"
                    width="4"
                    height="16"
                  /></svg
                >
                {t("menus.queue.pause")}
              {/if}
            </button>
            <button class="queue-action-btn stop" onclick={stopPlayback}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /></svg
              >
              {t("menus.queue.stop")}
            </button>
          {/if}
        </div>
        {#if queue.length > 0}
          <button
            class="queue-save-btn tooltip-below"
            onclick={savePlaylist}
            disabled={savingPlaylist}
            aria-label={t("menus.queue.savePlaylist")}
            data-tooltip={t("menus.queue.savePlaylist")}
            in:fly={{ y: 4, duration: 150, opacity: 0, easing: cubicOut }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path
                d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"
              />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>
        {/if}
      </div>
    </div>
  </div>
{/if}
