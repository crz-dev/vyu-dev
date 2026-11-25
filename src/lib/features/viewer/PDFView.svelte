<script lang="ts">
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import {
    type FindHighlight,
    type PdfLink,
    type PdfOutlineEntry,
    type PdfPage,
    type PdfPasswordPrompt as PdfPasswordPromptState,
    type PdfRedactionRect,
  } from "./pdf.svelte";
  import PdfPasswordPrompt from "./PdfPasswordPrompt.svelte";
  import PdfRedactOverlay from "./PdfRedactOverlay.svelte";
  import PdfSignaturePad from "./PdfSignaturePad.svelte";
  import { copyTextToClipboard } from "$lib/services/clipboard";
  import { showToast } from "$lib/components/toast.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";
  import {
    markup,
    getSignatureBounds,
    type DrawPoint,
  } from "$lib/features/markup/markup.svelte";
  import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
  import { menuStore } from "$lib/features/menus/menuVisibility.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  function tooltipLabel(label: string, keybindId: string): string {
    const key = keybindStore.label(keybindId);
    return key ? `${label} (${key})` : label;
  }

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
    goToPage,
    selectPage,
    openLink,
    fitWidth,
    autoFit,
    dualPage,
    nightMode,
    outline,
    panelTab,
    rotate,
    fitToWidth,
    fitToPage,
    toggleDualPage,
    toggleNightMode,
    setPanelTab,
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
    isFullscreen,
    fsControlsVisible,
    resetFsTimer,
    passwordPrompt,
    formDirty,
    redactActive,
    redactions,
    redactionConfirmOpen,
    signatureOpen,
    submitPassword,
    cancelPassword,
    addRedaction,
    removeRedaction,
    clearRedactions,
    cancelRedaction,
    setRedactionConfirmOpen,
    closeSignaturePad,
    onSaveForms,
    onDiscardForms,
    onApplyRedaction,
  }: {
    pdfContainerEl: HTMLElement | null;
    loading: boolean;
    error: string;
    pages: PdfPage[];
    scale: number;
    fitScale: number;
    zoomLocked: boolean;
    setScale: (s: number) => void;
    currentPage: number;
    pageCount: number;
    prevPage: () => void;
    nextPage: () => void;
    scrollToPage: (page: number) => void;
    goToPage: (page: number) => void;
    selectPage: (page: number) => void;
    openLink: (link: PdfLink) => void;
    fitWidth: boolean;
    autoFit: boolean;
    dualPage: boolean;
    nightMode: boolean;
    outline: PdfOutlineEntry[];
    panelTab: "pages" | "outline";
    rotate: () => void;
    fitToWidth: (containerWidth: number, containerHeight: number) => void;
    fitToPage: (containerWidth: number, containerHeight: number) => void;
    toggleDualPage: () => void;
    toggleNightMode: () => void;
    setPanelTab: (tab: "pages" | "outline") => void;
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
    togglePagePanel: (tab?: "pages" | "outline") => void;
    getPageThumbnail: (page: number) => Promise<string>;
    preloadAllThumbnails: () => Promise<void>;
    isFullscreen: boolean;
    fsControlsVisible: boolean;
    resetFsTimer: () => void;
    passwordPrompt: PdfPasswordPromptState;
    formDirty: boolean;
    redactActive: boolean;
    redactions: PdfRedactionRect[];
    redactionConfirmOpen: boolean;
    signatureOpen: boolean;
    submitPassword: (password: string) => void;
    cancelPassword: () => void;
    addRedaction: (
      pageNum: number,
      rect: { x: number; y: number; width: number; height: number },
    ) => void;
    removeRedaction: (id: number) => void;
    clearRedactions: () => void;
    cancelRedaction: () => void;
    setRedactionConfirmOpen: (open: boolean) => void;
    closeSignaturePad: () => void;
    onSaveForms: () => Promise<void>;
    onDiscardForms: () => void;
    onApplyRedaction: (
      clearMetadata: boolean,
      keepBackup: boolean,
    ) => Promise<void>;
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

  let pageEditing = $state(false);
  let pageInputValue = $state("");
  let pageInputEl: HTMLInputElement | null = $state(null);
  let panelPageEditing = $state(false);
  let panelPageValue = $state("");
  let panelPageInputEl: HTMLInputElement | null = $state(null);

  let pendingSignature = $state<DrawPoint[][] | null>(null);
  let signaturePointer = $state<{
    pageNum: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  let signatureDragging = false;
  let formBusy = $state(false);
  let redactionBusy = $state(false);
  let redactDrag = $state<{
    pageNum: number;
    left: DOMRect;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

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

  let activeOutlineIndex = $derived.by(() => {
    let index = -1;
    for (let i = 0; i < outline.length; i++) {
      if (outline[i].pageNum <= currentPage) index = i;
    }
    return index;
  });

  let signaturePreview = $derived.by(() => {
    const paths = pendingSignature;
    if (!paths) return null;
    const bounds = getSignatureBounds(paths);
    const pathsD = paths
      .filter((path) => path.length >= 2)
      .map((path) =>
        path
          .map((point, i) => {
            const x = ((point.x - bounds.minX) / bounds.width).toFixed(4);
            const y = ((point.y - bounds.minY) / bounds.height).toFixed(4);
            return `${i === 0 ? "M" : "L"}${x} ${y}`;
          })
          .join(" "),
      );
    return { bounds, pathsD };
  });

  let signaturePreviewBox = $derived.by(() => {
    const preview = signaturePreview;
    const pointer = signaturePointer;
    if (!preview || !pointer) return null;
    const ratio =
      (pointer.width / pointer.height) *
      (preview.bounds.height / preview.bounds.width);
    let width = 0.3;
    let height = width * ratio;
    if (height > 0.2) {
      width *= 0.2 / height;
      height = 0.2;
    }
    const left = Math.max(
      0.02,
      Math.min(1 - width - 0.02, pointer.x - width / 2),
    );
    const top = Math.max(
      0.02,
      Math.min(1 - height - 0.02, pointer.y - height / 2),
    );
    return {
      pageNum: pointer.pageNum,
      left,
      top,
      width,
      height,
    };
  });

  // Starting redaction cancels any pending signature placement.
  $effect(() => {
    if (redactActive) {
      pendingSignature = null;
      signaturePointer = null;
      signatureDragging = false;
    }
  });

  $effect(() => {
    if (!showPagePanel) panelPageEditing = false;
  });

  // Sync markup page when current page changes
  $effect(() => {
    if (currentPage > 0 && pageCount > 0) {
      markup.switchPage(currentPage);
    }
  });

  function focusFindInput(node: HTMLInputElement) {
    node.focus();
  }

  function containerSize() {
    return {
      width: pdfContainerEl?.clientWidth ?? 0,
      height: pdfContainerEl?.clientHeight ?? 0,
    };
  }

  function applyFitWidth() {
    const { width, height } = containerSize();
    fitToWidth(width, height);
  }

  function applyFitPage() {
    const { width, height } = containerSize();
    fitToPage(width, height);
  }

  function toggleFitWidthMode() {
    if (fitWidth && autoFit) applyFitPage();
    else applyFitWidth();
  }

  function beginPageEdit() {
    pageInputValue = String(currentPage);
    pageEditing = true;
    void tick().then(() => {
      pageInputEl?.focus();
      pageInputEl?.select();
    });
  }

  function commitPageEdit() {
    if (!pageEditing) return;
    pageEditing = false;
    const parsed = Number.parseInt(pageInputValue, 10);
    if (Number.isFinite(parsed)) goToPage(parsed);
  }

  function cancelPageEdit() {
    pageEditing = false;
  }

  function handlePageInputKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitPageEdit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelPageEdit();
    }
  }

  function beginPanelPageEdit() {
    panelPageValue = String(currentPage);
    panelPageEditing = true;
    void tick().then(() => {
      panelPageInputEl?.focus();
      panelPageInputEl?.select();
    });
  }

  function commitPanelPageEdit() {
    if (!panelPageEditing) return;
    panelPageEditing = false;
    const parsed = Number.parseInt(panelPageValue, 10);
    if (Number.isFinite(parsed)) goToPage(parsed);
  }

  function cancelPanelPageEdit() {
    panelPageEditing = false;
  }

  function handlePanelPageKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      commitPanelPageEdit();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      cancelPanelPageEdit();
    }
  }

  function acceptSignature(paths: DrawPoint[][]) {
    closeSignaturePad();
    markup.deactivateTools();
    pendingSignature = paths;
    const wrapper = currentPage > 0 ? pageWrapperRefs[currentPage - 1] : null;
    const rect = wrapper?.getBoundingClientRect();
    signaturePointer = rect
      ? {
          pageNum: currentPage,
          x: 0.65,
          y: 0.82,
          width: rect.width,
          height: rect.height,
        }
      : null;
  }

  function cancelSignaturePlacement() {
    pendingSignature = null;
    signaturePointer = null;
    signatureDragging = false;
  }

  function updateSignaturePointer(e: PointerEvent, pageNum: number) {
    if (!pendingSignature) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    signaturePointer = {
      pageNum,
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      width: rect.width,
      height: rect.height,
    };
  }

  function beginSignatureDrag(e: PointerEvent, pageNum: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    signatureDragging = true;
    updateSignaturePointer(e, pageNum);
  }

  function moveSignatureDrag(e: PointerEvent, pageNum: number) {
    if (!signatureDragging) return;
    updateSignaturePointer(e, pageNum);
  }

  function finishSignatureDrag(e: PointerEvent, pageNum: number) {
    if (!signatureDragging) return;
    signatureDragging = false;
    updateSignaturePointer(e, pageNum);
    const paths = pendingSignature;
    const pointer = signaturePointer;
    if (!paths || !pointer || pointer.pageNum !== pageNum) return;
    pendingSignature = null;
    signaturePointer = null;
    selectPage(pageNum);
    void tick().then(() => {
      markup.switchPage(pageNum);
      markup.insertSignature(
        paths,
        { x: pointer.x, y: pointer.y },
        { width: pointer.width, height: pointer.height },
      );
    });
  }

  async function saveFormChanges() {
    if (formBusy) return;
    formBusy = true;
    try {
      await onSaveForms();
    } finally {
      formBusy = false;
    }
  }

  function discardFormChanges() {
    if (formBusy) return;
    onDiscardForms();
  }

  function cancelRedactMode() {
    redactDrag = null;
    cancelRedaction();
  }

  function beginRedactDrag(e: PointerEvent, pageNum: number) {
    if (e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget as HTMLElement;
    el.setPointerCapture(e.pointerId);
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    redactDrag = {
      pageNum,
      left: rect,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    };
  }

  function moveRedactDrag(e: PointerEvent) {
    if (!redactDrag) return;
    const rect = redactDrag.left;
    redactDrag = {
      ...redactDrag,
      currentX: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      currentY: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function endRedactDrag() {
    const drag = redactDrag;
    redactDrag = null;
    if (!drag) return;
    addRedaction(drag.pageNum, {
      x: Math.min(drag.startX, drag.currentX),
      y: Math.min(drag.startY, drag.currentY),
      width: Math.abs(drag.currentX - drag.startX),
      height: Math.abs(drag.currentY - drag.startY),
    });
  }

  async function applyRedactions(clearMetadata: boolean, keepBackup: boolean) {
    if (redactionBusy) return;
    redactionBusy = true;
    try {
      await onApplyRedaction(clearMetadata, keepBackup);
    } finally {
      redactionBusy = false;
    }
  }

  function redactionPreview(pageNum: number) {
    if (!redactDrag || redactDrag.pageNum !== pageNum) return null;
    return {
      x: Math.min(redactDrag.startX, redactDrag.currentX),
      y: Math.min(redactDrag.startY, redactDrag.currentY),
      width: Math.abs(redactDrag.currentX - redactDrag.startX),
      height: Math.abs(redactDrag.currentY - redactDrag.startY),
    };
  }

  function pageRedactions(pageNum: number): PdfRedactionRect[] {
    return redactions.filter((rect) => rect.pageNum === pageNum);
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
      showToast({
        message: t("shell.viewer.pdf.copySelectedFailed"),
        color: "red",
      });
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
    if (keybindStore.isRecording || keybindStore.cheatSheetOpen) return;
    if (menuStore.isAnyOpen) return;
    if (
      signatureOpen ||
      pendingSignature ||
      passwordPrompt.visible ||
      redactActive
    )
      return;

    if (keybindStore.matches("pdf-previous-page", e)) {
      e.preventDefault();
      e.stopPropagation();
      prevPage();
      return;
    }
    if (keybindStore.matches("pdf-next-page", e)) {
      e.preventDefault();
      e.stopPropagation();
      nextPage();
      return;
    }
    if (keybindStore.matches("pdf-fit-width", e)) {
      e.preventDefault();
      e.stopPropagation();
      toggleFitWidthMode();
      return;
    }
    if (keybindStore.matches("pdf-dual-page", e)) {
      e.preventDefault();
      e.stopPropagation();
      toggleDualPage();
      return;
    }
    if (keybindStore.matches("pdf-rotate", e)) {
      e.preventDefault();
      e.stopPropagation();
      rotate();
      return;
    }
    if (keybindStore.matches("pdf-night", e)) {
      e.preventDefault();
      e.stopPropagation();
      toggleNightMode();
    }
  }

  $effect(() => {
    document.addEventListener("keydown", onPdfKeydown);
    return () => document.removeEventListener("keydown", onPdfKeydown);
  });

  let pageThumbUrls: Record<number, string> = $state({});

  $effect(() => {
    if (!showPagePanel || panelTab !== "pages") {
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
  class:night={nightMode}
  class:dual-page={dualPage}
  class:fit-width={fitWidth && autoFit}
  class:chrome-idle={isFullscreen && !fsControlsVisible}
  class:redacting={redactActive}
  class:sig-placing={!!pendingSignature}
  bind:this={pdfContainerEl}
  role="presentation"
  onwheel={handlePdfWheel}
  onscroll={isFullscreen ? resetFsTimer : undefined}
  onclick={isFullscreen ? resetFsTimer : undefined}
>
  <PdfPasswordPrompt
    open={passwordPrompt.visible}
    incorrect={passwordPrompt.incorrect}
    onSubmit={submitPassword}
    onCancel={cancelPassword}
  />
  <PdfSignaturePad
    open={signatureOpen}
    onApply={acceptSignature}
    onCancel={closeSignaturePad}
  />
  {#if pendingSignature}
    <div
      class="pdf-sign-hint"
      transition:fly={{ y: 10, duration: 160, opacity: 0.08 }}
    >
      <span>{t("shell.viewer.pdf.signPlaceHint")}</span>
      <button
        type="button"
        class="pdf-redact-btn"
        onclick={cancelSignaturePlacement}
      >
        {t("common.cancel")}
      </button>
    </div>
  {/if}
  {#if redactActive}
    <PdfRedactOverlay
      count={redactions.length}
      busy={redactionBusy}
      confirmOpen={redactionConfirmOpen}
      hideBar={menuStore.markupMenuVisible}
      onApply={applyRedactions}
      onCancel={cancelRedactMode}
      onClear={clearRedactions}
      onConfirmOpenChange={setRedactionConfirmOpen}
    />
  {/if}
  {#if findOpen}
    <div
      class="pdf-find-bar"
      transition:fly={{ y: -20, duration: 180, opacity: 0.08 }}
    >
      <input
        type="text"
        placeholder={t("shell.viewer.pdf.findPlaceholder")}
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
            : t("shell.viewer.pdf.noResults")}</span
        >
      {/if}
      <button
        class="pdf-find-btn"
        onclick={findPrev}
        disabled={findResults === 0}
        aria-label={t("shell.viewer.pdf.previousMatch")}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M18 15l-6-6-6 6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="pdf-find-btn"
        onclick={findNext}
        disabled={findResults === 0}
        aria-label={t("shell.viewer.pdf.nextMatch")}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <button
        class="pdf-find-close"
        onclick={toggleFind}
        aria-label={t("shell.viewer.pdf.closeFind")}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M1 1l8 8M9 1l-8 8"
            stroke="currentColor"
            stroke-width="1.2"
            stroke-linecap="round"
          />
        </svg>
      </button>
    </div>
  {/if}

  {#if !loading && !error && pageCount > 0}
    <div class="pdf-view-controls">
      {#if isFullscreen}
        {#if pageEditing}
          <input
            bind:this={pageInputEl}
            class="pdf-page-chip-input"
            style="width: calc({Math.max(1, pageInputValue.length)}ch + 16px)"
            bind:value={pageInputValue}
            inputmode="numeric"
            aria-label={t("shell.viewer.pdf.goToPage")}
            onkeydown={handlePageInputKeydown}
            onblur={commitPageEdit}
          />
        {:else}
          <button
            class="pdf-page-chip-btn tooltip-below"
            data-tooltip={t("shell.viewer.pdf.goToPage")}
            onclick={beginPageEdit}
            aria-label={t("shell.viewer.pdf.pageOf", {
              current: currentPage,
              total: pageCount,
            })}
          >
            {currentPage} / {pageCount}
          </button>
        {/if}
      {/if}
      {#if formDirty && !redactActive}
        <div class="pdf-form-actions">
          <button
            class="pdf-form-btn primary tooltip-below"
            data-tooltip={t("shell.viewer.pdf.formSave")}
            aria-label={t("shell.viewer.pdf.formSave")}
            onclick={saveFormChanges}
            disabled={formBusy}
          >
            <svg width="11" height="11" viewBox="0 0 10 10" fill="none">
              <path
                d="m2 5 2 2 4-4"
                stroke="currentColor"
                stroke-width="1.4"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            class="pdf-form-btn tooltip-below"
            data-tooltip={t("shell.viewer.pdf.formDiscard")}
            aria-label={t("shell.viewer.pdf.formDiscard")}
            onclick={discardFormChanges}
            disabled={formBusy}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path
                d="M1 1l8 8M9 1l-8 8"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      {/if}
    </div>
  {/if}

  {#if showPagePanel}
    <div
      class="pdf-page-panel"
      transition:fly={{ x: -20, duration: 180, opacity: 0.08 }}
    >
      <div class="pdf-page-panel-header">
        <div class="pdf-page-panel-tabs">
          <span class="pdf-page-panel-title">{t("shell.viewer.pdf.index")}</span
          >
          {#if outline.length > 0}
            <button
              class="pdf-page-panel-tab"
              class:active={panelTab === "outline"}
              aria-pressed={panelTab === "outline"}
              onclick={() =>
                setPanelTab(panelTab === "outline" ? "pages" : "outline")}
            >
              {t("shell.viewer.pdf.outline")}
            </button>
          {/if}
        </div>
        <button
          class="pdf-page-panel-close"
          onclick={() => togglePagePanel()}
          aria-label={t("shell.viewer.pdf.closeIndex")}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M1 1l8 8M9 1l-8 8"
              stroke="currentColor"
              stroke-width="1.2"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
      <div class="pdf-index-page">
        {#if panelPageEditing}
          <input
            bind:this={panelPageInputEl}
            class="pdf-page-chip-input"
            style="width: calc({Math.max(1, panelPageValue.length)}ch + 16px)"
            bind:value={panelPageValue}
            inputmode="numeric"
            aria-label={t("shell.viewer.pdf.goToPage")}
            onkeydown={handlePanelPageKeydown}
            onblur={commitPanelPageEdit}
          />
          <span class="pdf-page-total">/ {pageCount}</span>
        {:else}
          <button
            class="pdf-index-page-btn tooltip-below"
            data-tooltip={t("shell.viewer.pdf.goToPage")}
            aria-label={t("shell.viewer.pdf.pageOf", {
              current: currentPage,
              total: pageCount,
            })}
            onclick={beginPanelPageEdit}
          >
            {currentPage} / {pageCount}
          </button>
        {/if}
      </div>
      <div class="pdf-panel-actions">
        <button
          class="pdf-panel-action tooltip-below-start"
          data-tooltip={tooltipLabel(
            `${t("shell.viewer.pdf.rotate")} 90°`,
            "pdf-rotate",
          )}
          aria-label={t("shell.viewer.pdf.rotate")}
          onclick={rotate}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-below-start"
          class:active={autoFit && fitWidth}
          aria-pressed={autoFit && fitWidth}
          data-tooltip={tooltipLabel(
            t("shell.viewer.pdf.fitWidth"),
            "pdf-fit-width",
          )}
          aria-label={t("shell.viewer.pdf.fitWidth")}
          onclick={toggleFitWidthMode}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="5"
              width="18"
              height="14"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M7 12h10M9 9.5 6.5 12 9 14.5M15 9.5 17.5 12 15 14.5"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-below-start"
          class:active={dualPage}
          aria-pressed={dualPage}
          data-tooltip={tooltipLabel(
            t("shell.viewer.pdf.dualPage"),
            "pdf-dual-page",
          )}
          aria-label={t("shell.viewer.pdf.dualPage")}
          onclick={toggleDualPage}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="3"
              y="4"
              width="8"
              height="16"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <rect
              x="13"
              y="4"
              width="8"
              height="16"
              rx="1.2"
              stroke="currentColor"
              stroke-width="1.5"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-below-start"
          class:active={nightMode}
          aria-pressed={nightMode}
          data-tooltip={tooltipLabel(
            t("shell.viewer.pdf.nightMode"),
            "pdf-night",
          )}
          aria-label={t("shell.viewer.pdf.nightMode")}
          onclick={toggleNightMode}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M20 14.5A8.5 8.5 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      {#if panelTab === "pages"}
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
      {:else}
        <div class="pdf-page-panel-list">
          {#if outline.length === 0}
            <div class="pdf-page-panel-empty">
              {t("shell.viewer.pdf.noOutline")}
            </div>
          {:else}
            {#each outline as entry, i (i)}
              <button
                class="pdf-outline-item"
                class:active={activeOutlineIndex === i}
                style="padding-left: {8 + entry.depth * 12}px;"
                onclick={() => scrollToPage(entry.pageNum)}
                title={entry.title}
              >
                <span class="pdf-outline-title">{entry.title}</span>
                <span class="pdf-outline-page">{entry.pageNum}</span>
              </button>
            {/each}
          {/if}
        </div>
      {/if}
    </div>
  {/if}

  {#if loading}
    <div class="pdf-loading">
      <div class="pdf-spinner"></div>
      <span>{t("shell.viewer.pdf.loading")}</span>
    </div>
  {:else if error}
    <div class="pdf-error">{error}</div>
  {:else}
    {#each pages as page, i (page.pageNum)}
      {@const pageNum = page.pageNum}
      <div
        class="pdf-page-wrapper"
        class:right-page={dualPage && pageNum % 2 === 0}
        bind:this={pageWrapperRefs[pageNum - 1]}
      >
        <canvas
          bind:this={page.canvasRef}
          class="pdf-canvas"
          onclick={() => selectPage(pageNum)}
        ></canvas>
        <button
          class="pdf-page-label tooltip-ctrl"
          onclick={() => togglePagePanel("pages")}
          data-tooltip={showPagePanel && panelTab === "pages"
            ? t("shell.viewer.pdf.closeIndex")
            : t("shell.viewer.pdf.openIndex")}
          aria-label={showPagePanel && panelTab === "pages"
            ? t("shell.viewer.pdf.closeIndex")
            : t("shell.viewer.pdf.openIndex")}>{pageNum}</button
        >
        {#if findQuery && findResults > 0}
          {@const hl = getHighlightsForPage(pageNum)}
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
        {#if page.links.length > 0}
          <div class="pdf-link-layer">
            {#each page.links as link, linkIndex (linkIndex)}
              <button
                class="pdf-link"
                tabindex="-1"
                style="left: {link.left}px; top: {link.top}px; width: {link.width}px; height: {link.height}px;"
                onclick={(e) => {
                  e.stopPropagation();
                  openLink(link);
                }}
                aria-label={t("shell.viewer.pdf.internalLink")}
              ></button>
            {/each}
          </div>
        {/if}
        <div
          bind:this={page.textLayerRef}
          class="pdf-text-layer"
          aria-hidden="true"
          onclick={() => selectPage(pageNum)}
        ></div>
        <div bind:this={page.annotationsRef} class="pdf-annotation-layer"></div>
        {#if pageNum === currentPage}
          <DrawOverlay
            containerEl={currentPageWrapper}
            mediaEl={currentPageCanvas}
          />
        {/if}
        {#if redactActive}
          {@const preview = redactionPreview(pageNum)}
          <div
            class="pdf-redact-capture"
            role="presentation"
            onpointerdown={(e) => beginRedactDrag(e, pageNum)}
            onpointermove={moveRedactDrag}
            onpointerup={endRedactDrag}
            onpointercancel={endRedactDrag}
          ></div>
          {#each pageRedactions(pageNum) as rect (rect.id)}
            <button
              class="pdf-redact-rect"
              style="left: {rect.x * 100}%; top: {rect.y *
                100}%; width: {rect.width * 100}%; height: {rect.height *
                100}%;"
              onclick={(e) => {
                e.stopPropagation();
                removeRedaction(rect.id);
              }}
              aria-label={t("shell.viewer.pdf.redactRemove")}
            ></button>
          {/each}
          {#if preview}
            <div
              class="pdf-redact-preview"
              style="left: {preview.x * 100}%; top: {preview.y *
                100}%; width: {preview.width * 100}%; height: {preview.height *
                100}%;"
            ></div>
          {/if}
        {/if}
        {#if pendingSignature && signaturePreview}
          <div
            class="pdf-sign-placement"
            role="presentation"
            onpointermove={(e) => updateSignaturePointer(e, pageNum)}
            onpointerdown={(e) => beginSignatureDrag(e, pageNum)}
            onpointerup={(e) => finishSignatureDrag(e, pageNum)}
            onpointercancel={() => (signatureDragging = false)}
          >
            {#if signaturePreviewBox && signaturePreviewBox.pageNum === pageNum}
              <svg
                class="pdf-sign-preview"
                style="left: {signaturePreviewBox.left *
                  100}%; top: {signaturePreviewBox.top *
                  100}%; width: {signaturePreviewBox.width *
                  100}%; height: {signaturePreviewBox.height * 100}%;"
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {#each signaturePreview.pathsD as d}
                  <path
                    {d}
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    vector-effect="non-scaling-stroke"
                  />
                {/each}
              </svg>
            {/if}
          </div>
        {/if}
      </div>
      {#if !dualPage && i < pages.length - 1}
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
        data-tooltip={textSelection.copied
          ? t("shell.viewer.pdf.textCopied")
          : t("shell.viewer.pdf.copyText")}
        aria-label={textSelection.copied
          ? t("shell.viewer.pdf.textCopied")
          : t("shell.viewer.pdf.copySelected")}
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
