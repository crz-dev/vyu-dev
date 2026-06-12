<script lang="ts">
  import { fly } from "svelte/transition";
  import { eqStore } from "$lib/features/equalizer/equalizer-store.svelte";
  import { formatFreq, formatDb } from "$lib/features/equalizer/band-config";

  let {
    visible,
    onClose,
    onMoved,
    styleOverride = "",
    isVideo = false,
  }: {
    visible: boolean;
    onClose: () => void;
    onMoved?: () => void;
    styleOverride?: string;
    isVideo?: boolean;
  } = $props();

  let pinned = $state(false);
  let presetDropdownOpen = $state(false);

  const BANDS = [30, 60, 125, 250, 500, 1000, 2000, 4000, 8000, 16000] as const;

  const BAND_COLORS = [
    "var(--red)",
    "var(--red)",
    "var(--orange)",
    "var(--yellow)",
    "var(--green)",
    "var(--cyan)",
    "var(--blue)",
    "var(--purple)",
    "var(--pink)",
    "var(--pink)",
  ] as const;

  const BAND_BG = [
    "var(--red-bg-default)",
    "var(--red-bg-default)",
    "var(--orange-bg-default)",
    "var(--yellow-bg-default)",
    "var(--green-bg-default)",
    "var(--cyan-bg-default)",
    "var(--blue-bg-default)",
    "var(--purple-bg-default)",
    "var(--pink-bg-default)",
    "var(--pink-bg-default)",
  ] as const;

  const BAND_BORDER = [
    "var(--red-border)",
    "var(--red-border)",
    "var(--orange-border)",
    "var(--yellow-border)",
    "var(--green-border)",
    "var(--cyan-border)",
    "var(--blue-light-border)",
    "var(--purple-border)",
    "var(--pink-border)",
    "var(--pink-border)",
  ] as const;

  const audioPresets: Record<string, number[]> = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Bass Boost": [8, 6, 4, 2, 0, 0, -1, -1, -2, -3],
    Vocal: [-2, -1, 0, 3, 5, 5, 3, 1, 0, -1],
    Classical: [-1, 0, 0, 0, 0, 0, -3, -4, -4, -5],
    Rock: [5, 4, 2, 0, -1, 0, 2, 3, 4, 5],
    Jazz: [3, 2, 0, 2, 0, 0, 0, 1, 3, 4],
    Electronic: [5, 4, 2, 0, -2, 0, 0, 2, 4, 6],
    Podcast: [-3, -1, 2, 5, 5, 5, 3, 0, -1, -2],
  };

  const videoPresets: Record<string, number[]> = {
    Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    "Bass Boost": [8, 6, 4, 2, 0, 0, -1, -1, -2, -3],
    Dialogue: [-4, -3, -1, 1, 3, 5, 5, 3, 1, -1],
    Movie: [4, 3, 2, 0, -1, -1, 0, 2, 4, 5],
    Cinema: [5, 4, 3, 1, -2, -2, 0, 2, 4, 6],
    Action: [7, 5, 3, 0, -3, -2, 1, 3, 5, 7],
    "Night Mode": [2, 2, 1, 0, -2, -2, -1, 1, 2, 2],
    Surround: [3, 2, 0, -2, -3, -2, 0, 3, 5, 6],
  };

  const presets = $derived(isVideo ? videoPresets : audioPresets);

  const TRACK_HEIGHT = 100;

  function knobY(val: number): number {
    const ratio = (val + 12) / 24;
    return TRACK_HEIGHT - ratio * TRACK_HEIGHT;
  }

  function applyPreset(name: string) {
    const values = presets[name];
    if (values) {
      eqStore.applyPreset(name, values);
    }
  }

  function resetAll() {
    eqStore.resetAll();
  }

  function handleBandInput(index: number, e: Event) {
    const target = e.target as HTMLInputElement;
    eqStore.setBand(index, Number(target.value));
  }

  function handleGainInput(e: Event) {
    const target = e.target as HTMLInputElement;
    eqStore.setOutputGain(Number(target.value));
  }

  function curvePath(): string {
    const gap = 38;
    const startX = 19;
    const points: [number, number][] = eqStore.bands.map((val, i) => [
      startX + i * gap,
      knobY(val) + 12,
    ]);
    if (points.length < 2) return "";
    let d = `M ${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev[0] + (curr[0] - prev[0]) * 0.5;
      const cpx2 = prev[0] + (curr[0] - prev[0]) * 0.5;
      d += ` C ${cpx1},${prev[1]} ${cpx2},${curr[1]} ${curr[0]},${curr[1]}`;
    }
    return d;
  }

  const curveFillPath = $derived.by(() => {
    const gap = 38;
    const startX = 19;
    const points: [number, number][] = eqStore.bands.map((val, i) => [
      startX + i * gap,
      knobY(val) + 12,
    ]);
    if (points.length < 2) return "";
    let d = `M ${points[0][0]},${TRACK_HEIGHT / 2 + 12}`;
    d += ` L ${points[0][0]},${points[0][1]}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpx1 = prev[0] + (curr[0] - prev[0]) * 0.5;
      const cpx2 = prev[0] + (curr[0] - prev[0]) * 0.5;
      d += ` C ${cpx1},${prev[1]} ${cpx2},${curr[1]} ${curr[0]},${curr[1]}`;
    }
    d += ` L ${points[points.length - 1][0]},${TRACK_HEIGHT / 2 + 12}`;
    d += " Z";
    return d;
  });
</script>

