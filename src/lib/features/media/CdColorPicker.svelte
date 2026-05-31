<script lang="ts">
  import { CD_COLORS } from "$lib/shared/constants";

  let {
    visible,
    onClose,
    activeIndex,
    onPick,
  }: {
    visible: boolean;
    onClose: () => void;
    activeIndex: number;
    onPick: (index: number) => void;
  } = $props();

  function handleWindowMouseDown(e: MouseEvent) {
    if (
      visible &&
      !(e.target as HTMLElement).closest(".cd-color-picker") &&
      !(e.target as HTMLElement).closest(".cd-visual")
    ) {
      onClose();
    }
  }
</script>

<svelte:window onmousedown={handleWindowMouseDown} />

{#if visible}
  <div class="cd-color-picker">
    {#each CD_COLORS as color, i}
      <button
        class="cd-color-swatch"
        class:active={i === activeIndex}
        style="background: {color}"
        onclick={() => onPick(i)}
        aria-label={`Color ${i + 1}`}
      ></button>
    {/each}
  </div>
{/if}
