<script lang="ts">
  let { progress = 0 }: { progress: number } = $props();

  const discRadius = 130;
  const circumference = 2 * Math.PI * discRadius;
  const dashOffset = $derived(circumference * (1 - progress / 100));
</script>

<svg
  class="cd-visual"
  viewBox="0 0 300 300"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
  role="img"
  aria-label="Audio disc with playback progress"
>
  <defs>
    <radialGradient id="cdDiscGradient" cx="40%" cy="40%" r="60%">
      <stop offset="0%" stop-color="var(--cd-highlight, #e8e8e8)" />
      <stop offset="30%" stop-color="var(--cd-body, #d0d0d0)" />
      <stop offset="60%" stop-color="var(--cd-body, #b8b8b8)" />
      <stop offset="85%" stop-color="var(--cd-edge, #909090)" />
      <stop offset="100%" stop-color="var(--cd-edge, #787878)" />
    </radialGradient>
  </defs>

  <!-- Outer progress ring (background track) -->
  <circle
    cx="150"
    cy="150"
    r={discRadius}
    stroke="var(--cd-ring-track, rgba(128,128,128,0.2))"
    stroke-width="4"
    fill="none"
  />

  <!-- Outer progress ring (foreground progress) -->
  <circle
    cx="150"
    cy="150"
    r={discRadius}
    stroke="var(--green)"
    stroke-width="4"
    fill="none"
    stroke-linecap="round"
    stroke-dasharray={circumference}
    stroke-dashoffset={dashOffset}
    transform="rotate(-90 150 150)"
    class="cd-progress-ring"
  />

  <!-- Disc body -->
  <circle cx="150" cy="150" r="124" fill="url(#cdDiscGradient)" />

  <!-- Faint decorative concentric rings for CD texture -->
  <circle cx="150" cy="150" r="105" stroke="var(--cd-ring, rgba(0,0,0,0.06))" stroke-width="0.5" fill="none" />
  <circle cx="150" cy="150" r="85" stroke="var(--cd-ring, rgba(0,0,0,0.06))" stroke-width="0.5" fill="none" />
  <circle cx="150" cy="150" r="65" stroke="var(--cd-ring, rgba(0,0,0,0.06))" stroke-width="0.5" fill="none" />

  <!-- Center hole -->
  <circle cx="150" cy="150" r="18" fill="var(--bg-primary)" />

  <!-- Center hole inner rim for depth -->
  <circle cx="150" cy="150" r="18" stroke="var(--cd-edge, rgba(0,0,0,0.15))" stroke-width="0.5" fill="none" />
</svg>

<style>
  .cd-visual {
    width: min(280px, 100%);
    height: auto;
    display: block;
    flex-shrink: 0;
  }

  .cd-progress-ring {
    transition: stroke-dashoffset 0.1s linear;
  }
</style>
