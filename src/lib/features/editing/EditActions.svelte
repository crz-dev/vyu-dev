<script lang="ts">
  import { fly } from "svelte/transition";
  import { editing } from "$lib/features/editing/editing.svelte";

  let {
    side,
    onApply,
    onExport,
    onUndo,
    onReset,
  }: {
    side: "left" | "right";
    onApply: () => void;
    onExport: () => void;
    onUndo: () => void;
    onReset: () => void;
  } = $props();

  const canUndo = $derived(editing.getCanUndo());
  const hasEdits = $derived(editing.getHasEdits() || editing.getCropBounds() !== null);
</script>

{#if hasEdits && side === "left"}
    <div
      class="edit-actions-bar edit-actions-left"
      transition:fly={{ x: 60, duration: 180, opacity: 0.08 }}
    >
      <button
        class="edit-action-btn blue tooltip-ctrl"
        class:inactive={!canUndo}
        disabled={!canUndo}
        onclick={onUndo}
        data-tooltip="Undo"
        aria-label="Undo"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
          <path d="M3 3v5h5" />
        </svg>
        <span class="edit-action-label">Undo</span>
      </button>
      <button
        class="edit-action-btn red tooltip-ctrl"
        disabled={!hasEdits}
        onclick={onReset}
        data-tooltip="Reset"
        aria-label="Reset"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
        <span class="edit-action-label">Reset</span>
      </button>
    </div>
{:else if hasEdits && side === "right"}
    <div
      class="edit-actions-bar edit-actions-right"
      transition:fly={{ x: -60, duration: 180, opacity: 0.08 }}
    >
      <button
        class="edit-action-btn yellow tooltip-ctrl"
        disabled={!hasEdits}
        onclick={onExport}
        data-tooltip="Export"
        aria-label="Export"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17,8 12,3 7,8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span class="edit-action-label">Export</span>
      </button>
      <button
        class="edit-action-btn green tooltip-ctrl"
        disabled={!hasEdits}
        onclick={onApply}
        data-tooltip="Apply"
        aria-label="Apply"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M20 6L9 17l-5-5" />
        </svg>
        <span class="edit-action-label">Apply</span>
      </button>
    </div>
{/if}
