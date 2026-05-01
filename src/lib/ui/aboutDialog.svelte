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
        <p class="delete-title">About vyu</p>
        <p class="delete-subtitle">Fast. Minimal. Yours.</p>
      </div>

      <div class="about-content">
        <!-- Brand diamond -->
        <div class="about-brand">
          <div class="about-logo-diamond-wrap">
            <div class="about-logo-diamond"></div>
            <div class="about-logo-diamond-content">
              <span class="about-logo">vyu</span>
            </div>
          </div>
          <span class="about-version">v{__APP_VERSION__}</span>
        </div>

        <p class="about-desc">
          A fast, minimal media viewer built for creators who want to browse
          images and videos without the bloat.
        </p>

        <!-- Supported formats panel -->
        <div class="about-panel">
          <div class="about-panel-header">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            Supported formats
          </div>
          <div class="about-panel-body">
            <div class="about-format-row">
              <span class="about-format-badge">Images</span>
              <span class="about-format-items">PNG, JPG, JPEG, GIF, WEBP, BMP, TIFF, AVIF, HEIC, TGA, PSD, PCX, ICO, RAW</span>
            </div>
            <div class="about-sep"></div>
            <div class="about-format-row">
              <span class="about-format-badge">Videos</span>
              <span class="about-format-items">MP4, MKV, WEBM, MOV, AVI, FLV, WMV, MPEG, MPG, TS, M2TS, MTS, 3GP, OGV, ASF, DV, MXF, VOB, IVF</span>
            </div>
            <div class="about-sep"></div>
            <div class="about-format-row">
              <span class="about-format-badge">Audio</span>
              <span class="about-format-items">MP3, AAC, FLAC, WAV, OGG, WMA, M4A, AIFF, AU, AC3, DTS, OPUS, MPC, TTA, APE, ALAC, AMR</span>
            </div>
          </div>
        </div>

        <!-- Links panel -->
        <div class="about-panel">
          <div class="about-panel-header about-panel-header-yellow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
            Links
          </div>
          <div class="about-panel-body about-panel-body-center">
            <button class="about-link-btn" onclick={() => {}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #4ade80"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
              GitHub
            </button>
            <button class="about-link-btn" onclick={() => {}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #facc15"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Report an issue
            </button>
            <button class="about-link-btn" onclick={() => {}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: #f87171"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
              Support
            </button>
          </div>
        </div>

        <!-- Credits -->
        <div class="about-credits">
          <span>Made by <strong>crz-dev</strong></span>
          <span class="about-credits-sep">|</span>
          <span>Ideas & support by <strong>wamu</strong></span>
        </div>
      </div>

      <div class="delete-actions about-delete-actions">
        <button class="settings-action-btn blue" onclick={() => {}}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/></svg>
          Check for updates
        </button>
        <button class="delete-cancel" onclick={closeAbout}>Close</button>
      </div>
    </div>
  </div>
{/if}
