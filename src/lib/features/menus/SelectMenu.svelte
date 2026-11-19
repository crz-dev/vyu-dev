<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { library } from "$lib/features/library/library.svelte";
  import {
    deleteStore,
    performMultiDelete,
  } from "$lib/features/file-actions/deleteFile.svelte";
  import { invokeRenameFile } from "$lib/features/media/api";
  import { queue } from "$lib/features/media/queue.svelte";
  import { showToast } from "$lib/components/toast.svelte";
  import { getFileName } from "$lib/services/files";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;
  const tp = locale.tp;

  let {
    visible,
    selectedCount,
    getSelectedPaths,
    onSelectAll,
    onClose,
    onMoved,
  }: {
    visible: boolean;
    selectedCount: number;
    getSelectedPaths: () => string[];
    onSelectAll?: () => void;
    onClose: () => void;
    onMoved?: () => void;
  } = $props();

  function getPaths(): string[] {
    return getSelectedPaths?.() ?? [];
  }

  let allFavorited = $derived.by(() => {
    void selectedCount;
    if (selectedCount === 0) return false;
    const paths = getPaths();
    return paths.length > 0 && paths.every((p) => library.isFavorite(p));
  });

  $effect(() => {
    if (!visible) library.setCollectMode(false);
  });

  function handleClose() {
    library.setCollectMode(false);
    onClose();
  }

  function startMenuDrag(e: MouseEvent) {
    e.preventDefault();
    onMoved?.();
    const menu = (e.currentTarget as HTMLElement).closest(
      ".select-menu",
    ) as HTMLElement | null;
    if (!menu) return;
    const menuEl = menu;
    const startX = e.clientX;
    const startY = e.clientY;
    const rect = menuEl.getBoundingClientRect();
    const startLeft = rect.left;
    const startTop = rect.top;
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const savedTransition = menuEl.style.transition;
    menuEl.style.transition = "none";

    function onMouseMove(ev: MouseEvent) {
      menuEl.style.left = `${Math.max(0, Math.min(startLeft + ev.clientX - startX, maxLeft))}px`;
      menuEl.style.top = `${Math.max(0, Math.min(startTop + ev.clientY - startY, maxTop))}px`;
      menuEl.style.bottom = "auto";
      menuEl.style.transform = "none";
    }

    function onMouseUp() {
      menuEl.style.transition = savedTransition;
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  async function moveFiles() {
    const dir = await open({ directory: true });
    if (!dir) return;
    const paths = getPaths();
    let successCount = 0;
    let failCount = 0;
    for (const p of paths) {
      try {
        const fileName = getFileName(p);
        const dest = `${dir}\\${fileName}`;
        await invokeRenameFile(p, dest);
        queue.replacePath(p, dest);
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      library.triggerRescan();
      showToast({
        message: tp("menus.select.moved", successCount),
        color: "green",
      });
    }
    if (failCount > 0) {
      showToast({
        message: tp("menus.select.moveFailed", failCount),
        color: "red",
      });
    }
    handleClose();
  }

  function activateCollectMode() {
    library.closeCollection();
    library.setCollectMode(true);
    library.setActiveTab("collections");
  }

  function setCollectMove(move: boolean) {
    if (library.deleteOriginalAfterCopy !== move) {
      library.toggleDeleteOriginalAfterCopy();
    }
  }

  let allQueued = $derived.by(() => {
    void selectedCount;
    const paths = getPaths();
    return paths.length > 0 && paths.every((path) => queue.has(path));
  });

  function queueSelected() {
    const paths = getPaths();
    if (paths.length === 0) return;
    if (allQueued) {
      for (const path of paths) queue.remove(path);
      showToast({
        message: tp("menus.select.unqueued", paths.length),
        color: "grey",
      });
      handleClose();
      return;
    }
    const added = queue.enqueue(paths);
    showToast({
      message: added
        ? tp("menus.select.queued", added)
        : t("menus.select.alreadyQueued"),
      color: added ? "green" : "grey",
    });
    handleClose();
  }

  function toggleFavorite() {
    const paths = getPaths();
    if (paths.length === 0) return;
    if (paths.every((p) => library.isFavorite(p))) {
      for (const p of paths) library.removeFavorite(p);
      showToast({
        message: tp("menus.select.removedFavorites", paths.length),
        color: "red",
      });
    } else {
      for (const p of paths) {
        if (library.isFavorite(p)) library.removeFavorite(p);
        library.addFavorite(p);
      }
      showToast({
        message: tp("menus.select.addedFavorites", paths.length),
        color: "green",
      });
    }
    handleClose();
  }

  function deleteFiles() {
    const paths = getPaths();
    if (paths.length === 0) return;
    deleteStore.multiDeletePaths = paths;
    if (deleteStore.multiDeleteNoAsk) {
      handleClose();
      performMultiDelete({
        refreshView: () => {
          library.clearSelection();
          library.triggerRescan();
        },
      });
    } else {
      deleteStore.multiDeleteConfirm = true;
      handleClose();
    }
  }
</script>

<div class="select-menu" class:open={visible}>
  <div class="ctx-drag">
    <div class="select-all-card" class:collect-mode={library.collectMode}>
      {#if library.collectMode}
        <button
          class="ctx-pin tooltip-above-shift-right"
          data-tooltip={t("menus.select.backToActions")}
          onclick={(e) => {
            e.stopPropagation();
            library.exitCollectMode();
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={t("menus.select.backToActions")}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M9 14L4 9l5-5" />
            <path d="M20 20v-7a4 4 0 00-4-4H4" />
          </svg>
        </button>
      {:else}
        <button
          class="select-all-btn"
          onclick={(e) => {
            e.stopPropagation();
            onSelectAll?.();
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={t("menus.select.selectAllAria")}
        >
          {t("menus.select.selectAll")}
        </button>
      {/if}
    </div>
    <span
      class="ctx-drag-title select-drag-handle"
      role="button"
      tabindex="0"
      aria-label={t("menus.common.dragToMove")}
      onmousedown={startMenuDrag}
    >
      <span class="ctx-dots">
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
      </span>
      {#if library.collectMode && selectedCount === 1}
        <span
          >{t("menus.select.selectedFile", {
            name: getFileName(getPaths()[0]),
          })}</span
        >
      {:else}
        <span>{tp("menus.select.selected", selectedCount)}</span>
      {/if}
      <span class="ctx-dots">
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
      </span>
    </span>
    <button
      class="ctx-close tooltip-above-shift-left"
      data-tooltip={t("menus.common.close")}
      onclick={(e) => {
        e.stopPropagation();
        handleClose();
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
  {#if library.collectMode}
    <div class="edit-menu-card collect-panel">
      <div class="collect-section">
        <span class="collect-section-icon">
          <svg
            width="16"
            height="16"
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
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
        </span>
        <div class="collect-section-copy">
          <span class="collect-section-title"
            >{t("menus.select.collectTitle")}</span
          >
          <p class="collect-section-hint">
            {t("menus.select.collectPrompt")}
          </p>
        </div>
        <div
          class="collect-mode-options"
          role="group"
          aria-label={t("menus.select.collectAction")}
        >
          <button
            class="collect-mode-btn"
            class:active={!library.deleteOriginalAfterCopy}
            onclick={() => setCollectMove(false)}
            aria-pressed={!library.deleteOriginalAfterCopy}
          >
            {t("menus.select.copy")}
          </button>
          <button
            class="collect-mode-btn move"
            class:active={library.deleteOriginalAfterCopy}
            onclick={() => setCollectMove(true)}
            aria-pressed={library.deleteOriginalAfterCopy}
          >
            {t("menus.select.move")}
          </button>
        </div>
      </div>

      <div class="collect-divider"></div>

      <div class="collect-section">
        <span class="collect-section-icon yellow">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2z"
            />
            <path d="M11 13h6" />
            <path d="M14 10l3 3-3 3" />
          </svg>
        </span>
        <div class="collect-section-copy">
          <span class="collect-section-title"
            >{t("menus.select.moveToFolderTitle")}</span
          >
          <p class="collect-section-hint">
            {t("menus.select.moveToFolderHint")}
          </p>
        </div>
        <button class="collect-folder-btn" onclick={moveFiles}>
          <span>{t("menus.select.chooseFolder")}</span>
        </button>
      </div>
    </div>
  {:else}
    <div class="edit-menu-card">
      <div class="edit-menu-row">
        <button class="edit-menu-btn green sub" onclick={queueSelected}>
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
            <line x1="8" y1="6" x2="21" y2="6" />
            <line x1="8" y1="12" x2="21" y2="12" />
            <line x1="8" y1="18" x2="16" y2="18" />
            <circle cx="4" cy="6" r="1" />
            <circle cx="4" cy="12" r="1" />
            <circle cx="4" cy="18" r="1" />
          </svg>
          <span
            >{allQueued
              ? t("menus.select.unqueue")
              : t("menus.select.queue")}</span
          >
        </button>
        <button class="edit-menu-btn blue sub" onclick={activateCollectMode}>
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
              d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
            />
            <line x1="12" y1="11" x2="12" y2="17" />
            <line x1="9" y1="14" x2="15" y2="14" />
          </svg>
          <span>{t("menus.select.collect")}</span>
        </button>
        <button class="edit-menu-btn yellow sub" onclick={toggleFavorite}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill={allFavorited ? "currentColor" : "none"}
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polygon
              points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
            />
          </svg>
          <span
            >{allFavorited
              ? t("menus.select.unfavorite")
              : t("menus.select.favorite")}</span
          >
        </button>
        <button class="edit-menu-btn red sub" onclick={deleteFiles}>
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
            <polyline points="3 6 5 6 21 6" />
            <path
              d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
            />
          </svg>
          <span>{t("menus.select.delete")}</span>
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .select-menu {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%) translateY(calc(100% + 20px));
    background: color-mix(
      in srgb,
      var(--bg-secondary) var(--menu-opacity),
      transparent
    );
    backdrop-filter: blur(var(--menu-blur)) saturate(130%);
    border: 0.5px solid var(--bg-border);
    border-radius: 9px;
    padding: 6px;
    box-shadow: 0 14px 32px rgba(0, 0, 0, 0.5);
    z-index: 1000;
    min-width: 260px;
    width: min(398px, calc(100vw - 30px));
    transition:
      transform 190ms cubic-bezier(0.22, 0.9, 0.3, 1),
      opacity 190ms ease-out;
    pointer-events: none;
    opacity: 0;
  }

  .select-menu.open {
    transform: translateX(-50%) translateY(0);
    pointer-events: auto;
    opacity: 1;
  }

  .select-menu .ctx-drag {
    display: flex;
    justify-content: center;
    align-items: center;
    position: relative;
    cursor: default;
  }

  .select-menu .ctx-drag:hover {
    background: transparent;
  }

  .select-menu .select-drag-handle,
  .select-menu .select-drag-handle * {
    cursor: grab;
    user-select: none;
  }

  .select-menu .select-drag-handle:active,
  .select-menu .select-drag-handle:active * {
    cursor: grabbing;
  }

  .select-menu .ctx-close {
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
  }

  .select-all-card {
    position: absolute;
    left: 4px;
    top: 50%;
    transform: translateY(-50%);
    border: 0.5px solid var(--bg-elevated);
    border-radius: 8px;
    padding: 1px 3px;
    background: var(--bg-primary);
    display: flex;
    align-items: center;
  }

  .select-all-btn {
    background: none;
    border: none;
    color: var(--text-muted, #888);
    font-family: var(--font-family);
    font-size: 10px;
    padding: 2px 6px;
    cursor: pointer;
    border-radius: 4px;
    white-space: nowrap;
    transition: color 0.12s;
  }

  .select-all-btn:hover {
    color: var(--text-primary, #fff);
  }

  .select-all-card.collect-mode {
    border: none;
    background: transparent;
    padding: 0;
  }

  .collect-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 9px;
  }

  .collect-section {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .collect-section-icon {
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
    color: var(--blue-light);
  }

  .collect-section-icon.yellow {
    color: var(--yellow-soft);
  }

  .collect-section-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .collect-section-title {
    font-family: var(--font-family);
    font-size: 10px;
    color: var(--text-primary);
  }

  .collect-section-hint {
    margin: 0;
    font-family: var(--font-family);
    font-size: 9px;
    line-height: 1.35;
    color: var(--text-hint);
  }

  .collect-divider {
    height: 0;
    border-top: 0.5px solid var(--bg-elevated);
    margin: 1px 0;
  }

  .collect-mode-options {
    flex-shrink: 0;
    width: 104px;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    margin-top: 1px;
    padding: 2px;
    border: 0.5px solid var(--bg-border);
    border-radius: 6px;
    background: var(--bg-secondary);
  }

  .collect-mode-btn {
    min-width: 0;
    padding: 3px 2px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--text-muted);
    font-family: var(--font-family);
    font-size: 10px;
    cursor: pointer;
  }

  .collect-mode-btn.active {
    background: var(--blue-bg-hover);
    color: var(--blue-light);
  }

  .collect-mode-btn.move.active {
    background: var(--yellow-bg-default);
    color: var(--yellow-soft);
  }

  .collect-folder-btn {
    flex-shrink: 0;
    width: 104px;
    box-sizing: border-box;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
    padding: 5px 8px;
    border: 0.5px solid var(--yellow-border);
    border-radius: 6px;
    background: var(--yellow-bg-default);
    color: var(--yellow-soft);
    font-family: var(--font-family);
    font-size: 10px;
    cursor: pointer;
  }

  .collect-folder-btn:hover {
    background: var(--yellow-bg-active);
  }
</style>
