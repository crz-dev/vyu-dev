<script lang="ts">
  import { fly } from "svelte/transition";
  import type { FindHighlight } from "./pdf.svelte";
  import { copyTextToClipboard } from "$lib/services/clipboard";
  import { showToast } from "$lib/components/toast.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";
  import { markup } from "$lib/features/markup/markup.svelte";

  let {
    pdfContainerEl = $bindable(null),
    loading,
    error,
    pages,
    scale,
    fitScale,
    zoomLocked,
    setScale,
    currentPage,
    pageCount,
    prevPage,
    nextPage,
    scrollToPage,
    centerPage,
    findOpen,
    findQuery,
    findResults,
    findCurrentIdx,
    findHighlights,
    toggleFind,
    findText,
    findNext,
    findPrev,
    showPagePanel,
    togglePagePanel,
    getPageThumbnail,
    preloadAllThumbnails,
    toggleFullscreen,
    isFullscreen,
    resetFsTimer,
  }: {
    pdfContainerEl: HTMLElement | null;
    loading: boolean;
    error: string;
    pages: {
      canvasRef: HTMLCanvasElement | null;
      textLayerRef: HTMLDivElement | null;
    }[];
    scale: number;
    fitScale: number;
    zoomLocked: boolean;
    setScale: (s: number) => void;
    currentPage: number;
    pageCount: number;
    prevPage: () => void;
    nextPage: () => void;
    scrollToPage: (page: number) => void;
    centerPage: (page: number) => void;
    findOpen: boolean;
    findQuery: string;
    findResults: number;
    findCurrentIdx: number;
    findHighlights: FindHighlight[];
    toggleFind: () => void;
    findText: (q: string) => void;
    findNext: () => void;
    findPrev: () => void;
    showPagePanel: boolean;
    togglePagePanel: () => void;
    getPageThumbnail: (page: number) => Promise<string>;
    preloadAllThumbnails: () => Promise<void>;
    toggleFullscreen: () => void;
    isFullscreen: boolean;
    resetFsTimer: () => void;
  } = $props();

  let findInputEl: HTMLInputElement | null = $state(null);
  let textSelection = $state<{
    text: string;
    left: number;
    top: number;
    copied: boolean;
  } | null>(null);
  let copiedResetTimer: ReturnType<typeof setTimeout> | null = null;

  let pageWrapperRefs: (HTMLElement | null)[] = $state([]);
  let wheelRafId = 0;
  let pendingWheel: {
    clientX: number;
    clientY: number;
    deltaY: number;
    currentTarget: HTMLElement;
  } | null = null;

  let currentPageWrapper = $derived(
    currentPage > 0 && currentPage <= pageWrapperRefs.length
      ? pageWrapperRefs[currentPage - 1]
      : null,
  );
  let currentPageCanvas = $derived(
    currentPage > 0 && currentPage <= pages.length
      ? pages[currentPage - 1].canvasRef
      : null,
  );

  // Sync markup page when current page changes
  $effect(() => {
    if (currentPage > 0 && pageCount > 0) {
      markup.switchPage(currentPage);
    }
  });

  function focusFindInput(node: HTMLInputElement) {
    node.focus();
  }

  function handlePdfWheel(e: WheelEvent) {
    if (!e.ctrlKey) return;

    e.preventDefault();
    if (e.deltaY === 0) return;

    pendingWheel = {
      clientX: e.clientX,
      clientY: e.clientY,
      deltaY: e.deltaY,
      currentTarget: e.currentTarget as HTMLElement,
    };

    if (wheelRafId) return;

    wheelRafId = requestAnimationFrame(() => {
      wheelRafId = 0;
      if (!pendingWheel) return;

      const { clientX, clientY, deltaY, currentTarget } = pendingWheel;
      pendingWheel = null;

      const oldScale = scale;
      const minScale = zoomLocked ? 0.25 : Math.max(0.25, fitScale);
      const rawScale = oldScale * (deltaY > 0 ? 1 / 1.1 : 1.1);
      const newScale = Math.max(minScale, Math.min(5, rawScale));
      if (newScale === oldScale) return;

      const rect = currentTarget.getBoundingClientRect();
      const mouseX = clientX - rect.left;
      const mouseY = clientY - rect.top;
      const oldScrollLeft = currentTarget.scrollLeft;
      const oldScrollTop = currentTarget.scrollTop;

      setScale(newScale);
      requestAnimationFrame(() => {
        const ratio = newScale / oldScale;
        currentTarget.scrollLeft = (oldScrollLeft + mouseX) * ratio - mouseX;
        currentTarget.scrollTop = (oldScrollTop + mouseY) * ratio - mouseY;
      });
    });
  }

  function getHighlightsForPage(pageNum: number): FindHighlight | undefined {
    return findHighlights.find((h) => h.pageNum === pageNum);
  }

  function getSelectionElement(node: Node | null): Element | null {
    if (!node) return null;
    return node instanceof Element ? node : node.parentElement;
  }

  function isPdfTextNode(node: Node | null): boolean {
    const element = getSelectionElement(node);
    return (
      !!element?.closest(".pdf-text-layer") &&
      !!pdfContainerEl?.contains(element)
    );
  }

  function clearCopiedResetTimer(): void {
    if (!copiedResetTimer) return;
    clearTimeout(copiedResetTimer);
    copiedResetTimer = null;
  }

  function clearTextSelection(): void {
    clearCopiedResetTimer();
    textSelection = null;
  }

  function updateTextSelection(): void {
    const selection = window.getSelection();
    if (
      !pdfContainerEl ||
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0 ||
      !isPdfTextNode(selection.anchorNode) ||
      !isPdfTextNode(selection.focusNode)
    ) {
      clearTextSelection();
      return;
    }

    const text = selection.toString();
    if (!text.trim()) {
      clearTextSelection();
      return;
    }

    const rangeRect = selection.getRangeAt(0).getBoundingClientRect();
    if (rangeRect.width <= 0 || rangeRect.height <= 0) {
      clearTextSelection();
      return;
    }

    const viewerRect = pdfContainerEl.getBoundingClientRect();
    const pillWidth = 28;
    const pillHeight = 28;
    const edgePadding = 8;
    const gap = 2;
    const left = Math.max(
      viewerRect.left + pillWidth + edgePadding,
      Math.min(viewerRect.right - edgePadding, rangeRect.right),
    );
    const belowTop = rangeRect.bottom + gap;
    const top =
      belowTop + pillHeight <= viewerRect.bottom - edgePadding
        ? belowTop
        : Math.min(
            viewerRect.bottom - pillHeight - edgePadding,
            Math.max(
              viewerRect.top + edgePadding,
              rangeRect.top - pillHeight - gap,
            ),
          );

    const sameText = textSelection?.text === text;
    if (!sameText) clearCopiedResetTimer();

    textSelection = {
      text,
      left,
      top,
      copied: sameText ? (textSelection?.copied ?? false) : false,
    };
  }

  async function copySelection(): Promise<void> {
    const text = textSelection?.text;
    if (!text) return;

    try {
      await copyTextToClipboard(text);
      if (textSelection?.text === text) {
        textSelection = { ...textSelection, copied: true };
        clearCopiedResetTimer();
        copiedResetTimer = setTimeout(() => {
          if (textSelection?.text === text) {
            textSelection = { ...textSelection, copied: false };
          }
          copiedResetTimer = null;
        }, 2000);
      }
    } catch {
      showToast({ message: "Failed to copy selected text", color: "red" });
    }
  }

  $effect(() => {
    const container = pdfContainerEl;
    if (!container) return;

    const refreshSelection = () => updateTextSelection();
    document.addEventListener("selectionchange", refreshSelection);
    window.addEventListener("resize", refreshSelection);
    container.addEventListener("scroll", refreshSelection, { passive: true });

    return () => {
      document.removeEventListener("selectionchange", refreshSelection);
      window.removeEventListener("resize", refreshSelection);
      container.removeEventListener("scroll", refreshSelection);
      clearCopiedResetTimer();
    };
  });

  function onPdfKeydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable
    )
      return;
    if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      prevPage();
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      nextPage();
    }
  }

  $effect(() => {
    document.addEventListener("keydown", onPdfKeydown);
    return () => document.removeEventListener("keydown", onPdfKeydown);
  });

  let pageThumbUrls: Record<number, string> = $state({});

  $effect(() => {
    if (!showPagePanel) {
      pageThumbUrls = {};
      return;
    }
    let cancelled = false;
    (async () => {
      for (let i = 1; i <= pageCount && !cancelled; i++) {
        const url = await getPageThumbnail(i);
        if (url && !cancelled) {
          pageThumbUrls = { ...pageThumbUrls, [i]: url };
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  });
</script>

<div
  class="pdf-viewer"
  class:fullscreen={isFullscreen}
  bind:this={pdfContainerEl}
  role="presentation"
  onwheel={handlePdfWheel}
  onscroll={isFullscreen ? resetFsTimer : undefined}
  onclick={isFullscreen ? resetFsTimer : undefined}
>
  {#if findOpen}
    <div
      class="pdf-find-bar"
      transition:fly={{ y: -20, duration: 180, opacity: 0.08 }}
    >
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
          >{findResults > 0
            ? `${findCurrentIdx}/${findResults}`
            : "No results"}</span
        >
      {/if}
      <button
        class="pdf-find-btn"
        onclick={findPrev}
        disabled={findResults === 0}
        aria-label="Previous match">▲</button
      >
      <button
        class="pdf-find-btn"
        onclick={findNext}
        disabled={findResults === 0}
        aria-label="Next match">▼</button
      >
      <button
        class="pdf-find-close"
        onclick={toggleFind}
        aria-label="Close find bar">✕</button
      >
    </div>
  {/if}

  {#if showPagePanel}
    <div
      class="pdf-page-panel"
      transition:fly={{ x: -20, duration: 180, opacity: 0.08 }}
    >
      <div class="pdf-page-panel-header">
        <span class="pdf-page-panel-title">Index</span>
        <button class="pdf-page-panel-close" onclick={togglePagePanel}>✕</button
        >
      </div>
      <div class="pdf-page-panel-list">
        {#each pages as page, i}
          <button
            class="pdf-page-panel-item"
            class:active={currentPage === i + 1}
            onclick={() => {
              scrollToPage(i + 1);
            }}
          >
            {#if pageThumbUrls[i + 1]}
              <img
                src={pageThumbUrls[i + 1]}
                alt=""
                class="pdf-page-panel-thumb"
              />
            {:else}
              <div class="pdf-page-panel-placeholder"></div>
            {/if}
            <span class="pdf-page-panel-num">{i + 1}</span>
          </button>
        {/each}
      </div>
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
      <div class="pdf-page-wrapper" bind:this={pageWrapperRefs[i]}>
        <canvas
          bind:this={page.canvasRef}
          class="pdf-canvas"
          onclick={() => centerPage(i + 1)}
          ondblclick={toggleFullscreen}
        ></canvas>
        <button
          class="pdf-page-label"
          onclick={togglePagePanel}
          aria-label="Open page panel">{i + 1}</button
        >
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
        <div
          bind:this={page.textLayerRef}
          class="pdf-text-layer"
          aria-hidden="true"
          onclick={() => centerPage(i + 1)}
          ondblclick={toggleFullscreen}
        ></div>
        {#if i + 1 === currentPage}
          <DrawOverlay
            containerEl={currentPageWrapper}
            mediaEl={currentPageCanvas}
          />
        {/if}
      </div>
      {#if i < pages.length - 1}
        <div class="pdf-page-separator"></div>
      {/if}
    {/each}
  {/if}

  {#if textSelection}
    <div
      class="pdf-selection-pill"
      transition:fly={{ y: -6, duration: 150, opacity: 0.08 }}
      style="left: {textSelection.left}px; top: {textSelection.top}px;"
    >
      <button
        class="pdf-selection-copy tooltip-below"
        onclick={copySelection}
        onpointerdown={(e) => e.preventDefault()}
        data-tooltip={textSelection.copied ? "Text copied" : "Copy text"}
        aria-label={textSelection.copied ? "Text copied" : "Copy selected text"}
        class:copied={textSelection.copied}
      >
        {#if textSelection.copied}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m2.75 7.25 2.5 2.5 6-6"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        {:else}
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="4.25"
              y="3.25"
              width="7"
              height="8"
              rx="1"
              stroke="currentColor"
              stroke-width="1.2"
            />
            <path
              d="M9.25 3.25V2.75A1.25 1.25 0 0 0 8 1.5H4A1.25 1.25 0 0 0 2.75 2.75v6A1.25 1.25 0 0 0 4 10h.25"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        {/if}
      </button>
    </div>
  {/if}
</div>
