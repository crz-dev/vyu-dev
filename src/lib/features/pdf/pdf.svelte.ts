// PDF rendering
import { convertFileSrc } from "@tauri-apps/api/core";
import type {
  PDFDocumentProxy,
  PDFPageProxy,
} from "pdfjs-dist/types/src/display/api";

export interface PdfPage {
  pageNum: number;
  canvasRef: HTMLCanvasElement | null;
  rendered: boolean;
  width: number;
  height: number;
}

export interface PdfState {
  pages: PdfPage[];
  scale: number;
  pageCount: number;
  loading: boolean;
  error: string;
}

const RENDER_DEBOUNCE_MS = 60;
const LOAD_TIMEOUT_MS = 45_000;

export type PdfStore = ReturnType<typeof createPdf>;

export function createPdf() {
  const state = $state<PdfState>({
    pages: [],
    scale: 1.0,
    pageCount: 0,
    loading: false,
    error: "",
  });

  let pdfDoc: PDFDocumentProxy | null = null;
  let observer: IntersectionObserver | null = null;
  let renderTimers: Map<number, ReturnType<typeof setTimeout>> = new Map();
  let pdfContainerEl: HTMLElement | null = null;
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
    } catch (err) {
      console.error(`Failed to render PDF page ${page.pageNum}:`, err);
    }
  }

  function setupObserver() {
    if (disposed) return;
    if (observer) observer.disconnect();

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
  }

  async function loadFile(path: string): Promise<void> {
    cleanup();
    disposed = false;
    state.loading = true;
    state.error = "";
    state.pages = [];
    state.pageCount = 0;

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
        });
      }
      state.pages = pages;
      state.loading = false;
      clearTimeout(timeoutId);

      // Wait for page promises to resolve before setting up observer
      await Promise.allSettled(pagePromises);

      // Defer observer setup so DOM has a chance to bind canvas refs
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
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
    state.loading = false;
    state.error = "";
    state.scale = 1.0;
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
  };
}
