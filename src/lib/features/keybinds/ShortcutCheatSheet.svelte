<script lang="ts">
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import {
    KEYBIND_ACTIONS,
    KEYBIND_CATEGORY_LABELS,
    KEYBIND_CATEGORY_ORDER,
  } from "$lib/features/keybinds/keybindDefinitions";

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
          <p id="cheat-sheet-title" class="cheat-sheet-title">Shortcuts</p>
          <p class="settings-hint">
            Press
            <span class="help-kbd-inline"
              >{keybindStore.label("show-shortcuts") || "the shortcut"}</span
            >
            again or Escape to close.
          </p>
        </div>
        <button
          class="settings-action-btn"
          onclick={() => keybindStore.closeCheatSheet()}
          aria-label="Close shortcuts">Close</button
        >
      </div>

      <div class="cheat-sheet-body">
        {#each groups as group}
          <div class="cheat-sheet-group">
            <p class="settings-group-label">
              {KEYBIND_CATEGORY_LABELS[group.category]}
            </p>
            <div class="cheat-sheet-list">
              {#each group.actions as action}
                <div class="cheat-sheet-row">
                  <span class="cheat-sheet-label">{action.label}</span>
                  <span class="cheat-sheet-key"
                    >{keybindStore.label(action.id)}</span
                  >
                </div>
              {/each}
            </div>
          </div>
        {/each}

        <div class="cheat-sheet-group">
          <p class="settings-group-label">Reserved</p>
          <div class="cheat-sheet-list">
            <div class="cheat-sheet-row">
              <span class="cheat-sheet-label">Cancel / close dialogs</span>
              <span class="cheat-sheet-key">Esc</span>
            </div>
            <div class="cheat-sheet-row">
              <span class="cheat-sheet-label"
                >Clear binding while recording</span
              >
              <span class="cheat-sheet-key">Backspace / Delete</span>
            </div>
            <div class="cheat-sheet-row">
              <span class="cheat-sheet-label">System reserved</span>
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
