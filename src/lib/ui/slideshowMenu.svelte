<script lang="ts">
  import { fly } from "svelte/transition";
  import { slideshow } from "$lib/core/slideshow.svelte";

  let {
    visible,
    onClose,
  }: {
    visible: boolean;
    onClose: () => void;
  } = $props();

  let sliderHovered = $state(false);
  let trackEl: HTMLDivElement | null = $state(null);
  let isDragging = $state(false);

  const minInterval = 1;
  const maxInterval = 10;

  function valueToPct(val: number) {
    if (val <= 5) {
      return ((val - 1) / (5 - 1)) * 50;
    }
    return 50 + ((val - 5) / (10 - 5)) * 50;
  }

  function pctToValue(pct: number) {
    if (pct <= 50) {
      return 1 + (pct / 50) * (5 - 1);
    }
    return 5 + ((pct - 50) / 50) * (10 - 5);
  }

  function updateIntervalFromX(clientX: number) {
    if (!trackEl) return;
    const rect = trackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const val = pctToValue(pct);
    slideshow.intervalSec = Math.round(
      Math.max(minInterval, Math.min(maxInterval, val)),
    );
  }

  function handleTrackPointerDown(e: PointerEvent) {
    if (!trackEl) return;
    isDragging = true;
    trackEl.setPointerCapture(e.pointerId);
    updateIntervalFromX(e.clientX);
  }

  function handleTrackPointerMove(e: PointerEvent) {
    if (!isDragging || !trackEl) return;
    e.preventDefault();
    updateIntervalFromX(e.clientX);
  }

  function handleTrackPointerUp(e: PointerEvent) {
    if (!isDragging || !trackEl) return;
    isDragging = false;
    trackEl.releasePointerCapture(e.pointerId);
  }

  function handleWindowMouseDown(e: MouseEvent) {
    if (visible && !(e.target as HTMLElement).closest(".slideshow-menu")) {
      onClose();
    }
  }

  const scrubberPct = $derived(valueToPct(slideshow.intervalSec));
  const displayInterval = $derived(`${slideshow.intervalSec}s`);
</script>

<svelte:window onmousedown={handleWindowMouseDown} />

{#if visible}
  <div
    class="slideshow-menu"
    transition:fly={{ y: 10, duration: 150, opacity: 0.08 }}
  >
    <div
      class="ctx-drag"
      role="button"
      tabindex="0"
      aria-label="Drag to move"
      onmousedown={(e) => {
        e.preventDefault();
        const menu = (e.currentTarget as HTMLElement).closest(
          ".slideshow-menu",
        ) as HTMLElement;
        if (!menu) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = menu.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        function onMouseMove(ev: MouseEvent) {
          menu.style.left = `${startLeft + ev.clientX - startX}px`;
          menu.style.top = `${startTop + ev.clientY - startY}px`;
          menu.style.bottom = "auto";
          menu.style.height = "fit-content";
          menu.style.transform = "none";
        }

        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }}
    >
      <span class="ctx-dot"></span><span class="ctx-dot"></span><span
        class="ctx-dot"
      ></span>
      <button
        class="ctx-close"
        onclick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label="Close"
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
        >
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>

    <div class="slideshow-section interval-section">
      <span class="slideshow-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        Interval
      </span>
      <div
        class="color-slider-track"
        bind:this={trackEl}
        role="slider"
        tabindex="0"
        aria-valuemin={minInterval}
        aria-valuemax={maxInterval}
        aria-valuenow={slideshow.intervalSec}
        aria-label="Slideshow interval"
        onpointerdown={handleTrackPointerDown}
        onpointermove={handleTrackPointerMove}
        onpointerup={handleTrackPointerUp}
        onpointercancel={handleTrackPointerUp}
        onmouseenter={() => (sliderHovered = true)}
        onmouseleave={() => (sliderHovered = false)}
      >
        <div class="color-slider-fill" style="width: {scrubberPct}%"></div>
        {#each [1, 5, 10] as markerVal}
          {@const markerPct = valueToPct(markerVal)}
          <div
            class="color-slider-marker"
            class:center-marker={markerVal === 5}
            style="left: {markerPct}%"
            onpointerdown={(e) => e.stopPropagation()}
            onclick={() => (slideshow.intervalSec = markerVal)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                slideshow.intervalSec = markerVal;
              }
            }}
            role="button"
            tabindex="0"
            aria-label="Set interval to {markerVal} seconds"
          ></div>
        {/each}
        <div
          class="color-slider-scrubber"
          style="left: {scrubberPct}%"
          role="button"
          tabindex="0"
          aria-label="Scrubber"
          onpointerdown={(e) => {
            e.stopPropagation();
            if (!trackEl) return;
            isDragging = true;
            trackEl.setPointerCapture(e.pointerId);
          }}
        ></div>
        {#if sliderHovered || isDragging}
          <div class="slideshow-scrubber-tooltip" style="left: {scrubberPct}%">
            <span>{displayInterval}</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="slideshow-section">
      <span class="slideshow-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h16M4 16h16"/></svg>
        Order
      </span>
      <div class="slideshow-toggle-row">
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.order === "next"}
          onclick={() => (slideshow.order = "next")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>
          Next
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.order === "shuffle"}
          onclick={() => (slideshow.order = "shuffle")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
          Shuffle
        </button>
      </div>
    </div>

    <div class="slideshow-section">
      <span class="slideshow-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
        Videos
      </span>
      <div class="slideshow-toggle-row">
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.videoMode === "skip"}
          onclick={() => (slideshow.videoMode = "skip")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="17" y1="5" x2="17" y2="19"/><line x1="21" y1="5" x2="21" y2="19"/></svg>
          Skip
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.videoMode === "full"}
          onclick={() => (slideshow.videoMode = "full")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>
          Full
        </button>
      </div>
    </div>

    <div class="slideshow-section">
      <span class="slideshow-label">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
        Transition
      </span>
      <div class="slideshow-toggle-row three">
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.transition === "none"}
          onclick={() => (slideshow.transition = "none")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          None
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.transition === "fade"}
          onclick={() => (slideshow.transition = "fade")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16a4 4 0 100-8 4 4 0 000 8z"/></svg>
          Fade
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.transition === "slide"}
          onclick={() => (slideshow.transition = "slide")}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
          Slide
        </button>
      </div>
    </div>

    <div class="slideshow-actions" class:two={slideshow.active}>
      {#if !slideshow.active}
        <button
          class="slideshow-action-btn start"
          onclick={() => slideshow.start()}
          in:fly={{ y: 5, duration: 150 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          Start
        </button>
      {:else}
        {#key slideshow.paused}
          <button
            class="slideshow-action-btn"
            class:pause={!slideshow.paused}
            class:play={slideshow.paused}
            onclick={() =>
              slideshow.paused ? slideshow.resume() : slideshow.pause()}
            in:fly={{ y: 5, duration: 150 }}
          >
            {#if slideshow.paused}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Play
            {:else}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              Pause
            {/if}
          </button>
        {/key}
        <button
          class="slideshow-action-btn stop"
          onclick={() => slideshow.stop()}
          in:fly={{ y: 5, duration: 150 }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
          Stop
        </button>
      {/if}
    </div>
  </div>
{/if}
