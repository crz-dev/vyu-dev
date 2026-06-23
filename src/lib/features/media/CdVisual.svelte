<script lang="ts">
  import { eqEngine } from "$lib/features/equalizer/equalizer-engine";

  let {
    progress = 0,
    audioEl,
    duration,
    currentTime,
    onScrubStart,
    onScrubMove,
    onScrubEnd,
    isScrubbing,
    fileName,
    color = "var(--green)",
    onCenterClick,
  }: {
    progress: number;
    audioEl: () => HTMLAudioElement | null;
    duration: number;
    currentTime: number;
    onScrubStart: (e: MouseEvent | TouchEvent) => void;
    onScrubMove: (e: MouseEvent | TouchEvent, newProgress: number) => void;
    onScrubEnd: () => void;
    isScrubbing: boolean;
    fileName: string;
    color?: string;
    onCenterClick?: () => void;
  } = $props();

  const discRadius = 275;
  const centerLabelRadius = 80;
  const textRadius = 55;
  const circumference = 2 * Math.PI * discRadius;
  const dashOffset = $derived(circumference * (1 - progress / 100));

  // Bass-reactive scale (1 = no pop, up to ~1.03 on strong bass)
  let bassScale = $state(1);

  // Rotation state for visual feedback during drag
  let rotation = $state(0);
  let lastAngle = $state(0);
  let isDragging = $state(false);

  let dragRect: DOMRect | null = null;

  function calculateAngle(
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): number {
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    // Convert to degrees, offset so 0° is at 12 o'clock
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    if (angle < 0) angle += 360;
    return angle;
  }

  function handleDragStart(e: MouseEvent | TouchEvent) {
    if (e instanceof MouseEvent && e.button !== 0) return;

    if ((e.target as Element)?.closest?.(".cd-center-label")) return;

    e.preventDefault();

    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const point = e instanceof TouchEvent ? e.touches[0] : e;

    dragRect = rect;

    lastAngle = calculateAngle(point.clientX, point.clientY, rect);
    isDragging = true;
    rotation = progress * 3.6;

    onScrubStart(e);
  }

  function handleDragMove(e: MouseEvent | TouchEvent) {
    if (!isDragging) return;

    const rect = dragRect!;
    const point = e instanceof TouchEvent ? e.touches[0] : e;

    const currentAngle = calculateAngle(point.clientX, point.clientY, rect);
    let deltaAngle = currentAngle - lastAngle;

    // Handle wraparound at 360°/0°
    if (deltaAngle > 180) deltaAngle -= 360;
    if (deltaAngle < -180) deltaAngle += 360;

    rotation += deltaAngle;
    lastAngle = currentAngle;

    let normalizedRotation = rotation % 360;
    if (normalizedRotation < 0) normalizedRotation += 360;

    const newProgress = normalizedRotation / 3.6;

    onScrubMove(e, newProgress);
  }

  function handleDragEnd(_e: MouseEvent | TouchEvent) {
    if (!isDragging) return;

    isDragging = false;

    onScrubEnd();
  }

  $effect(() => {
    if (!isDragging) {
      rotation = progress * 3.6;
    }
  });

  $effect(() => {
    const el = audioEl();
    if (!el) return;

    // Connect audio to shared equalizer engine (idempotent)
    eqEngine.connectMediaElement(el);

    const analyser = eqEngine.getAnalyser();
    if (!analyser) {
      // Engine could not connect — bail silently
      return;
    }

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    let rafId: number;
    let currentScale = 1;
    let frameCount = 0;

    function tick() {
      frameCount++;
      if (frameCount % 3 !== 0) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      analyser!.getByteFrequencyData(freqData);

      // Deep bass only ~20-170 Hz. Bins 0-1 cover 0-172 Hz. Weight bin 0 at 1.0, bin 1 at 0.6
      const b0 = freqData[0] / 255;
      const b1 = freqData[1] / 255;
      const avg = (b0 * 1.0 + b1 * 0.6) / 1.6;

      // Target scale: 1.0 at silence → 1.05 at full bass
      const target = 1 + avg * 0.05;
      // Exponential smoothing for organic feel
      currentScale += (target - currentScale) * 0.3;
      bassScale = currentScale;

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      bassScale = 1;
    };
  });
</script>

<svg
  class="cd-visual"
  class:dragging={isDragging}
  viewBox="0 0 650 650"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="slider"
  aria-label="Vinyl record with playback progress - drag to scrub"
  aria-valuenow={Math.round(progress)}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuetext={`${Math.round(progress)}% played`}
  tabindex="0"
  style="--cd-accent: {color}; transform: scale({bassScale})"
  onmousedown={handleDragStart}
  onmousemove={handleDragMove}
  onmouseup={handleDragEnd}
  onmouseleave={handleDragEnd}
  ontouchstart={handleDragStart}
  ontouchmove={handleDragMove}
  ontouchend={handleDragEnd}
