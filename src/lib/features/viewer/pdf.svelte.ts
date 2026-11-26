import { convertFileSrc } from "@tauri-apps/api/core";
import {
  getCached,
  registerDocumentThumbnailRenderer,
  setCached,
} from "$lib/services/thumbnailCache.svelte";
import { invokeStoreThumbnail } from "$lib/features/media/api";
import { getFileExt } from "$lib/services/files";
import { loadPdfNightMode, savePdfNightMode } from "$lib/services/storage";
import {
  deletePdfBookmarks,
  loadPdfBookmarks,
  savePdfBookmarks,
} from "$lib/services/database";
import { DRAW_COLORS } from "$lib/features/markup/markup.svelte";
import { DOCUMENT_EXTS } from "$lib/shared/constants";
import { locale } from "$lib/features/i18n/locale.svelte";
import type {
  PDFDocumentLoadingTask,
  PDFDocumentProxy,
  PDFPageProxy,
  RefProxy,
} from "pdfjs-dist/types/src/display/api";

// Standalone PDF page 1 thumbnail generator.
// Used by library and thumbnail bar when the backend (FFmpeg) can't handle PDFs.
const PDF_THUMB_CONCURRENT = 2;
const PDF_THUMB_TIMEOUT_MS = 15_000;
let pdfThumbActive = 0;
let pdfThumbQueue: Array<() => void> = [];
const pdfThumbRequests = new Map<string, Promise<string>>();

async function acquirePdfSlot(): Promise<void> {
  if (pdfThumbActive < PDF_THUMB_CONCURRENT) {
    pdfThumbActive++;
    return;
  }
  // releasePdfSlot hands the slot directly to the next waiter, so the
  // active count stays unchanged across the handoff.
  await new Promise<void>((resolve) => pdfThumbQueue.push(resolve));
}

