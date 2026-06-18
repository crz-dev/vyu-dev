<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { library } from "$lib/features/library/library.svelte";
  import {
    deleteStore,
    performMultiDelete,
  } from "$lib/features/fileActions/deleteFile.svelte";
  import {
    invokeRenameFile,
    invokeCopyFileUnique,
  } from "$lib/features/media/tools";
  import { showToast } from "$lib/features/toast/toast.svelte";
  import { getFileName } from "$lib/services/files";

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

  async function duplicateTo() {
    const dir = await open({ directory: true });
    if (!dir) return;
    const paths = getPaths();
    let successCount = 0;
    let failCount = 0;
    for (const p of paths) {
      try {
        await invokeCopyFileUnique(p, dir);
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      showToast({
        message: `${successCount} file${successCount === 1 ? "" : "s"} duplicated to ${dir}`,
        color: "green",
      });
    }
    if (failCount > 0) {
      showToast({
        message: `Failed to duplicate ${failCount} file${failCount === 1 ? "" : "s"}`,
        color: "red",
      });
    }
    onClose();
    return;
  }

  async function moveTo() {
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
        successCount++;
      } catch {
        failCount++;
      }
    }
    if (successCount > 0) {
      showToast({
        message: `${successCount} file${successCount === 1 ? "" : "s"} moved`,
        color: "blue",
      });
    }
    if (failCount > 0) {
      showToast({
        message: `Failed to move ${failCount} file${failCount === 1 ? "" : "s"}`,
        color: "red",
      });
    }
    onClose();
  }

  function toggleFavorite() {
    const paths = getPaths();
    if (paths.length === 0) return;
    const allFavorited = paths.every((p) => library.isFavorite(p));
    if (allFavorited) {
      for (const p of paths) library.removeFavorite(p);
      showToast({
        message: `Removed ${paths.length === 1 ? "file" : `${paths.length} files`} from favorites`,
        color: "yellow",
      });
    } else {
      for (const p of paths) {
        if (!library.isFavorite(p)) library.addFavorite(p);
      }
      showToast({
        message: `Added ${paths.length === 1 ? "file" : `${paths.length} files`} to favorites`,
        color: "yellow",
      });
    }
    onClose();
  }

  function deleteFiles() {
    const paths = getPaths();
    if (paths.length === 0) return;
    deleteStore.multiDeletePaths = paths;
    if (deleteStore.multiDeleteNoAsk) {
      onClose();
      performMultiDelete({ refreshView: () => library.clearSelection() });
    } else {
      deleteStore.multiDeleteConfirm = true;
      onClose();
    }
  }
</script>

<div class="select-menu" class:open={visible}>
  <div
    class="ctx-drag"
    role="button"
    tabindex="0"
    aria-label="Drag to move"
    onmousedown={(e) => {
      e.preventDefault();
      onMoved?.();
      const menu = (e.currentTarget as HTMLElement).closest(
        ".select-menu",
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
        menu.style.bottom = "auto";
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
    <div class="select-all-card">
      <button
        class="select-all-btn"
        onclick={(e) => {
          e.stopPropagation();
          onSelectAll?.();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label="Select all files"
      >
        Select all
      </button>
    </div>
    <span class="ctx-drag-title">
      <span class="ctx-dots">
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
        <span class="ctx-dot"></span>
      </span>
      <span
        >{selectedCount}
        {selectedCount === 1 ? "file" : "files"} selected</span
      >
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
      <button class="edit-menu-btn green sub" onclick={duplicateTo}>
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
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
        <span>Copy to</span>
      </button>
      <button class="edit-menu-btn blue sub" onclick={moveTo}>
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
          <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
          <polyline points="17 21 17 13 7 13 7 21" />
          <polyline points="7 3 7 8 15 8" />
        </svg>
        <span>Move to</span>
      </button>
      <button class="edit-menu-btn yellow sub" onclick={toggleFavorite}>
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
          <polygon
            points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"
          />
        </svg>
        <span>Favorite</span>
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
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        </svg>
        <span>Delete</span>
      </button>
    </div>
  </div>
</div>

<style>
  .select-menu {
    position: fixed;
    bottom: 40px;
    left: 50%;
    transform: translateX(-50%) translateY(calc(100% + 20px));
    background: var(--bg-secondary);
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
  }

  .select-menu .ctx-drag:hover {
    background: transparent;
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
</style>
