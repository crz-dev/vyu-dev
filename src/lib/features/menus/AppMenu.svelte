<script lang="ts">
  import { invokeRenameFile } from "$lib/features/media/tools";
  import AppDropdownMenu from "./AppDropdownMenu.svelte";

  let {
    fileName,
    fileSrc,
    filePath,
    onRenamed,
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
  }: {
    fileName: string;
    fileSrc: string;
    filePath: string;
    onRenamed: (newPath: string) => void;
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
  } = $props();

  let editing = $state(false);
  let editValue = $state("");
  let inputEl = $state<HTMLInputElement | null>(null);

  function startEditing() {
    editValue = fileName;
    editing = true;
    setTimeout(() => {
      if (!inputEl) return;
      inputEl.focus();
      const dotIndex = editValue.lastIndexOf(".");
      inputEl.setSelectionRange(0, dotIndex > 0 ? dotIndex : editValue.length);
    }, 0);
  }

  async function commitRename() {
    editing = false;
    hideFilenameTooltip();
    const newName = editValue.trim();
    if (!newName || newName === fileName || !filePath) return;

    // Sanitize: reject names containing path separators or traversal
    if (/[/\\]/.test(newName) || newName === ".." || newName === ".") {
      console.error("Rename rejected: invalid characters in filename");
      return;
    }

    const sep = filePath.includes("\\") ? "\\" : "/";
    const dir = filePath.substring(0, filePath.lastIndexOf(sep));
    const newPath = `${dir}${sep}${newName}`;

    // Ensure the resolved path stays within the original directory
    if (!newPath.startsWith(dir + sep)) {
      console.error("Rename rejected: path traversal detected");
      return;
    }

    try {
      await invokeRenameFile(filePath, newPath);
      onRenamed(newPath);
    } catch (e) {
      console.error("Rename failed:", e);
    }
  }

  function cancelEdit() {
    editing = false;
  }

  // Submit rename on any click outside the input.
  // onblur doesn't work here because startPan calls preventDefault()
  // on mousedown, which prevents the browser from blurring the input.
  $effect(() => {
    if (!editing) return;
    function onGlobalMouseDown(e: MouseEvent) {
      if (inputEl && !inputEl.contains(e.target as Node)) {
        commitRename();
      }
    }
    document.addEventListener("mousedown", onGlobalMouseDown, true);
    return () => document.removeEventListener("mousedown", onGlobalMouseDown, true);
  });
</script>

<div class="topbar" onmousedown={startDrag} role="toolbar" tabindex="-1">
  <div class="app-dropdown-anchor">
    <button
      class="app-dropdown-toggle tooltip-below"
      class:active={dropdownVisible}
      onclick={onToggleDropdown}
      aria-label="Open app menu"
      data-tooltip="Vyu"
    >
      <img src="/app-icon.png" alt="vyu" class="app-icon" />
    </button>
    <AppDropdownMenu
      visible={dropdownVisible}
      onClose={onCloseDropdown}
      {onOpenSettings}
      {onOpenAccessibility}
      {onOpenHelp}
      {onOpenAbout}
      {onOpenFeedback}
    />
  </div>
  <span class="divider">/</span>
  {#if editing}
    <input
      bind:this={inputEl}
      bind:value={editValue}
      class="filename-input"
      type="text"
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
      aria-label="Rename file"
    />
  {:else}
    <button
      class="filename filename-btn"
      onmouseenter={showFilenameTooltip}
      onmouseleave={hideFilenameTooltip}
      onclick={fileSrc ? startEditing : undefined}
      aria-label="Rename file">{fileName}</button
    >
  {/if}
  {#if fileSrc}
    <span class="divider">/</span>
    <button
      class="folder-btn close-file-btn tooltip-below"
      data-tooltip="Close file"
      onclick={closeFile}
      aria-label="close file"
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
    <span class="divider">/</span>
    <button
      class="folder-btn open-file-btn tooltip-below"
      data-tooltip="Open file"
      onclick={openFileDialog}
      aria-label="open file"
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
  {/if}
  <div class="window-controls">
    <button
      class="wc-btn tooltip-below"
      data-tooltip="Minimize"
      onclick={minimizeWindow}
      aria-label="minimize">−</button
    >
    <button
      class="wc-btn tooltip-below"
      data-tooltip="Maximize"
      onclick={maximizeWindow}
      aria-label="maximize">▢</button
    >
    <button
      class="wc-btn close tooltip-below"
      data-tooltip="Close"
      onclick={closeWindow}
      aria-label="close">✕</button
    >
  </div>
</div>