{#if visible}
  <div class="equalizer-wrapper" style={styleOverride}>
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
            ".equalizer-wrapper",
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
          <span>Equalizer</span>
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
        <div class="eq-controls-row">
          <button
            class="eq-bypass-btn"
            class:active={!eqStore.bypass}
            onclick={() => eqStore.setBypass(!eqStore.bypass)}
          >
            <span class="eq-bypass-track" class:on={!eqStore.bypass}>
              <span class="eq-bypass-thumb"></span>
            </span>
            <span class="eq-bypass-label"
              >{eqStore.bypass ? "Bypass" : "Active"}</span
            >
          </button>

          <div class="edit-menu-divider"></div>

          <div class="eq-preset-anchor">
            <button
              class="eq-preset-btn"
              onclick={() => (presetDropdownOpen = !presetDropdownOpen)}
            >
              <span>{eqStore.activePreset}</span>
              <svg
                width="8"
                height="8"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {#if presetDropdownOpen}
              <div
                class="eq-preset-dropdown"
                role="menu"
                tabindex="-1"
                onmouseleave={() => (presetDropdownOpen = false)}
              >
                {#each Object.keys(presets) as name}
                  <button
                    class="eq-preset-item"
                    class:active={eqStore.activePreset === name}
                    onclick={() => {
                      applyPreset(name);
                      presetDropdownOpen = false;
                    }}
                  >
                    {name}
                  </button>
                {/each}
                {#if eqStore.activePreset === "Custom"}
                  <div class="eq-preset-separator"></div>
                  <button
                    class="eq-preset-item active"
                    onclick={() => (presetDropdownOpen = false)}
                  >
                    Custom
                  </button>
                {/if}
              </div>
            {/if}
          </div>

          <button
            class="eq-reset-btn tooltip-below"
            data-tooltip="Reset"
            onclick={resetAll}
            aria-label="Reset"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
          </button>
        </div>

        <div class="eq-bands-card">
          <div class="eq-bands-area">
            <svg
              class="eq-curve"
              viewBox="0 0 {38 * 9 + 38} {TRACK_HEIGHT + 24}"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient
                  id="eqCurveGrad"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="0%"
                >
                  <stop
                    offset="0%"
                    stop-color="var(--red)"
                    stop-opacity="0.7"
                  />
                  <stop
                    offset="25%"
                    stop-color="var(--yellow)"
                    stop-opacity="0.7"
                  />
                  <stop
                    offset="50%"
                    stop-color="var(--cyan)"
                    stop-opacity="0.7"
                  />
                  <stop
                    offset="75%"
                    stop-color="var(--purple)"
                    stop-opacity="0.7"
                  />
                  <stop
                    offset="100%"
                    stop-color="var(--pink)"
                    stop-opacity="0.7"
                  />
                </linearGradient>
              </defs>
              <path d={curveFillPath} fill="url(#eqCurveGrad)" opacity="0.12" />
              <path
                d={curvePath()}
                fill="none"
                stroke="url(#eqCurveGrad)"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            {#each BANDS as freq, i}
              {@const val = eqStore.bands[i]}
              {@const pct = ((val + 12) / 24) * 100}
              <div class="eq-band">
                <span class="eq-db-label">{formatDb(val)}</span>
                <div class="eq-slider-track" style="height: {TRACK_HEIGHT}px;">
                  <div class="eq-slider-center"></div>
                  <div
                    class="eq-slider-fill"
                    class:above={val > 0}
                    class:below={val < 0}
                    style:top={val >= 0
                      ? `${knobY(val)}px`
                      : `${TRACK_HEIGHT / 2}px`}
                    style:height={val >= 0
                      ? `${TRACK_HEIGHT / 2 - knobY(val)}px`
                      : `${knobY(val) - TRACK_HEIGHT / 2}px`}
                    style:background={BAND_COLORS[i]}
                    style:opacity="0.35"
                  ></div>
                  <input
                    type="range"
                    class="eq-slider-input"
                    min="-12"
                    max="12"
                    step="1"
                    value={val}
                    oninput={(e) => handleBandInput(i, e)}
                    style:accent-color={BAND_COLORS[i]}
                  />
                  <div
                    class="eq-knob"
                    style:top="{knobY(val)}px"
                    style:background={BAND_COLORS[i]}
                    style:border-color={BAND_BORDER[i]}
                    style:box-shadow="0 0 8px {BAND_BG[i]}"
                  ></div>
                </div>
                <span class="eq-freq-label">{formatFreq(freq)}</span>
              </div>
            {/each}
          </div>
        </div>

        <div class="eq-gain-row">
          <span class="eq-gain-label">
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
            </svg>
            Gain
          </span>
          <div class="eq-gain-track">
            <div class="eq-gain-center"></div>
            <div
              class="eq-gain-fill"
              style:width="{((eqStore.outputGain + 12) / 24) * 100}%"
            ></div>
            <button
              class="eq-gain-marker"
              class:active={eqStore.outputGain === -12}
              style:left="0%"
              onclick={() => eqStore.setOutputGain(-12)}
              aria-label="Min gain"
            ></button>
            <button
              class="eq-gain-marker"
              class:active={eqStore.outputGain === 0}
              style:left="50%"
              onclick={() => eqStore.setOutputGain(0)}
              aria-label="Zero gain"
            ></button>
            <button
              class="eq-gain-marker"
              class:active={eqStore.outputGain === 12}
              style:left="100%"
              onclick={() => eqStore.setOutputGain(12)}
              aria-label="Max gain"
            ></button>
            <input
              type="range"
              class="eq-gain-input"
              min="-12"
              max="12"
              step="1"
              value={eqStore.outputGain}
              oninput={handleGainInput}
            />
            <div
              class="eq-knob eq-gain-knob"
              style:left="{((eqStore.outputGain + 12) / 24) * 100}%"
            ></div>
          </div>
          <span class="eq-gain-value">{formatDb(eqStore.outputGain)}</span>
        </div>
      </div>
    </div>
  </div>
{/if}
