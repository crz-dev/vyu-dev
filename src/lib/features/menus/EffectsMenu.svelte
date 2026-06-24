<script lang="ts">
  import { fly } from "svelte/transition";
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";
  import { effectsStore } from "$lib/features/effects/effects-store.svelte";

  let {
    visible,
    onClose,
    onMoved,
    styleOverride = "",
    filePath = "",
  }: {
    visible: boolean;
    onClose: () => void;
    onMoved?: () => void;
    styleOverride?: string;
    filePath?: string;
  } = $props();

  let pinned = $state(false);
  let tuneRowOpen = $state(false);
  let filterRowOpen = $state(false);
  let stageRowOpen = $state(false);
  let visualRowOpen = $state(false);
  let activeTuneItem: "pitch" | "reverb" | "chorus" | "distortion" | null =
    $state(null);
  let tuneValues = $state({ pitch: 0, reverb: 0, chorus: 0, distortion: 0 });
  let activeFilter: "nightcore" | "lofi" | "eightBit" | "radio" | null =
    $state(null);
  let activeStage: "mono" | "stereo" | "surround" | "eightD" | null =
    $state(null);
  let openTimeout: ReturnType<typeof setTimeout> | null = $state(null);

  // Tune slider (markup-style)
  let tuneTrackEl: HTMLDivElement | null = $state(null);
  let isTuneDragging = $state(false);

  function getTuneRange() {
    if (activeTuneItem === "pitch") return { min: -12, max: 12 };
    return { min: 0, max: 100 };
  }

  function getTuneMarkers() {
    if (activeTuneItem === "pitch") {
      return [
        { val: -12, pct: 0 },
        { val: 0, pct: 50 },
        { val: 12, pct: 100 },
      ];
    }
    return [
      { val: 0, pct: 0 },
      { val: 50, pct: 50 },
      { val: 100, pct: 100 },
    ];
  }

  function applyTuneToStore(
    item: "pitch" | "reverb" | "chorus" | "distortion",
    val: number,
  ) {
    if (item === "pitch") effectsStore.setPitch(val);
    else if (item === "reverb") effectsStore.setReverb(val);
    else if (item === "chorus") effectsStore.setChorus(val);
    else if (item === "distortion") effectsStore.setDistortion(val);
  }

  function updateTuneFromX(clientX: number) {
    if (!tuneTrackEl || !activeTuneItem) return;
    const rect = tuneTrackEl.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    const { min, max } = getTuneRange();
    const val = Math.round(min + pct * (max - min));
    tuneValues[activeTuneItem] = val;
    applyTuneToStore(activeTuneItem, val);
  }

  function handleTunePointerDown(e: PointerEvent) {
    if (!tuneTrackEl) return;
    isTuneDragging = true;
    tuneTrackEl.setPointerCapture(e.pointerId);
    updateTuneFromX(e.clientX);
  }

  function handleTunePointerMove(e: PointerEvent) {
    if (!isTuneDragging || !tuneTrackEl) return;
    e.preventDefault();
    updateTuneFromX(e.clientX);
  }

  function handleTunePointerUp(e: PointerEvent) {
    if (!isTuneDragging || !tuneTrackEl) return;
    isTuneDragging = false;
    tuneTrackEl.releasePointerCapture(e.pointerId);
  }

  function jumpToTune(val: number) {
    if (!activeTuneItem) return;
    tuneValues[activeTuneItem] = val;
    applyTuneToStore(activeTuneItem, val);
  }

  const tuneScrubberPct = $derived.by(() => {
    if (!activeTuneItem) return 0;
    const { min, max } = getTuneRange();
    return ((tuneValues[activeTuneItem] - min) / (max - min)) * 100;
  });

  function formatPitch(v: number): string {
    if (v === 0) return "0 st";
    return v > 0 ? `+${v} st` : `${v} st`;
  }

  function formatPct(v: number): string {
    return `${v}%`;
  }

  function toggleTune(e: Event) {
    e.stopPropagation();
    if (tuneRowOpen) {
      tuneRowOpen = false;
      activeTuneItem = null;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      filterRowOpen = false;
      stageRowOpen = false;
      visualRowOpen = false;
      activeTuneItem = null;
      openTimeout = setTimeout(() => {
        tuneRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleFilter(e: Event) {
    e.stopPropagation();
    if (filterRowOpen) {
      filterRowOpen = false;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      tuneRowOpen = false;
      activeTuneItem = null;
      stageRowOpen = false;
      visualRowOpen = false;
      openTimeout = setTimeout(() => {
        filterRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleStage(e: Event) {
    e.stopPropagation();
    if (stageRowOpen) {
      stageRowOpen = false;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      tuneRowOpen = false;
      activeTuneItem = null;
      filterRowOpen = false;
      visualRowOpen = false;
      openTimeout = setTimeout(() => {
        stageRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function toggleVisual(e: Event) {
    e.stopPropagation();
    if (visualRowOpen) {
      visualRowOpen = false;
    } else {
      if (openTimeout) clearTimeout(openTimeout);
      tuneRowOpen = false;
      activeTuneItem = null;
      filterRowOpen = false;
      stageRowOpen = false;
      openTimeout = setTimeout(() => {
        visualRowOpen = true;
        openTimeout = null;
      }, 100);
    }
  }

  function openTuneItem(item: typeof activeTuneItem, e: Event) {
    e.stopPropagation();
    activeTuneItem = activeTuneItem === item ? null : item;
  }

  function toggleFilterItem(
    key: "nightcore" | "lofi" | "eightBit" | "radio",
    e: Event,
  ) {
    e.stopPropagation();
    const newFilter = activeFilter === key ? null : key;
    activeFilter = newFilter;
    effectsStore.setFilter(newFilter);
  }

  function toggleStageItem(
    key: "mono" | "stereo" | "surround" | "eightD",
    e: Event,
  ) {
    e.stopPropagation();
    if (activeStage === key) {
      activeStage = null;
      eqEngine.setStage(null);
    } else {
      activeStage = key;
      eqEngine.setStage(key);
    }
  }

  function flashVisual(name: string, e: Event) {
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    target.classList.remove("flash");
    void target.offsetWidth;
    target.classList.add("flash");
  }

  $effect(() => {
    if (!visible) {
      if (openTimeout) {
        clearTimeout(openTimeout);
        openTimeout = null;
      }
      tuneRowOpen = false;
      filterRowOpen = false;
      stageRowOpen = false;
      visualRowOpen = false;
      activeTuneItem = null;
      if (activeFilter !== null) {
        activeFilter = null;
        effectsStore.setFilter(null);
      }
      pinned = false;
    }
  });

  $effect(() => {
    if (visible) {
      activeStage = eqEngine.getStageMode();
    }
  });

  $effect(() => {
    if (filePath) {
      activeStage = eqEngine.getStageMode();
      tuneValues.pitch = effectsStore.pitch;
      tuneValues.reverb = effectsStore.reverb;
      tuneValues.chorus = effectsStore.chorus;
      tuneValues.distortion = effectsStore.distortion;
      activeFilter = effectsStore.activeFilter;
    }
  });
</script>

{#if visible}
  <div class="edit-menu-wrapper" style={styleOverride}>
    <div
      class="edit-menu"
      class:pinned
      transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}
    >
      <div
        class="ctx-drag"
        role="button"
        tabindex="0"
        aria-label="Drag to move"
        onmousedown={(e) => {
          e.preventDefault();
          onMoved?.();
          const menu = (e.currentTarget as HTMLElement).closest(
            ".edit-menu-wrapper",
          ) as HTMLElement;
          if (!menu) return;
          const startX = e.clientX;
          const startY = e.clientY;
          const rect = menu.getBoundingClientRect();
          const startLeft = rect.left;
          const startTop = rect.top;
          const savedTransition = menu.style.transition;
          menu.style.transition = "none";

          function onMouseMove(ev: MouseEvent) {
            menu.style.left = `${startLeft + ev.clientX - startX}px`;
            menu.style.top = `${startTop + ev.clientY - startY}px`;
            menu.style.transform = "none";
          }

          function onMouseUp() {
            menu.style.transition = savedTransition;
            window.removeEventListener("mousemove", onMouseMove);
            window.removeEventListener("mouseup", onMouseUp);
          }

          window.addEventListener("mousemove", onMouseMove);
          window.addEventListener("mouseup", onMouseUp);
        }}
      >
        <button
          class="ctx-pin tooltip-below"
          class:active={pinned}
          data-tooltip={pinned ? "Unpin" : "Pin"}
          onclick={(e) => {
            e.stopPropagation();
            pinned = !pinned;
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label={pinned ? "Unpin" : "Pin"}
        >
          <svg
            width="9"
            height="9"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path
              d="M12 2C8 2 6 5 6 9V11L2 15V18H22V15L18 11V9C18 5 16 2 12 2ZM12 18V23"
            />
          </svg>
        </button>
        <span class="ctx-drag-title">
          <span class="ctx-dots">
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
          </span>
          <span>Effects</span>
          <span class="ctx-dots">
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
            <span class="ctx-dot"></span>
          </span>
        </span>
        <button
          class="ctx-close tooltip-below"
          data-tooltip="Close"
          onclick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          onmousedown={(e) => e.stopPropagation()}
          aria-label="Close"
        >
          <svg
            width="9"
            height="9"
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

      <div class="edit-menu-card">
        <div class="edit-menu-row">
          <button
            class="edit-menu-btn red"
            class:sub-open={filterRowOpen || stageRowOpen || visualRowOpen}
            onclick={toggleTune}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
            <span>Tune</span>
          </button>
          <button
            class="edit-menu-btn yellow"
            class:sub-open={tuneRowOpen || stageRowOpen || visualRowOpen}
            onclick={toggleFilter}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M12 2l1.5 4.5 4.5 1.5-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5z"
              />
              <path d="M19 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" />
            </svg>
            <span>Filter</span>
          </button>
          <button
            class="edit-menu-btn green"
            class:sub-open={tuneRowOpen || filterRowOpen || visualRowOpen}
            onclick={toggleStage}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
              <rect x="4" y="15" width="4" height="6" rx="1" />
              <rect x="16" y="15" width="4" height="6" rx="1" />
            </svg>
            <span>Stage</span>
          </button>
          <button
            class="edit-menu-btn blue"
            class:sub-open={tuneRowOpen || filterRowOpen || stageRowOpen}
            onclick={toggleVisual}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
              <path d="M6 10v4M10 8v6M14 10v4M18 8v6" />
            </svg>
            <span>Visual</span>
          </button>
        </div>

        {#if tuneRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button
              class="edit-menu-btn red sub"
              class:active={activeTuneItem === "pitch"}
              onclick={(e) => openTuneItem("pitch", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <span>Pitch</span>
            </button>
            <button
              class="edit-menu-btn red sub"
              class:active={activeTuneItem === "reverb"}
              onclick={(e) => openTuneItem("reverb", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="12" r="5" />
                <circle cx="12" cy="12" r="8" />
              </svg>
              <span>Reverb</span>
            </button>
            <button
              class="edit-menu-btn red sub"
              class:active={activeTuneItem === "chorus"}
              onclick={(e) => openTuneItem("chorus", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M2 8c3-4 5-4 8 0s5 4 8 0" />
                <path d="M2 12c3-4 5-4 8 0s5 4 8 0" />
                <path d="M2 16c3-4 5-4 8 0s5 4 8 0" />
              </svg>
              <span>Chorus</span>
            </button>
            <button
              class="edit-menu-btn red sub"
              class:active={activeTuneItem === "distortion"}
              onclick={(e) => openTuneItem("distortion", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M14 2L6 12h5l-3 10 11-12h-6z" />
              </svg>
              <span>Distortion</span>
            </button>
          </div>

          {#if activeTuneItem}
            {@const item = activeTuneItem}
            {@const label = item.charAt(0).toUpperCase() + item.slice(1)}
            {@const max = item === "pitch" ? 12 : 100}
            {@const min = item === "pitch" ? -12 : 0}
            {@const val = tuneValues[item]}
            {@const display =
              item === "pitch" ? formatPitch(val) : formatPct(val)}
            <div
              class="markup-slider-panel"
              in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
              out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
            >
              <div
                class="color-slider-track"
                bind:this={tuneTrackEl}
                role="slider"
                tabindex="0"
                aria-valuemin={min}
                aria-valuemax={max}
                aria-valuenow={val}
                aria-label={label}
                onpointerdown={handleTunePointerDown}
                onpointermove={handleTunePointerMove}
                onpointerup={handleTunePointerUp}
                onpointercancel={handleTunePointerUp}
              >
                <div
                  class="color-slider-fill"
                  style="width: {tuneScrubberPct}%"
                ></div>
                {#each getTuneMarkers() as marker}
                  <div
                    class="color-slider-marker"
                    class:center-marker={marker.val === 0}
                    style="left: {marker.pct}%"
                    onpointerdown={(e) => e.stopPropagation()}
                    onclick={() => jumpToTune(marker.val)}
                    onkeydown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        jumpToTune(marker.val);
                      }
                    }}
                    role="button"
                    tabindex="0"
                    aria-label="Set {label} to {marker.val}"
                  ></div>
                {/each}
                <div
                  class="color-slider-scrubber"
                  style="left: {tuneScrubberPct}%"
                  role="button"
                  tabindex="0"
                  aria-label="Scrubber"
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    if (!tuneTrackEl) return;
                    isTuneDragging = true;
                    tuneTrackEl.setPointerCapture(e.pointerId);
                  }}
                ></div>
              </div>
              <div
                class="color-scrubber-tooltip"
                style="left: {tuneScrubberPct}%"
              >
                <span>{display}</span>
              </div>
            </div>
          {/if}
        {/if}

        {#if filterRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button
              class="edit-menu-btn yellow sub"
              class:active={activeFilter === "nightcore"}
              onclick={(e) => toggleFilterItem("nightcore", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
              <span>Nightcore</span>
            </button>
            <button
              class="edit-menu-btn yellow sub"
              class:active={activeFilter === "lofi"}
              onclick={(e) => toggleFilterItem("lofi", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <circle cx="8" cy="12" r="2.5" />
                <circle cx="16" cy="12" r="2.5" />
                <path d="M10.5 12h3" />
              </svg>
              <span>Lo-Fi</span>
            </button>
            <button
              class="edit-menu-btn yellow sub"
              class:active={activeFilter === "eightBit"}
              onclick={(e) => toggleFilterItem("eightBit", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="9" y="2" width="6" height="6" rx="1" />
                <rect x="3" y="9" width="6" height="6" rx="1" />
                <rect x="9" y="9" width="6" height="6" rx="1" />
                <rect x="15" y="9" width="6" height="6" rx="1" />
              </svg>
              <span>8-Bit</span>
            </button>
            <button
              class="edit-menu-btn yellow sub"
              class:active={activeFilter === "radio"}
              onclick={(e) => toggleFilterItem("radio", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <line x1="12" y1="8" x2="12" y2="20" />
                <path d="M7 20h10" />
                <path d="M9 20l3-8 3 8" />
                <circle cx="12" cy="5" r="3" />
                <path d="M4 10a6 6 0 0 1 4-2" />
                <path d="M20 10a6 6 0 0 0-4-2" />
                <path d="M2 14a10 10 0 0 1 6-3" />
                <path d="M22 14a10 10 0 0 0-6-3" />
              </svg>
              <span>Radio</span>
            </button>
          </div>
        {/if}

        {#if stageRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button
              class="edit-menu-btn green sub"
              class:active={activeStage === "mono"}
              onclick={(e) => toggleStageItem("mono", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M11 5L6 9H2v6h4l5 4V5z" />
                <path d="M15 8a4 4 0 0 1 0 5" />
                <path d="M17 6a7 7 0 0 1 0 9" />
              </svg>
              <span>Mono</span>
            </button>
            <button
              class="edit-menu-btn green sub"
              class:active={activeStage === "stereo"}
              onclick={(e) => toggleStageItem("stereo", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path d="M8 4L4 8v8l4 4V4z" />
                <path d="M16 4l4 4v8l-4 4V4z" />
                <path d="M1 8a3 3 0 0 1 0-3" />
                <path d="M23 8a3 3 0 0 0 0-3" />
              </svg>
              <span>Stereo</span>
            </button>
            <button
              class="edit-menu-btn green sub"
              class:active={activeStage === "surround"}
              onclick={(e) => toggleStageItem("surround", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <circle cx="12" cy="5" r="2.5" />
                <circle cx="5" cy="12" r="2.5" />
                <circle cx="12" cy="19" r="2.5" />
                <circle cx="19" cy="12" r="2.5" />
              </svg>
              <span>Surround</span>
            </button>
            <button
              class="edit-menu-btn green sub"
              class:active={activeStage === "eightD"}
              onclick={(e) => toggleStageItem("eightD", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <ellipse cx="12" cy="12" rx="10" ry="4" />
                <circle cx="6" cy="9" r="1.5" fill="currentColor" />
              </svg>
              <span>8D</span>
            </button>
          </div>
        {/if}

        {#if visualRowOpen}
          <div class="edit-menu-separator"></div>
          <div
            class="edit-menu-row"
            in:fly={{ y: -10, duration: 150, opacity: 0.05 }}
            out:fly={{ y: -10, duration: 100, opacity: 0.05 }}
          >
            <button
              class="edit-menu-btn blue sub"
              onclick={(e) => flashVisual("thumbnail", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
              <span>Thumbnail</span>
            </button>
            <button
              class="edit-menu-btn blue sub"
              onclick={(e) => flashVisual("card", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M8 8h8" />
                <path d="M8 12h5" />
                <path d="M8 16h7" />
              </svg>
              <span>Card</span>
            </button>
            <button
              class="edit-menu-btn blue sub"
              onclick={(e) => flashVisual("waveform", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="3" y="8" width="2" height="8" rx="1" />
                <rect x="7" y="5" width="2" height="14" rx="1" />
                <rect x="11" y="3" width="2" height="18" rx="1" />
                <rect x="15" y="7" width="2" height="10" rx="1" />
                <rect x="19" y="10" width="2" height="4" rx="1" />
              </svg>
              <span>Waveform</span>
            </button>
            <button
              class="edit-menu-btn blue sub"
              onclick={(e) => flashVisual("spectrogram", e)}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <rect x="4" y="10" width="4" height="10" rx="1" />
                <rect x="10" y="4" width="4" height="16" rx="1" />
                <rect x="16" y="7" width="4" height="13" rx="1" />
              </svg>
              <span>Spectrogram</span>
            </button>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
