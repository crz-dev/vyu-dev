<script lang="ts">
  import { cubicInOut } from "svelte/easing";
  import { fade, fly } from "svelte/transition";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { showToast } from "$lib/components/toast.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { invokeCheckForUpdates } from "$lib/features/system/api";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import {
    loadLastDialogSection,
    saveLastDialogSection,
  } from "$lib/services/storage";

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

  interface HelpEntry {
    icon: string;
    titleKey: string;
    bodyKey: string;
    keys?: string[];
  }

  interface HelpSection {
    id: string;
    labelKey: string;
    entries: HelpEntry[];
  }

  const sections: HelpSection[] = [
    {
      id: "start",
      labelKey: "dialogs.help.nav.start",
      entries: [
        {
          icon: "folder",
          titleKey: "dialogs.help.start.open.title",
          bodyKey: "dialogs.help.start.open.body",
          keys: ["open-file"],
        },
        {
          icon: "chevrons",
          titleKey: "dialogs.help.start.browse.title",
          bodyKey: "dialogs.help.start.browse.body",
          keys: ["previous-file", "next-file"],
        },
        {
          icon: "grid",
          titleKey: "dialogs.help.start.library.title",
          bodyKey: "dialogs.help.start.library.body",
          keys: ["toggle-library"],
        },
        {
          icon: "maximize",
          titleKey: "dialogs.help.start.fullscreen.title",
          bodyKey: "dialogs.help.start.fullscreen.body",
          keys: ["fullscreen"],
        },
        {
          icon: "keyboard",
          titleKey: "dialogs.help.start.shortcuts.title",
          bodyKey: "dialogs.help.start.shortcuts.body",
          keys: ["show-shortcuts"],
        },
      ],
    },
    {
      id: "features",
      labelKey: "dialogs.help.nav.features",
      entries: [
        {
          icon: "bookmark",
          titleKey: "dialogs.help.features.markers.title",
          bodyKey: "dialogs.help.features.markers.body",
          keys: ["add-marker"],
        },
        {
          icon: "film",
          titleKey: "dialogs.help.features.clips.title",
          bodyKey: "dialogs.help.features.clips.body",
          keys: ["loop-start", "loop-end"],
        },
        {
          icon: "playCircle",
          titleKey: "dialogs.help.features.slideshow.title",
          bodyKey: "dialogs.help.features.slideshow.body",
          keys: ["toggle-slideshow", "toggle-sleep-timer"],
        },
        {
          icon: "pencil",
          titleKey: "dialogs.help.features.editing.title",
          bodyKey: "dialogs.help.features.editing.body",
          keys: ["export-edits"],
        },
        {
          icon: "sliders",
          titleKey: "dialogs.help.features.audio.title",
          bodyKey: "dialogs.help.features.audio.body",
        },
      ],
    },
    {
      id: "faq",
      labelKey: "dialogs.help.nav.faq",
      entries: [
        {
          icon: "shield",
          titleKey: "dialogs.help.faq.uploaded.title",
          bodyKey: "dialogs.help.faq.uploaded.body",
        },
        {
          icon: "wifiOff",
          titleKey: "dialogs.help.faq.offline.title",
          bodyKey: "dialogs.help.faq.offline.body",
        },
        {
          icon: "download",
          titleKey: "dialogs.help.faq.exports.title",
          bodyKey: "dialogs.help.faq.exports.body",
        },
        {
          icon: "sun",
          titleKey: "dialogs.help.faq.appearance.title",
          bodyKey: "dialogs.help.faq.appearance.body",
        },
        {
          icon: "undo",
          titleKey: "dialogs.help.faq.undo.title",
          bodyKey: "dialogs.help.faq.undo.body",
        },
      ],
    },
    {
      id: "issues",
      labelKey: "dialogs.help.nav.issues",
      entries: [
        {
          icon: "alertCircle",
          titleKey: "dialogs.help.issues.open.title",
          bodyKey: "dialogs.help.issues.open.body",
        },
        {
          icon: "volumeOff",
          titleKey: "dialogs.help.issues.sound.title",
          bodyKey: "dialogs.help.issues.sound.body",
        },
        {
          icon: "activity",
          titleKey: "dialogs.help.issues.stutter.title",
          bodyKey: "dialogs.help.issues.stutter.body",
        },
        {
          icon: "keyboard",
          titleKey: "dialogs.help.issues.shortcuts.title",
          bodyKey: "dialogs.help.issues.shortcuts.body",
        },
        {
          icon: "message",
          titleKey: "dialogs.help.issues.report.title",
          bodyKey: "dialogs.help.issues.report.body",
        },
      ],
    },
    {
      id: "changelog",
      labelKey: "dialogs.help.nav.changelog",
      entries: [
        {
          icon: "fileText",
          titleKey: "dialogs.help.changelog.notes.title",
          bodyKey: "dialogs.help.changelog.notes.body",
        },
      ],
    },
  ];

  const iconPaths: Record<string, string[]> = {
    folder: [
      "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
    ],
    chevrons: ["M9 18l-6-6 6-6", "M15 6l6 6-6 6"],
    grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
    maximize: [
      "M8 3H5a2 2 0 0 0-2 2v3",
      "M16 3h3a2 2 0 0 1 2 2v3",
      "M16 21h3a2 2 0 0 0 2-2v-3",
      "M8 21H5a2 2 0 0 1-2-2v-3",
    ],
    keyboard: [
      "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z",
      "M7 10h1",
      "M11 10h1",
      "M15 10h1",
      "M8 14h8",
    ],
    undo: ["M1 4v6h6", "M3.51 15a9 9 0 1 0 2.13-9.36L1 10"],
    bookmark: ["M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"],
    film: [
      "M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z",
      "M7 3v18",
      "M17 3v18",
      "M3 8h4",
      "M3 16h4",
      "M17 8h4",
      "M17 16h4",
    ],
    playCircle: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M10 8l6 4-6 4z"],
    pencil: ["M12 20h9", "M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"],
    sliders: [
      "M4 21v-7",
      "M4 10V3",
      "M12 21v-9",
      "M12 8V3",
      "M20 21v-5",
      "M20 12V3",
      "M1 14h6",
      "M9 8h6",
      "M17 16h6",
    ],
    shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
    wifiOff: [
      "M1 1l22 22",
      "M16.72 11.06A10.94 10.94 0 0 1 19 12.55",
      "M5 12.55a10.94 10.94 0 0 1 5.16-2.39",
      "M10.71 5.05A16 16 0 0 1 22.58 9",
      "M1.42 9a15.91 15.91 0 0 1 4.7-2.88",
      "M8.53 16.11a6 6 0 0 1 6.95 0",
      "M12 20h.01",
    ],
    download: [
      "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4",
      "M7 10l5 5 5-5",
      "M12 15V3",
    ],
    sun: [
      "M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10z",
      "M12 1v2",
      "M12 21v2",
      "M4.22 4.22l1.42 1.42",
      "M18.36 18.36l1.42 1.42",
      "M1 12h2",
      "M21 12h2",
      "M4.22 19.78l1.42-1.42",
      "M18.36 5.64l1.42-1.42",
    ],
    alertCircle: [
      "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z",
      "M12 8v4",
      "M12 16h.01",
    ],
    volumeOff: ["M11 5L6 9H2v6h4l5 4z", "M23 9l-6 6", "M17 9l6 6"],
    activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
    message: [
      "M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z",
    ],
    fileText: [
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z",
      "M14 2v6h6",
      "M16 13H8",
      "M16 17H8",
      "M10 9H8",
    ],
  };

  // Saved ids from the earlier layout.
  const legacySections: Record<string, string> = {
    "quick-start": "start",
    tips: "features",
    troubleshooting: "issues",
  };

  function initialSection(): string {
    const saved = loadLastDialogSection("help");
    const mapped = saved ? (legacySections[saved] ?? saved) : "start";
    return sections.some((section) => section.id === mapped) ? mapped : "start";
  }

  function swipe(
    node: Element,
    {
      direction,
      duration,
      easing,
    }: {
      direction: number;
      duration: number;
      easing: (value: number) => number;
    },
  ) {
    const width = node.getBoundingClientRect().width;

    return {
      duration,
      easing,
      css: (value: number) => {
        const offset = (1 - value) * direction * width;
        return `transform: translate3d(${offset}px, 0, 0); opacity: ${value};`;
      },
    };
  }

  let activeSection = $state(initialSection());
  let tabDirection = $state(1);
  let contentEl = $state<HTMLDivElement | null>(null);
  let checkingUpdates = $state(false);
  let panelReady = $state(false);

  const currentSection = $derived(
    sections.find((section) => section.id === activeSection) ?? sections[0],
  );
  const currentIndex = $derived(
    sections.findIndex((section) => section.id === currentSection.id),
  );
  const previousSection = $derived(
    currentIndex > 0 ? sections[currentIndex - 1] : null,
  );
  const nextSection = $derived(
    currentIndex < sections.length - 1 ? sections[currentIndex + 1] : null,
  );

  $effect(() => {
    saveLastDialogSection("help", activeSection);
  });

  $effect(() => {
    panelReady = true;
  });

  function selectSection(id: string) {
    if (id === activeSection) return;
    const from = sections.findIndex((section) => section.id === activeSection);
    const to = sections.findIndex((section) => section.id === id);
    tabDirection = to > from ? 1 : -1;
    activeSection = id;
    contentEl?.scrollTo({ top: 0 });
  }

  async function checkForUpdates() {
    if (checkingUpdates) return;
    checkingUpdates = true;
    try {
      const result = await invokeCheckForUpdates();
      const url = result.status === "update" ? result.releaseUrl : null;
      showToast({
        message: result.message,
        color: "grey",
        duration: url ? 7000 : 4000,
        actions: url
          ? [
              {
                label: t("dialogs.feedback.toast.open"),
                variant: "accent",
                onClick: () => {
                  void openUrl(url).catch((e) =>
                    showToast({ message: String(e), color: "red" }),
                  );
                },
              },
            ]
          : [],
      });
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    } finally {
      checkingUpdates = false;
    }
  }
