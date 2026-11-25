<script lang="ts">
  import { fly } from "svelte/transition";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    open,
    incorrect,
    onSubmit,
    onCancel,
  }: {
    open: boolean;
    incorrect: boolean;
    onSubmit: (password: string) => void;
    onCancel: () => void;
  } = $props();

  let value = $state("");
  let inputEl: HTMLInputElement | null = $state(null);

  $effect(() => {
    if (!open) {
      value = "";
      return;
    }
    requestAnimationFrame(() => inputEl?.focus());
  });

  function submit(e: SubmitEvent) {
    e.preventDefault();
    onSubmit(value);
  }
</script>

{#if open}
  <div
    class="pdf-password-overlay"
    role="dialog"
    aria-modal="true"
    aria-label={t("shell.viewer.pdf.passwordTitle")}
  >
    <form
      class="pdf-password-card"
      transition:fly={{ y: 10, duration: 160, opacity: 0.08 }}
      onsubmit={submit}
    >
      <div class="pdf-dialog-header">
        <div class="pdf-password-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <rect
              x="5"
              y="10"
              width="14"
              height="11"
              rx="2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M8 10V7a4 4 0 0 1 8 0v3"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
            <circle cx="12" cy="15" r="1.2" fill="currentColor" />
            <path
              d="M12 16.2v2"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </div>
        <div class="pdf-password-copy">
          <span class="pdf-password-title"
            >{t("shell.viewer.pdf.passwordTitle")}</span
          >
          <span class="pdf-password-hint"
            >{t("shell.viewer.pdf.passwordHint")}</span
          >
        </div>
        <button
          type="button"
          class="pdf-dialog-close"
          onclick={onCancel}
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
      <input
        bind:this={inputEl}
        bind:value
        class="pdf-password-input"
        class:invalid={incorrect}
        type="password"
        autocomplete="off"
        placeholder={t("shell.viewer.pdf.passwordPlaceholder")}
        aria-label={t("shell.viewer.pdf.passwordPlaceholder")}
        onkeydown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onCancel();
          }
        }}
      />
      {#if incorrect}
        <span class="pdf-password-error"
          >{t("shell.viewer.pdf.passwordIncorrect")}</span
        >
      {/if}
      <div class="pdf-password-actions">
        <button type="button" class="pdf-password-btn" onclick={onCancel}>
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
        <button type="submit" class="pdf-password-btn primary">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <rect
              x="5"
              y="10"
              width="14"
              height="11"
              rx="2"
              stroke="currentColor"
              stroke-width="1.7"
            />
            <path
              d="M8 10V7a4 4 0 0 1 7.5-1.8"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
            />
          </svg>
          {t("shell.viewer.pdf.passwordUnlock")}
        </button>
      </div>
    </form>
  </div>
{/if}
