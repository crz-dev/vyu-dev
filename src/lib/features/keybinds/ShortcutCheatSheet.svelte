<script lang="ts">
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import {
    KEYBIND_ACTIONS,
    KEYBIND_CATEGORY_LABELS,
    KEYBIND_CATEGORY_ORDER,
  } from "$lib/features/keybinds/keybindDefinitions";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  const groups = $derived.by(() =>
    KEYBIND_CATEGORY_ORDER.map((category) => ({
      category,
      actions: KEYBIND_ACTIONS.filter(
        (action) =>
          action.category === category &&
          keybindStore.bindingFor(action.id) !== null,
      ),
    })).filter((group) => group.actions.length > 0),
  );
</script>

{#if keybindStore.cheatSheetOpen}
  <div
    class="cheat-sheet-overlay"
    role="presentation"
    onclick={(e) => {
      if (e.target === e.currentTarget) keybindStore.closeCheatSheet();
    }}
  >
    <div
      class="cheat-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cheat-sheet-title"
    >
      <div class="cheat-sheet-header">
        <div>
          <p id="cheat-sheet-title" class="cheat-sheet-title">
            {t("settings.keybinds.cheatSheet.title")}
          </p>
          <p class="settings-hint">
            {t("settings.keybinds.cheatSheet.hint.prefix")}
            <span class="help-kbd-inline"
              >{keybindStore.label("show-shortcuts") ||
                t("settings.keybinds.cheatSheet.fallback")}</span
            >
            {t("settings.keybinds.cheatSheet.hint.suffix")}
          </p>
        </div>
        <button
          class="settings-action-btn"
          onclick={() => keybindStore.closeCheatSheet()}
          aria-label={t("settings.keybinds.cheatSheet.closeAria")}
          >{t("settings.keybinds.cheatSheet.close")}</button
        >
      </div>

      <div class="cheat-sheet-body">
        {#each groups as group}
          <div class="cheat-sheet-group">
            <p class="settings-group-label">
              {t(KEYBIND_CATEGORY_LABELS[group.category])}
            </p>
            <div class="cheat-sheet-list">
              {#each group.actions as action}
                <div class="cheat-sheet-row">
                  <span class="cheat-sheet-label">{t(action.label)}</span>
                  <span class="cheat-sheet-key"
                    >{keybindStore.label(action.id)}</span
                  >
                </div>
              {/each}
            </div>
          </div>
        {/each}

        <div class="cheat-sheet-group">
          <p class="settings-group-label">
            {t("settings.keybinds.cheatSheet.reserved")}
          </p>
          <div class="cheat-sheet-list">
            <div class="cheat-sheet-row">
              <span class="cheat-sheet-label"
                >{t("settings.keybinds.cheatSheet.cancel")}</span
              >
              <span class="cheat-sheet-key">Esc</span>
            </div>
            <div class="cheat-sheet-row">
              <span class="cheat-sheet-label"
                >{t("settings.keybinds.cheatSheet.clear")}</span
              >
              <span class="cheat-sheet-key">Backspace / Delete</span>
            </div>
            <div class="cheat-sheet-row">
              <span class="cheat-sheet-label"
                >{t("settings.keybinds.cheatSheet.system")}</span
              >
              <span class="cheat-sheet-key"
                >Alt+F4 · Alt+Tab · Ctrl+Alt+Del · F5 · Ctrl+R · Ctrl+Shift+I/J
                · F12</span
              >
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
{/if}
