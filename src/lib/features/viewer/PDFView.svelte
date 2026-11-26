<script lang="ts">
  import { onDestroy, tick } from "svelte";
  import { fly, slide } from "svelte/transition";
  import {
    type FindHighlight,
    type PdfBookmark,
    type PdfLink,
    type PdfOutlineEntry,
    type PdfPage,
    type PdfPasswordPrompt as PdfPasswordPromptState,
    type PdfRedactionRect,
    PDF_BOOKMARK_COLORS,
  } from "./pdf.svelte";
  import PdfPasswordPrompt from "./PdfPasswordPrompt.svelte";
  import PdfSearchMenu from "./PdfSearchMenu.svelte";
  import PdfRedactOverlay from "./PdfRedactOverlay.svelte";
  import PdfSignaturePad from "./PdfSignaturePad.svelte";
  import { copyTextToClipboard } from "$lib/services/clipboard";
  import { showToast } from "$lib/components/toast.svelte";
  import { invokePrintFile } from "$lib/features/media/api";
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
    filePath,
    loading,
    error,
    pages,
    scale,
    fitScale,
    zoomLocked,
    setScale,
    currentPage,
    pageCount,
    resumePage,
    getPageText,
    prevPage,
    nextPage,
    scrollToPage,
    goToPage,
    selectPage,
    openLink,
    fitWidth,
    autoFit,
    dualPage,
    singlePage,
    nightMode,
    bookmarks,
    onAddBookmark,
    onUpdateBookmark,
    onRemoveBookmark,
    toggleSinglePage,
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
    encrypted,
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
    startRedaction,
    cancelRedaction,
    setRedactionConfirmOpen,
    openSignaturePad,
    closeSignaturePad,
    onSaveForms,
    onDiscardForms,
    onApplyRedaction,
  }: {
    pdfContainerEl: HTMLElement | null;
    filePath: string;
    loading: boolean;
    error: string;
    pages: PdfPage[];
    scale: number;
    fitScale: number;
    zoomLocked: boolean;
    setScale: (s: number) => void;
    currentPage: number;
    pageCount: number;
    resumePage: number | null;
    getPageText: (pageNum: number) => Promise<string>;
    prevPage: () => void;
    nextPage: () => void;
    scrollToPage: (page: number) => void;
    goToPage: (page: number) => void;
    selectPage: (page: number) => void;
    openLink: (link: PdfLink) => void;
    fitWidth: boolean;
    autoFit: boolean;
    dualPage: boolean;
    singlePage: boolean;
    nightMode: boolean;
    bookmarks: PdfBookmark[];
    onAddBookmark: (page: number) => PdfBookmark | null;
    onUpdateBookmark: (
      page: number,
      patch: Partial<Pick<PdfBookmark, "color" | "title">>,
    ) => void;
    onRemoveBookmark: (page: number) => void;
    toggleSinglePage: () => void;
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
    encrypted: boolean;
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
    startRedaction: () => void;
    cancelRedaction: () => void;
    setRedactionConfirmOpen: (open: boolean) => void;
    openSignaturePad: () => void;
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
  let lastSinglePageWheel = 0;
  let pendingWheel: {
    clientX: number;
    clientY: number;
    deltaY: number;
    currentTarget: HTMLElement;
  } | null = null;

  let pageEditing = $state(false);
  let pageInputValue = $state("");
  let pageInputEl: HTMLInputElement | null = $state(null);
  let readAloudActive = $state(false);
  let readAloudPage = $state(0);
  let readingRuler = $state(false);
  let rulerTop = $state(0);
  let rulerLeft = $state(0);
  let rulerWidth = $state(0);
  let rulerViewerTop = $state(0);
  let rulerViewerBottom = $state(0);
  const READING_RULER_HEIGHT = 96;
  const AUTO_SCROLL_MIN = 10;
  const AUTO_SCROLL_MAX = 140;
  let autoScrollOpen = $state(false);
  let autoScrollPlaying = $state(false);
  let autoScrollSpeed = $state(40);
  let autoScrollRaf = 0;
  let autoScrollLast = 0;
  let speedDragging = false;
  let speedTrackEl: HTMLDivElement | null = $state(null);
  const autoScrollPct = $derived(
    ((autoScrollSpeed - AUTO_SCROLL_MIN) /
      (AUTO_SCROLL_MAX - AUTO_SCROLL_MIN)) *
      100,
  );
  let editingBookmarkPage = $state<number | null>(null);
  let bookmarkTitleDraft = $state("");

  function bookmarkForPage(pageNum: number): PdfBookmark | null {
    return bookmarks.find((bookmark) => bookmark.page === pageNum) ?? null;
  }

  function openBookmarkEditor(pageNum: number) {
    autoScrollOpen = false;
    stopAutoScroll();
    let bookmark = bookmarkForPage(pageNum);
    if (!bookmark) bookmark = onAddBookmark(pageNum);
    if (!bookmark) return;
    bookmarkTitleDraft = bookmark.title;
    editingBookmarkPage = pageNum;
  }

  function updateBookmarkTitle(value: string) {
    bookmarkTitleDraft = value;
  }

  function commitBookmarkTitle() {
    if (editingBookmarkPage === null) return;
    onUpdateBookmark(editingBookmarkPage, { title: bookmarkTitleDraft });
  }

  function handleBookmarkAction() {
    const existing = bookmarkForPage(currentPage);
    if (!existing) {
      onAddBookmark(currentPage);
      return;
    }
    toggleBookmarkEditor(currentPage);
  }

  function toggleBookmarkEditor(pageNum: number) {
    if (editingBookmarkPage === pageNum) {
      editingBookmarkPage = null;
      return;
    }
    openBookmarkEditor(pageNum);
  }

  function handleThumbnailContext(e: MouseEvent, pageNum: number) {
    e.preventDefault();
    e.stopPropagation();
    if (!bookmarkForPage(pageNum)) onAddBookmark(pageNum);
  }

  function handlePageLabelContext(e: MouseEvent, pageNum: number) {
    if (!bookmarkForPage(pageNum)) return;
    e.preventDefault();
    e.stopPropagation();
    onRemoveBookmark(pageNum);
    if (editingBookmarkPage === pageNum) editingBookmarkPage = null;
  }

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
    if (!showPagePanel) editingBookmarkPage = null;
  });

  // Sync markup page when current page changes
  $effect(() => {
    if (currentPage > 0 && pageCount > 0) {
      markup.switchPage(currentPage);
    }
  });

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

  function stopReadAloud() {
    readAloudActive = false;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  async function printDocument() {
    if (!filePath) return;
    try {
      await invokePrintFile(filePath);
      showToast({
        message: t("dialogs.dialog.toast.printOpened"),
        color: "green",
      });
    } catch (err) {
      console.error("Failed to open print dialog:", err);
      showToast({
        message:
          typeof err === "string" ? err : t("dialogs.dialog.share.printer"),
        color: "red",
      });
    }
  }

  function positionReadingRuler(clientY: number) {
    const el = pdfContainerEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const height = READING_RULER_HEIGHT;
    rulerTop = Math.min(
      rect.bottom - height - 4,
      Math.max(rect.top + 4, clientY - height / 2),
    );
    rulerLeft = rect.left;
    rulerWidth = rect.width;
    rulerViewerTop = rect.top;
    rulerViewerBottom = rect.bottom;
  }

  function toggleReadingRuler() {
    readingRuler = !readingRuler;
    if (readingRuler) {
      const el = pdfContainerEl;
      if (el) {
        const rect = el.getBoundingClientRect();
        positionReadingRuler(rect.top + rect.height / 2);
      }
    }
  }

  function handleReadingRulerMove(e: PointerEvent) {
    if (readingRuler) positionReadingRuler(e.clientY);
  }

  function stopAutoScroll() {
    autoScrollPlaying = false;
    autoScrollLast = 0;
    if (pdfContainerEl) pdfContainerEl.style.scrollBehavior = "";
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = 0;
    }
  }

  function autoScrollTick(timestamp: number) {
    autoScrollRaf = 0;
    if (!autoScrollPlaying) return;
    const el = pdfContainerEl;
    if (!el) {
      stopAutoScroll();
      return;
    }
    if (!autoScrollLast) autoScrollLast = timestamp;
    const dt = Math.min(64, timestamp - autoScrollLast);
    autoScrollLast = timestamp;
    el.scrollTop += (autoScrollSpeed * dt) / 1000;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
    if (atBottom) {
      if (singlePage && currentPage < pageCount) {
        nextPage();
      } else {
        stopAutoScroll();
        return;
      }
    }
    autoScrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function setAutoScrollPlaying(value: boolean) {
    if (value === autoScrollPlaying) return;
    if (!value) {
      stopAutoScroll();
      return;
    }
    autoScrollPlaying = true;
    autoScrollLast = 0;
    if (pdfContainerEl) pdfContainerEl.style.scrollBehavior = "auto";
    autoScrollRaf = requestAnimationFrame(autoScrollTick);
  }

  function toggleAutoScrollMenu() {
    autoScrollOpen = !autoScrollOpen;
    if (autoScrollOpen) {
      editingBookmarkPage = null;
    } else {
      stopAutoScroll();
    }
  }

  function updateAutoScrollSpeed(e: PointerEvent) {
    const el = speedTrackEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    autoScrollSpeed =
      AUTO_SCROLL_MIN + pct * (AUTO_SCROLL_MAX - AUTO_SCROLL_MIN);
  }

  async function speakFromPage(page: number) {
    if (!readAloudActive || readAloudPage !== page) return;
    const text = await getPageText(page);
    if (!readAloudActive || readAloudPage !== page) return;
    if (!text) {
      const next = page + 1;
      if (next > pageCount) {
        readAloudActive = false;
        return;
      }
      readAloudPage = next;
      goToPage(next);
      void speakFromPage(next);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => {
      if (readAloudPage !== page || !readAloudActive) return;
      const next = page + 1;
      if (next > pageCount) {
        readAloudActive = false;
        return;
      }
      readAloudPage = next;
      goToPage(next);
      void speakFromPage(next);
    };
    utterance.onerror = () => {
      if (readAloudPage === page) readAloudActive = false;
    };
    window.speechSynthesis.speak(utterance);
  }

  async function toggleReadAloud() {
    if (readAloudActive) {
      stopReadAloud();
      return;
    }
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      showToast({
        message: t("shell.viewer.pdf.readAloudUnavailable"),
        color: "red",
      });
      return;
    }
    const page = currentPage;
    const text = await getPageText(page);
    if (!text) {
      showToast({
        message: t("shell.viewer.pdf.noTextToRead"),
        color: "grey",
      });
      return;
    }
    stopReadAloud();
    readAloudPage = page;
    readAloudActive = true;
    goToPage(page);
    void speakFromPage(page);
  }

  $effect(() => {
    if (loading || error) {
      stopReadAloud();
      stopAutoScroll();
    }
  });

  onDestroy(() => {
    stopReadAloud();
    stopAutoScroll();
  });

  function openSignature() {
    if (encrypted) {
      showToast({
        message: t("shell.viewer.pdf.passwordRequired"),
        color: "red",
      });
      return;
    }
    if (redactActive) cancelRedactMode();
    markup.deactivateTools();
    openSignaturePad();
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

  function startRedact() {
    if (encrypted) {
      showToast({
        message: t("shell.viewer.pdf.passwordRequired"),
        color: "red",
      });
      return;
    }
    if (redactActive) {
      cancelRedactMode();
      return;
    }
    pendingSignature = null;
    redactDrag = null;
    markup.deactivateTools();
    startRedaction();
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
    if (singlePage && !e.ctrlKey) {
      const el = pdfContainerEl;
      if (!el || Math.abs(e.deltaY) < 4) return;
      const atTop = el.scrollTop <= 1;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 2;
      const goingDown = e.deltaY > 0;
      if ((goingDown && !atBottom) || (!goingDown && !atTop)) return;
      const now = Date.now();
      if (now - lastSinglePageWheel < 220) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      lastSinglePageWheel = now;
      if (goingDown) nextPage();
      else prevPage();
      return;
    }
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
  onpointermove={handleReadingRulerMove}
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
  {#if readingRuler}
    <div
      class="pdf-ruler-shade"
      style:top="{rulerViewerTop}px"
      style:left="{rulerLeft}px"
      style:width="{rulerWidth}px"
      style:height="{Math.max(0, rulerTop - rulerViewerTop)}px"
      aria-hidden="true"
    ></div>
    <div
      class="pdf-ruler-shade"
      style:top="{rulerTop + READING_RULER_HEIGHT}px"
      style:left="{rulerLeft}px"
      style:width="{rulerWidth}px"
      style:height="{Math.max(
        0,
        rulerViewerBottom - (rulerTop + READING_RULER_HEIGHT),
      )}px"
      aria-hidden="true"
    ></div>
  {/if}
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
  <PdfSearchMenu
    visible={findOpen}
    query={findQuery}
    results={findResults}
    current={findCurrentIdx}
    onSearch={findText}
    onNext={findNext}
    onPrev={findPrev}
    onClose={toggleFind}
  />

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
        <span class="pdf-page-panel-title">{t("shell.viewer.pdf.index")}</span>
        <div class="pdf-page-panel-head-actions">
          {#if outline.length > 0}
            <button
              class="pdf-panel-head-btn tooltip-below"
              class:active={panelTab === "outline"}
              aria-pressed={panelTab === "outline"}
              data-tooltip={t("shell.viewer.pdf.outline")}
              aria-label={t("shell.viewer.pdf.outline")}
              onclick={() =>
                setPanelTab(panelTab === "outline" ? "pages" : "outline")}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M4 6h16M8 11h12M12 16h8"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          {/if}
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
      </div>
      <div class="pdf-panel-actions">
        <button
          class="pdf-panel-action tooltip-below-start"
          class:active={autoScrollOpen || autoScrollPlaying}
          aria-pressed={autoScrollOpen}
          data-tooltip={t("shell.viewer.pdf.autoScroll")}
          aria-label={t("shell.viewer.pdf.autoScroll")}
          onclick={toggleAutoScrollMenu}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="5"
              y="3"
              width="14"
              height="18"
              rx="2"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <path
              d="M12 8v8M9 13l3 3 3-3"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-below-start"
          class:active={!!bookmarkForPage(currentPage)}
          aria-pressed={!!bookmarkForPage(currentPage)}
          style:color={bookmarkForPage(currentPage)?.color}
          data-tooltip={bookmarkForPage(currentPage)
            ? t("shell.viewer.pdf.editBookmark")
            : t("shell.viewer.pdf.bookmarkPage")}
          aria-label={bookmarkForPage(currentPage)
            ? t("shell.viewer.pdf.editBookmark")
            : t("shell.viewer.pdf.bookmarkPage")}
          onclick={handleBookmarkAction}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 3h12v18l-6-4-6 4V3z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-below"
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
            <rect
              x="3"
              y="8"
              width="16"
              height="10"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <path
              d="M15 4h5v5M20 4l-6 6"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-below"
          data-tooltip={t("dialogs.dialog.share.printer")}
          aria-label={t("dialogs.dialog.share.printer")}
          onclick={printDocument}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <polyline
              points="6 9 6 2 18 2 18 9"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M6 12H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <rect
              x="6"
              y="14"
              width="12"
              height="8"
              rx="1"
              stroke="currentColor"
              stroke-width="1.8"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-below"
          data-tooltip={t("shell.viewer.pdf.sign")}
          aria-label={t("shell.viewer.pdf.sign")}
          onclick={openSignature}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
          </svg>
        </button>
        <button
          class="pdf-panel-action danger tooltip-below"
          class:active={redactActive}
          aria-pressed={redactActive}
          data-tooltip={t("shell.viewer.pdf.redact")}
          aria-label={t("shell.viewer.pdf.redact")}
          onclick={startRedact}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.6"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M3 3l18 18" />
            <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
            <path
              d="M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.2 3.2"
            />
            <path
              d="M6.6 6.6A18.2 18.2 0 0 0 2 12s3 8 10 8a9.7 9.7 0 0 0 4.4-1"
            />
          </svg>
        </button>
      </div>
      {#if autoScrollOpen}
        <div class="pdf-autoscroll-menu" transition:slide={{ duration: 160 }}>
          <div class="pdf-autoscroll-head">
            <span class="pdf-autoscroll-title"
              >{t("shell.viewer.pdf.autoScroll")}</span
            >
            <span class="pdf-autoscroll-speed"
              >{Math.round(autoScrollSpeed)}</span
            >
          </div>
          <div class="pdf-autoscroll-slider-row">
            <button
              class="pdf-autoscroll-step"
              onclick={() =>
                (autoScrollSpeed = Math.max(
                  AUTO_SCROLL_MIN,
                  autoScrollSpeed - 5,
                ))}>−</button
            >
            <div
              class="color-slider-track"
              bind:this={speedTrackEl}
              role="slider"
              tabindex="0"
              aria-label={t("shell.viewer.pdf.autoScrollSpeed")}
              aria-valuemin={AUTO_SCROLL_MIN}
              aria-valuemax={AUTO_SCROLL_MAX}
              aria-valuenow={Math.round(autoScrollSpeed)}
              onpointerdown={(e) => {
                e.preventDefault();
                speedDragging = true;
                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                updateAutoScrollSpeed(e);
              }}
              onpointermove={(e) => {
                if (speedDragging) updateAutoScrollSpeed(e);
              }}
              onpointerup={(e) => {
                speedDragging = false;
                (e.currentTarget as HTMLElement).releasePointerCapture(
                  e.pointerId,
                );
              }}
              onpointercancel={() => (speedDragging = false)}
              onkeydown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                  e.preventDefault();
                  const delta = e.key === "ArrowLeft" ? -5 : 5;
                  autoScrollSpeed = Math.max(
                    AUTO_SCROLL_MIN,
                    Math.min(AUTO_SCROLL_MAX, autoScrollSpeed + delta),
                  );
                }
              }}
            >
              <div
                class="color-slider-fill"
                style:width="{autoScrollPct}%"
              ></div>
              <div
                class="color-slider-scrubber"
                style:left="{autoScrollPct}%"
              ></div>
            </div>
            <button
              class="pdf-autoscroll-step"
              onclick={() =>
                (autoScrollSpeed = Math.min(
                  AUTO_SCROLL_MAX,
                  autoScrollSpeed + 5,
                ))}>+</button
            >
          </div>
          <button
            class="pdf-autoscroll-primary"
            class:playing={autoScrollPlaying}
            aria-label={autoScrollPlaying
              ? t("media.playback.pause")
              : t("media.playback.play")}
            onclick={() => setAutoScrollPlaying(!autoScrollPlaying)}
          >
            {#if autoScrollPlaying}
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <rect
                  x="2.5"
                  y="2.5"
                  width="7"
                  height="7"
                  rx="1"
                  fill="currentColor"
                />
              </svg>
              <span>{t("media.playback.pause")}</span>
            {:else}
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden="true"
              >
                <path d="M3 2.2v7.6L9.5 6 3 2.2Z" fill="currentColor" />
              </svg>
              <span>{t("media.playback.play")}</span>
            {/if}
          </button>
        </div>
      {/if}
      {#if editingBookmarkPage !== null}
        {@const editingBookmark = bookmarkForPage(editingBookmarkPage)}
        <div class="pdf-bookmark-editor" transition:slide={{ duration: 160 }}>
          <div class="pdf-bookmark-editor-head">
            <input
              class="pdf-bookmark-title-input"
              placeholder={t("shell.viewer.pdf.bookmarkTitle")}
              aria-label={t("shell.viewer.pdf.bookmarkTitle")}
              value={bookmarkTitleDraft}
              oninput={(e) => updateBookmarkTitle(e.currentTarget.value)}
              onblur={commitBookmarkTitle}
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitBookmarkTitle();
                }
              }}
            />
            <button
              class="pdf-bookmark-remove"
              aria-label={t("shell.viewer.pdf.removeBookmark")}
              title={t("shell.viewer.pdf.removeBookmark")}
              onclick={() => {
                if (editingBookmarkPage !== null) {
                  onRemoveBookmark(editingBookmarkPage);
                  editingBookmarkPage = null;
                }
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M3 6h18" />
                <path d="M8 6V4h8v2" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
              </svg>
            </button>
          </div>
          <div class="pdf-bookmark-colors">
            {#each PDF_BOOKMARK_COLORS as color}
              <button
                class="pdf-bookmark-swatch"
                class:active={editingBookmark?.color === color}
                style:background={color}
                aria-label={color}
                onclick={() => {
                  if (editingBookmarkPage !== null) {
                    onUpdateBookmark(editingBookmarkPage, { color });
                  }
                }}
              ></button>
            {/each}
          </div>
        </div>
      {/if}
      {#if panelTab === "pages"}
        <div class="pdf-page-panel-list pdf-page-panel-grid">
          {#each pages as page, i}
            {@const bookmark = bookmarkForPage(i + 1)}
            <div
              class="pdf-page-panel-item"
              class:active={currentPage === i + 1}
              role="button"
              tabindex="0"
              onclick={() => {
                if (
                  editingBookmarkPage !== null &&
                  editingBookmarkPage !== i + 1
                ) {
                  editingBookmarkPage = null;
                }
                scrollToPage(i + 1);
              }}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  if (
                    editingBookmarkPage !== null &&
                    editingBookmarkPage !== i + 1
                  ) {
                    editingBookmarkPage = null;
                  }
                  scrollToPage(i + 1);
                }
              }}
              ondblclick={() => {
                if (bookmarkForPage(i + 1)) toggleBookmarkEditor(i + 1);
              }}
              oncontextmenu={(e) => handleThumbnailContext(e, i + 1)}
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
              {#if resumePage === i + 1}
                <span
                  class="pdf-page-resume"
                  title={t("shell.viewer.pdf.resumePoint")}
                  aria-label={t("shell.viewer.pdf.resumePoint")}
                >
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5"
                      stroke="currentColor"
                      stroke-width="2.4"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </span>
              {/if}
              {#if bookmark}
                <button
                  class="pdf-page-panel-num bookmarked"
                  style:background={bookmark.color}
                  title={bookmark.title
                    ? `${bookmark.title} (${i + 1})`
                    : String(i + 1)}
                  onclick={(e) => {
                    e.stopPropagation();
                    toggleBookmarkEditor(i + 1);
                  }}
                  ondblclick={(e) => e.stopPropagation()}
                >
                  {bookmark.title ? `${bookmark.title} (${i + 1})` : i + 1}
                </button>
              {:else}
                <span class="pdf-page-panel-num">{i + 1}</span>
              {/if}
            </div>
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
      <div class="pdf-panel-footer">
        <button
          class="pdf-panel-action tooltip-above-shift-right"
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
          class="pdf-panel-action tooltip-above-shift-right"
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
          class="pdf-panel-action tooltip-above"
          class:active={singlePage}
          aria-pressed={singlePage}
          data-tooltip={t("shell.viewer.pdf.singlePage")}
          aria-label={t("shell.viewer.pdf.singlePage")}
          onclick={toggleSinglePage}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <rect
              x="6"
              y="3"
              width="12"
              height="18"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.5"
            />
            <path
              d="M9 8h6M9 12h6M9 16h4"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-above"
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
            width="15"
            height="15"
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
        <button
          class="pdf-panel-action tooltip-above"
          class:active={readingRuler}
          aria-pressed={readingRuler}
          data-tooltip={t("shell.viewer.pdf.readingRuler")}
          aria-label={t("shell.viewer.pdf.readingRuler")}
          onclick={toggleReadingRuler}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 8V5h3M20 8V5h-3M4 16v3h3M20 16v3h-3"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M7 12h10"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <button
          class="pdf-panel-action tooltip-above"
          class:active={readAloudActive}
          aria-pressed={readAloudActive}
          data-tooltip={readAloudActive
            ? t("shell.viewer.pdf.stopReading")
            : t("shell.viewer.pdf.readAloud")}
          aria-label={readAloudActive
            ? t("shell.viewer.pdf.stopReading")
            : t("shell.viewer.pdf.readAloud")}
          onclick={toggleReadAloud}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M11 5 6 9H2v6h4l5 4V5Z"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M15.5 8.5a5 5 0 0 1 0 7"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
            <path
              d="M18.5 5.5a9 9 0 0 1 0 13"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
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
      {@const bookmark = bookmarkForPage(pageNum)}
      <div
        class="pdf-page-wrapper"
        class:right-page={dualPage && pageNum % 2 === 0}
        class:hidden-page={singlePage && pageNum !== currentPage}
        bind:this={pageWrapperRefs[pageNum - 1]}
      >
        <canvas
          bind:this={page.canvasRef}
          class="pdf-canvas"
          onclick={() => selectPage(pageNum)}
        ></canvas>
        <button
          class="pdf-page-label tooltip-ctrl"
          class:bookmarked={!!bookmark}
          style:background={bookmark?.color}
          style:color={bookmark ? "#17181a" : undefined}
          onclick={() => togglePagePanel("pages")}
          oncontextmenu={(e) => handlePageLabelContext(e, pageNum)}
          data-tooltip={showPagePanel && panelTab === "pages"
            ? t("shell.viewer.pdf.closeIndex")
            : t("shell.viewer.pdf.openIndex")}
          aria-label={showPagePanel && panelTab === "pages"
            ? t("shell.viewer.pdf.closeIndex")
            : t("shell.viewer.pdf.openIndex")}
          >{bookmark?.title
            ? `${bookmark.title} (${pageNum})`
            : pageNum}</button
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
      {#if !dualPage && !singlePage && i < pages.length - 1}
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
