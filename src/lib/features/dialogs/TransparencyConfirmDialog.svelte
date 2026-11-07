<script lang="ts">
  import { locale } from "$lib/features/i18n/locale.svelte";

  let {
    open,
    fileName,
    fileExtUpper,
    onClose,
    onChoice,
  }: {
    open: boolean;
    fileName: string;
    fileExtUpper: string;
    onClose: () => void;
    onChoice: (choice: "png" | "keep") => void;
  } = $props();

  const t = locale.t;
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
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4" />
            <path d="M12 8h.01" />
          </svg>
          <div>
            <p class="delete-title">{t("dialogs.transparency.title")}</p>
            <p class="delete-subtitle">{fileName}</p>
          </div>
        </div>
        <button
          class="edit-confirm-header-close"
          onclick={onClose}
          aria-label={t("dialogs.transparency.cancel")}
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
        {t("dialogs.transparency.body")}
      </div>
      <div class="edit-confirm-actions edit-confirm-actions-vertical">
        <button
          class="edit-confirm-btn-blue edit-confirm-btn-full"
          onclick={() => onChoice("keep")}
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
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          {t("dialogs.transparency.keepAs", { ext: fileExtUpper })}
        </button>
        <button
          class="edit-confirm-btn-primary edit-confirm-btn-full"
          onclick={() => onChoice("png")}
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
            <path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            />
            <polyline points="14 2 14 8 20 8" />
            <line x1="12" y1="18" x2="12" y2="12" />
            <line x1="9" y1="15" x2="15" y2="15" />
          </svg>
          {t("dialogs.transparency.convertPng")}
        </button>
      </div>
    </div>
  </div>
{/if}
