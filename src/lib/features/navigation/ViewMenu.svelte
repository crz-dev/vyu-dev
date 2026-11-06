<script lang="ts">
  let {
    visible,
    onClose,
    x,
    y,
    viewMode,
    onViewChange,
    density,
    onDensityChange,
  }: {
    visible: boolean;
    onClose: () => void;
    x: number;
    y: number;
    viewMode: "grid" | "list" | "river" | "filmstrip";
    onViewChange: (mode: "grid" | "list" | "river" | "filmstrip") => void;
    density: number;
    onDensityChange: (v: number) => void;
  } = $props();

  const VIEW_OPTIONS: {
    value: "grid" | "list" | "river" | "filmstrip";
    label: string;
    icon: string;
  }[] = [
    {
      value: "grid",
      label: "Grid",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    },
    {
      value: "river",
      label: "River",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
    },
    {
      value: "list",
      label: "List",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    },
    {
      value: "filmstrip",
      label: "Filmstrip",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="8" x2="22" y2="8"/><line x1="2" y1="16" x2="22" y2="16"/><line x1="7" y1="4" x2="7" y2="8"/><line x1="12" y1="4" x2="12" y2="8"/><line x1="17" y1="4" x2="17" y2="8"/><line x1="7" y1="16" x2="7" y2="20"/><line x1="12" y1="16" x2="12" y2="20"/><line x1="17" y1="16" x2="17" y2="20"/></svg>`,
    },
  ];

  let trackEl: HTMLDivElement | null = $state(null);
  let dragging = false;

  function densityFromPointer(clientX: number) {
    if (!trackEl) return density;
    const rect = trackEl.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }

  function handleTrackPointerDown(e: PointerEvent) {
    e.stopPropagation();
    dragging = true;
    trackEl?.setPointerCapture(e.pointerId);
    onDensityChange(densityFromPointer(e.clientX));
  }

  function handleTrackPointerMove(e: PointerEvent) {
    if (!dragging) return;
    e.stopPropagation();
    onDensityChange(densityFromPointer(e.clientX));
  }

  function handleTrackPointerUp(e: PointerEvent) {
    if (!dragging) return;
    dragging = false;
    trackEl?.releasePointerCapture(e.pointerId);
  }

  function handleWindowMouseDown(e: MouseEvent) {
    if (
      visible &&
      !(e.target as HTMLElement).closest(".sort-menu") &&
      !(e.target as HTMLElement).closest(".lib-view-toggle")
    ) {
      onClose();
    }
  }
</script>

<svelte:window onmousedown={handleWindowMouseDown} />

{#if visible}
  <div class="sort-menu" style="left: {x - 60}px; bottom: {y + 0}px;">
    <div class="sort-menu-header">
      <span class="sort-menu-title">View mode by</span>
    </div>
    <div class="sort-menu-separator"></div>
    {#each VIEW_OPTIONS as option}
      <button
        class="sort-menu-item"
        class:active={viewMode === option.value}
        onclick={() => onViewChange(option.value)}
      >
        <span class="sort-menu-label">{option.label}</span>
        {@html option.icon}
      </button>
    {/each}
    <div class="sort-menu-separator"></div>
    <div class="view-density-wrap">
      <div class="view-density-row">
        <div
          class="view-density-track"
          bind:this={trackEl}
          onpointerdown={handleTrackPointerDown}
          onpointermove={handleTrackPointerMove}
          onpointerup={handleTrackPointerUp}
          role="slider"
          tabindex="0"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(density * 100)}
          aria-label="Thumbnail size"
        >
          <div class="view-density-fill" style="width: {density * 100}%"></div>
          {#each [0, 0.5, 1] as pct}
            <div
              class="view-density-marker"
              style="left: {pct * 100}%"
              onpointerdown={(e) => e.stopPropagation()}
              onclick={(e) => {
                e.stopPropagation();
                onDensityChange(pct);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onDensityChange(pct);
                }
              }}
              role="button"
              tabindex="0"
              aria-label="Set size to {pct === 0
                ? 'large'
                : pct === 0.5
                  ? 'medium'
                  : 'small'}"
            ></div>
          {/each}
          <div
            class="view-density-scrubber"
            style="left: {density * 100}%"
          ></div>
        </div>
        <div class="view-density-icon">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .sort-menu-item {
    justify-content: flex-end;
    text-align: right;
  }

  .sort-menu-header {
    justify-content: flex-end;
  }

  .view-density-wrap {
    padding: 6px 10px;
  }

  .view-density-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .view-density-track {
    position: relative;
    flex: 1;
    height: 16px;
    display: flex;
    align-items: center;
    cursor: pointer;
    touch-action: none;
  }

  .view-density-track::before {
    content: "";
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 4px;
    border-radius: 2px;
    background: var(--bg-border);
    pointer-events: none;
    z-index: 0;
  }

  .view-density-fill {
    position: absolute;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    height: 4px;
    border-radius: 2px;
    background: var(--text-primary);
    pointer-events: none;
    z-index: 1;
  }

  .view-density-marker {
    position: absolute;
    top: 50%;
    width: 9px;
    height: 9px;
    background: var(--text-primary);
    opacity: 0.5;
    transform: translate(-50%, -50%) rotate(45deg) scale(0.85);
    pointer-events: auto;
    cursor: pointer;
    z-index: 3;
    transition:
      opacity 0.2s ease,
      transform 0.15s ease;
  }

  .view-density-track:hover .view-density-marker {
    opacity: 0.7;
  }

  .view-density-marker:hover {
    opacity: 1;
    transform: translate(-50%, -50%) rotate(45deg) scale(1.4);
  }

  .view-density-scrubber {
    position: absolute;
    top: 50%;
    width: 12px;
    height: 12px;
    background: var(--text-primary);
    transform: translate(-50%, -50%) rotate(45deg) scale(0.95);
    pointer-events: auto;
    cursor: pointer;
    z-index: 5;
    transition:
      opacity 0.2s,
      transform 0.15s ease;
    box-shadow: 0 0 8px rgba(255, 255, 255, 0.4);
  }

  .view-density-track:hover .view-density-scrubber {
    transform: translate(-50%, -50%) rotate(45deg) scale(1);
  }

  .view-density-scrubber:hover {
    transform: translate(-50%, -50%) rotate(45deg) scale(1.28);
  }

  .view-density-icon {
    color: var(--text-muted);
    display: flex;
    align-items: center;
    flex-shrink: 0;
  }
</style>
