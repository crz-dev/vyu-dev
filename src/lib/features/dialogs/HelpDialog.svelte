<script lang="ts">
  import {
    loadLastDialogSection,
    saveLastDialogSection,
  } from "$lib/services/storage";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  function shortcut(id: string): string {
    return keybindStore.label(id) || t("dialogs.help.unbound");
  }

  let {
    helpOpen,
    closeHelp,
  }: {
    helpOpen: boolean;
    closeHelp: () => void;
  } = $props();

  let activeSection = $state(loadLastDialogSection("help") || "quick-start");
  let contentEl = $state<HTMLDivElement | null>(null);
  let flashId = $state<string | null>(null);
  let isScrolling = $state(false);
  let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
  let flashTimeout: ReturnType<typeof setTimeout> | null = null;

  $effect(() => {
    saveLastDialogSection("help", activeSection);
  });

  $effect(() => {
    if (helpOpen) {
      requestAnimationFrame(() => {
        const el = document.getElementById(`help-section-${activeSection}`);
        if (el) {
          el.scrollIntoView({ block: "start" });
        }
      });
    }
  });

  const sections = [
    { id: "quick-start", labelKey: "dialogs.help.nav.quickStart" },
    { id: "faq", labelKey: "dialogs.help.nav.faq" },
    { id: "tips", labelKey: "dialogs.help.nav.tips" },
    {
      id: "troubleshooting",
      labelKey: "dialogs.help.nav.troubleshooting",
    },
    { id: "changelog", labelKey: "dialogs.help.nav.changelog" },
  ];

  function scrollToSection(id: string) {
    activeSection = id;
    if (scrollTimeout) clearTimeout(scrollTimeout);
    if (flashTimeout) clearTimeout(flashTimeout);
    isScrolling = true;
    const el = document.getElementById(`help-section-${id}`);
    if (el && contentEl) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      flashId = id;
      flashTimeout = setTimeout(() => {
        if (flashId === id) flashId = null;
      }, 900);
    }
    scrollTimeout = setTimeout(() => {
      isScrolling = false;
    }, 700);
  }

  function handleScroll() {
    if (!contentEl || isScrolling) return;
    const nearBottom =
      contentEl.scrollTop + contentEl.clientHeight >=
      contentEl.scrollHeight - 8;
    if (nearBottom) {
      activeSection = sections[sections.length - 1].id;
      return;
    }
    const containerRect = contentEl.getBoundingClientRect();
    const threshold = containerRect.top + contentEl.clientHeight * 0.35;
    let current = sections[0].id;
    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(`help-section-${sections[i].id}`);
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= threshold) {
          current = sections[i].id;
          break;
        }
      }
    }
    activeSection = current;
  }
</script>

