<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import SettingsGroupIcon from "$lib/components/SettingsGroupIcon.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import {
    KEYBIND_ACTIONS,
    KEYBIND_CATEGORY_ICONS,
    KEYBIND_CATEGORY_LABELS,
    KEYBIND_CATEGORY_ORDER,
  } from "$lib/features/keybinds/keybindDefinitions";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import { menuStore } from "$lib/features/menus/menuVisibility.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";

  const t = locale.t;

  const tabs = KEYBIND_CATEGORY_ORDER.map((category) => ({
    category,
    label: KEYBIND_CATEGORY_LABELS[category],
    icon: KEYBIND_CATEGORY_ICONS[category],
  }));
  const tabSplit = Math.ceil(tabs.length / 2);
  const tabRows = [tabs.slice(0, tabSplit), tabs.slice(tabSplit)];

  let direction = $state(1);
  let bodyEl = $state<HTMLDivElement | null>(null);

  const actions = $derived(
    KEYBIND_ACTIONS.filter(
      (action) =>
        action.category === keybindStore.cheatSheetCategory &&
        keybindStore.bindingFor(action.id) !== null,
    ),
  );

  function duration(ms: number): number {
    return appearance.reducedMotion ? 0 : ms;
  }

  function keyParts(id: string): string[] {
    const label = keybindStore.label(id);
    return label ? label.split(" + ") : [];
  }

  function selectCategory(category: (typeof tabs)[number]["category"]) {
    const from = KEYBIND_CATEGORY_ORDER.indexOf(
      keybindStore.cheatSheetCategory,
    );
    const to = KEYBIND_CATEGORY_ORDER.indexOf(category);
    direction = to > from ? 1 : -1;
    keybindStore.setCheatSheetCategory(category);
  }

  function remapAction(id: string) {
    keybindStore.requestActionFocus(id);
    keybindStore.closeCheatSheet();
    menuStore.openSettingsAt("keybinds");
  }

  $effect(() => {
    keybindStore.cheatSheetCategory;
    if (!bodyEl) return;
    bodyEl.scrollTo({
      top: 0,
      behavior: appearance.reducedMotion ? "auto" : "smooth",
    });
  });
</script>

{#if keybindStore.cheatSheetOpen}
  <div
    class="delete-overlay cheat-sheet-overlay"
    role="presentation"
    transition:fade={{ duration: duration(140) }}
    onmousedown={(e) => {
      if (e.target === e.currentTarget) keybindStore.closeCheatSheet();
    }}
  >
    <div
      class="delete-dialog cheat-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheat-sheet-title"
      in:fly={{ y: 8, duration: duration(180), opacity: 0 }}
      out:fly={{ y: 5, duration: duration(120), opacity: 0 }}
    >
      <div class="settings-header-bar">
        <p id="cheat-sheet-title" class="delete-title cheat-sheet-title">
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
            ><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><path
              d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"
            /></svg
          >
          {t("settings.keybinds.cheatSheet.title")}
        </p>
        <p class="delete-subtitle cheat-sheet-hint">
          {t("dialogs.help.start.shortcuts.body")}
        </p>
        <button
          class="dialog-close-x"
          onclick={() => keybindStore.closeCheatSheet()}
          aria-label={t("settings.keybinds.cheatSheet.closeAria")}
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

      <div class="help-tabs cheat-sheet-tabs">
        {#each tabRows as row}
          <div class="cheat-sheet-tab-row">
            {#each row as tab}
              {@const active = keybindStore.cheatSheetCategory === tab.category}
              <button
                class="help-tab-btn cheat-sheet-tab"
                class:active
                aria-current={active ? "true" : undefined}
                onclick={() => selectCategory(tab.category)}
              >
                <SettingsGroupIcon name={tab.icon} />
                <span>{t(tab.label)}</span>
              </button>
            {/each}
          </div>
        {/each}
      </div>

      <div class="cheat-sheet-body" bind:this={bodyEl}>
        <div class="cheat-sheet-stage">
          {#key keybindStore.cheatSheetCategory}
            <div
              class="cheat-sheet-card"
              in:fly={{
                x: direction * 12,
                duration: duration(160),
                opacity: 0,
              }}
              out:fly={{
                x: -direction * 12,
                duration: duration(110),
                opacity: 0,
              }}
            >
              {#each actions as action (action.id)}
                {@const parts = keyParts(action.id)}
                <button
                  type="button"
                  class="cheat-sheet-row cheat-sheet-row-action"
                  title={t("settings.keybinds.action.change", {
                    action: t(action.label),
                  })}
                  onclick={() => remapAction(action.id)}
                >
                  <span class="cheat-sheet-label">{t(action.label)}</span>
                  <span class="cheat-sheet-trailing">
                    <span class="cheat-sheet-keys">
                      {#each parts as part, index}
                        <kbd
                          class="cheat-sheet-key"
                          class:cheat-sheet-key-main={index ===
                            parts.length - 1}>{part}</kbd
                        >
                      {/each}
                    </span>
                    <span class="cheat-sheet-remap" aria-hidden="true">
                      <SettingsGroupIcon name="pencil" />
                    </span>
                  </span>
                </button>
              {:else}
                <p class="cheat-sheet-empty">
                  {t("settings.keybinds.empty")}
                </p>
              {/each}

              {#if keybindStore.cheatSheetCategory === "app"}
                <p class="settings-group-label cheat-sheet-reserved-label">
                  <span class="settings-group-icon">
                    <SettingsGroupIcon name="lock" />
                  </span>
                  {t("settings.keybinds.cheatSheet.reserved")}
                </p>
                <div class="cheat-sheet-row">
                  <span class="cheat-sheet-label"
                    >{t("settings.keybinds.cheatSheet.cancel")}</span
                  >
                  <span class="cheat-sheet-keys">
                    <kbd class="cheat-sheet-key cheat-sheet-key-main">Esc</kbd>
                  </span>
                </div>
                <div class="cheat-sheet-row">
                  <span class="cheat-sheet-label"
                    >{t("settings.keybinds.cheatSheet.clear")}</span
                  >
                  <span class="cheat-sheet-keys">
                    <kbd class="cheat-sheet-key cheat-sheet-key-main"
                      >Backspace</kbd
                    >
                    <kbd class="cheat-sheet-key cheat-sheet-key-main"
                      >Delete</kbd
                    >
                  </span>
                </div>
              {/if}
            </div>
          {/key}
        </div>
      </div>
    </div>
  </div>
{/if}
