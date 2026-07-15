<script lang="ts">
  let {
    pdfContainerEl = $bindable(null),
    loading,
    error,
    pages,
    scale,
    setScale,
    currentPage,
    pageCount,
    prevPage,
    nextPage,
  }: {
    pdfContainerEl: HTMLElement | null;
    loading: boolean;
    error: string;
    pages: { canvasRef: HTMLCanvasElement | null }[];
    scale: number;
    setScale: (s: number) => void;
    currentPage: number;
    pageCount: number;
    prevPage: () => void;
    nextPage: () => void;
  } = $props();
</script>

<div
  class="pdf-viewer"
  bind:this={pdfContainerEl}
  role="region"
  aria-label="PDF viewer"
>
  {#if loading}
    <div class="pdf-loading">
      <div class="pdf-spinner"></div>
      <span>Loading PDF...</span>
    </div>
  {:else if error}
    <div class="pdf-error">{error}</div>
  {:else}
    {#each pages as page, i}
      <div class="pdf-page-wrapper">
        <canvas bind:this={page.canvasRef} class="pdf-canvas"></canvas>
      </div>
      {#if i < pages.length - 1}
        <div class="pdf-page-separator"></div>
      {/if}
    {/each}
  {/if}
</div>
<div class="pdf-zoom-controls">
  <button
    class="pdf-zoom-btn"
    onclick={() => setScale(scale - 0.25)}
    disabled={scale <= 0.25}
    aria-label="Zoom out">−</button
  >
  <span class="pdf-zoom-label">{Math.round(scale * 100)}%</span>
  <button
    class="pdf-zoom-btn"
    onclick={() => setScale(scale + 0.25)}
    disabled={scale >= 5}
    aria-label="Zoom in">+</button
  >
  <button
    class="pdf-zoom-btn pdf-zoom-reset"
    onclick={() => setScale(1)}
    aria-label="Reset zoom">Reset</button
  >
  <div class="pdf-page-nav">
    <button
      class="pdf-zoom-btn"
      onclick={prevPage}
      disabled={currentPage <= 1}
      aria-label="Previous page">◀</button
    >
    <span class="pdf-page-count">{currentPage}/{pageCount}</span>
    <button
      class="pdf-zoom-btn"
      onclick={nextPage}
      disabled={currentPage >= pageCount}
      aria-label="Next page">▶</button
    >
  </div>
</div>