{#if helpOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeHelp();
    }}
  >
    <div class="delete-dialog help-dialog" role="dialog" aria-modal="true">
      <div class="settings-header-bar">
        <p class="delete-title">
          <svg
            class="header-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="12" cy="12" r="10" /><path
              d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
            /><line x1="12" y1="17" x2="12.01" y2="17" /></svg
          >
          {t("dialogs.help.title")}
        </p>
        <p class="delete-subtitle">{t("dialogs.help.subtitle")}</p>
        <button
          class="dialog-close-x"
          onclick={closeHelp}
          aria-label={t("dialogs.help.close")}
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

      <div class="help-tabs">
        {#each sections as sec}
          <button
            class="help-tab-btn"
            class:active={activeSection === sec.id}
            data-section={sec.id}
            onclick={() => scrollToSection(sec.id)}
          >
            {#if sec.id === "quick-start"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><polygon
                  points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                /></svg
              >
            {:else if sec.id === "faq"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><path
                  d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
                /><line x1="12" y1="17" x2="12.01" y2="17" /></svg
              >
            {:else if sec.id === "tips"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                /></svg
              >
            {:else if sec.id === "troubleshooting"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><line
                  x1="12"
                  y1="8"
                  x2="12"
                  y2="12"
                /><line x1="12" y1="16" x2="12.01" y2="16" /></svg
              >
            {:else if sec.id === "changelog"}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                /><path
                  d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                /></svg
              >
            {/if}
            {t(sec.labelKey)}
          </button>
        {/each}
      </div>

      <div
        class="settings-content"
        bind:this={contentEl}
        onscroll={handleScroll}
      >
        <div
          id="help-section-quick-start"
          class="settings-section"
          class:flash={flashId === "quick-start"}
        >
          <p class="settings-section-header">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg
            >
            {t("dialogs.help.nav.quickStart")}
          </p>
          <div class="settings-row help-text-row">
            <div class="help-text">
              <p>
                <strong>{t("dialogs.help.quickStart.openFile.title")}</strong>
                — {t("dialogs.help.quickStart.openFile.body")}
                <span class="help-kbd-inline">{shortcut("open-file")}</span>{t(
                  "dialogs.help.punct.period",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.quickStart.navigate.title")}</strong>
                — {t("dialogs.help.quickStart.navigate.body")}
              </p>
              <p>
                <strong>{t("dialogs.help.quickStart.fullscreen.title")}</strong>
                — {t("dialogs.help.quickStart.fullscreen.body")}
                <span class="help-kbd-inline">{shortcut("fullscreen")}</span>{t(
                  "dialogs.help.punct.period",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.quickStart.zoom.title")}</strong>
                — {t("dialogs.help.quickStart.zoom.body")}
              </p>
              <p>
                <strong>{t("dialogs.help.quickStart.compare.title")}</strong>
                — {t("dialogs.help.quickStart.compare.before")}
                <span class="help-kbd-inline">{shortcut("compare")}</span>
                {t("dialogs.help.quickStart.compare.after")}
              </p>
              <p>
                <strong>{t("dialogs.help.quickStart.shortcuts.title")}</strong>
                — {t("dialogs.help.quickStart.shortcuts.body")}
                <span class="help-kbd-inline">{shortcut("show-shortcuts")}</span
                >
                {t("dialogs.help.quickStart.shortcuts.after")}
              </p>
            </div>
          </div>
        </div>

        <div
          id="help-section-faq"
          class="settings-section"
          class:flash={flashId === "faq"}
        >
          <p class="settings-section-header">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="12" cy="12" r="10" /><path
                d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
              /><line x1="12" y1="17" x2="12.01" y2="17" /></svg
            >
            {t("dialogs.help.nav.faq")}
          </p>
          <div class="settings-row help-text-row">
            <div class="help-text">
              <p>
                <strong>{t("dialogs.help.faq.private.title")}</strong> — {t(
                  "dialogs.help.faq.private.body",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.faq.offline.title")}</strong> — {t(
                  "dialogs.help.faq.offline.body",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.faq.changeUi.title")}</strong> — {t(
                  "dialogs.help.faq.changeUi.before",
                )}
                <span class="help-kbd-inline"
                  >{t("dialogs.help.faq.changeUi.appearance")}</span
                >
                {t("dialogs.help.faq.changeUi.after")}
              </p>
              <p>
                <strong>{t("dialogs.help.faq.canEdit.title")}</strong> — {t(
                  "dialogs.help.faq.canEdit.body",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.faq.converted.title")}</strong> — {t(
                  "dialogs.help.faq.converted.body",
                )}
              </p>
            </div>
          </div>
        </div>

        <div
          id="help-section-tips"
          class="settings-section"
          class:flash={flashId === "tips"}
        >
          <p class="settings-section-header">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              /></svg
            >
            {t("dialogs.help.nav.tips")}
          </p>
          <div class="settings-row help-text-row">
            <div class="help-text">
              <p>
                <strong>{t("dialogs.help.tips.slideshow.title")}</strong> — {t(
                  "dialogs.help.tips.slideshow.body",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.tips.timestamps.title")}</strong> — {t(
                  "dialogs.help.tips.timestamps.body",
                )}
                <span class="help-kbd-inline">{shortcut("add-marker")}</span>
                {t("dialogs.help.tips.timestamps.after")}
              </p>
              <p>
                <strong>{t("dialogs.help.tips.crop.title")}</strong> — {t(
                  "dialogs.help.tips.crop.body",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.tips.drag.title")}</strong> — {t(
                  "dialogs.help.tips.drag.body",
                )}
              </p>
              <p>
                <strong>{t("dialogs.help.tips.clipboard.title")}</strong> — {t(
                  "dialogs.help.tips.clipboard.body",
                )}
              </p>
            </div>
          </div>
        </div>

        <div
          id="help-section-troubleshooting"
          class="settings-section"
          class:flash={flashId === "troubleshooting"}
        >
          <p class="settings-section-header">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="12" cy="12" r="10" /><line
                x1="12"
                y1="8"
                x2="12"
                y2="12"
              /><line x1="12" y1="16" x2="12.01" y2="16" /></svg
            >
            {t("dialogs.help.nav.troubleshooting")}
          </p>
          <div class="settings-row help-text-row">
            <div class="help-text">
              <p>
                <strong>{t("dialogs.help.troubleshooting.video.title")}</strong>
                — {t("dialogs.help.troubleshooting.video.body")}
              </p>
              <p>
                <strong>{t("dialogs.help.troubleshooting.audio.title")}</strong>
                — {t("dialogs.help.troubleshooting.audio.body")}
              </p>
              <p>
                <strong>{t("dialogs.help.troubleshooting.ffmpeg.title")}</strong
                >
                — {t("dialogs.help.troubleshooting.ffmpeg.body")}
              </p>
              <p>
                <strong
                  >{t("dialogs.help.troubleshooting.performance.title")}</strong
                >
                — {t("dialogs.help.troubleshooting.performance.body")}
                <code>--safe-mode</code>
                {t("dialogs.help.troubleshooting.performance.after")}
              </p>
              <p>
                <strong
                  >{t("dialogs.help.troubleshooting.shortcuts.title")}</strong
                >
                — {t("dialogs.help.troubleshooting.shortcuts.body")}
              </p>
            </div>
          </div>
        </div>

        <div
          id="help-section-changelog"
          class="settings-section"
          class:flash={flashId === "changelog"}
        >
          <p class="settings-section-header">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              /><path
                d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              /></svg
            >
            {t("dialogs.help.nav.changelog")}
          </p>
          <div class="settings-row help-text-row">
            <div class="help-text">
              <p>
                <strong>{t("dialogs.help.changelog.title")}</strong> — {t(
                  "dialogs.help.changelog.body",
                )}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="delete-actions settings-footer">
        <div class="settings-footer-left">
          <button class="settings-action-btn" onclick={() => {}}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><circle cx="12" cy="12" r="10" /><polyline
                points="12 6 12 12 16 14"
              /></svg
            >
            {t("dialogs.help.footer.checkUpdates")}
          </button>
        </div>
        <button class="settings-action-btn" onclick={closeHelp}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" /><path
              d="M3 3v5h5"
            /></svg
          >
          {t("dialogs.help.footer.restartTutorial")}
        </button>
      </div>
    </div>
  </div>
{/if}
