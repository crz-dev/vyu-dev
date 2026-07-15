<script lang="ts">
  import { fly } from "svelte/transition";
  import type { FindHighlight } from "./pdf.svelte";

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
    scrollToPage,
    findOpen,
    findQuery,
    findResults,
    findCurrentIdx,
    findHighlights,
    toggleFind,
    findText,
    findNext,
    findPrev,
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
    scrollToPage: (page: number) => void;
    findOpen: boolean;
    findQuery: string;
    findResults: number;
    findCurrentIdx: number;
    findHighlights: FindHighlight[];
    toggleFind: () => void;
    findText: (q: string) => void;
    findNext: () => void;
    findPrev: () => void;
  } = $props();

  let editingPage = $state(false);
  let pageInput = $state("");
  let inputEl: HTMLInputElement | null = $state(null);
  let findInputEl: HTMLInputElement | null = $state(null);

  function startPageEdit() {
    pageInput = String(currentPage);
    editingPage = true;
    requestAnimationFrame(() => inputEl?.select());
  }

  function commitPage() {
    editingPage = false;
    const num = parseInt(pageInput, 10);
    if (!isNaN(num) && num >= 1 && num <= pageCount) {
      scrollToPage(num);
    }
  }

  function onPageKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Escape") {
      editingPage = false;
    }
  }

  function focusFindInput(node: HTMLInputElement) {
    node.focus();
  }

  function getHighlightsForPage(pageNum: number): FindHighlight | undefined {
    return findHighlights.find((h) => h.pageNum === pageNum);
  }
</script>

<div
  class="pdf-viewer"
  bind:this={pdfContainerEl}
  role="region"
  aria-label="PDF viewer"
>
  {#if findOpen}
    <div class="pdf-find-bar" transition:fly={{ y: -20, duration: 180, opacity: 0.08 }}>
      <input
        type="text"
        placeholder="Find in document\u2026"
        value={findQuery}
        oninput={(e) => findText((e.target as HTMLInputElement).value)}
        onkeydown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            if (e.shiftKey) findPrev();
            else findNext();
          }
          if (e.key === "Escape") toggleFind();
        }}
        class="pdf-find-input"
        use:focusFindInput
      />
      {#if findQuery}
        <span class="pdf-find-count"
          >{findResults > 0 ? `${findCurrentIdx}/${findResults}` : "No results"}</span
        >
      {/if}
      <button class="pdf-find-btn" onclick={findPrev} disabled={findResults === 0} aria-label="Previous match"
        >▲</button
      >
      <button class="pdf-find-btn" onclick={findNext} disabled={findResults === 0} aria-label="Next match"
        >▼</button
      >
      <button class="pdf-find-close" onclick={toggleFind} aria-label="Close find bar"
        >✕</button
      >
    </div>
  {/if}

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
        {#if findQuery && findResults > 0}
          {@const hl = getHighlightsForPage(i + 1)}
          {#if hl}
            <div class="pdf-highlight-overlay">
              {#each hl.rects as rect}
                <div
                  class="pdf-highlight-rect"
                  style="left: {rect.left}px; top: {rect.top}px; width: {rect.width}px; height: {rect.height}px;"
                ></div>
              {/each}
            </div>
          {/if}
        {/if}
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
  <button
    class="pdf-zoom-label"
    onclick={() => setScale(1)}
    aria-label="Reset zoom"
  >{Math.round(scale * 100)}%</button
  >
  <button
    class="pdf-zoom-btn"
    onclick={() => setScale(scale + 0.25)}
    disabled={scale >= 5}
    aria-label="Zoom in">+</button
  >
  <div class="pdf-page-nav">
    <button
      class="pdf-zoom-btn"
      onclick={prevPage}
      disabled={currentPage <= 1}
      aria-label="Previous page">◀</button
    >
    {#if editingPage}
      <input
        bind:this={inputEl}
        type="text"
        bind:value={pageInput}
        class="pdf-page-input"
        onblur={commitPage}
        onkeydown={onPageKeydown}
      />
    {:else}
      <button
        class="pdf-page-count"
        onclick={startPageEdit}
        aria-label="Go to page"
      >{currentPage}/{pageCount}</button
      >
    {/if}
    <button
      class="pdf-zoom-btn"
      onclick={nextPage}
      disabled={currentPage >= pageCount}
      aria-label="Next page">▶</button
    >
  </div>
</div>
