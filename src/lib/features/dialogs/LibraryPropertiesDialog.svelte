<script lang="ts">
  import { fade } from "svelte/transition";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { library } from "$lib/features/library/library.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { formatByteSize, formatMetaDate } from "$lib/shared/fileMeta";
  import { obscurePath } from "$lib/shared/privacy";
  import { bouncePropRows } from "./propRows";
  import type { LibraryViewInfo } from "$lib/shared/types";

  const t = locale.t;

  let {
    open,
    viewInfo,
    onClose,
    onOpenFolder,
    onCopyPath,
    onCopyAll,
    copyPropValue,
  }: {
    open: boolean;
    viewInfo: LibraryViewInfo | null;
    onClose: () => void;
    onOpenFolder: () => void;
    onCopyPath: () => void;
    onCopyAll: () => void;
    copyPropValue: (value: string) => void;
  } = $props();

  const overlayFadeMs = $derived(appearance.reducedMotion ? 0 : 120);

  const ICONS = {
    type: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
    files: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    folders: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>`,
    size: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    images: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
    videos: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
    audio: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>`,
    documents: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><polyline points="4 4 12 12 20 4"/></svg>`,
    calendar: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
    parent: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>`,
    path: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,
  };

  function subtitle(): string {
    if (!viewInfo) return "";
    if (viewInfo.kind === "folder") {
      return viewInfo.name || pathValue(viewInfo.path);
    }
    if (viewInfo.kind === "recents") return t("library.tabs.recents");
    if (viewInfo.kind === "favorites") return t("library.tabs.favorites");
    return t("library.tabs.collections");
  }

  function typeValue(): string {
    if (!viewInfo) return "";
    if (viewInfo.kind === "folder") {
      return t("dialogs.dialog.properties.typeFolder");
    }
    if (viewInfo.kind === "recents") return t("library.tabs.recents");
    if (viewInfo.kind === "favorites") return t("library.tabs.favorites");
    return t("library.tabs.collections");
  }

  function sizeValue(): string {
    if (!viewInfo) return "";
    if (viewInfo.loading) return t("dialogs.dialog.properties.loading");
    return formatByteSize(viewInfo.totalSize);
  }

  function dateValue(ms: number | null): string {
    if (!viewInfo) return "";
    if (viewInfo.loading) return t("dialogs.dialog.properties.loading");
    if (library.privacyMode) return "••••••••••••••••••";
    return ms ? formatMetaDate(ms) : t("dialogs.dialog.properties.unknown");
  }

  function pathValue(path: string | null): string {
    if (!path) return t("dialogs.dialog.properties.unknown");
    return library.privacyMode ? obscurePath(path) : path;
  }

  function copyRow(value: string) {
    copyPropValue(value);
  }

  function onRowKeydown(value: string, event: KeyboardEvent) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    copyRow(value);
  }
</script>

{#snippet propRow(label: string, value: string, icon: string)}
  <div
    class="props-row"
    onclick={() => copyRow(value)}
    onkeydown={(event) => onRowKeydown(value, event)}
    role="button"
    tabindex="0"
  >
    <span class="props-k">{@html icon}{label}</span>
    <span class="props-v">{value}</span>
  </div>
{/snippet}

{#if open && viewInfo}
  <div
    class="delete-overlay"
    out:fade={{ duration: overlayFadeMs }}
    role="presentation"
    onmousedown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}
  >
    <div class="delete-dialog props-dialog" role="dialog" aria-modal="true">
      <div class="props-header-bar">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.5V16" stroke-linecap="round" />
          <circle cx="12" cy="7.5" r="1" fill="currentColor" />
        </svg>
        <div>
          <p class="delete-title">{t("dialogs.dialog.properties.title")}</p>
          <p class="delete-subtitle">{subtitle()}</p>
        </div>
        <button
          class="dialog-close-x"
          onclick={onClose}
          aria-label={t("dialogs.dialog.menu.close")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
          >
        </button>
      </div>

      <div class="props-list" use:bouncePropRows>
        {@render propRow(
          t("dialogs.dialog.properties.type"),
          typeValue(),
          ICONS.type,
        )}

        {#if viewInfo.kind === "folder"}
          {@render propRow(
            t("dialogs.dialog.properties.files"),
            String(viewInfo.fileCount),
            ICONS.files,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.folders"),
            String(viewInfo.folderCount),
            ICONS.folders,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.size"),
            sizeValue(),
            ICONS.size,
          )}
        {:else if viewInfo.kind === "collections"}
          {@render propRow(
            t("dialogs.dialog.properties.collections"),
            String(viewInfo.collectionCount),
            ICONS.folders,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.linkedFolders"),
            String(viewInfo.linkedCollectionCount),
            ICONS.parent,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.customCollections"),
            String(viewInfo.customCollectionCount),
            ICONS.folders,
          )}
        {:else}
          {@render propRow(
            t("dialogs.dialog.properties.files"),
            String(viewInfo.fileCount),
            ICONS.files,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.size"),
            sizeValue(),
            ICONS.size,
          )}
        {/if}

        {#if viewInfo.kind !== "collections"}
          {#if viewInfo.typeCounts.images > 0}
            {@render propRow(
              t("library.sections.type.images"),
              String(viewInfo.typeCounts.images),
              ICONS.images,
            )}
          {/if}
          {#if viewInfo.typeCounts.videos > 0}
            {@render propRow(
              t("library.sections.type.videos"),
              String(viewInfo.typeCounts.videos),
              ICONS.videos,
            )}
          {/if}
          {#if viewInfo.typeCounts.audio > 0}
            {@render propRow(
              t("library.sections.type.audio"),
              String(viewInfo.typeCounts.audio),
              ICONS.audio,
            )}
          {/if}
          {#if viewInfo.typeCounts.documents > 0}
            {@render propRow(
              t("library.sections.type.documents"),
              String(viewInfo.typeCounts.documents),
              ICONS.documents,
            )}
          {/if}
        {/if}

        {#if viewInfo.kind === "folder"}
          {@render propRow(
            t("dialogs.dialog.properties.created"),
            dateValue(viewInfo.createdMs),
            ICONS.calendar,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.modified"),
            dateValue(viewInfo.modifiedMs),
            ICONS.calendar,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.folder"),
            pathValue(viewInfo.parent),
            ICONS.parent,
          )}
          {@render propRow(
            t("dialogs.dialog.properties.filePath"),
            pathValue(viewInfo.path),
            ICONS.path,
          )}
        {/if}
      </div>

      <div class="props-actions-card">
        <div class="props-actions">
          {#if viewInfo.kind === "folder"}
            <button class="props-btn" onclick={onOpenFolder}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
                />
              </svg>
              {t("dialogs.dialog.properties.openFolder")}
            </button>
            <button class="props-btn" onclick={onCopyPath}>
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              >
                <path
                  d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
                />
                <path
                  d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
                />
              </svg>
              {t("dialogs.dialog.properties.copyFolderPath")}
            </button>
          {/if}
          <button class="props-btn" onclick={onCopyAll}>
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            >
              <rect x="8" y="8" width="13" height="13" rx="2" />
              <path d="M4 16V5a1 1 0 011-1h11" />
            </svg>
            {t("dialogs.dialog.properties.copyProperties")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
