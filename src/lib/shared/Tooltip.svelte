<script lang="ts">
  import type { ClipBoundary, VideoMarker } from "$lib/shared/types";

  let {
    tsTooltip,
    tsEditMenuVisible,
    volumeTooltipVisible,
    volumeTooltipX,
    volumeTooltipY,
    speedTooltipVisible,
    speedTooltipX,
    speedTooltipY,
    playbackSpeed,
    muted,
    volume,
    tsEditMenu,
    editingTimestamp,
    editingSegment,
    currentTitle,
    updateEditorTitle,
    closeTimestampEditor,
    onEditorScissor,
    onEditorDeleteTimestamp,
    onEditorDeleteSegment,
  }: {
    tsTooltip: {
      visible: boolean;
      x: number;
      y: number;
      title?: string;
      timeLabel: string;
      tone?: "yellow" | "blue" | "green";
    };
    tsEditMenuVisible: boolean;
    volumeTooltipVisible: boolean;
    volumeTooltipX: number;
    volumeTooltipY: number;
    speedTooltipVisible: boolean;
    speedTooltipX: number;
    speedTooltipY: number;
    playbackSpeed: number;
    muted: boolean;
    volume: number;
    tsEditMenu: {
      visible: boolean;
      x: number;
      y: number;
      targetId: string;
      targetType: string;
    };
    editingTimestamp: VideoMarker | undefined;
    editingSegment: ClipBoundary | undefined;
    currentTitle: string;
    updateEditorTitle: (v: string) => void;
    closeTimestampEditor: () => void;
    onEditorScissor: (kind: "start" | "end") => void;
    onEditorDeleteTimestamp: () => void;
    onEditorDeleteSegment: () => void;
  } = $props();
</script>

{#if tsTooltip.visible && !tsEditMenuVisible}
  <div
    class="ts-tooltip"
    class:blue={tsTooltip.tone === "blue"}
    class:green={tsTooltip.tone === "green"}
    style="left: {tsTooltip.x}px; top: {tsTooltip.y}px;"
  >
    {#if tsTooltip.title}
      <span class="ts-tooltip-title">{tsTooltip.title}</span>
    {/if}
    <span>{tsTooltip.timeLabel}</span>
  </div>
{/if}

<div
  id="filename-tooltip"
  class="filename-tooltip"
  style="position:fixed;opacity:0;left:0;top:0;pointer-events:none;z-index:9999"
></div>

{#if tsEditMenu.visible}
  {@const isSegmentMenu = !!editingSegment}
  {#if editingTimestamp || editingSegment}
    <div
      class="ts-edit-menu"
      class:blue={isSegmentMenu}
      style="left: {tsEditMenu.x}px; top: {tsEditMenu.y}px;"
    >
      <div class="ts-edit-menu-top">
        <input
          class="ts-title-input"
          type="text"
          maxlength="100"
          placeholder="Add Title..."
          value={currentTitle}
          oninput={(e) =>
            updateEditorTitle((e.currentTarget as HTMLInputElement).value)}
          onkeydown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              closeTimestampEditor();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              closeTimestampEditor();
            }
          }}
        />
        {#if !isSegmentMenu}
          <button
            class="ts-delete-btn"
            onclick={(e) => {
              e.stopPropagation();
              onEditorDeleteTimestamp();
            }}
            aria-label="Delete timestamp"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              ><path
                d="M6 6L18 18M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
          </button>
        {:else}
          <button
            class="ts-delete-btn"
            onclick={(e) => {
              e.stopPropagation();
              onEditorDeleteSegment();
            }}
            aria-label="Delete clip marker"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              ><path
                d="M6 6L18 18M18 6L6 18"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              /></svg
            >
          </button>
        {/if}
      </div>
      <div
        class="ts-scissor-split"
        class:segment-toggle={isSegmentMenu}
        role="group"
        aria-label="segment type"
      >
        <button
          class="ts-split-btn left tooltip-ctrl"
          class:is-active={isSegmentMenu
            ? editingSegment?.kind === "start"
            : false}
          class:is-inactive={isSegmentMenu
            ? editingSegment?.kind !== "start"
            : false}
          data-tooltip="Start clip"
          onclick={(e) => {
            e.stopPropagation();
            onEditorScissor("start");
          }}
          aria-label="Start clip"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
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
        </button>
        <button
          class="ts-split-btn right tooltip-ctrl"
          class:is-active={isSegmentMenu
            ? editingSegment?.kind === "end"
            : false}
          class:is-inactive={isSegmentMenu
            ? editingSegment?.kind !== "end"
            : false}
          data-tooltip="End clip"
          onclick={(e) => {
            e.stopPropagation();
            onEditorScissor("end");
          }}
          aria-label="End clip"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
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
        </button>
      </div>
    </div>
  {/if}
{/if}
