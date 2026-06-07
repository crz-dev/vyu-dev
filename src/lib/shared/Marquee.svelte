<script lang="ts">
  let {
    text = "",
    class: className = "",
    scrollOnHover = false,
    onOverflow,
    measureWidth,
  }: {
    text: string;
    class?: string;
    scrollOnHover?: boolean;
    onOverflow?: (overflowing: boolean) => void;
    measureWidth?: number;
  } = $props();

  const SCROLL_SPEED = 40; // px per second

  let containerEl = $state<HTMLElement | null>(null);
  let trackEl = $state<HTMLElement | null>(null);
  let isOverflowing = $state(false);
  let isHovering = $state(false);
  let shouldScroll = $derived(
    !scrollOnHover ? isOverflowing : isOverflowing && isHovering,
  );
  let marqueeDur = $state(8);

  function measure() {
    if (trackEl) {
      const available = measureWidth ?? containerEl?.clientWidth ?? 0;
      const overflowing = available > 0 && trackEl.scrollWidth > available;
      if (overflowing !== isOverflowing) {
        isOverflowing = overflowing;
        onOverflow?.(overflowing);
      }
      if (overflowing) {
        marqueeDur = trackEl.scrollWidth / SCROLL_SPEED;
      }
    }
  }

  $effect(() => {
    text;
    measureWidth;
    requestAnimationFrame(measure);
  });
</script>

<div
  class="marquee-wrapper {className}"
  bind:this={containerEl}
  onmouseenter={() => {
    if (scrollOnHover) isHovering = true;
  }}
  onmouseleave={() => {
    if (scrollOnHover) isHovering = false;
  }}
  role="presentation"
>
  <span
    class="marquee-track"
    class:scrolling={shouldScroll}
    bind:this={trackEl}
    style={shouldScroll ? `--marquee-dur: ${marqueeDur}s` : ""}
  >
    <span class="marquee-text">{text}</span>
    {#if shouldScroll}
      <span class="marquee-sep" aria-hidden="true"></span>
      <span class="marquee-text" aria-hidden="true">{text}</span>
    {/if}
  </span>
</div>
