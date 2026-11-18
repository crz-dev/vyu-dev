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
</script>

{#snippet statCell(label: string, value: string, icon: string)}
  <button
    type="button"
    class="library-stat"
    data-copyable
    onclick={() => copyRow(value)}
  >
    <span class="library-stat-icon">{@html icon}</span>
    <span class="library-stat-label">{label}</span>
    <span class="library-stat-value">{value}</span>
  </button>
{/snippet}

{#snippet mediaTile(label: string, value: string, icon: string)}
  <button
    type="button"
    class="library-media-tile"
    data-copyable
    onclick={() => copyRow(value)}
  >
    <span class="library-media-icon">{@html icon}</span>
    <span class="library-media-value">{value}</span>
    <span class="library-media-label">{label}</span>
  </button>
{/snippet}

{#snippet detailRow(label: string, value: string, icon: string, title = "")}
  <button
    type="button"
    class="library-detail"
    data-copyable
    onclick={() => copyRow(value)}
    title={title || undefined}
  >
    <span class="library-detail-icon">{@html icon}</span>
    <span class="library-detail-label">{label}</span>
    <span class="library-detail-value">{value}</span>
  </button>
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
    <div
      class="delete-dialog props-dialog library-props-dialog"
      role="dialog"
      aria-modal="true"
    >
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

      <div class="library-props-body" use:bouncePropRows>
        <section class="library-props-card library-details-card">
          <p class="library-section-label">
            {t("dialogs.dialog.properties.details")}
          </p>
          <div
            class="library-details-grid"
            class:three-up={viewInfo.kind === "recents" ||
              viewInfo.kind === "favorites"}
          >
            {@render statCell(
              t("dialogs.dialog.properties.type"),
              typeValue(),
              ICONS.type,
            )}
            {#if viewInfo.kind !== "collections"}
              {@render statCell(
                t("dialogs.dialog.properties.size"),
                sizeValue(),
                ICONS.size,
              )}
            {/if}
            {#if viewInfo.kind === "collections"}
              {@render statCell(
                t("dialogs.dialog.properties.collections"),
                String(viewInfo.collectionCount),
                ICONS.folders,
              )}
            {:else}
              {@render statCell(
                t("dialogs.dialog.properties.files"),
                String(viewInfo.fileCount),
                ICONS.files,
              )}
              {#if viewInfo.kind === "folder"}
                {@render statCell(
                  t("dialogs.dialog.properties.folders"),
                  String(viewInfo.folderCount),
                  ICONS.folders,
                )}
              {/if}
            {/if}
          </div>
        </section>

        <section class="library-props-card library-contents-card">
          <p class="library-section-label">
            {t("dialogs.dialog.properties.contents")}
          </p>
          <div class="library-contents-body">
            {#if viewInfo.kind === "collections"}
              <div class="library-collection-grid">
                {@render mediaTile(
                  t("dialogs.dialog.properties.linkedFolders"),
                  String(viewInfo.linkedCollectionCount),
                  ICONS.parent,
                )}
                {@render mediaTile(
                  t("dialogs.dialog.properties.customCollections"),
                  String(viewInfo.customCollectionCount),
                  ICONS.folders,
                )}
              </div>
            {:else}
              <div class="library-media-grid">
                {@render mediaTile(
                  t("library.sections.type.images"),
                  String(viewInfo.typeCounts.images),
                  ICONS.images,
                )}
                {@render mediaTile(
                  t("library.sections.type.videos"),
                  String(viewInfo.typeCounts.videos),
                  ICONS.videos,
                )}
                {@render mediaTile(
                  t("library.sections.type.audio"),
                  String(viewInfo.typeCounts.audio),
                  ICONS.audio,
                )}
                {@render mediaTile(
                  t("library.sections.type.documents"),
                  String(viewInfo.typeCounts.documents),
                  ICONS.documents,
                )}
              </div>
            {/if}

            {#if viewInfo.kind === "folder"}
              {@render detailRow(
                t("dialogs.dialog.properties.modified"),
                dateValue(viewInfo.modifiedMs),
                ICONS.calendar,
                dateValue(viewInfo.modifiedMs),
              )}
              {@render detailRow(
                t("dialogs.dialog.properties.filePath"),
                pathValue(viewInfo.path),
                ICONS.parent,
                pathValue(viewInfo.path),
              )}
            {/if}
          </div>
        </section>
      </div>

      <div
        class="props-actions-card"
        class:compact={viewInfo.kind !== "folder"}
      >
        <div
          class="props-actions library-props-actions"
          class:single={viewInfo.kind !== "folder"}
        >
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

<style>
  .library-props-dialog {
    width: 460px;
    gap: 8px;
    padding: 0 22px 14px;
  }

  .library-props-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .library-props-card {
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 7px;
    border: 0.5px solid var(--bg-elevated);
    border-radius: 10px;
    background: color-mix(
      in srgb,
      var(--bg-primary) var(--menu-opacity),
      transparent
    );
    backdrop-filter: blur(var(--menu-blur)) saturate(130%);
  }

  .library-details-card {
    height: 96px;
  }

  .library-contents-card {
    height: 140px;
  }

  .library-section-label {
    margin: 0 0 0 2px;
    font-size: 9px;
    line-height: 1;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-hint);
    font-family: var(--font-family);
  }

  .library-details-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
    flex: 1;
    min-height: 0;
  }

  .library-details-grid.three-up {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .library-stat,
  .library-media-tile,
  .library-detail {
    border: 0.5px solid transparent;
    background: rgba(255, 255, 255, 0.025);
    color: var(--text-secondary);
    font-family: var(--font-family);
    text-align: left;
    cursor: pointer;
    transition:
      background 0.12s,
      border-color 0.12s;
  }

  .library-stat:hover,
  .library-media-tile:hover,
  .library-detail:hover {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--bg-border);
  }

  .library-stat:focus-visible,
  .library-media-tile:focus-visible,
  .library-detail:focus-visible {
    outline: none;
    box-shadow: 0 0 0 1px var(--text-muted);
  }

  .library-stat {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 3px 7px;
    border-radius: 7px;
  }

  .library-stat-icon,
  .library-media-icon,
  .library-detail-icon {
    display: inline-flex;
    flex-shrink: 0;
    color: var(--text-hint);
    line-height: 0;
  }

  .library-stat-label,
  .library-detail-label {
    flex-shrink: 0;
    font-size: 9.5px;
    color: var(--text-muted);
    white-space: nowrap;
  }

  .library-stat-value,
  .library-detail-value {
    min-width: 0;
    margin-left: auto;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 10.5px;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .library-contents-body {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-height: 0;
  }

  .library-media-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 5px;
    flex: 1;
    min-height: 0;
  }

  .library-collection-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 5px;
    flex: 1;
    min-height: 0;
  }

  .library-media-tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    min-width: 0;
    min-height: 54px;
    padding: 6px 4px;
    border-radius: 7px;
  }

  .library-media-value {
    font-size: 15px;
    font-weight: 500;
    line-height: 1;
    color: var(--text-primary);
    font-variant-numeric: tabular-nums;
  }

  .library-media-label {
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 9px;
    color: var(--text-muted);
  }

  .library-detail {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    padding: 3px 7px;
    border-radius: 7px;
  }

  .library-props-actions {
    flex-wrap: nowrap;
    gap: 6px;
  }

  .props-actions-card.compact {
    align-self: center;
    padding: 0;
    border: none;
    border-radius: 0;
    background: transparent;
    backdrop-filter: none;
  }

  .library-props-actions :global(.props-btn) {
    flex: 1 1 0;
    min-width: 0;
    padding: 6px 8px;
    font-size: 10.5px;
    white-space: nowrap;
  }

  .library-props-actions.single :global(.props-btn) {
    flex: 0 1 auto;
    padding: 6px 18px;
  }
</style>