function releasePdfSlot(): void {
  const next = pdfThumbQueue.shift();
  if (next) {
    next();
    return;
  }
  pdfThumbActive = Math.max(0, pdfThumbActive - 1);
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("PDF thumbnail timed out")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function renderPdfThumbnail(path: string, size: number): Promise<string> {
  await acquirePdfSlot();
  let loadingTask: PDFDocumentLoadingTask | null = null;
  let pdfDoc: PDFDocumentProxy | null = null;
  try {
    const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
    const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
    globalThis.pdfjsWorker = pdfjsWorker;
    pdfjsLib.GlobalWorkerOptions.workerSrc = ".";

    const url = convertFileSrc(path);
    loadingTask = pdfjsLib.getDocument({
      url,
      enableXfa: true,
      disableAutoFetch: false,
    });
    pdfDoc = await withTimeout(loadingTask.promise, PDF_THUMB_TIMEOUT_MS);

    const page = await withTimeout(pdfDoc.getPage(1), PDF_THUMB_TIMEOUT_MS);
    const vp = page.getViewport({ scale: 1 });
    const scale = size / Math.max(vp.width, vp.height);
    const renderVp = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(renderVp.width);
    canvas.height = Math.floor(renderVp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    await withTimeout(
      page.render({ canvasContext: ctx, viewport: renderVp }).promise,
      PDF_THUMB_TIMEOUT_MS,
    );
    return canvas.toDataURL("image/jpeg", 0.7);
  } catch {
    return "";
  } finally {
    // Release the slot before cleanup so a slow destroy cannot block others.
    releasePdfSlot();
    if (pdfDoc) {
      void pdfDoc.destroy().catch(() => {});
    } else if (loadingTask) {
      void loadingTask.destroy().catch(() => {});
    }
  }
}

export function generatePdfThumbnail(
  path: string,
  size: number,
): Promise<string> {
  const cached = getCached(path, size);
  if (cached) return Promise.resolve(cached);

  const key = `${path}\0${size}`;
  const existing = pdfThumbRequests.get(key);
  if (existing) return existing;

  const request = renderPdfThumbnail(path, size)
    .then((dataUrl) => {
      if (dataUrl) {
        setCached(path, size, dataUrl);
        // Persist so later sessions can return it from the backend cache.
        void invokeStoreThumbnail(path, size, dataUrl).catch(() => {});
      }
      return dataUrl;
    })
    .finally(() => {
      pdfThumbRequests.delete(key);
    });

  pdfThumbRequests.set(key, request);
  return request;
}

export function isPdfPath(path: string): boolean {
  return DOCUMENT_EXTS.includes(getFileExt(path));
}

// Let the shared thumbnail service route PDFs here instead of the backend.
registerDocumentThumbnailRenderer(generatePdfThumbnail);

export interface PdfLink {
  left: number;
  top: number;
  width: number;
  height: number;
  dest: string | unknown[] | null;
}

export interface PdfOutlineEntry {
  title: string;
  pageNum: number;
  depth: number;
}

export interface PdfPage {
  pageNum: number;
  canvasRef: HTMLCanvasElement | null;
  textLayerRef: HTMLDivElement | null;
  annotationsRef: HTMLDivElement | null;
  rendered: boolean;
  width: number;
  height: number;
  pageHeight: number;
  links: PdfLink[];
}

export interface PdfPasswordPrompt {
  visible: boolean;
  incorrect: boolean;
}

export interface PdfRedactionRect {
  id: number;
  pageNum: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfRedactionPageImage {
  pageNum: number;
  dataBase64: string;
  width: number;
  height: number;
  widthPt: number;
  heightPt: number;
}

export interface FindHighlight {
  pageNum: number;
  rects: { left: number; top: number; width: number; height: number }[];
}

export interface PdfBookmark {
  page: number;
  color: string;
  title: string;
}

export const PDF_BOOKMARK_COLORS = DRAW_COLORS.filter(
  (color) => !["#000000", "#888888", "#ffffff"].includes(color),
);

export interface PdfState {
  pages: PdfPage[];
  scale: number;
  fitScale: number;
  autoFit: boolean;
  fitWidth: boolean;
  rotation: number;
  dualPage: boolean;
  singlePage: boolean;
  nightMode: boolean;
  encrypted: boolean;
  passwordPrompt: PdfPasswordPrompt;
  formDirty: boolean;
  redactActive: boolean;
  redactions: PdfRedactionRect[];
  redactionConfirmOpen: boolean;
  signatureOpen: boolean;
  pageCount: number;
  currentPage: number;
  loading: boolean;
  error: string;
  findOpen: boolean;
  findQuery: string;
  findResults: number;
  findCurrentIdx: number;
  findMatchPages: number[];
  findHighlights: FindHighlight[];
  findMatchCase: boolean;
  findWholeWord: boolean;
  findRegex: boolean;
  showPagePanel: boolean;
  panelTab: "pages" | "outline";
  outline: PdfOutlineEntry[];
  pdfVersion: string;
  pdfPageSize: string;
  documentInfo: string;
  resumePage: number | null;
  bookmarks: PdfBookmark[];
}

const RENDER_DEBOUNCE_MS = 60;
const LOAD_TIMEOUT_MS = 45_000;
// Vertical gap between page rows; keep in sync with .pdf-page-separator margin.
const PAGE_SEP = 25;
// Horizontal gap between the two pages of a spread.
const PAGE_GAP = 12;
type PdfJsModule = typeof import("pdfjs-dist/build/pdf.mjs");
type PdfTextContent = Awaited<ReturnType<PDFPageProxy["getTextContent"]>>;
type TextLayerTask = {
  cancel: () => void;
  render: () => Promise<void>;
};

export function groupPdfRows(pages: PdfPage[], dual: boolean): PdfPage[][] {
  if (!dual) return pages.map((page) => [page]);
  const rows: PdfPage[][] = [];
  for (let i = 0; i < pages.length; i += 2) {
    rows.push(pages.slice(i, i + 2));
  }
  return rows;
}

export type PdfStore = ReturnType<typeof createPdf>;

export function createPdf() {
  const state = $state<PdfState>({
    pages: [],
    scale: 1.0,
    fitScale: 1.0,
    autoFit: true,
    fitWidth: false,
    rotation: 0,
    dualPage: false,
    singlePage: false,
    nightMode: loadPdfNightMode(),
    encrypted: false,
    passwordPrompt: { visible: false, incorrect: false },
    formDirty: false,
    redactActive: false,
    redactions: [],
    redactionConfirmOpen: false,
    signatureOpen: false,
    pageCount: 0,
    currentPage: 1,
    loading: false,
    error: "",
    findOpen: false,
    findQuery: "",
    findResults: 0,
    findCurrentIdx: 0,
    findMatchPages: [],
    findHighlights: [],
    findMatchCase: false,
    findWholeWord: false,
    findRegex: false,
    showPagePanel: false,
    panelTab: "pages",
    outline: [],
    pdfVersion: "",
    pdfPageSize: "",
    documentInfo: "",
    resumePage: null,
    bookmarks: [],
  });

  let pdfDoc: PDFDocumentProxy | null = null;
  let pdfjsLib: PdfJsModule | null = null;
  let loadingTaskRef: PDFDocumentLoadingTask | null = null;
  let passwordCallback: ((password: string) => void) | null = null;
  let observer: IntersectionObserver | null = null;
  let renderTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  let textContentCache: Map<number, PdfTextContent> = new Map();
  let textLayerTasks: Map<number, TextLayerTask> = new Map();
  let textLayerVersions: Map<number, number> = new Map();
  let annotationLayerVersions: Map<number, number> = new Map();
  let pageProxies: Map<number, PDFPageProxy> = new Map();
  let annotationCache: Map<number, unknown[]> = new Map();
  let redactionId = 0;
  let pdfContainerEl: HTMLElement | null = null;
  let scrollHandler: ((e: Event) => void) | null = null;
  let currentFilePath = "";
  let disposed = false;
  let loadGen = 0;
  let sourceNonce = 0;

  function setContainer(el: HTMLElement | null) {
    pdfContainerEl = el;
  }

  function clampScale(value: number): number {
    return Math.max(0.25, Math.min(5, value));
  }

  function isDualLayout(): boolean {
    return state.dualPage;
  }

  function layoutRows(): { pages: PdfPage[]; width: number; height: number }[] {
    return groupPdfRows(state.pages, isDualLayout()).map((pages) => {
      let width = 0;
      let height = 0;
      for (const page of pages) {
        width += page.width + (width > 0 ? PAGE_GAP : 0);
        height = Math.max(height, page.height);
      }
      return { pages, width, height };
    });
  }

  function updateCanvasStyles() {
    for (const page of state.pages) {
      const canvas = page.canvasRef;
      if (!canvas || page.width <= 0 || page.height <= 0) continue;
      canvas.style.width = `${page.width * state.scale}px`;
      canvas.style.height = `${page.height * state.scale}px`;
    }
  }

  function clearTextLayer(pageNum: number): void {
    textLayerVersions.set(pageNum, (textLayerVersions.get(pageNum) ?? 0) + 1);
    textLayerTasks.get(pageNum)?.cancel();
    textLayerTasks.delete(pageNum);
    const page = state.pages.find((item) => item.pageNum === pageNum);
    page?.textLayerRef?.replaceChildren();
  }

  function clearAnnotationLayer(pageNum: number): void {
    annotationLayerVersions.set(
      pageNum,
      (annotationLayerVersions.get(pageNum) ?? 0) + 1,
    );
    const page = state.pages.find((item) => item.pageNum === pageNum);
    page?.annotationsRef?.replaceChildren();
  }

  async function getPageAnnotations(
    pdfPage: PDFPageProxy,
    pageNum: number,
  ): Promise<unknown[] | null> {
    const cached = annotationCache.get(pageNum);
    if (cached) return cached;
    if (!pdfDoc || disposed) return null;
    const documentRef = pdfDoc;
    try {
      const annotations = (await pdfPage.getAnnotations({
        intent: "display",
      })) as unknown[];
      if (disposed || pdfDoc !== documentRef) return null;
      annotationCache.set(pageNum, annotations);
      return annotations;
    } catch {
      return null;
    }
  }

  async function renderAnnotationLayer(
    pdfPage: PDFPageProxy,
    page: PdfPage,
  ): Promise<void> {
    const container = page.annotationsRef;
    const lib = pdfjsLib;
    const documentRef = pdfDoc;
    if (!container || !lib || !documentRef || disposed) return;

    clearAnnotationLayer(page.pageNum);
    const version = annotationLayerVersions.get(page.pageNum) ?? 0;
    const annotations = await getPageAnnotations(pdfPage, page.pageNum);
    if (
      !annotations ||
      disposed ||
      pdfDoc !== documentRef ||
      annotationLayerVersions.get(page.pageNum) !== version ||
      page.annotationsRef !== container
    ) {
      return;
    }

    const visible = annotations.filter((item) => {
      const annotation = item as { subtype?: string; noHTML?: boolean };
      return annotation.subtype !== "Link" && !annotation.noHTML;
    });
    if (visible.length === 0) return;

    container.style.setProperty("--scale-factor", String(state.scale));
    const viewport = pdfPage.getViewport({
      scale: state.scale,
      rotation: state.rotation,
    });

    try {
      const layer = new lib.AnnotationLayer({
        div: container,
        accessibilityManager: undefined,
        annotationCanvasMap: undefined,
        annotationEditorUIManager: undefined,
        page: pdfPage,
        viewport: viewport.clone({ dontFlip: true }),
        structTreeLayer: undefined,
      });
      await layer.render({
        viewport,
        div: container,
        annotations: visible,
        page: pdfPage,
        linkService: {
          addLinkAttributes() {},
          getDestinationHash: () => "",
          getAnchorUrl: () => "",
          setHash() {},
          executeNamedAction() {},
          executeAction() {},
          goToDestination() {},
        } as never,
        annotationStorage: documentRef.annotationStorage,
        renderForms: true,
      });
      if (state.encrypted) {
        container.classList.add("readonly");
        for (const field of container.querySelectorAll<
          HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
        >("input, textarea, select")) {
          field.disabled = true;
        }
      } else {
        container.classList.remove("readonly");
      }
    } catch (err) {
      if (annotationLayerVersions.get(page.pageNum) === version && !disposed) {
        console.error(
          `Failed to render PDF annotation layer ${page.pageNum}:`,
          err,
        );
      }
    }
  }

  function applyScale(value: number, autoFit: boolean) {
    const newScale = autoFit ? value : clampScale(value);
    // Manual zoom leaves any fit mode; the menu should stop showing Fit width.
    if (!autoFit) state.fitWidth = false;
    if (state.scale === newScale && state.autoFit === autoFit) return;

    state.scale = newScale;
    state.autoFit = autoFit;
    updateCanvasStyles();

    for (const page of state.pages) {
      clearTextLayer(page.pageNum);
      clearAnnotationLayer(page.pageNum);
      page.rendered = false;
      page.links = [];
    }
    if (observer && pdfContainerEl) {
      for (const page of state.pages) {
        if (page.canvasRef) observer.observe(page.canvasRef);
      }
    }
    if (state.findQuery) {
      findText(state.findQuery);
    }
  }

  function setScale(val: number) {
    applyScale(val, false);
  }

  function fitToScreen(containerWidth: number, containerHeight: number) {
    if (containerWidth <= 0 || containerHeight <= 0) return;

    let maxWidth = 0;
    let maxHeight = 0;
    for (const row of layoutRows()) {
      maxWidth = Math.max(maxWidth, row.width);
      maxHeight = Math.max(maxHeight, row.height);
    }
    if (maxWidth <= 0 || maxHeight <= 0) return;

    const widthScale = containerWidth / maxWidth;
    const fitScale = state.fitWidth
      ? Math.min(10, widthScale)
      : Math.min(10, widthScale, containerHeight / maxHeight);
    if (!Number.isFinite(fitScale) || fitScale <= 0) return;

    state.fitScale = fitScale;
    applyScale(fitScale, true);
  }

  function setFitWidth(
    enabled: boolean,
    containerWidth: number,
    containerHeight: number,
  ) {
    state.fitWidth = enabled;
    fitToScreen(containerWidth, containerHeight);
  }

  function resetScale() {
    applyScale(1, false);
  }

  function scheduleRender(pdfPage: PDFPageProxy, page: PdfPage) {
    const pageNum = page.pageNum;
    const existing = renderTimers.get(pageNum);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      renderTimers.delete(pageNum);
      renderPage(pdfPage, page);
    }, RENDER_DEBOUNCE_MS);

    renderTimers.set(pageNum, timer);
  }

  async function renderPagesForPrint(scale = 1.4): Promise<string[]> {
    if (!pdfDoc || disposed) return [];
    const images: string[] = [];
    for (let i = 1; i <= state.pageCount; i++) {
      if (disposed) break;
      const proxy = pageProxies.get(i);
      if (!proxy) continue;
      const viewport = proxy.getViewport({ scale, rotation: state.rotation });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      try {
        await proxy.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL("image/jpeg", 0.92));
      } catch {
        // Skip pages that fail to render.
      }
    }
    return images;
  }

  async function renderPage(pdfPage: PDFPageProxy, page: PdfPage) {
    if (disposed) return;
    const canvas = page.canvasRef;
    if (!canvas || !pdfPage) return;
    if (page.rendered) return;

    const viewport = pdfPage.getViewport({
      scale: state.scale,
      rotation: state.rotation,
    });

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = `${viewport.width}px`;
    canvas.style.height = `${viewport.height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    try {
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;
      page.rendered = true;
      void renderTextLayer(pdfPage, page);
      void renderAnnotationLayer(pdfPage, page);
      void loadPageLinks(pdfPage, page, viewport);
      updateCurrentPage();
      if (page.pageNum === 1 && currentFilePath) {
        try {
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setCached(currentFilePath, 120, dataUrl);
          // Also cache at library size so the library finds it without re-rendering
          setCached(currentFilePath, 256, dataUrl);
          window.dispatchEvent(
            new CustomEvent("vyu-pdf-thumbnail-ready", {
              detail: { path: currentFilePath, dataUrl },
            }),
          );
        } catch {
          // thumbnail caching is non-critical
        }
      }
    } catch (err) {
      console.error(`Failed to render PDF page ${page.pageNum}:`, err);
    }
  }

  async function getTextContent(
    pageNum: number,
    pdfPage?: PDFPageProxy,
  ): Promise<PdfTextContent | null> {
    const cached = textContentCache.get(pageNum);
    if (cached) return cached;
    if (!pdfDoc || disposed) return null;
    const documentRef = pdfDoc;

    try {
      const content = await (
        pdfPage ?? (await pdfDoc.getPage(pageNum))
      ).getTextContent();
      if (disposed || pdfDoc !== documentRef) return null;
      textContentCache.set(pageNum, content);
      return content;
    } catch {
      return null;
    }
  }

  async function getPageText(pageNum: number): Promise<string> {
    const content = await getTextContent(pageNum);
    if (!content) return "";
    return content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async function renderTextLayer(
    pdfPage: PDFPageProxy,
    page: PdfPage,
  ): Promise<void> {
    const container = page.textLayerRef;
    const lib = pdfjsLib;
    const documentRef = pdfDoc;
    if (!container || !lib || !documentRef || disposed) return;

    clearTextLayer(page.pageNum);
    const version = textLayerVersions.get(page.pageNum) ?? 0;
    const textContent = await getTextContent(page.pageNum, pdfPage);
    if (
      !textContent ||
      disposed ||
      pdfDoc !== documentRef ||
      textLayerVersions.get(page.pageNum) !== version ||
      page.textLayerRef !== container
    ) {
      return;
    }

    container.style.setProperty("--scale-factor", String(state.scale));
    const viewport = pdfPage.getViewport({
      scale: state.scale,
      rotation: state.rotation,
    });
    const task = new lib.TextLayer({
      textContentSource: textContent,
      container,
      viewport: viewport.clone({ dontFlip: true }),
    }) as TextLayerTask;
    textLayerTasks.set(page.pageNum, task);

    try {
      await task.render();
    } catch (err) {
      if (textLayerTasks.get(page.pageNum) === task && !disposed) {
        console.error(`Failed to render PDF text layer ${page.pageNum}:`, err);
      }
    } finally {
      if (textLayerTasks.get(page.pageNum) === task) {
        textLayerTasks.delete(page.pageNum);
      }
    }
  }

  async function loadPageLinks(
    pdfPage: PDFPageProxy,
    page: PdfPage,
    viewport: ReturnType<PDFPageProxy["getViewport"]>,
  ): Promise<void> {
    const documentRef = pdfDoc;
    const scale = state.scale;
    const rotation = state.rotation;
    if (!documentRef || disposed) return;

    try {
      const annotations = await getPageAnnotations(pdfPage, page.pageNum);
      if (
        !annotations ||
        disposed ||
        pdfDoc !== documentRef ||
        state.scale !== scale ||
        state.rotation !== rotation
      ) {
        return;
      }

      const links: PdfLink[] = [];
      for (const item of annotations) {
        const annotation = item as {
          subtype?: string;
          rect?: number[];
          dest?: string | unknown[] | null;
        };
        if (annotation.subtype !== "Link" || !annotation.dest) continue;
        const rect = annotation.rect;
        if (!Array.isArray(rect) || rect.length < 4) continue;
        const [x1, y1, x2, y2] = viewport.convertToViewportRectangle(rect);
        const left = Math.min(x1, x2);
        const top = Math.min(y1, y2);
        const width = Math.abs(x2 - x1);
        const height = Math.abs(y2 - y1);
        if (width <= 0 || height <= 0) continue;
        links.push({ left, top, width, height, dest: annotation.dest });
      }
      page.links = links;
    } catch {
      // Link annotations are optional; keep the page readable without them.
    }
  }

  async function resolveDestPage(
    doc: PDFDocumentProxy,
    dest: string | unknown[] | null,
  ): Promise<number | null> {
    if (!dest) return null;
    const resolved =
      typeof dest === "string" ? await doc.getDestination(dest) : dest;
    if (!Array.isArray(resolved) || resolved.length === 0) return null;
    const ref = resolved[0];
    if (typeof ref === "number") return ref + 1;
    if (ref && typeof ref === "object") {
      const refProxy = ref as RefProxy;
      if (typeof refProxy.num === "number") {
        try {
          return (await doc.getPageIndex(refProxy)) + 1;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  function updateCurrentPage() {
    if (!pdfContainerEl || state.pages.length === 0) return;
    if (state.singlePage) return;
    const containerRect = pdfContainerEl.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerCenterX = containerRect.left + containerRect.width / 2;

    let minTopDistance = Infinity;
    const rects = new Map<number, DOMRect>();
    for (const page of state.pages) {
      if (!page.canvasRef) continue;
      const rect = page.canvasRef.getBoundingClientRect();
      rects.set(page.pageNum, rect);
      minTopDistance = Math.min(
        minTopDistance,
        Math.abs(rect.top - containerTop),
      );
    }
    if (!Number.isFinite(minTopDistance)) return;

    // Stay on the manually selected page when it shares the visible row.
    const currentRect = rects.get(state.currentPage);
    if (
      currentRect &&
      Math.abs(currentRect.top - containerTop) <= minTopDistance + 1
    ) {
      return;
    }

    let closest = state.currentPage;
    let closestDist = Infinity;
    for (const [pageNum, rect] of rects) {
      const vertical = Math.abs(rect.top - containerTop);
      if (vertical > minTopDistance + 1) continue;
      // Horizontal center breaks ties between the two pages of a spread.
      const dist = Math.abs(rect.left + rect.width / 2 - containerCenterX);
      if (dist < closestDist) {
        closestDist = dist;
        closest = pageNum;
      }
    }
    state.currentPage = closest;
  }

  function setupObserver() {
    if (disposed) return;
    if (observer) observer.disconnect();
    if (scrollHandler && pdfContainerEl) {
      pdfContainerEl.removeEventListener("scroll", scrollHandler);
      scrollHandler = null;
    }

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const canvas = entry.target as HTMLCanvasElement;
          const page = state.pages.find((p) => p.canvasRef === canvas);
          if (page && !page.rendered) {
            pdfDoc
              ?.getPage(page.pageNum)
              ?.then((p: PDFPageProxy) => scheduleRender(p, page))
              ?.catch(() => {});
          }
          observer?.unobserve(canvas);
        }
      },
      {
        root: pdfContainerEl,
        rootMargin: "300px 0px",
        threshold: 0.01,
      },
    );

    scrollHandler = () => updateCurrentPage();
    pdfContainerEl?.addEventListener("scroll", scrollHandler, {
      passive: true,
    });
  }

  async function loadFile(path: string): Promise<void> {
    cleanup();
    const gen = ++loadGen;
    disposed = false;
    currentFilePath = path;
    state.loading = true;
    state.error = "";
    state.pages = [];
    state.pageCount = 0;
    state.currentPage = 1;

    const timeoutId = setTimeout(() => {
      if (state.loading && gen === loadGen) {
        state.loading = false;
        state.error =
          "PDF loading timed out. The file may be too large or corrupted.";
        console.error("PDF load timed out after", LOAD_TIMEOUT_MS, "ms");
      }
    }, LOAD_TIMEOUT_MS);

    try {
      // Dynamic import so pdfjs-dist only loads when a PDF is opened (code-split)
      const loadedPdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
      if (gen !== loadGen) {
        clearTimeout(timeoutId);
        return;
      }
      pdfjsLib = loadedPdfjsLib;

      // Preload the worker module on the main thread — this triggers PDF.js's
      // built-in "fake worker" mode, which runs worker logic on the main thread
      // instead of spawning a Web Worker.  Necessary because Tauri's WebView2
      // custom protocol (asset://) does not support Web Workers.
      const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
      if (gen !== loadGen) {
        clearTimeout(timeoutId);
        return;
      }
      globalThis.pdfjsWorker = pdfjsWorker;

      // Must be a truthy non-empty string — PDF.js 4.x checks for falsy
      loadedPdfjsLib.GlobalWorkerOptions.workerSrc = ".";

      const url = `${convertFileSrc(path)}?v=${++sourceNonce}`;
      const loadingTask = loadedPdfjsLib.getDocument({
        url,
        enableXfa: true,
        disableAutoFetch: false,
      });
      loadingTaskRef = loadingTask;
      loadingTask.onPassword = (
        updatePassword: (password: string) => void,
        reason: number,
      ) => {
        if (gen !== loadGen || disposed) return;
        clearTimeout(timeoutId);
        passwordCallback = updatePassword;
        state.encrypted = true;
        state.passwordPrompt = {
          visible: true,
          incorrect:
            reason === loadedPdfjsLib.PasswordResponses.INCORRECT_PASSWORD,
        };
      };
      const pdfDocument = await loadingTask.promise;
      if (gen !== loadGen) {
        clearTimeout(timeoutId);
        void pdfDocument.destroy();
        return;
      }
      pdfDoc = pdfDocument;
      loadingTaskRef = null;
      passwordCallback = null;
      state.passwordPrompt = { visible: false, incorrect: false };

      const storage = pdfDocument.annotationStorage;
      storage.onSetModified = () => {
        if (!disposed) state.formDirty = true;
      };
      storage.onResetModified = () => {
        if (!disposed) state.formDirty = false;
      };

      const numPages = pdfDocument.numPages;
      state.pageCount = numPages;

      const pagePromises: Promise<PDFPageProxy>[] = [];
      for (let i = 1; i <= numPages; i++) {
        pagePromises.push(pdfDocument.getPage(i));
      }

      const pages: PdfPage[] = [];
      for (let i = 1; i <= numPages; i++) {
        pages.push({
          pageNum: i,
          canvasRef: null,
          textLayerRef: null,
          annotationsRef: null,
          rendered: false,
          width: 0,
          height: 0,
          pageHeight: 0,
          links: [],
        });
      }
      state.pages = pages;
      state.loading = false;
      clearTimeout(timeoutId);

      // Wait for page promises to resolve
      const pageResults = await Promise.allSettled(pagePromises);
      if (gen !== loadGen) return;

      // Store viewport heights and pre-set canvas dimensions so DOM layout is correct
      // even for pages not yet rendered
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
      if (gen !== loadGen) return;

      pageProxies.clear();
      for (let i = 0; i < numPages; i++) {
        const result = pageResults[i];
        if (result.status === "fulfilled") {
          const pdfPage = result.value;
          pageProxies.set(i + 1, pdfPage);
          const vp = pdfPage.getViewport({
            scale: 1,
            rotation: state.rotation,
          });
          state.pages[i].pageHeight = vp.height;
          state.pages[i].width = vp.width;
          state.pages[i].height = vp.height;
          const canvas = state.pages[i].canvasRef;
          if (canvas) {
            const cssW = vp.width * state.scale;
            const cssH = vp.height * state.scale;
            canvas.style.width = `${cssW}px`;
            canvas.style.height = `${cssH}px`;
          }
        }
      }

      if (numPages > 0) {
        const w = state.pages[0].width;
        const h = state.pages[0].pageHeight;
        state.pdfPageSize = `${Math.round(w)} × ${Math.round(h)} pt`;
      }
      try {
        const meta = await pdfDocument.getMetadata();
        if (gen !== loadGen) return;
        const info = meta.info as Record<string, unknown> | undefined;
        if (info?.PDFFormatVersion) {
          state.pdfVersion = String(info.PDFFormatVersion);
        }
        const readString = (key: string): string => {
          const value = info?.[key];
          return typeof value === "string" ? value.trim() : "";
        };
        const meaningful = (value: string) =>
          value && !/^\(?(anonymous|unspecified|unknown)\)?$/i.test(value);
        const documentParts = [
          readString("Title"),
          readString("Author"),
          readString("Producer"),
          readString("Creator"),
        ].filter(meaningful);
        state.documentInfo = documentParts.slice(0, 2).join(" · ");
      } catch {
        /* ignore */
      }
      void loadPdfBookmarks(path).then((raw) => {
        if (gen !== loadGen || disposed) return;
        state.bookmarks = parseBookmarks(raw);
      });
      if (gen !== loadGen) return;

      void loadOutline(pdfDocument, gen);

      setupObserver();

      if (observer) {
        for (const page of state.pages) {
          if (page.canvasRef) observer.observe(page.canvasRef);
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (gen !== loadGen) return;
      state.loading = false;
      state.error =
        err instanceof Error
          ? err.message
          : locale.t("shell.viewer.pdf.loadFailed");
      console.error("PDF load error:", err);
    }
  }

  function cleanup() {
    loadGen++;
    disposed = true;
    for (const [, timer] of renderTimers) clearTimeout(timer);
    renderTimers.clear();
    for (const task of textLayerTasks.values()) task.cancel();
    textLayerTasks.clear();
    textLayerVersions.clear();
    annotationLayerVersions.clear();
    passwordCallback = null;
    state.passwordPrompt = { visible: false, incorrect: false };
    if (loadingTaskRef) {
      try {
        void loadingTaskRef.destroy();
      } catch {
        // ignore
      }
      loadingTaskRef = null;
    }
    if (observer) {
      observer.disconnect();
      observer = null;
    }
    if (scrollHandler && pdfContainerEl) {
      pdfContainerEl.removeEventListener("scroll", scrollHandler);
      scrollHandler = null;
    }
    if (pdfDoc) {
      try {
        pdfDoc.annotationStorage.onSetModified = null;
        pdfDoc.annotationStorage.onResetModified = null;
        pdfDoc.destroy();
      } catch {
        // ignore
      }
      pdfDoc = null;
    }
    state.pages = [];
    state.pageCount = 0;
    state.currentPage = 1;
    state.loading = false;
    state.error = "";
    state.scale = 1.0;
    state.fitScale = 1.0;
    state.autoFit = true;
    state.fitWidth = false;
    state.rotation = 0;
    state.dualPage = false;
    state.encrypted = false;
    state.formDirty = false;
    state.redactActive = false;
    state.redactions = [];
    state.redactionConfirmOpen = false;
    state.signatureOpen = false;
    state.findOpen = false;
    state.findQuery = "";
    state.findResults = 0;
    state.findCurrentIdx = 0;
    state.findMatchPages = [];
    state.findHighlights = [];
    state.findMatchCase = false;
    state.findWholeWord = false;
    state.findRegex = false;
    findItemsCache.clear();
    state.panelTab = "pages";
    state.outline = [];
    state.pdfVersion = "";
    state.pdfPageSize = "";
    state.documentInfo = "";
    state.resumePage = null;
    state.bookmarks = [];
    pageThumbnailCache.clear();
    textContentCache.clear();
    annotationCache.clear();
    pageProxies.clear();
  }

  let pageThumbnailCache: Map<number, string> = new Map();

  function togglePagePanel(tab?: "pages" | "outline") {
    if (state.showPagePanel && (!tab || state.panelTab === tab)) {
      state.showPagePanel = false;
      pageThumbnailCache.clear();
      return;
    }
    state.showPagePanel = true;
    state.panelTab = tab ?? "pages";
  }

  function setPanelTab(tab: "pages" | "outline") {
    state.panelTab = tab;
  }

  async function getPageThumbnail(pageNum: number): Promise<string> {
    const cached = pageThumbnailCache.get(pageNum);
    if (cached) return cached;
    if (!pdfDoc || disposed) return "";
    try {
      const pdfPage = await pdfDoc.getPage(pageNum);
      const vp = pdfPage.getViewport({ scale: 0.25 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";
      await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
      pageThumbnailCache.set(pageNum, dataUrl);
      return dataUrl;
    } catch {
      return "";
    }
  }

  async function preloadAllThumbnails(): Promise<void> {
    const batchSize = 4;
    for (let i = 1; i <= state.pageCount; i += batchSize) {
      const batch = [];
      for (let j = i; j < i + batchSize && j <= state.pageCount; j++) {
        batch.push(getPageThumbnail(j));
      }
      await Promise.all(batch);
    }
  }

  function scrollToPage(pageNum: number) {
    if (!pdfContainerEl) return;
    const target = Math.max(1, Math.min(state.pageCount, pageNum));
    state.currentPage = target;
    if (state.singlePage) {
      centerPage(target);
      return;
    }
    const FALLBACK = 800;
    let top = 0;
    for (const row of layoutRows()) {
      if (row.pages.some((page) => page.pageNum >= pageNum)) break;
      top += (row.height > 0 ? row.height * state.scale : FALLBACK) + PAGE_SEP;
    }
    pdfContainerEl.scrollTo({ top, behavior: "smooth" });
  }

  function centerPage(pageNum: number) {
    if (!pdfContainerEl) return;
    if (state.singlePage) {
      pdfContainerEl.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const FALLBACK = 800;
    let pageTop = 0;
    let pageH = 0;
    for (const row of layoutRows()) {
      if (row.pages.some((page) => page.pageNum === pageNum)) {
        pageH = row.height > 0 ? row.height * state.scale : FALLBACK;
        break;
      }
      pageTop +=
        (row.height > 0 ? row.height * state.scale : FALLBACK) + PAGE_SEP;
    }
    const viewH = pdfContainerEl.clientHeight;
    const top = pageTop - (viewH - pageH) / 2;
    pdfContainerEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function stepPage(delta: number) {
    if (state.singlePage) {
      selectPage(
        Math.max(1, Math.min(state.pageCount, state.currentPage + delta)),
      );
      return;
    }
    const rows = layoutRows();
    if (rows.length === 0) return;
    const index = rows.findIndex((row) =>
      row.pages.some((page) => page.pageNum === state.currentPage),
    );
    const target = Math.max(
      0,
      Math.min(rows.length - 1, (index < 0 ? 0 : index) + delta),
    );
    state.currentPage = rows[target].pages[0].pageNum;
    centerPage(rows[target].pages[0].pageNum);
  }

  function prevPage() {
    stepPage(-1);
  }

  function nextPage() {
    stepPage(1);
  }

  function goToPage(pageNum: number) {
    const target = Math.round(pageNum);
    if (!Number.isFinite(target)) return;
    const clamped = Math.max(1, Math.min(state.pageCount, target));
    state.currentPage = clamped;
    centerPage(clamped);
  }

  function selectPage(pageNum: number) {
    if (pageNum < 1 || pageNum > state.pageCount) return;
    state.currentPage = pageNum;
    centerPage(pageNum);
  }

  function fitToWidth(containerWidth: number, containerHeight: number) {
    setFitWidth(true, containerWidth, containerHeight);
  }

  function fitToPage(containerWidth: number, containerHeight: number) {
    setFitWidth(false, containerWidth, containerHeight);
  }

  function clearRenderLayers() {
    for (const page of state.pages) {
      clearTextLayer(page.pageNum);
      clearAnnotationLayer(page.pageNum);
      page.rendered = false;
      page.links = [];
    }
    updateCanvasStyles();
    if (observer && pdfContainerEl) {
      for (const page of state.pages) {
        if (page.canvasRef) observer.observe(page.canvasRef);
      }
    }
  }

  function rotate() {
    if (state.pages.length === 0) return;
    state.rotation = (state.rotation + 90) % 360;

    for (const [pageNum, proxy] of pageProxies) {
      const page = state.pages.find((item) => item.pageNum === pageNum);
      if (!page) continue;
      try {
        const viewport = proxy.getViewport({
          scale: 1,
          rotation: state.rotation,
        });
        page.width = viewport.width;
        page.height = viewport.height;
        page.pageHeight = viewport.height;
      } catch {
        // Keep the previous dimensions if the page cannot report a viewport.
      }
    }

    findItemsCache.clear();
    clearRenderLayers();
    if (state.autoFit && pdfContainerEl) {
      fitToScreen(pdfContainerEl.clientWidth, pdfContainerEl.clientHeight);
    }
    if (state.findQuery) {
      findText(state.findQuery);
    }
    centerPageAfterLayout(state.currentPage);
  }

  function centerPageAfterLayout(pageNum: number) {
    if (typeof requestAnimationFrame !== "function") {
      centerPage(pageNum);
      return;
    }
    requestAnimationFrame(() => centerPage(pageNum));
  }

  function toggleDualPage() {
    state.dualPage = !state.dualPage;
    if (state.dualPage) state.singlePage = false;
    if (state.autoFit && pdfContainerEl) {
      fitToScreen(pdfContainerEl.clientWidth, pdfContainerEl.clientHeight);
    }
    centerPageAfterLayout(state.currentPage);
  }

  function toggleSinglePage() {
    state.singlePage = !state.singlePage;
    if (state.singlePage) state.dualPage = false;
    if (state.autoFit && pdfContainerEl) {
      fitToScreen(pdfContainerEl.clientWidth, pdfContainerEl.clientHeight);
    }
    centerPageAfterLayout(state.currentPage);
  }

  function parseBookmarks(raw: string | null): PdfBookmark[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) return [];
      const allowed = new Set(PDF_BOOKMARK_COLORS);
      const pageCount = state.pageCount;
      return parsed
        .map((entry) => {
          if (!entry || typeof entry !== "object") return null;
          const record = entry as Record<string, unknown>;
          const page = Number(record.page);
          if (!Number.isFinite(page) || page < 1) return null;
          if (pageCount > 0 && page > pageCount) return null;
          const color =
            typeof record.color === "string" && allowed.has(record.color)
              ? record.color
              : PDF_BOOKMARK_COLORS[0];
          const title =
            typeof record.title === "string" ? record.title.trim() : "";
          return { page: Math.round(page), color, title };
        })
        .filter((entry): entry is PdfBookmark => entry !== null);
    } catch {
      return [];
    }
  }

  function bookmarkForPage(pageNum: number): PdfBookmark | null {
    return (
      state.bookmarks.find((bookmark) => bookmark.page === pageNum) ?? null
    );
  }

  function persistBookmarks() {
    if (!currentFilePath) return;
    if (state.bookmarks.length === 0) {
      void deletePdfBookmarks(currentFilePath);
      return;
    }
    void savePdfBookmarks(currentFilePath, JSON.stringify(state.bookmarks));
  }

  function addBookmark(pageNum = state.currentPage): PdfBookmark | null {
    const target = Math.round(pageNum);
    if (!Number.isFinite(target) || target < 1 || target > state.pageCount) {
      return null;
    }
    const existing = bookmarkForPage(target);
    if (existing) return existing;
    const usedColors = new Set(
      state.bookmarks.map((bookmark) => bookmark.color),
    );
    const color =
      PDF_BOOKMARK_COLORS.find((candidate) => !usedColors.has(candidate)) ??
      PDF_BOOKMARK_COLORS[state.bookmarks.length % PDF_BOOKMARK_COLORS.length];
    const bookmark: PdfBookmark = { page: target, color, title: "" };
    state.bookmarks = [...state.bookmarks, bookmark];
    persistBookmarks();
    return bookmark;
  }

  function updateBookmark(
    pageNum: number,
    patch: Partial<Pick<PdfBookmark, "color" | "title">>,
  ) {
    state.bookmarks = state.bookmarks.map((bookmark) =>
      bookmark.page === pageNum ? { ...bookmark, ...patch } : bookmark,
    );
    persistBookmarks();
  }

  function removeBookmark(pageNum: number) {
    state.bookmarks = state.bookmarks.filter(
      (bookmark) => bookmark.page !== pageNum,
    );
    persistBookmarks();
  }

  function toggleNightMode() {
    state.nightMode = !state.nightMode;
    savePdfNightMode(state.nightMode);
  }

  async function loadOutline(doc: PDFDocumentProxy, gen: number) {
    try {
      const raw = await doc.getOutline();
      if (!raw || raw.length === 0) {
        if (gen === loadGen && !disposed) state.outline = [];
        return;
      }

      const entries: PdfOutlineEntry[] = [];
      const walk = async (items: unknown[], depth: number) => {
        for (const item of items) {
          const node = item as {
            title?: string;
            dest?: string | unknown[] | null;
            items?: unknown[];
          };
          if (gen !== loadGen || disposed) return;
          const pageNum = await resolveDestPage(doc, node.dest ?? null);
          const title = String(node.title ?? "").trim();
          if (pageNum && title) {
            entries.push({ title, pageNum, depth });
          }
          if (Array.isArray(node.items) && node.items.length > 0) {
            await walk(node.items, depth + 1);
          }
        }
      };
      await walk(raw, 0);

      if (gen !== loadGen || disposed) return;
      state.outline = entries.filter(
        (entry) => entry.pageNum >= 1 && entry.pageNum <= state.pageCount,
      );
    } catch {
      if (gen === loadGen && !disposed) state.outline = [];
    }
  }

  async function openLink(link: PdfLink) {
    const doc = pdfDoc;
    if (!doc || disposed || !link.dest) return;
    try {
      const page = await resolveDestPage(doc, link.dest);
      if (page && !disposed && pdfDoc === doc) {
        scrollToPage(page);
      }
    } catch {
      // Broken destinations should not break the viewer.
    }
  }

  function submitPassword(password: string) {
    const callback = passwordCallback;
    if (!callback) return;
    passwordCallback = null;
    state.passwordPrompt = { visible: false, incorrect: false };
    callback(password);
  }

  function cancelPassword() {
    passwordCallback = null;
    state.passwordPrompt = { visible: false, incorrect: false };
    state.loading = false;
    state.error = locale.t("shell.viewer.pdf.passwordRequired");
    const task = loadingTaskRef;
    loadingTaskRef = null;
    loadGen++;
    disposed = true;
    if (task) void task.destroy().catch(() => {});
  }

  async function serializePdfBytes(): Promise<Uint8Array | null> {
    const doc = pdfDoc;
    if (!doc || disposed) return null;
    return doc.saveDocument();
  }

  function markFormsSaved() {
    if (pdfDoc) {
      try {
        pdfDoc.annotationStorage.resetModified();
      } catch {
        // ignore
      }
    }
    state.formDirty = false;
  }

  function refreshAnnotationLayers() {
    if (!pdfDoc) return;
    for (const page of state.pages) {
      const proxy = pageProxies.get(page.pageNum);
      if (!proxy || !page.rendered) continue;
      clearAnnotationLayer(page.pageNum);
      void renderAnnotationLayer(proxy, page);
    }
  }

  function discardFormChanges() {
    const doc = pdfDoc;
    if (!doc || disposed) return;
    const all = doc.annotationStorage.getAll();
    if (all) {
      for (const key of Object.keys(all)) {
        doc.annotationStorage.remove(key);
      }
    }
    doc.annotationStorage.resetModified();
    state.formDirty = false;
    refreshAnnotationLayers();
  }

  function startRedaction() {
    if (state.encrypted) return;
    state.redactActive = true;
    state.redactions = [];
    state.redactionConfirmOpen = false;
    state.showPagePanel = false;
  }

  function cancelRedaction() {
    state.redactActive = false;
    state.redactions = [];
    state.redactionConfirmOpen = false;
  }

  function requestRedactionConfirm() {
    if (state.redactions.length > 0) state.redactionConfirmOpen = true;
  }

  function setRedactionConfirmOpen(open: boolean) {
    state.redactionConfirmOpen = open;
  }

  function undoRedaction() {
    state.redactions = state.redactions.slice(0, -1);
    if (state.redactions.length === 0) state.redactionConfirmOpen = false;
  }

  function openSignaturePad() {
    if (state.encrypted) return;
    state.redactionConfirmOpen = false;
    state.redactActive = false;
    state.redactions = [];
    state.signatureOpen = true;
  }

  function closeSignaturePad() {
    state.signatureOpen = false;
  }

  function addRedaction(
    pageNum: number,
    rect: { x: number; y: number; width: number; height: number },
  ) {
    if (rect.width <= 0.002 || rect.height <= 0.002) return;
    const x = Math.max(0, Math.min(1, rect.x));
    const y = Math.max(0, Math.min(1, rect.y));
    state.redactions.push({
      id: ++redactionId,
      pageNum,
      x,
      y,
      width: Math.min(1 - x, Math.abs(rect.width)),
      height: Math.min(1 - y, Math.abs(rect.height)),
    });
  }

  function removeRedaction(id: number) {
    state.redactions = state.redactions.filter((item) => item.id !== id);
  }

  function clearRedactions() {
    state.redactions = [];
  }

  async function renderRedactionPages(): Promise<PdfRedactionPageImage[]> {
    const doc = pdfDoc;
    if (!doc || disposed) return [];
    const byPage = new Map<number, PdfRedactionRect[]>();
    for (const rect of state.redactions) {
      const existing = byPage.get(rect.pageNum);
      if (existing) existing.push(rect);
      else byPage.set(rect.pageNum, [rect]);
    }

    const MAX_PIXELS = 16_000_000;
    const images: PdfRedactionPageImage[] = [];
    for (const [pageNum, rects] of byPage) {
      if (disposed || pdfDoc !== doc) return [];
      const pdfPage = pageProxies.get(pageNum);
      if (!pdfPage) continue;
      const pointViewport = pdfPage.getViewport({
        scale: 1,
        rotation: state.rotation,
      });
      const targetScale = Math.min(
        300 / 72,
        Math.sqrt(
          MAX_PIXELS / Math.max(1, pointViewport.width * pointViewport.height),
        ),
      );
      const viewport = pdfPage.getViewport({
        scale: Math.max(1, targetScale),
        rotation: state.rotation,
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      await pdfPage.render({
        canvasContext: ctx,
        viewport,
        annotationMode: pdfjsLib?.AnnotationMode.ENABLE_STORAGE,
      }).promise;
      if (disposed || pdfDoc !== doc) return [];
      ctx.fillStyle = "#000";
      for (const rect of rects) {
        ctx.fillRect(
          rect.x * canvas.width,
          rect.y * canvas.height,
          rect.width * canvas.width,
          rect.height * canvas.height,
        );
      }
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      const comma = dataUrl.indexOf(",");
      images.push({
        pageNum,
        dataBase64: comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl,
        width: canvas.width,
        height: canvas.height,
        widthPt: pointViewport.width,
        heightPt: pointViewport.height,
      });
    }
    return images;
  }

  let findItemsCache: Map<
    number,
    { str: string; x: number; y: number; w: number; h: number }[]
  > = new Map();

  function toggleFind() {
    state.findOpen = !state.findOpen;
    if (!state.findOpen) {
      state.findQuery = "";
      state.findResults = 0;
      state.findCurrentIdx = 0;
      state.findMatchPages = [];
      state.findHighlights = [];
      findItemsCache.clear();
    }
  }

  async function findText(query: string) {
    state.findQuery = query;
    if (!query || !pdfDoc || disposed) {
      state.findResults = 0;
      state.findMatchPages = [];
      state.findHighlights = [];
      return;
    }
    state.findResults = 0;
    state.findMatchPages = [];
    state.findHighlights = [];
    let regex: RegExp | null = null;
    if (state.findRegex) {
      try {
        regex = new RegExp(query, state.findMatchCase ? "g" : "gi");
      } catch {
        state.findCurrentIdx = 0;
        return;
      }
    }
    const needle = state.findMatchCase ? query : query.toLowerCase();
    const isWholeWord = (text: string, index: number, length: number) => {
      if (!state.findWholeWord) return true;
      const before = index > 0 ? text[index - 1] : "";
      const after = index + length < text.length ? text[index + length] : "";
      return !/\w/.test(before) && !/\w/.test(after);
    };

    for (let i = 1; i <= state.pageCount; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const vp = page.getViewport({
          scale: state.scale,
          rotation: state.rotation,
        });
        let items = findItemsCache.get(i);
        if (items === undefined) {
          const content = await getTextContent(i, page);
          if (!content) continue;
          items = [];
          for (const item of content.items) {
            if ("str" in item) {
              const t = item as {
                str: string;
                transform: number[];
                width: number;
                height: number;
              };
              items.push({
                str: t.str,
                x: t.transform[4],
                y: t.transform[5],
                w: t.width,
                h: t.height || 12,
              });
            }
          }
          findItemsCache.set(i, items);
        }
        const pageRects: {
          left: number;
          top: number;
          width: number;
          height: number;
        }[] = [];
        let pageCount = 0;
        for (const item of items) {
          if (regex) {
            regex.lastIndex = 0;
            let match: RegExpExecArray | null;
            while ((match = regex.exec(item.str)) !== null) {
              const idx = match.index;
              const matchLength = match[0].length;
              if (matchLength === 0) {
                regex.lastIndex += 1;
                continue;
              }
              if (!isWholeWord(item.str, idx, matchLength)) continue;
              pageCount++;
              const ratio = idx / item.str.length;
              const matchW = (matchLength / item.str.length) * item.w;
              const startX = item.x + ratio * item.w;
              const endX = startX + matchW;
              // Convert through the page viewport so highlights follow the
              // current rotation instead of assuming an upright page.
              const [vx1, vy1] = vp.convertToViewportPoint(
                startX,
                item.y + item.h * 0.75,
              );
              const [vx2, vy2] = vp.convertToViewportPoint(
                endX,
                item.y - item.h * 0.25,
              );
              pageRects.push({
                left: Math.min(vx1, vx2),
                top: Math.min(vy1, vy2),
                width: Math.max(2, Math.abs(vx2 - vx1)),
                height: Math.max(2, Math.abs(vy2 - vy1)),
              });
            }
            continue;
          }
          const haystack = state.findMatchCase
            ? item.str
            : item.str.toLowerCase();
          let idx = 0;
          while ((idx = haystack.indexOf(needle, idx)) !== -1) {
            if (!isWholeWord(item.str, idx, needle.length)) {
              idx += 1;
              continue;
            }
            pageCount++;
            const ratio = idx / item.str.length;
            const matchW = (needle.length / item.str.length) * item.w;
            const startX = item.x + ratio * item.w;
            const endX = startX + matchW;
            // Convert through the page viewport so highlights follow the
            // current rotation instead of assuming an upright page.
            const [vx1, vy1] = vp.convertToViewportPoint(
              startX,
              item.y + item.h * 0.75,
            );
            const [vx2, vy2] = vp.convertToViewportPoint(
              endX,
              item.y - item.h * 0.25,
            );
            pageRects.push({
              left: Math.min(vx1, vx2),
              top: Math.min(vy1, vy2),
              width: Math.max(2, Math.abs(vx2 - vx1)),
              height: Math.max(2, Math.abs(vy2 - vy1)),
            });
            idx += needle.length;
          }
        }
        if (pageCount > 0) {
          state.findMatchPages.push(i);
          state.findResults += pageCount;
          state.findHighlights.push({ pageNum: i, rects: pageRects });
        }
      } catch {
        // skip failed pages
      }
    }
    state.findCurrentIdx = state.findResults > 0 ? 1 : 0;
    if (state.findMatchPages.length > 0) {
      scrollToPage(state.findMatchPages[0]);
    }
  }

  async function findNext() {
    if (state.findResults === 0 || state.findMatchPages.length === 0) return;
    const idx = state.findCurrentIdx;
    const matchPageIdx = state.findMatchPages.findIndex(
      (p) => p >= state.currentPage,
    );
    const targetIdx = matchPageIdx >= 0 ? matchPageIdx : 0;
    const targetPageIdx = (targetIdx + 1) % state.findMatchPages.length;
    state.findCurrentIdx = Math.min(
      state.findCurrentIdx + 1,
      state.findResults,
    );
    scrollToPage(state.findMatchPages[targetPageIdx]);
  }

  async function findPrev() {
    if (state.findResults === 0 || state.findMatchPages.length === 0) return;
    const matchPageIdx = state.findMatchPages.findIndex(
      (p) => p >= state.currentPage,
    );
    const targetIdx =
      matchPageIdx > 0 ? matchPageIdx - 1 : state.findMatchPages.length - 1;
    state.findCurrentIdx = Math.max(state.findCurrentIdx - 1, 1);
    scrollToPage(state.findMatchPages[targetIdx]);
  }

  function setFindOption(option: "case" | "word" | "regex") {
    if (option === "case") {
      state.findMatchCase = !state.findMatchCase;
    } else if (option === "word") {
      state.findWholeWord = !state.findWholeWord;
    } else {
      state.findRegex = !state.findRegex;
    }
    if (state.findQuery) void findText(state.findQuery);
  }

  return {
    get state() {
      return state;
    },
    setContainer,
    loadFile,
    cleanup,
    setScale,
    fitToScreen,
    fitToWidth,
    fitToPage,
    resetScale,
    clampScale,
    scrollToPage,
    centerPage,
    prevPage,
    nextPage,
    goToPage,
    selectPage,
    rotate,
    toggleDualPage,
    toggleSinglePage,
    bookmarkForPage,
    addBookmark,
    updateBookmark,
    removeBookmark,
    toggleNightMode,
    setPanelTab,
    openLink,
    submitPassword,
    cancelPassword,
    serializePdfBytes,
    markFormsSaved,
    discardFormChanges,
    startRedaction,
    cancelRedaction,
    requestRedactionConfirm,
    setRedactionConfirmOpen,
    undoRedaction,
    openSignaturePad,
    closeSignaturePad,
    addRedaction,
    removeRedaction,
    clearRedactions,
    renderRedactionPages,
    toggleFind,
    findText,
    findNext,
    findPrev,
    setFindOption,
    getPageText,
    renderPagesForPrint,
    togglePagePanel,
    getPageThumbnail,
    preloadAllThumbnails,
  };
}
