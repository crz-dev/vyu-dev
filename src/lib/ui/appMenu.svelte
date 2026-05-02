<script lang="ts">
  import { invokeRenameFile } from "$lib/services/mediaTools";
  import AppDropdownMenu from "./appDropdownMenu.svelte";

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
    const sep = filePath.includes("\\") ? "\\" : "/";
    const dir = filePath.substring(0, filePath.lastIndexOf(sep));
    const newPath = `${dir}${sep}${newName}`;
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
</script>

<div class="topbar" onmousedown={startDrag} role="toolbar" tabindex="-1">
  <div class="app-dropdown-anchor">
    <button
      class="app-name app-dropdown-toggle"
      class:active={dropdownVisible}
      onclick={onToggleDropdown}
      aria-label="Open app menu"
    >
      vyu
    </button>
    <AppDropdownMenu visible={dropdownVisible} onClose={onCloseDropdown} {onOpenSettings} {onOpenAccessibility} {onOpenHelp} {onOpenAbout} {onOpenFeedback} />
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
      onblur={commitRename}
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
          d="M8 3h7l5 5v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
          stroke="currentColor"
          stroke-width="2"
        />
        <path d="M15 3v5h5" stroke="currentColor" stroke-width="2" />
        <path
          d="M11 12H4"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <path
          d="M7 9l-3 3 3 3"
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
        <path
          d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
          stroke="currentColor"
          stroke-width="2"
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
