<script lang="ts">
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
    getTitleEditorWidthCh,
    updateEditorTitle,
    closeTimestampEditor,
    onEditorScissor,
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
    editingTimestamp: any;
    editingSegment: any;
    currentTitle: string;
    getTitleEditorWidthCh: (title: string) => number;
    updateEditorTitle: (v: string) => void;
    closeTimestampEditor: () => void;
    onEditorScissor: (kind: "start" | "end") => void;
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

{#if volumeTooltipVisible}
  <div
    class="vol-tooltip"
    style="left: {volumeTooltipX}px; top: {volumeTooltipY - 32}px;"
  >
    {muted ? "0" : Math.round(volume * 100)}%
  </div>
{/if}

{#if speedTooltipVisible}
  <div
    class="vol-tooltip"
    style="left: {speedTooltipX}px; top: {speedTooltipY - 32}px;"
  >
    {playbackSpeed}×
  </div>
{/if}

<div
  id="filename-tooltip"
  style="position:fixed;opacity:0;transition:opacity 0.15s ease 0.4s;background:#1a1a1a;color:#aaaaaa;font-size:11px;font-family:Inter,sans-serif;white-space:nowrap;padding:4px 8px;border-radius:4px;border:0.5px solid #2a2a2a;pointer-events:none;z-index:9999;"
></div>

{#if tsEditMenu.visible}
  {@const isSegmentMenu = !!editingSegment}
  {#if editingTimestamp || editingSegment}
    <div
      class="ts-edit-menu"
      class:blue={isSegmentMenu}
      style="left: {tsEditMenu.x}px; top: {tsEditMenu.y}px;"
    >
      <input
        class="ts-title-input"
        type="text"
        maxlength="100"
        placeholder="Title"
        value={currentTitle}
        style="width: {getTitleEditorWidthCh(currentTitle)}ch;"
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
          data-tooltip="Start Clip Here"
          onclick={(e) => {
            e.stopPropagation();
            onEditorScissor("start");
          }}
          aria-label="Start Clip Here"
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
          data-tooltip="End Clip Here"
          onclick={(e) => {
            e.stopPropagation();
            onEditorScissor("end");
          }}
          aria-label="End Clip Here"
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