>
  <defs>
    <!-- Vinyl groove pattern -->
    <radialGradient id="vinylGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--vinyl-disc)" />
      <stop offset="95%" stop-color="var(--vinyl-disc)" />
      <stop offset="100%" stop-color="var(--vinyl-edge, #2a2a2a)" />
    </radialGradient>

    <!-- Center label gradient -->
    <radialGradient id="centerLabelGradient" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="var(--cd-accent)" stop-opacity="0.9" />
      <stop offset="100%" stop-color="var(--cd-accent)" />
    </radialGradient>

    <!-- Circular text path for filename (rotates with disc so filename stays at top at 0:00) -->
    <path
      id="filenamePath"
      d="M 325,270 A 55,55 0 0,1 325,380 A 55,55 0 0,1 325,270"
      transform="rotate({-90 + rotation} 325 325)"
    />
  </defs>

  <!-- Outer progress ring (background track) -->
  <circle
    cx="325"
    cy="325"
    r={discRadius}
    stroke="var(--cd-ring-track)"
    stroke-width="4"
    fill="none"
  />

  <!-- Outer progress ring (foreground progress) -->
  <circle
    cx="325"
    cy="325"
    r={discRadius}
    stroke="var(--cd-accent)"
    stroke-width="4"
    fill="none"
    stroke-linecap="round"
    stroke-dasharray={circumference}
    stroke-dashoffset={dashOffset}
    transform="rotate(-90 325 325)"
    class="cd-progress-ring"
  />

  <!-- Vinyl disc body (rotates during drag) -->
  <g transform="rotate({rotation} 325 325)">
    <!-- Main disc -->
    <circle cx="325" cy="325" r="270" fill="url(#vinylGradient)" />

    <!-- Concentric grooves for vinyl texture -->
    <circle
      cx="325"
      cy="325"
      r="248"
      stroke="var(--vinyl-groove)"
      stroke-width="0.5"
      fill="none"
    />
    <circle
      cx="325"
      cy="325"
      r="226"
      stroke="var(--vinyl-groove)"
      stroke-width="0.5"
      fill="none"
    />
    <circle
      cx="325"
      cy="325"
      r="204"
      stroke="var(--vinyl-groove)"
      stroke-width="0.5"
      fill="none"
    />
    <circle
      cx="325"
      cy="325"
      r="182"
      stroke="var(--vinyl-groove)"
      stroke-width="0.5"
      fill="none"
    />
    <circle
      cx="325"
      cy="325"
      r="160"
      stroke="var(--vinyl-groove)"
      stroke-width="0.5"
      fill="none"
    />
    <circle
      cx="325"
      cy="325"
      r="138"
      stroke="var(--vinyl-groove)"
      stroke-width="0.5"
      fill="none"
    />
    <circle
      cx="325"
      cy="325"
      r="116"
      stroke="var(--vinyl-groove)"
      stroke-width="0.5"
      fill="none"
    />

    <!-- Center label -->
    <circle
      cx="325"
      cy="325"
      r={centerLabelRadius}
      fill="url(#centerLabelGradient)"
      class="cd-center-label"
      role="button"
      tabindex="0"
      aria-label="Change vinyl color"
      onclick={() => onCenterClick?.()}
      onkeydown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onCenterClick?.();
        }
      }}
    />

    <!-- Center label inner ring for depth -->
    <circle
      cx="325"
      cy="325"
      r="75"
      stroke="rgba(0,0,0,0.2)"
      stroke-width="1"
      fill="none"
    />

    <!-- Filename text on circular path -->
    <text
      class="filename-text"
      font-size="13"
      font-weight="500"
      fill="var(--text-primary)"
      font-family="var(--font-family)"
      letter-spacing="0.5"
      text-anchor="middle"
    >
      <textPath
        href="#filenamePath"
        startOffset="50%"
        method="align"
        spacing="auto"
      >
        {fileName}
      </textPath>
    </text>

    <!-- Center hole -->
    <circle cx="325" cy="325" r="16" fill="var(--vinyl-center-hole)" />

    <!-- Center hole highlight -->
    <circle
      cx="325"
      cy="325"
      r="16"
      stroke="rgba(255,255,255,0.1)"
      stroke-width="0.5"
      fill="none"
    />
  </g>
</svg>

<style>
  .cd-visual {
    width: 100%;
    height: 100%;
    display: block;
    cursor: grab;
    outline: none;
    transition: transform 0.05s linear;
  }

  .cd-visual:active {
    cursor: grabbing;
  }

  .cd-visual.dragging {
    cursor: grabbing;
  }

  .cd-progress-ring {
    transition: stroke-dashoffset 0.1s linear;
  }

  .filename-text {
    text-transform: uppercase;
  }

  .cd-center-label {
    cursor: pointer;
    outline: none;
  }
</style>
