<script lang="ts">
  let {
    open,
    fileName,
    onClose,
    onConfirm,
    onExportInstead,
  }: {
    open: boolean;
    fileName: string;
    onClose: () => void;
    onConfirm: () => void;
    onExportInstead: () => void;
  } = $props();
</script>

{#if open}
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="delete-dialog edit-confirm-dialog"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      onmousedown={(e) => e.stopPropagation()}
    >
      <div class="edit-confirm-header">
        <div class="edit-confirm-header-left">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="color: var(--blue)"
          >
            <path
              d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"
            />
          </svg>
          <div>
            <p class="delete-title">Apply Edits?</p>
            <p class="delete-subtitle">{fileName}</p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={onClose}
          aria-label="Cancel"
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
      <div class="edit-confirm-body-box">
        Applying edits will overwrite the current image. A temporary backup is
        created, but you cannot undo after closing the file or app.
      </div>
      <div class="edit-confirm-actions edit-confirm-actions-horizontal">
        <button
          class="edit-confirm-btn-export"
          onclick={onExportInstead}
        >
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
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17,8 12,3 7,8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Export instead
        </button>
        <button class="edit-confirm-btn-primary" onclick={onConfirm}>
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
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Apply
        </button>
      </div>
    </div>
  </div>
{/if}
