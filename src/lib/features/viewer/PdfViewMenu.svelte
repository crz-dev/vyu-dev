<script lang="ts">
  import { fly } from "svelte/transition";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let {
    fitWidth,
    autoFit,
    rotation,
    dualPage,
    nightMode,
    onOutline,
    onFitPage,
    onFitWidth,
    rotate,
    toggleDualPage,
    toggleNightMode,
    onPresentation,
  }: {
    fitWidth: boolean;
    autoFit: boolean;
    rotation: number;
    dualPage: boolean;
    nightMode: boolean;
    onOutline: () => void;
    onFitPage: () => void;
    onFitWidth: () => void;
    rotate: () => void;
    toggleDualPage: () => void;
    toggleNightMode: () => void;
    onPresentation: () => void;
  } = $props();

  let open = $state(false);
  const transitionMs = $derived(appearance.reducedMotion ? 0 : 140);

  function shortcut(id: string): string {
    return keybindStore.label(id);
  }

  function handleWindowMouseDown(e: MouseEvent) {
    if (!open) return;
    if (!(e.target as HTMLElement).closest(".pdf-view-menu-wrap")) {
      open = false;
    }
  }

  function handleWindowKeydown(e: KeyboardEvent) {
    if (!open || e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    open = false;
  }

  function run(action: () => void) {
    open = false;
    action();
  }
</script>

<svelte:window
  onmousedown={handleWindowMouseDown}
  onkeydowncapture={handleWindowKeydown}
/>

<div class="pdf-view-menu-wrap">
  <button
    class="pdf-view-toggle tooltip-below"
    class:menu-active={open}
    data-tooltip={t("shell.viewer.pdf.viewOptions")}
    aria-label={t("shell.viewer.pdf.viewOptions")}
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 7h7M15 7h5M4 12h3M11 12h9M4 17h11M19 17h1"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
      />
      <circle cx="13" cy="7" r="2" stroke="currentColor" stroke-width="1.6" />
      <circle cx="9" cy="12" r="2" stroke="currentColor" stroke-width="1.6" />
      <circle cx="17" cy="17" r="2" stroke="currentColor" stroke-width="1.6" />
    </svg>
  </button>

  {#if open}
    <div
      class="pdf-view-menu"
      transition:fly={{ y: -6, duration: transitionMs, opacity: 0.08 }}
    >
      <button class="pdf-view-menu-item" onclick={() => run(onOutline)}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M4 6h16M8 11h12M12 16h8"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
          />
        </svg>
        <span class="pdf-view-menu-label">{t("shell.viewer.pdf.outline")}</span>
      </button>
      <div class="pdf-view-menu-sep"></div>
      <button
        class="pdf-view-menu-item"
        class:active={autoFit && !fitWidth}
        aria-pressed={autoFit && !fitWidth}
        onclick={() => run(onFitPage)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="5"
            y="3"
            width="14"
            height="18"
            rx="1.5"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        <span class="pdf-view-menu-label">{t("shell.viewer.pdf.fitPage")}</span>
        {#if autoFit && !fitWidth}
          <svg
            class="pdf-view-menu-check"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m2 5 2 2 4-4"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
      </button>
      <button
        class="pdf-view-menu-item"
        class:active={autoFit && fitWidth}
        aria-pressed={autoFit && fitWidth}
        onclick={() => run(onFitWidth)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="5"
            width="18"
            height="14"
            rx="1.5"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M7 12h10M9 9.5 6.5 12 9 14.5M15 9.5 17.5 12 15 14.5"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="pdf-view-menu-label">{t("shell.viewer.pdf.fitWidth")}</span
        >
        {#if autoFit && fitWidth}
          <svg
            class="pdf-view-menu-check"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m2 5 2 2 4-4"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {:else if shortcut("pdf-fit-width")}
          <span class="pdf-view-menu-key">{shortcut("pdf-fit-width")}</span>
        {/if}
      </button>
      <button class="pdf-view-menu-item" onclick={() => run(rotate)}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="pdf-view-menu-label"
          >{t("shell.viewer.pdf.rotate")} {rotation}°</span
        >
        {#if shortcut("pdf-rotate")}
          <span class="pdf-view-menu-key">{shortcut("pdf-rotate")}</span>
        {/if}
      </button>
      <button
        class="pdf-view-menu-item"
        class:active={dualPage}
        aria-pressed={dualPage}
        onclick={() => run(toggleDualPage)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="4"
            width="8"
            height="16"
            rx="1.2"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <rect
            x="13"
            y="4"
            width="8"
            height="16"
            rx="1.2"
            stroke="currentColor"
            stroke-width="1.5"
          />
        </svg>
        <span class="pdf-view-menu-label">{t("shell.viewer.pdf.dualPage")}</span
        >
        {#if dualPage}
          <svg
            class="pdf-view-menu-check"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m2 5 2 2 4-4"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {/if}
      </button>
      <button
        class="pdf-view-menu-item"
        class:active={nightMode}
        aria-pressed={nightMode}
        onclick={() => run(toggleNightMode)}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span class="pdf-view-menu-label"
          >{t("shell.viewer.pdf.nightMode")}</span
        >
        {#if nightMode}
          <svg
            class="pdf-view-menu-check"
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m2 5 2 2 4-4"
              stroke="currentColor"
              stroke-width="1.4"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {:else if shortcut("pdf-night")}
          <span class="pdf-view-menu-key">{shortcut("pdf-night")}</span>
        {/if}
      </button>
      <div class="pdf-view-menu-sep"></div>
      <button class="pdf-view-menu-item" onclick={() => run(onPresentation)}>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <rect
            x="3"
            y="4"
            width="18"
            height="12"
            rx="1.5"
            stroke="currentColor"
            stroke-width="1.5"
          />
          <path
            d="M12 16v4M8 20h8"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          />
        </svg>
        <span class="pdf-view-menu-label"
          >{t("shell.viewer.pdf.presentation")}</span
        >
        {#if shortcut("pdf-presentation")}
          <span class="pdf-view-menu-key">{shortcut("pdf-presentation")}</span>
        {/if}
      </button>
    </div>
  {/if}
</div>
