<script lang="ts">
  import { fly } from "svelte/transition";
  import { slideshow } from "$lib/features/media/slideshow.svelte";
  import { queue } from "$lib/features/media/queue.svelte";
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
  }: {
    visible: boolean;
    onClose: () => void;
    fileList?: string[];
    currentIndex?: number;
  } = $props();

  let pinned = $state(false);
  let menuElement = $state<HTMLElement | null>(null);

  const intervalOptions = [1, 3, 5, 10];

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
    queue.clear();
    slideshow.stop();
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
    class="queue-menu slideshow-menu"
    class:pinned
    bind:this={menuElement}
    transition:fly={{ y: 10, duration: 150, opacity: 0.08 }}
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
        class="ctx-pin tooltip-below"
        class:active={pinned}
        data-tooltip={pinned ? t("menus.common.unpin") : t("menus.common.pin")}
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
      <span class="queue-header-title">
        <span>{t("menus.queue.title")}</span>
        {#if queue.length > 0}
          <span class="queue-title-count">{queue.length}</span>
        {/if}
      </span>
      <button
        class="ctx-close tooltip-below"
        data-tooltip={t("menus.common.close")}
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

    <div class="queue-body">
      {#if queue.length === 0}
        <div class="queue-empty">
          <span class="queue-empty-title">{t("menus.queue.empty")}</span>
          <span class="queue-empty-hint">{t("menus.queue.emptyHint")}</span>
        </div>
      {:else}
        <div class="queue-list" role="list">
          {#each queue.items as path, index (path)}
            <div class="queue-row" role="listitem">
              <span class="queue-index">{index + 1}</span>
              <button
                class="queue-row-main"
                onclick={() => playQueued(path)}
                data-tooltip={t("menus.queue.playNow")}
              >
                <span class="queue-row-name">{getFileName(path)}</span>
                <span class="queue-row-folder">{folderLabel(path)}</span>
              </button>
              <button
                class="queue-row-remove"
                onclick={() => removeQueued(path)}
                aria-label={t("menus.queue.remove")}
                data-tooltip={t("menus.queue.remove")}
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
      {/if}

      {#if fileList.length > 0 || queue.length > 0}
        <div class="queue-utility-row">
          {#if fileList.length > 0}
            <button class="queue-utility-btn" onclick={queueFolder}>
              {t("menus.queue.addFolder", { count: fileList.length })}
            </button>
          {/if}
          {#if queue.length > 0}
            <button class="queue-utility-btn danger" onclick={clearQueue}>
              {t("menus.queue.clear")}
            </button>
          {/if}
        </div>
      {/if}

      <div class="queue-interval-row">
        <span class="queue-control-label">{t("menus.slideshow.interval")}</span>
        <div class="queue-interval-options">
          {#each intervalOptions as seconds (seconds)}
            <button
              class="queue-interval-btn"
              class:active={slideshow.intervalSec === seconds}
              onclick={() => (slideshow.intervalSec = seconds)}
              aria-label={tp("menus.slideshow.setInterval", seconds)}
            >
              {seconds}s
            </button>
          {/each}
        </div>
      </div>

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
    </div>
  </div>
{/if}
