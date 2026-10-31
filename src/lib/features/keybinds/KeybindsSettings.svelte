<script lang="ts">
  import { onDestroy } from "svelte";
  import { slide } from "svelte/transition";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { showToast } from "$lib/components/toast.svelte";
  import {
    KEYBIND_ACTIONS,
    KEYBIND_CATEGORY_LABELS,
    KEYBIND_CATEGORY_ORDER,
    KEYBIND_CONTEXT_LABELS,
  } from "$lib/features/keybinds/keybindDefinitions";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import {
    formatBinding,
    formatKey,
  } from "$lib/features/keybinds/keybindUtils";
  import KeyboardOverview from "$lib/features/keybinds/KeyboardOverview.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  type ContextFilter = "all" | "viewer" | "library" | "pdf";

  let search = $state("");
  let contextFilter = $state<ContextFilter>("all");
  let unboundOnly = $state(false);
  let selectedKey = $state<string | null>(null);
  let showOverview = $state(true);
  let resetAllConfirming = $state(false);
  let resetAllTimeout: ReturnType<typeof setTimeout> | null = null;

  const contextActions = $derived.by(() =>
    KEYBIND_ACTIONS.filter(
      (action) =>
        contextFilter === "all" ||
        action.context === "global" ||
        action.context === contextFilter,
    ),
  );

  const filteredActions = $derived.by(() => {
    const query = search.trim().toLowerCase().replace(/\s+/g, "");
    return contextActions.filter((action) => {
      if (unboundOnly && !keybindStore.isUnbound(action.id)) return false;
      if (selectedKey) {
        const binding = keybindStore.bindingFor(action.id);
        if (!binding || binding.key !== selectedKey) return false;
      }
      if (query) {
        const haystack = [
          action.label,
          action.description,
          keybindStore.label(action.id),
          KEYBIND_CONTEXT_LABELS[action.context],
        ]
          .join(" ")
          .toLowerCase()
          .replace(/\s+/g, "");
        if (!haystack.includes(query)) return false;
      }
      return true;
    });
  });

  const groupedActions = $derived.by(() =>
    KEYBIND_CATEGORY_ORDER.map((category) => ({
      category,
      actions: filteredActions.filter((action) => action.category === category),
    })).filter((group) => group.actions.length > 0),
  );

  onDestroy(() => {
    if (resetAllTimeout) clearTimeout(resetAllTimeout);
  });

  function startRecording(id: string, button: HTMLButtonElement) {
    keybindStore.beginRecording(id);
    button.focus();
  }

  function handleRecordKey(e: KeyboardEvent, id: string) {
    if (keybindStore.recordingActionId !== id) return;
    if (e.key === "Tab") {
      keybindStore.cancelRecording();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    keybindStore.recordEvent(e);
  }

  function handleRecordBlur(id: string) {
    if (keybindStore.recordingActionId === id) keybindStore.cancelRecording();
  }

  function handleReset(id: string) {
    const error = keybindStore.resetAction(id);
    if (error) showToast({ message: error, color: "red" });
  }

  function handleResetAll() {
    if (!resetAllConfirming) {
      resetAllConfirming = true;
      if (resetAllTimeout) clearTimeout(resetAllTimeout);
      resetAllTimeout = setTimeout(() => {
        resetAllConfirming = false;
        resetAllTimeout = null;
      }, 5000);
      return;
    }
    if (resetAllTimeout) {
      clearTimeout(resetAllTimeout);
      resetAllTimeout = null;
    }
    resetAllConfirming = false;
    keybindStore.resetAll();
    showToast({ message: "Shortcuts restored to defaults", color: "green" });
  }

  function toggleSelectedKey(key: string) {
    selectedKey = selectedKey === key ? null : key;
  }

  const contextFilters: { id: ContextFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "viewer", label: "Viewer" },
    { id: "library", label: "Library" },
    { id: "pdf", label: "PDF" },
  ];
</script>

