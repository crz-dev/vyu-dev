<script lang="ts">
  import { fly } from "svelte/transition";
  import { invokeRenameFile } from "$lib/features/media/api";
  import { showToast } from "$lib/components/toast.svelte";
  import { getFileName } from "$lib/services/files";
  import AppDropdownMenu from "./AppDropdownMenu.svelte";
  import Marquee from "$lib/components/Marquee.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  function shortcutSuffix(id: string): string {
    const label = keybindStore.label(id);
    return label ? ` (${label})` : "";
  }

  let {
    fileName,
    fileSrc,
    filePath,
    onRenamed,
    onFolderRenamed,
    startDrag,
    showFilenameTooltip,
    hideFilenameTooltip,
    closeFile,
    openFileDialog,
    minimizeWindow,
    maximizeWindow,
    closeWindow,
    dropdownVisible,
    onToggleDropdown,
    onCloseDropdown,
    onOpenSettings,
    onOpenAccessibility,
    onOpenHelp,
    onOpenAbout,
    onOpenFeedback,
    onOpenLibrary,
    libraryOpen = false,
    onCloseLibrary,
    parentFolder,
  }: {
    fileName: string;
    fileSrc: string;
    filePath: string;
    onRenamed: (newPath: string) => void;
    onFolderRenamed?: (newFolderPath: string) => void;
    startDrag: (e: MouseEvent) => void;
    showFilenameTooltip: (e: MouseEvent) => void;
    hideFilenameTooltip: () => void;
    closeFile: () => void;
    openFileDialog: () => void;
    minimizeWindow: () => void;
    maximizeWindow: () => void;
    closeWindow: () => void;
    dropdownVisible: boolean;
    onToggleDropdown: () => void;
    onCloseDropdown: () => void;
    onOpenSettings: () => void;
    onOpenAccessibility: () => void;
    onOpenHelp: () => void;
    onOpenAbout: () => void;
    onOpenFeedback: () => void;
    onOpenLibrary: () => void;
    libraryOpen?: boolean;
    onCloseLibrary?: () => void;
    parentFolder?: () => string;
  } = $props();

  let editing = $state(false);
  let closing = $state(false);
  let editValue = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);
  let startWidthPx = 0;
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  let measureCtx: CanvasRenderingContext2D | null = null;

  // Mirrors .filename max-width in layout.css.
  const FILENAME_MAX_WIDTH = 300;
  // Mirrors the .filename-input width transition in layout.css.
  const RENAME_CLOSE_MS = 190;

  let folderEditing = $state(false);
  let folderEditValue = $state("");
  let folderInputEl = $state<HTMLInputElement | null>(null);

  const folderName = $derived(parentFolder ? getFileName(parentFolder()) : "");

  function startEditing(target?: HTMLButtonElement | EventTarget | null) {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
      closing = false;
    }
    startWidthPx =
      target instanceof HTMLElement ? target.getBoundingClientRect().width : 0;
    editValue = fileName;
    editing = true;
    setTimeout(() => {
      if (!inputEl) return;
      inputEl.focus();
      const dotIndex = editValue.lastIndexOf(".");
      inputEl.setSelectionRange(0, dotIndex > 0 ? dotIndex : editValue.length);
      resetRenameScroll(inputEl);
    }, 0);
  }

  function measureRenameTextWidth(
    text: string,
    style: CSSStyleDeclaration,
  ): number | null {
    if (!measureCtx) {
      measureCtx = document.createElement("canvas").getContext("2d");
    }
    if (!measureCtx) return null;
    measureCtx.font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    return measureCtx.measureText(text).width;
  }

  function measureRenameChrome(style: CSSStyleDeclaration): number {
    return (
      parseFloat(style.paddingLeft) +
      parseFloat(style.paddingRight) +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.borderRightWidth)
    );
  }

  // Space the topbar can spare before the actions to the right of the input.
  // Those actions move as the input grows, so measure against the topbar's
  // right edge (the window controls are pinned there) rather than against the
  // next sibling, which would just echo the input's current width.
  function measureRenameLimit(input: HTMLInputElement): number {
    const topbar = input.parentElement;
    if (!topbar) return Number.POSITIVE_INFINITY;
    const topbarStyle = getComputedStyle(topbar);
    const gap = parseFloat(topbarStyle.columnGap) || 0;
    let reserved = 0;
    for (
      let sibling = input.nextElementSibling;
      sibling;
      sibling = sibling.nextElementSibling
    ) {
      reserved += sibling.getBoundingClientRect().width + gap;
    }
    const rightEdge =
      topbar.getBoundingClientRect().right -
      parseFloat(topbarStyle.paddingRight);
    return Math.max(
      0,
      Math.floor(rightEdge - input.getBoundingClientRect().left - reserved),
    );
  }

  function measureRenameWidth(input: HTMLInputElement): number {
    const style = getComputedStyle(input);
    const textWidth = measureRenameTextWidth(input.value, style) ?? 0;
    const natural = Math.ceil(textWidth + measureRenameChrome(style)) + 2;
    return Math.min(natural, measureRenameLimit(input));
  }

  function resizeRenameInput(input: HTMLInputElement) {
    input.style.width = `${measureRenameWidth(input)}px`;

    // Canvas metrics can drift from the font the field actually renders with.
    // Its scrollWidth reports the text width alone, so grow when the name
    // still clips.
    if (input.scrollWidth > input.clientWidth) {
      const chrome = measureRenameChrome(getComputedStyle(input));
      const needed = Math.ceil(input.scrollWidth + chrome) + 2;
      input.style.width = `${Math.min(needed, measureRenameLimit(input))}px`;
    }
  }

  // Chromium scrolls a focused field to its caret when the selection changes,
  // which hides the start of a name that is wider than the box.
  function resetRenameScroll(input: HTMLInputElement) {
    input.scrollLeft = 0;
  }

  // Shrink back to the filename's displayed width before swapping the input
  // for the label, so the actions slide back with it. The box keeps its text
  // visible while the chrome collapses, landing on the label's geometry.
  function startClose(displayName: string) {
    if (!editing || closing) return;
    closing = true;
    const input = inputEl;
    if (input) {
      // Drop focus so the caret and its scroll-into-view cannot fight the
      // shrink, and Chromium cannot scroll away from the start of the name.
      input.blur();
      input.scrollLeft = 0;
      const textWidth =
        measureRenameTextWidth(displayName, getComputedStyle(input)) ?? 0;
      const target = Math.min(Math.ceil(textWidth) + 1, FILENAME_MAX_WIDTH);
      input.style.width = `${Math.max(target, 0)}px`;
    }
    closeTimer = setTimeout(() => {
      closeTimer = null;
      editing = false;
      closing = false;
    }, RENAME_CLOSE_MS);
  }

  async function commitRename() {
    if (closing) return;
    const newName = editValue.trim();
    startClose(newName || fileName);
    hideFilenameTooltip();
    if (!newName || newName === fileName || !filePath) return;

    // Sanitize: reject names containing path separators or traversal
    if (/[/\\]/.test(newName) || newName === ".." || newName === ".") {
      showToast({
        message: t("menus.app.toast.invalidFilename"),
        color: "red",
      });
      return;
    }

    const sep = filePath.includes("\\") ? "\\" : "/";
    const dir = filePath.substring(0, filePath.lastIndexOf(sep));
    const newPath = `${dir}${sep}${newName}`;

    // Ensure the resolved path stays within the original directory
    if (!newPath.startsWith(dir + sep)) {
      showToast({
        message: t("menus.app.toast.invalidFilename"),
        color: "red",
      });
      return;
    }

    try {
      await invokeRenameFile(filePath, newPath);
      onRenamed(newPath);
      showToast({ message: t("menus.app.toast.fileRenamed"), color: "green" });
    } catch (e) {
      showToast({ message: t("menus.app.toast.renameFailed"), color: "red" });
    }
  }

  function cancelEdit() {
    if (closing) return;
    startClose(fileName);
  }

  function startFolderEditing() {
    folderEditValue = folderName;
    folderEditing = true;
    setTimeout(() => {
      if (!folderInputEl) return;
      folderInputEl.focus();
      folderInputEl.select();
    }, 0);
  }

  async function commitFolderRename() {
    folderEditing = false;
    const newName = folderEditValue.trim();
    const folder = parentFolder?.();
    if (!newName || newName === folderName || !folder) return;

    if (/[/\\]/.test(newName) || newName === ".." || newName === ".") {
      showToast({
        message: t("menus.app.toast.invalidFolderName"),
        color: "red",
      });
      return;
    }

    const sep = folder.includes("\\") ? "\\" : "/";
    const parentDir = folder.substring(0, folder.lastIndexOf(sep));
    const newFolderPath = `${parentDir}${sep}${newName}`;

    if (!newFolderPath.startsWith(parentDir + sep)) {
      showToast({
        message: t("menus.app.toast.invalidFolderName"),
        color: "red",
      });
      return;
    }

    try {
      await invokeRenameFile(folder, newFolderPath);
      onFolderRenamed?.(newFolderPath);
      showToast({
        message: t("menus.app.toast.folderRenamed"),
        color: "green",
      });
    } catch (e) {
      showToast({ message: t("menus.app.toast.renameFailed"), color: "red" });
    }
  }

  function cancelFolderEdit() {
    folderEditing = false;
  }

  // Grow the input from the filename's displayed width so the actions to the
  // right slide over instead of jumping.
  $effect(() => {
    if (!editing) return;
    const input = inputEl;
    if (!input) return;
    input.style.width = `${startWidthPx || input.offsetWidth}px`;
    // Flush the start width so the change below transitions instead of
    // being treated as the element's initial style.
    void input.offsetWidth;
    resizeRenameInput(input);
    resetRenameScroll(input);

    // Canvas metrics fall back to another font until the display font is
    // ready, which can under-measure the name.
    let cancelled = false;
    void document.fonts?.ready.then(() => {
      if (cancelled || closing || inputEl !== input) return;
      resizeRenameInput(input);
      resetRenameScroll(input);
    });
    return () => {
      cancelled = true;
    };
  });

  // Submit rename on any click outside the input.
  // onblur doesn't work here because startPan calls preventDefault()
  // on mousedown, which prevents the browser from blurring the input.
  $effect(() => {
    if (!editing || closing) return;
    function onGlobalMouseDown(e: MouseEvent) {
      if (inputEl && !inputEl.contains(e.target as Node)) {
        commitRename();
      }
    }
    document.addEventListener("mousedown", onGlobalMouseDown, true);
    return () =>
      document.removeEventListener("mousedown", onGlobalMouseDown, true);
  });

  $effect(() => {
    if (!folderEditing) return;
    function onGlobalMouseDown(e: MouseEvent) {
      if (folderInputEl && !folderInputEl.contains(e.target as Node)) {
        commitFolderRename();
      }
    }
    document.addEventListener("mousedown", onGlobalMouseDown, true);
    return () =>
      document.removeEventListener("mousedown", onGlobalMouseDown, true);
  });
