<script lang="ts">
  import { fly } from "svelte/transition";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    count,
    busy,
    confirmOpen,
    hideBar = false,
    onApply,
    onCancel,
    onClear,
    onConfirmOpenChange,
  }: {
    count: number;
    busy: boolean;
    confirmOpen: boolean;
    hideBar?: boolean;
    onApply: (clearMetadata: boolean, keepBackup: boolean) => void;
    onCancel: () => void;
    onClear: () => void;
    onConfirmOpenChange: (open: boolean) => void;
  } = $props();

  let clearMetadata = $state(true);
  let keepBackup = $state(false);

  $effect(() => {
    if (count === 0 && confirmOpen) onConfirmOpenChange(false);
  });

  function confirm() {
    onConfirmOpenChange(false);
    onApply(clearMetadata, keepBackup);
  }
</script>

{#if !hideBar}
  <div
    class="pdf-redact-bar"
    transition:fly={{ y: 10, duration: 160, opacity: 0.08 }}
  >
    <span class="pdf-redact-hint">{t("shell.viewer.pdf.redactHint")}</span>
    <span class="pdf-redact-count">{count}</span>
    <button
      type="button"
      class="pdf-redact-btn"
      onclick={onClear}
      disabled={count === 0 || busy}
    >
      {t("shell.viewer.pdf.redactClear")}
    </button>
    <button
      type="button"
      class="pdf-redact-btn"
      onclick={onCancel}
      disabled={busy}
    >
      {t("common.cancel")}
    </button>
    <button
      type="button"
      class="pdf-redact-btn danger"
      onclick={() => onConfirmOpenChange(true)}
      disabled={count === 0 || busy}
    >
      {busy
        ? t("shell.viewer.pdf.redactWorking")
        : t("shell.viewer.pdf.redactApply")}
    </button>
  </div>
{/if}

{#if confirmOpen}
  <div class="pdf-redact-confirm-overlay" role="presentation">
    <div
      class="pdf-redact-confirm"
      role="dialog"
      aria-modal="true"
      aria-label={t("shell.viewer.pdf.redactConfirmTitle")}
      transition:fly={{ y: 8, duration: 160, opacity: 0.08 }}
    >
      <div class="pdf-dialog-header">
        <div class="pdf-password-icon danger" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M4 20 20 4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="pdf-password-copy">
          <span class="pdf-password-title"
            >{t("shell.viewer.pdf.redactConfirmTitle")}</span
          >
        </div>
        <button
          type="button"
          class="pdf-dialog-close"
          onclick={() => onConfirmOpenChange(false)}
          aria-label={t("common.close")}
        >
          <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <p class="pdf-redact-confirm-body">
        {t("shell.viewer.pdf.redactConfirmBody")}
      </p>
      <label class="pdf-redact-check">
        <input type="checkbox" bind:checked={clearMetadata} />
        <span>{t("shell.viewer.pdf.redactConfirmMetadata")}</span>
      </label>
      <label class="pdf-redact-check">
        <input type="checkbox" bind:checked={keepBackup} />
        <span>{t("shell.viewer.pdf.redactConfirmBackup")}</span>
      </label>
      <div class="pdf-password-actions">
        <button
          type="button"
          class="pdf-password-btn"
          onclick={() => onConfirmOpenChange(false)}
        >
          <svg width="12" height="12" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
          {t("common.cancel")}
        </button>
        <button type="button" class="pdf-password-btn danger" onclick={confirm}>
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
{/if}
