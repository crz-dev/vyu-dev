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
    slideshow.intervalSec = Math.round(Math.max(minInterval, Math.min(maxInterval, val)));
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
      <span class="slideshow-label">Interval</span>
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
      <span class="slideshow-label">Order</span>
      <div class="slideshow-toggle-row">
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.order === "next"}
          onclick={() => (slideshow.order = "next")}
        >
          Next
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.order === "shuffle"}
          onclick={() => (slideshow.order = "shuffle")}
        >
          Shuffle
        </button>
      </div>
    </div>

    <div class="slideshow-section">
      <span class="slideshow-label">Videos</span>
      <div class="slideshow-toggle-row">
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.videoMode === "skip"}
          onclick={() => (slideshow.videoMode = "skip")}
        >
          Skip
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.videoMode === "full"}
          onclick={() => (slideshow.videoMode = "full")}
        >
          Full
        </button>
      </div>
    </div>

    <div class="slideshow-section">
      <span class="slideshow-label">Transition</span>
      <div class="slideshow-toggle-row three">
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.transition === "none"}
          onclick={() => (slideshow.transition = "none")}
        >
          None
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.transition === "fade"}
          onclick={() => (slideshow.transition = "fade")}
        >
          Fade
        </button>
        <button
          class="slideshow-toggle-btn"
          class:active={slideshow.transition === "slide"}
          onclick={() => (slideshow.transition = "slide")}
        >
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
            {slideshow.paused ? "Play" : "Pause"}
          </button>
        {/key}
        <button
          class="slideshow-action-btn stop"
          onclick={() => slideshow.stop()}
          in:fly={{ y: 5, duration: 150 }}
        >
          Stop
        </button>
      {/if}
    </div>
  </div>
{/if}
