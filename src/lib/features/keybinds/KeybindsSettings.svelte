<script lang="ts">
  import { onDestroy } from "svelte";
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
  import SettingsGroupIcon from "$lib/components/SettingsGroupIcon.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  type ContextFilter = "all" | "viewer" | "library" | "pdf";

  let search = $state("");
  let contextFilter = $state<ContextFilter>("all");
  let unboundOnly = $state(false);
  let selectedKey = $state<string | null>(null);
  let expandedCategories = $state<Record<string, boolean>>({});
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

  const filtersActive = $derived(
    search.trim() !== "" ||
      contextFilter !== "all" ||
      unboundOnly ||
      !!selectedKey,
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

  function toggleCategory(category: string) {
    expandedCategories = {
      ...expandedCategories,
      [category]: !expandedCategories[category],
    };
  }

  function toggleSelectedKey(key: string) {
    selectedKey = selectedKey === key ? null : key;
  }

  function isCategoryOpen(category: string): boolean {
    return filtersActive || !!expandedCategories[category];
  }

  const contextFilters: { id: ContextFilter; label: string }[] = [
    { id: "all", label: "All" },
    { id: "viewer", label: "Viewer" },
    { id: "library", label: "Library" },
    { id: "pdf", label: "PDF" },
  ];

  const categoryIcons: Record<string, string> = {
    app: "window",
    viewer: "eye",
    file: "file",
    editing: "pencil",
    library: "book",
    pdf: "file",
    slideshow: "slideshow",
  };
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

  <p class="settings-group-label">
    <span class="settings-group-icon">
      <SettingsGroupIcon name="keyboard" />
    </span>
    Keyboard Overview
  </p>
  <KeyboardOverview
    actions={contextActions}
    {selectedKey}
    onSelectKey={toggleSelectedKey}
  />

  <div class="settings-card has-child">
    <div class="settings-row keybind-filter-row">
      <div class="settings-control keybind-search-control">
        <div class="keybind-search-wrap">
          <svg
            class="keybind-search-icon"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="11" cy="11" r="8" /><line
              x1="21"
              y1="21"
              x2="16.65"
              y2="16.65"
            /></svg
          >
          <input
            class="keybind-search-input"
            type="search"
            placeholder="Search actions"
            bind:value={search}
            aria-label="Search keybindings"
          />
        </div>
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
  </div>

  <div class="settings-row keybind-help-row">
    <span class="settings-hint"
      >Click a shortcut, then press a key combo. Esc cancels.</span
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
      <button
        class="settings-group-label keybind-category-toggle"
        aria-expanded={isCategoryOpen(group.category)}
        onclick={() => toggleCategory(group.category)}
      >
        <span class="settings-group-icon">
          <SettingsGroupIcon
            name={categoryIcons[group.category] ?? "keyboard"}
          />
        </span>
        {KEYBIND_CATEGORY_LABELS[group.category]}
        <span class="keybind-category-count">{group.actions.length}</span>
        <svg
          class="settings-group-chevron"
          class:open={isCategoryOpen(group.category)}
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-linejoin="round"><polyline points="9 18 15 12 9 6" /></svg
        >
      </button>
      {#if isCategoryOpen(group.category)}
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
      {/if}
    {/each}
  {/if}

  <div class="settings-card has-child keybind-reset-card">
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
          {resetAllConfirming ? "Confirm?" : "Reset"}
        </button>
      </div>
    </div>
  </div>
</div>
