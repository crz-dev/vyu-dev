// PDF rendering
import { convertFileSrc } from "@tauri-apps/api/core";
import { setCached } from "$lib/services/thumbnailCache";
import { getFileExt } from "$lib/services/files";
import { DOCUMENT_EXTS } from "$lib/shared/constants";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

// Standalone PDF page 1 thumbnail generator.
// Used by library and thumbnail bar when the backend (FFmpeg) can't handle PDFs.
const PDF_THUMB_CONCURRENT = 2;
let pdfThumbInflight = 0;
let pdfThumbQueue: Array<() => void> = [];

async function acquirePdfSlot(): Promise<void> {
  if (pdfThumbInflight < PDF_THUMB_CONCURRENT) {
    pdfThumbInflight++;
    return;
  }
  await new Promise<void>((resolve) => pdfThumbQueue.push(resolve));
  pdfThumbInflight++;
}

function releasePdfSlot(): void {
  pdfThumbInflight--;
  const next = pdfThumbQueue.shift();
  if (next) {
    pdfThumbInflight++;
    next();
  }
}

export async function generatePdfThumbnail(
  path: string,
  size: number,
): Promise<string> {
  await acquirePdfSlot();
  try {
    const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");
    const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
    globalThis.pdfjsWorker = pdfjsWorker;
    pdfjsLib.GlobalWorkerOptions.workerSrc = ".";

    const url = convertFileSrc(path);
    const loadingTask = pdfjsLib.getDocument({
      url,
      enableXfa: true,
      disableAutoFetch: false,
    });
    const pdfDoc = await loadingTask.promise;

    const page = await pdfDoc.getPage(1);
    const vp = page.getViewport({ scale: 1 });
    const scale = size / Math.max(vp.width, vp.height);
    const renderVp = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(renderVp.width);
    canvas.height = Math.floor(renderVp.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    await page.render({ canvasContext: ctx, viewport: renderVp }).promise;
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    pdfDoc.destroy();
    return dataUrl;
  } catch {
    return "";
  } finally {
    releasePdfSlot();
  }
}

export function isPdfPath(path: string): boolean {
  return DOCUMENT_EXTS.includes(getFileExt(path));
}

export interface PdfPage {
  pageNum: number;
  canvasRef: HTMLCanvasElement | null;
  rendered: boolean;
  width: number;
  height: number;
  pageHeight: number;
}

export interface FindHighlight {
  pageNum: number;
  rects: { left: number; top: number; width: number; height: number }[];
}

export interface PdfState {
  pages: PdfPage[];
  scale: number;
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
  showPagePanel: boolean;
  pdfVersion: string;
  pdfPageSize: string;
}

const RENDER_DEBOUNCE_MS = 60;
const LOAD_TIMEOUT_MS = 45_000;

export type PdfStore = ReturnType<typeof createPdf>;

export function createPdf() {
  const state = $state<PdfState>({
    pages: [],
    scale: 1.0,
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
    showPagePanel: false,
    pdfVersion: "",
    pdfPageSize: "",
  });

  let pdfDoc: PDFDocumentProxy | null = null;
  let observer: IntersectionObserver | null = null;
  let renderTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  let pdfContainerEl: HTMLElement | null = null;
  let scrollHandler: ((e: Event) => void) | null = null;
  let currentFilePath = "";
  let disposed = false;

  function setContainer(el: HTMLElement | null) {
    pdfContainerEl = el;
  }

  function clampScale(value: number): number {
    return Math.max(0.25, Math.min(5, value));
  }

  function setScale(val: number) {
    const newScale = clampScale(val);
    if (state.scale === newScale) return;
    state.scale = newScale;
    // Mark all pages for re-render at new scale
    for (const page of state.pages) {
      page.rendered = false;
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

  async function renderPage(pdfPage: PDFPageProxy, page: PdfPage) {
    if (disposed) return;
    const canvas = page.canvasRef;
    if (!canvas || !pdfPage) return;
    if (page.rendered) return;

    const viewport = pdfPage.getViewport({ scale: state.scale });
    page.width = viewport.width;
    page.height = viewport.height;

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

  function updateCurrentPage() {
    if (!pdfContainerEl || state.pages.length === 0) return;
    const containerRect = pdfContainerEl.getBoundingClientRect();
    const containerTop = containerRect.top;
    let closest = state.currentPage;
    let closestDist = Infinity;
    for (const page of state.pages) {
      if (!page.canvasRef) continue;
      const rect = page.canvasRef.getBoundingClientRect();
      const dist = Math.abs(rect.top - containerTop);
      if (dist < closestDist) {
        closestDist = dist;
        closest = page.pageNum;
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
    pdfContainerEl?.addEventListener("scroll", scrollHandler, { passive: true });
  }

  async function loadFile(path: string): Promise<void> {
    cleanup();
    disposed = false;
    currentFilePath = path;
    state.loading = true;
    state.error = "";
    state.pages = [];
    state.pageCount = 0;
    state.currentPage = 1;

    const timeoutId = setTimeout(() => {
      if (state.loading) {
        state.loading = false;
        state.error =
          "PDF loading timed out. The file may be too large or corrupted.";
        console.error("PDF load timed out after", LOAD_TIMEOUT_MS, "ms");
      }
    }, LOAD_TIMEOUT_MS);

    try {
      // Dynamic import so pdfjs-dist only loads when a PDF is opened (code-split)
      const pdfjsLib = await import("pdfjs-dist/build/pdf.mjs");

      // Preload the worker module on the main thread — this triggers PDF.js's
      // built-in "fake worker" mode, which runs worker logic on the main thread
      // instead of spawning a Web Worker.  Necessary because Tauri's WebView2
      // custom protocol (asset://) does not support Web Workers.
      const pdfjsWorker = await import("pdfjs-dist/build/pdf.worker.min.mjs");
      globalThis.pdfjsWorker = pdfjsWorker;

      // Must be a truthy non-empty string — PDF.js 4.x checks for falsy
      pdfjsLib.GlobalWorkerOptions.workerSrc = ".";

      const url = convertFileSrc(path);
      const loadingTask = pdfjsLib.getDocument({
        url,
        enableXfa: true,
        disableAutoFetch: false,
      });
      pdfDoc = await loadingTask.promise;

      const numPages = pdfDoc.numPages;
      state.pageCount = numPages;

      const pagePromises: Promise<PDFPageProxy>[] = [];
      for (let i = 1; i <= numPages; i++) {
        pagePromises.push(pdfDoc.getPage(i));
      }

      const pages: PdfPage[] = [];
      for (let i = 1; i <= numPages; i++) {
        pages.push({
          pageNum: i,
          canvasRef: null,
          rendered: false,
          width: 0,
          height: 0,
          pageHeight: 0,
        });
      }
      state.pages = pages;
      state.loading = false;
      clearTimeout(timeoutId);

      // Wait for page promises to resolve
      const pageResults = await Promise.allSettled(pagePromises);

      // Store viewport heights and pre-set canvas dimensions so DOM layout is correct
      // even for pages not yet rendered
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );

      for (let i = 0; i < numPages; i++) {
        const result = pageResults[i];
        if (result.status === "fulfilled") {
          const pdfPage = result.value;
          const vp = pdfPage.getViewport({ scale: 1 });
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
        const meta = await pdfDoc.getMetadata();
        const info = meta.info as Record<string, unknown> | undefined;
        if (info?.PDFFormatVersion) {
          state.pdfVersion = String(info.PDFFormatVersion);
        }
      } catch { /* ignore */ }

      setupObserver();

      if (observer) {
        for (const page of state.pages) {
          if (page.canvasRef) observer.observe(page.canvasRef);
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      state.loading = false;
      state.error = err instanceof Error ? err.message : "Failed to load PDF";
      console.error("PDF load error:", err);
    }
  }

  function cleanup() {
    disposed = true;
    for (const [, timer] of renderTimers) clearTimeout(timer);
    renderTimers.clear();
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
    state.findOpen = false;
    state.findQuery = "";
    state.findResults = 0;
    state.findCurrentIdx = 0;
    state.findMatchPages = [];
    state.findHighlights = [];
    findItemsCache.clear();
    findPageHeights.clear();
    state.showPagePanel = false;
    state.pdfVersion = "";
    state.pdfPageSize = "";
    pageThumbnailCache.clear();
  }

  let pageThumbnailCache: Map<number, string> = new Map();

  function togglePagePanel() {
    state.showPagePanel = !state.showPagePanel;
    if (!state.showPagePanel) pageThumbnailCache.clear();
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
    const SEP = 25;
    const FALLBACK = 800;
    let top = 0;
    for (const p of state.pages) {
      if (p.pageNum >= pageNum) break;
      top += (p.height > 0 ? p.height : FALLBACK) * state.scale + SEP;
    }
    pdfContainerEl.scrollTo({ top, behavior: "smooth" });
  }

  function centerPage(pageNum: number) {
    if (!pdfContainerEl) return;
    const SEP = 25;
    const FALLBACK = 800;
    let pageTop = 0;
    let pageH = 0;
    for (const p of state.pages) {
      if (p.pageNum === pageNum) {
        pageH = (p.height > 0 ? p.height : FALLBACK) * state.scale;
        break;
      }
      pageTop += (p.height > 0 ? p.height : FALLBACK) * state.scale + SEP;
    }
    const viewH = pdfContainerEl.clientHeight;
    const top = pageTop - (viewH - pageH) / 2;
    pdfContainerEl.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function prevPage() {
    const next = Math.max(1, state.currentPage - 1);
    centerPage(next);
  }

  function nextPage() {
    const next = Math.min(state.pageCount, state.currentPage + 1);
    centerPage(next);
  }

  let findItemsCache: Map<number, { str: string; x: number; y: number; w: number; h: number }[]> = new Map();
  let findPageHeights: Map<number, number> = new Map();

  function toggleFind() {
    state.findOpen = !state.findOpen;
    if (!state.findOpen) {
      state.findQuery = "";
      state.findResults = 0;
      state.findCurrentIdx = 0;
      state.findMatchPages = [];
      state.findHighlights = [];
      findItemsCache.clear();
      findPageHeights.clear();
    }
  }

  async function findText(query: string) {
    if (!query || !pdfDoc || disposed) {
      state.findResults = 0;
      state.findMatchPages = [];
      state.findHighlights = [];
      return;
    }
    state.findQuery = query;
    state.findResults = 0;
    state.findMatchPages = [];
    state.findHighlights = [];
    const lowerQuery = query.toLowerCase();
    const scale = state.scale;

    for (let i = 1; i <= state.pageCount; i++) {
      try {
        let items = findItemsCache.get(i);
        let pageH = findPageHeights.get(i);
        if (items === undefined || pageH === undefined) {
          const page = await pdfDoc.getPage(i);
          const vp = page.getViewport({ scale: 1 });
          pageH = vp.height;
          findPageHeights.set(i, pageH);
          const content = await page.getTextContent();
          items = [];
          for (const item of content.items) {
            if ("str" in item) {
              const t = item as { str: string; transform: number[]; width: number; height: number };
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
        const pageRects: { left: number; top: number; width: number; height: number }[] = [];
        let pageCount = 0;
        for (const item of items) {
          const lower = item.str.toLowerCase();
          let idx = 0;
          while ((idx = lower.indexOf(lowerQuery, idx)) !== -1) {
            pageCount++;
            const ratio = idx / item.str.length;
            const matchW = (lowerQuery.length / item.str.length) * item.w;
            pageRects.push({
              left: (item.x + ratio * item.w) * scale,
              top: (pageH - item.y - item.h * 0.75) * scale,
              width: matchW * scale,
              height: item.h * 1.15 * scale,
            });
            idx += lowerQuery.length;
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
    state.findCurrentIdx = Math.min(state.findCurrentIdx + 1, state.findResults);
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

  return {
    get state() {
      return state;
    },
    setContainer,
    loadFile,
    cleanup,
    setScale,
    clampScale,
    scrollToPage,
    centerPage,
    prevPage,
    nextPage,
    toggleFind,
    findText,
    findNext,
    findPrev,
    togglePagePanel,
    getPageThumbnail,
    preloadAllThumbnails,
  };
}