<div id="settings-section-keybinds" class="settings-section" class:flash>
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
      ><rect x="2" y="4" width="20" height="16" rx="2" ry="2" /><path
        d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"
      /></svg
    >
    Keybinds
  </p>

  <div class="settings-row keybind-filter-row">
    <div class="settings-control keybind-search-control">
      <input
        class="keybind-search-input"
        type="search"
        placeholder="Search actions or shortcuts"
        bind:value={search}
        aria-label="Search keybindings"
      />
      <div class="pill-group pill-group-4">
        {#each contextFilters as filter}
          <button
            class="pill-btn"
            class:active={contextFilter === filter.id}
            onclick={() => (contextFilter = filter.id)}>{filter.label}</button
          >
        {/each}
      </div>
    </div>
    <div class="settings-control">
      <label class="toggle-row keybind-unbound-toggle">
        <input type="checkbox" bind:checked={unboundOnly} />
        <span class="toggle-track" class:on={unboundOnly}
          ><span class="toggle-thumb"></span></span
        >
        <span class="settings-hint">Unbound</span>
      </label>
    </div>
  </div>

  <div class="settings-row keybind-overview-toggle">
    <div class="settings-label-col">
      <div class="settings-label-text">
        <span class="settings-label">Keyboard overview</span>
        <span class="settings-hint">Click a used key to filter the list</span>
      </div>
    </div>
    <div class="settings-control">
      <button
        class="settings-action-btn"
        onclick={() => (showOverview = !showOverview)}
        >{showOverview ? "Hide" : "Show"}</button
      >
    </div>
  </div>

  {#if showOverview}
    <div transition:slide={{ duration: appearance.reducedMotion ? 0 : 160 }}>
      <KeyboardOverview
        actions={contextActions}
        {selectedKey}
        onSelectKey={toggleSelectedKey}
      />
    </div>
  {/if}

  <div class="settings-row keybind-help-row">
    <span class="settings-hint"
      >Click a shortcut and press a key combo. Escape cancels; Backspace or
      Delete clears.</span
    >
  </div>

  {#if selectedKey}
    <div class="settings-row keybind-filter-chip-row">
      <span class="settings-hint"
        >Showing shortcuts using
        <strong>{formatKey(selectedKey)}</strong></span
      >
      <button class="settings-action-btn" onclick={() => (selectedKey = null)}
        >Clear</button
      >
    </div>
  {/if}

  {#if groupedActions.length === 0}
    <div class="settings-row keybind-empty-row">
      <span class="settings-hint">No shortcuts match these filters.</span>
    </div>
  {:else}
    {#each groupedActions as group}
      <p class="settings-group-label">
        {KEYBIND_CATEGORY_LABELS[group.category]}
      </p>
      <div class="settings-card has-child">
        {#each group.actions as action}
          {@const recording = keybindStore.recordingActionId === action.id}
          {@const label = keybindStore.label(action.id)}
          {@const custom = keybindStore.isCustom(action.id)}
          <div class="settings-row keybind-row">
            <div class="settings-label-col">
              <div class="settings-label-text">
                <span class="settings-label">{action.label}</span>
                <span class="settings-hint">
                  {action.description} · {KEYBIND_CONTEXT_LABELS[
                    action.context
                  ]}
                </span>
                {#if recording && keybindStore.recordingError}
                  <span class="keybind-conflict"
                    >{keybindStore.recordingError}</span
                  >
                {/if}
              </div>
            </div>
            <div class="settings-control keybind-control">
              <button
                class="help-kbd-btn keybind-key-btn"
                class:keybind-recording={recording}
                aria-pressed={recording}
                aria-label={`Change ${action.label} shortcut`}
                title={custom
                  ? `Default: ${formatBinding(action.defaultBinding)}`
                  : "Click to change"}
                onclick={(e) => startRecording(action.id, e.currentTarget)}
                onkeydown={(e) => handleRecordKey(e, action.id)}
                onblur={() => handleRecordBlur(action.id)}
              >
                {recording ? "Press keys…" : label || "Unbound"}
              </button>
              {#if custom}
                <button
                  class="settings-action-btn keybind-reset-btn"
                  title={`Reset ${action.label}`}
                  aria-label={`Reset ${action.label}`}
                  onclick={() => handleReset(action.id)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    ><polyline points="1 4 1 10 7 10" /><path
                      d="M3.51 15a9 9 0 102.13-9.36L1 10"
                    /></svg
                  >
                </button>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {/each}
  {/if}

  <div class="settings-row keybind-reset-row">
    <div class="settings-label-col">
      <div class="settings-label-text">
        <span class="settings-hint">Restore all shortcuts to defaults</span>
      </div>
    </div>
    <div class="settings-control">
      <button class="settings-action-btn yellow" onclick={handleResetAll}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polyline points="1 4 1 10 7 10" /><path
            d="M3.51 15a9 9 0 102.13-9.36L1 10"
          /></svg
        >
        {resetAllConfirming ? "Confirm?" : "Reset all"}
      </button>
    </div>
  </div>
</div>
