<script lang="ts">
  import { TS_DROP_ANIM_DELAYS_MS } from "$lib/features/menus/dropAnimations";

  let {
    open,
    onClose,
    hasAnyMarkers,
    addTimestamp,
    addLoopStart,
    addLoopEnd,
    addClipStart,
    addClipEnd,
    deleteAllMarkers,
    thin = false,
  }: {
    open: boolean;
    onClose: () => void;
    hasAnyMarkers: boolean;
    addTimestamp: () => void;
    addLoopStart: () => void;
    addLoopEnd: () => void;
    addClipStart: () => void;
    addClipEnd: () => void;
    deleteAllMarkers: () => void;
    thin?: boolean;
  } = $props();

  // Two-step delete confirmation is internal to the menu — parent only
  // sees the final deleteAllMarkers callback fire.
  let deleteConfirm = $state(false);

  $effect(() => {
    if (open) deleteConfirm = false;
  });

  function animStyle(index: number): string {
    return `animation: tsDropItemPopIn 200ms cubic-bezier(0.22, 0.8, 0.3, 1) backwards; animation-delay: ${TS_DROP_ANIM_DELAYS_MS[index]}ms`;
  }

  function requestDelete() {
    deleteConfirm = true;
  }

  function confirmDelete() {
    deleteAllMarkers();
    deleteConfirm = false;
  }

  function handleAddTimestamp() {
    addTimestamp();
    deleteConfirm = false;
  }
</script>

{#if open}
  <div class="ts-drop-menu" class:thin={thin} role="menu">
    <div class="ts-drop-header" style={animStyle(0)}>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <polygon
          points="12,2 22,12 12,22 2,12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span>Markers</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
        <polygon
          points="12,2 22,12 12,22 2,12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </div>
    <div class="edit-menu-card">
      {#if hasAnyMarkers}
        {#if !deleteConfirm}
          <button
            class="ts-drop-item ts-drop-red"
            style={animStyle(1)}
            onclick={requestDelete}
            role="menuitem"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <polyline
                points="3 6 5 6 21 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M19 6l-1 14H6L5 6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M10 11v6M14 11v6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
              <path
                d="M9 6V4h6v2"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            Delete Markers
          </button>
        {:else}
          <button
            class="ts-drop-item ts-drop-red-confirm"
            style={animStyle(1)}
            onclick={confirmDelete}
            role="menuitem"
          >
            Confirm Delete
          </button>
        {/if}
      {/if}
      <div class="ts-drop-split">
        <button
          class="ts-drop-half ts-drop-green"
          style={animStyle(2)}
          onclick={addLoopStart}
          role="menuitem"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            />
            <text
              x="12"
              y="12"
              text-anchor="middle"
              dominant-baseline="central"
              font-size="11"
              font-weight="700"
              fill="currentColor"
              font-family="var(--font-family)">A</text
            >
          </svg>
          Loop start
        </button>
        <button
          class="ts-drop-half ts-drop-green"
          style={animStyle(2)}
          onclick={addLoopEnd}
          role="menuitem"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
            <circle
              cx="12"
              cy="12"
              r="9"
              stroke="currentColor"
              stroke-width="2"
            />
            <text
              x="12"
              y="12"
              text-anchor="middle"
              dominant-baseline="central"
              font-size="11"
              font-weight="700"
              fill="currentColor"
              font-family="var(--font-family)">B</text
            >
          </svg>
          Loop end
        </button>
      </div>
      <div class="ts-drop-split">
        <button
          class="ts-drop-half ts-drop-blue"
          style={animStyle(3)}
          onclick={addClipStart}
          role="menuitem"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="7"
              cy="8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><circle
              cx="7"
              cy="15.8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><path
              d="M9.5 9.6L19 5.2M9.5 14.2L19 19"
              stroke="currentColor"
              stroke-width="1.8"
            /></svg
          >
          Clip start
        </button>
        <button
          class="ts-drop-half ts-drop-blue"
          style={animStyle(3)}
          onclick={addClipEnd}
          role="menuitem"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            ><circle
              cx="17"
              cy="8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><circle
              cx="17"
              cy="15.8"
              r="2.2"
              stroke="currentColor"
              stroke-width="1.8"
            /><path
              d="M14.5 9.6L5 5.2M14.5 14.2L5 19"
              stroke="currentColor"
              stroke-width="1.8"
            /></svg
          >
          Clip end
        </button>
      </div>
      <button
        class="ts-drop-item ts-drop-yellow"
        style={animStyle(4)}
        onclick={handleAddTimestamp}
        role="menuitem"
      >
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
        </svg>
        Add Timestamp
      </button>
    </div>
  </div>
{/if}
