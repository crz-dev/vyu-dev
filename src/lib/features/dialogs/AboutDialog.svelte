<script lang="ts">
  let {
    aboutOpen,
    closeAbout,
  }: {
    aboutOpen: boolean;
    closeAbout: () => void;
  } = $props();
</script>

{#if aboutOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => {
      if (e.target === e.currentTarget) closeAbout();
    }}
  >
    <div class="delete-dialog about-dialog" role="dialog" aria-modal="true">
      <div class="settings-header-bar">
        <p class="delete-title">
          <svg
            class="header-icon"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="12" cy="12" r="10" /><line
              x1="12"
              y1="16"
              x2="12"
              y2="12"
            /><line x1="12" y1="8" x2="12.01" y2="8" /></svg
          >
          About Vyu
        </p>
        <p class="delete-subtitle">Version: v{__APP_VERSION__}</p>
        <button class="dialog-close-x" onclick={closeAbout} aria-label="Close">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg
          >
        </button>
      </div>

      <div class="about-content">
        <div class="about-brand">
          <div class="about-logo-wrap">
            <div class="about-logo-border"></div>
            <img class="about-logo" src="/app-icon.png" alt="vyu" />
          </div>
        </div>

        <h2 class="about-title">
          View <span class="about-title-underline">Your</span> Universe
        </h2>

        <p class="about-desc">
          A media viewer actually built for this decade — editing, format
          support, zero telemetry.
        </p>

        <div class="about-panel">
          <div class="about-panel-header">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              /><polyline points="14 2 14 8 20 8" /></svg
            >
            Supported formats
          </div>
          <div class="about-panel-body">
            <div class="about-format-row">
              <span class="about-format-badge">Images</span>
              <span class="about-format-items"
                >JPG · PNG · GIF · WebP · BMP · HEIC · AVIF · TIFF · JXL</span
              >
            </div>
            <div class="about-sep"></div>
            <div class="about-format-row">
              <span class="about-format-badge">Videos</span>
              <span class="about-format-items"
                >MP4 · MKV · MOV · AVI · WebM · WMV · M4V · MPG · TS</span
              >
            </div>
            <div class="about-sep"></div>
            <div class="about-format-row">
              <span class="about-format-badge">Audio</span>
              <span class="about-format-items"
                >MP3 · AAC · WAV · FLAC · M4A · OGG · WMA · AIFF · ALAC</span
              >
            </div>
            <div class="about-sep"></div>
            <div class="about-format-row">
              <span class="about-format-badge">Other</span>
              <span class="about-format-items"
                >PSD · PDF · SVG · ICO · RAW · Opus · Damaged Media</span
              >
            </div>
          </div>
        </div>

        <div class="about-panel">
          <div class="about-panel-header about-panel-header-yellow">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
              /><path
                d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
              /></svg
            >
            Links
          </div>
          <div class="about-panel-body about-panel-body-center">
            <button class="about-link-btn" onclick={() => {}}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="color: var(--green)"
                ><path
                  d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
                /></svg
              >
              GitHub
            </button>
            <button class="about-link-btn" onclick={() => {}}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="color: var(--yellow-soft)"
                ><path
                  d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                /><line x1="12" y1="9" x2="12" y2="13" /><line
                  x1="12"
                  y1="17"
                  x2="12.01"
                  y2="17"
                /></svg
              >
              Report an issue
            </button>
            <button class="about-link-btn" onclick={() => {}}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="color: var(--red)"
                ><path
                  d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"
                /></svg
              >
              Support
            </button>
          </div>
        </div>

        <div class="about-credits">
          <span>Made by <strong>crz-dev</strong></span>
          <span class="about-credits-sep">|</span>
          <span>Icon design by <strong>wamu</strong></span>
        </div>
      </div>
    </div>
  </div>
{/if}
