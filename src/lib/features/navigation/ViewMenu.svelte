<script lang="ts">
  let {
    visible,
    onClose,
    x,
    y,
    viewMode,
    onViewChange,
  }: {
    visible: boolean;
    onClose: () => void;
    x: number;
    y: number;
    viewMode: "grid" | "list" | "river";
    onViewChange: (mode: "grid" | "list" | "river") => void;
  } = $props();

  const VIEW_OPTIONS: {
    value: "grid" | "list" | "river";
    label: string;
    icon: string;
  }[] = [
    {
      value: "grid",
      label: "Grid",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    },
    {
      value: "list",
      label: "List",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
    },
    {
      value: "river",
      label: "River",
      icon: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/></svg>`,
    },
  ];

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
  <div class="sort-menu" style="left: {x - 60}px; bottom: {y + 2}px;">
    <div class="sort-menu-header">
      <span class="sort-menu-title">View mode</span>
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
</style>
