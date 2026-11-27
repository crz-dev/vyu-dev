<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { fade, fly, slide } from "svelte/transition";
  import { editing } from "$lib/features/editing/editing.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { contextMenuStore } from "$lib/features/menus/contextMenu.svelte";
  import { menuStore } from "$lib/features/menus/menuVisibility.svelte";

  const t = locale.t;

  let {
    active,
    count,
    busy,
    confirmOpen,
    hideBar = false,
    indexOpen,
    onApply,
    onCancel,
    onClear,
    onConfirmOpenChange,
  }: {
    active: boolean;
    count: number;
    busy: boolean;
    confirmOpen: boolean;
    hideBar?: boolean;
    indexOpen: boolean;
    onApply: (clearMetadata: boolean, keepBackup: boolean) => void;
    onCancel: () => void;
    onClear: () => void;
    onConfirmOpenChange: (open: boolean) => void;
  } = $props();

  let clearMetadata = $state(true);
  let keepBackup = $state(false);
  let pinned = $state(false);
  let dragging = $state(false);
  let menuEl: HTMLDivElement | null = $state(null);

  $effect(() => {
    if (count === 0 && confirmOpen) onConfirmOpenChange(false);
  });

  let sawIndexOpen = false;

  $effect(() => {
    if (active) return;
    pinned = false;
    sawIndexOpen = false;
    dragging = false;
  });

  $effect(() => {
    if (!active) return;
    const floatingMenuOpen = menuStore.isAnyOpen || contextMenuStore.isOpen;
    if (indexOpen) sawIndexOpen = true;
    if (pinned) return;
    if (floatingMenuOpen || (sawIndexOpen && !indexOpen)) onCancel();
  });

  function confirm() {
    onConfirmOpenChange(false);
    onApply(clearMetadata, keepBackup);
  }

  function shortFolderPath(path: string): string {
    if (!path) return "";
    const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
    if (parts.length <= 2) return parts.join("/");
    return parts.slice(-2).join("/");
  }

  async function pickBackupFolder() {
    const dir = await open({
      directory: true,
      defaultPath: editing.backupDir || undefined,
    });
    if (dir) editing.setBackupDir(dir as string);
  }

  function startDrag(e: MouseEvent) {
    if (e.button !== 0 || !menuEl) return;
    e.preventDefault();
    const menu = menuEl;
    const rect = menu.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = rect.left;
    const startTop = rect.top;
    const savedTransition = menu.style.transition;
    dragging = true;
    menu.style.transition = "none";

    function onMove(ev: MouseEvent) {
      menu.style.left = `${Math.max(
        0,
        Math.min(maxLeft, startLeft + ev.clientX - startX),
      )}px`;
      menu.style.top = `${Math.max(
        0,
        Math.min(maxTop, startTop + ev.clientY - startY),
      )}px`;
      menu.style.bottom = "auto";
      menu.style.translate = "none";
      menu.style.transform = "none";
    }

    function onUp() {
      dragging = false;
      menu.style.transition = savedTransition;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
</script>

{#if active && (!hideBar || pinned)}
  <div
    class="edit-menu pdf-redact-bar"
    class:dragging
    class:pinned
    bind:this={menuEl}
    transition:fly={{ y: 26, duration: 190, opacity: 0.08 }}
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="0"
      aria-label={t("menus.common.dragToMove")}
      onmousedown={startDrag}
    >
      <button
        type="button"
        class="ctx-pin tooltip-ctrl"
        class:active={pinned}
        data-tooltip={pinned ? t("menus.common.unpin") : t("menus.common.pin")}
        onclick={() => (pinned = !pinned)}
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
      <span class="ctx-drag-title">
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
        <span>{t("shell.viewer.pdf.redact")}</span>
        <span class="ctx-dots">
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
          <span class="ctx-dot"></span>
        </span>
      </span>
      <button
        type="button"
        class="ctx-close tooltip-ctrl"
        data-tooltip={t("menus.common.close")}
        onclick={onCancel}
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

    <div class="pdf-redact-menu-body">
      <div class="pdf-redact-info">
        <svg
          class="pdf-redact-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3 3l18 18"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <path
            d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <path
            d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.2"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
          <path
            d="M6.6 6.6A18.2 18.2 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 4.4-1"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        <span class="pdf-redact-hint" title={t("shell.viewer.pdf.redactHint")}
          >{t("shell.viewer.pdf.redactHint")}</span
        >
        <span class="pdf-redact-count">{count}</span>
      </div>
      <div class="pdf-redact-actions">
        <button
          type="button"
          class="pdf-redact-btn icon-btn tooltip-ctrl"
          data-tooltip={t("shell.viewer.pdf.redactClear")}
          aria-label={t("shell.viewer.pdf.redactClear")}
          onclick={onClear}
          disabled={count === 0 || busy}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 19h14M8 15l7-7a2.1 2.1 0 0 1 3 3l-7 7H8v-3Z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="pdf-redact-btn danger icon-btn tooltip-ctrl"
          data-tooltip={busy
            ? t("shell.viewer.pdf.redactWorking")
            : t("shell.viewer.pdf.redactApply")}
          aria-label={busy
            ? t("shell.viewer.pdf.redactWorking")
            : t("shell.viewer.pdf.redactApply")}
          onclick={() => onConfirmOpenChange(true)}
          disabled={count === 0 || busy}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3l7.5 3v5.2c0 4.4-3 8.1-7.5 9.8-4.5-1.7-7.5-5.4-7.5-9.8V6L12 3Z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linejoin="round"
            />
            <path
              d="m8.5 12 2.3 2.3 4.7-4.8"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}

{#if active && confirmOpen}
  <div
    class="pdf-redact-confirm-overlay"
    role="presentation"
    transition:fade={{ duration: 180 }}
    onmousedown={(e) => {
      if (e.target === e.currentTarget) onConfirmOpenChange(false);
    }}
  >
    <div
      class="delete-dialog delete-confirm-dialog pdf-redact-confirm"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      aria-label={t("shell.viewer.pdf.redactConfirmTitle")}
      transition:fly={{ y: 8, duration: 160, opacity: 0.08 }}
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="edit-confirm-header">
        <div class="edit-confirm-header-left">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 3l18 18"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path
              d="M10.6 10.6a2 2 0 0 0 2.8 2.8"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path
              d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.2"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
            <path
              d="M6.6 6.6A18.2 18.2 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 4.4-1"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
          <div>
            <p class="delete-title">
              {t("shell.viewer.pdf.redactConfirmTitle")}
            </p>
          </div>
        </div>
        <button
          type="button"
          class="edit-confirm-header-close"
          onclick={() => onConfirmOpenChange(false)}
          aria-label={t("common.close")}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <p class="pdf-redact-confirm-body">
        {t("shell.viewer.pdf.redactConfirmBody")}
      </p>

      <div class="delete-toggles">
        <label class="toggle-row">
          <span class="toggle-label">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"
              />
              <path
                d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"
              />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
            {t("shell.viewer.pdf.redactConfirmMetadata")}
          </span>
          <input type="checkbox" bind:checked={clearMetadata} />
          <span class="toggle-track" class:on={clearMetadata}
            ><span class="toggle-thumb"></span></span
          >
        </label>

        <label class="toggle-row">
          <span class="toggle-label">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
              <path d="M10 12h4" />
            </svg>
            {t("shell.viewer.pdf.redactConfirmBackup")}
          </span>
          <input type="checkbox" bind:checked={keepBackup} />
          <span class="toggle-track" class:on={keepBackup}
            ><span class="toggle-thumb"></span></span
          >
        </label>

        {#if keepBackup}
          <div
            class="pdf-redact-backup-folder"
            transition:slide={{ duration: 140 }}
          >
            <button
              type="button"
              class="pdf-redact-folder-btn"
              title={editing.backupDir || t("settings.editor.backup.appData")}
              onclick={pickBackupFolder}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                />
              </svg>
              <span>
                {editing.backupDir
                  ? shortFolderPath(editing.backupDir)
                  : t("settings.editor.backup.appData")}
              </span>
            </button>
            {#if editing.backupDir}
              <button
                type="button"
                class="pdf-redact-folder-clear"
                title={t("settings.editor.backup.useDefault")}
                aria-label={t("settings.editor.backup.useDefault")}
                onclick={() => editing.setBackupDir("")}
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M18 6L6 18M6 6l12 12"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
            {/if}
          </div>
        {/if}
      </div>

      <div class="delete-actions-card">
        <div class="edit-confirm-actions edit-confirm-actions-horizontal">
          <button
            type="button"
            class="delete-cancel"
            onclick={() => onConfirmOpenChange(false)}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            class="delete-confirm-btn"
            onclick={confirm}
            disabled={busy}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3l7.5 3v5.2c0 4.4-3 8.1-7.5 9.8-4.5-1.7-7.5-5.4-7.5-9.8V6L12 3Z"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="m8.5 12 2.3 2.3 4.7-4.8"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {t("common.confirm")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