</script>

{#snippet sectionIcon(id: string)}
  {#if id === "start"}
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
  {:else if id === "features"}
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
  {:else if id === "faq"}
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
  {:else if id === "issues"}
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
  {:else}
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
  {/if}
{/snippet}

{#snippet entryIcon(name: string)}
  <svg
    class="help-entry-icon"
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    {#each iconPaths[name] ?? [] as path}
      <path d={path} />
    {/each}
  </svg>
{/snippet}

{#if helpOpen}
  <div
    class="delete-overlay"
    role="presentation"
    out:fade={{ duration: appearance.reducedMotion ? 0 : 140 }}
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeHelp();
    }}
  >
    <div
      class="delete-dialog help-dialog"
      role="dialog"
      aria-modal="true"
      out:fly={{
        y: 5,
        duration: appearance.reducedMotion ? 0 : 120,
        opacity: 0,
      }}
    >
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
            aria-current={activeSection === sec.id ? "true" : undefined}
            onclick={() => selectSection(sec.id)}
          >
            {t(sec.labelKey)}
          </button>
        {/each}
      </div>

      <div class="settings-content" bind:this={contentEl}>
        <div class="help-panel-stage">
          {#key activeSection}
            <div
              class="help-panel"
              in:swipe={{
                direction: tabDirection,
                duration: panelReady ? 220 : 0,
                easing: cubicInOut,
              }}
              out:swipe={{
                direction: -tabDirection,
                duration: 220,
                easing: cubicInOut,
              }}
            >
              <div
                id={`help-section-${currentSection.id}`}
                class="settings-section"
              >
                <p class="settings-section-header">
                  {@render sectionIcon(currentSection.id)}
                  {t(currentSection.labelKey)}
                  {#if currentSection.id === "changelog"}
                    <span class="help-header-action">
                      <span class="help-header-version">v{__APP_VERSION__}</span
                      >
                      <button
                        class="settings-action-btn"
                        disabled={checkingUpdates}
                        onclick={checkForUpdates}
                      >
                        {checkingUpdates
                          ? t("dialogs.help.changelog.update.checking")
                          : t("dialogs.help.changelog.update.label")}
                      </button>
                    </span>
                  {/if}
                </p>

                <div class="help-entries">
                  {#each currentSection.entries as entry}
                    <div class="help-entry">
                      <div class="help-entry-head">
                        {@render entryIcon(entry.icon)}
                        <span class="help-entry-title">{t(entry.titleKey)}</span
                        >
                        {#if entry.keys?.length}
                          <span class="help-entry-keys">
                            {#each entry.keys as id}
                              <span class="help-kbd-inline">{shortcut(id)}</span
                              >
                            {/each}
                          </span>
                        {/if}
                      </div>
                      <p class="help-entry-body">{t(entry.bodyKey)}</p>
                    </div>
                  {/each}
                </div>
              </div>
            </div>
          {/key}
        </div>
      </div>

      <div class="help-footer">
        <button
          class="help-nav-btn"
          disabled={!previousSection}
          onclick={() => previousSection && selectSection(previousSection.id)}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><polyline points="15 18 9 12 15 6" /></svg
          >
          {t("dialogs.help.footer.previous")}
        </button>
        <button
          class="help-nav-btn"
          disabled={!nextSection}
          onclick={() => nextSection && selectSection(nextSection.id)}
        >
          {t("dialogs.help.footer.next")}
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
          >
        </button>
      </div>
    </div>
  </div>
{/if}