</script>

<div class="topbar" onmousedown={startDrag} role="toolbar" tabindex="-1">
  <div class="app-dropdown-anchor">
    <button
      class="app-dropdown-toggle tooltip-below"
      class:active={dropdownVisible}
      class:menu-active={dropdownVisible}
      data-topbar-app
      onclick={onToggleDropdown}
      aria-label={t("menus.app.open")}
      data-tooltip="Vyu"
    >
      <img src="/favicon.png" alt="vyu" class="app-icon" />
    </button>
    <AppDropdownMenu
      visible={dropdownVisible}
      onClose={onCloseDropdown}
      {onOpenSettings}
      {onOpenAccessibility}
      {onOpenHelp}
      {onOpenAbout}
      {onOpenFeedback}
      {onOpenLibrary}
      {libraryOpen}
      {onCloseLibrary}
    />
  </div>
  {#if libraryOpen}
    <span class="divider"></span>
    <button
      class="folder-btn back-btn tooltip-below"
      data-tooltip={t("menus.app.backToViewer")}
      onclick={onCloseLibrary}
      aria-label={t("menus.app.backToViewer")}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path
          d="M19 12H5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path
          d="M12 19l-7-7 7-7"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {/if}
  {#if !libraryOpen}
    <span class="divider"></span>
    {#if editing}
      <input
        bind:this={inputEl}
        bind:value={editValue}
        class="filename-input"
        class:closing
        type="text"
        oninput={() => {
          if (inputEl && !closing) resizeRenameInput(inputEl);
        }}
        onkeydown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitRename();
          }
          if (e.key === "Escape") {
            e.preventDefault();
            cancelEdit();
          }
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label={t("menus.app.renameFile")}
      />
    {:else}
      <button
        class="filename filename-btn"
        onmouseenter={showFilenameTooltip}
        onmouseleave={hideFilenameTooltip}
        onclick={(e) => fileSrc && startEditing(e.currentTarget)}
        aria-label={t("menus.app.renameFile")}
        ><Marquee
          text={fileName}
          scrollOnHover
          class="filename-marquee"
        /></button
      >
    {/if}
  {/if}
  {#if !libraryOpen && fileSrc}
    <div
      class="file-actions"
      transition:fly={{ y: -8, duration: 180, opacity: 0.12 }}
    >
      <span class="divider"></span>
      <button
        class="folder-btn close-file-btn tooltip-below"
        data-tooltip={`${t("menus.app.closeFile")}${shortcutSuffix("close-file")}`}
        onclick={closeFile}
        aria-label={t("menus.app.closeFile")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 10h13a4 4 0 010 8H7"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M7 6l-4 4 4 4"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="divider"></span>
      <button
        class="folder-btn open-file-btn tooltip-below"
        data-tooltip={`${t("menus.app.openFile")}${shortcutSuffix("open-file")}`}
        onclick={openFileDialog}
        aria-label={t("menus.app.openFile")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
          <line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  {/if}
  <div class="window-controls">
    <button
      class="wc-btn tooltip-below"
      data-tooltip={t("menus.app.minimize")}
      onclick={minimizeWindow}
      aria-label={t("menus.app.minimize")}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 5h8"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
    </button>
    <button
      class="wc-btn tooltip-below"
      data-tooltip={t("menus.app.maximize")}
      onclick={maximizeWindow}
      aria-label={t("menus.app.maximize")}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
      >
        <rect
          x="1"
          y="1"
          width="8"
          height="8"
          rx="0.75"
          stroke="currentColor"
          stroke-width="1.2"
        />
      </svg>
    </button>
    <span class="wc-sep"></span>
    <button
      class="wc-btn close tooltip-below tooltip-below-end"
      data-topbar-close
      data-tooltip={t("menus.app.close")}
      onclick={closeWindow}
      aria-label={t("menus.app.close")}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 10 10"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M1 1l8 8M9 1l-8 8"
          stroke="currentColor"
          stroke-width="1.2"
          stroke-linecap="round"
        />
      </svg>
    </button>
  </div>
</div>

<style>
  .file-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .back-btn {
    color: var(--text-primary);
    margin-left: -4px;
  }
  .back-btn:hover {
    color: var(--text-primary);
  }
</style>
