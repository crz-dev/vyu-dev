// DATAFLOW: createPdf manages PDF.js document loading and per-page canvas rendering.
// Pages are rendered lazily via IntersectionObserver for large documents.
// Zoom re-renders visible pages at the new scale.
import { convertFileSrc } from "@tauri-apps/api/core";

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

export function createPdf() {
  const state = $state<PdfState>({
    pages: [],
    scale: 1.0,
    pageCount: 0,
    loading: false,
    error: "",
  });

  let pdfDoc: any = null;
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
    // Trigger observer to re-render visible pages
    if (observer && pdfContainerEl) {
      for (const page of state.pages) {
        if (page.canvasRef) observer.observe(page.canvasRef);
      }
    }
  }

  function scheduleRender(pdfPage: any, page: PdfPage) {
    const pageNum = page.pageNum;
    const existing = renderTimers.get(pageNum);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      renderTimers.delete(pageNum);
      renderPage(pdfPage, page);
    }, RENDER_DEBOUNCE_MS);

    renderTimers.set(pageNum, timer);
  }

  async function renderPage(pdfPage: any, page: PdfPage) {
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
            const pdfPage = (pdfDoc as any)?._transport?._pagePromises?.[
              page.pageNum - 1
            ];
            const resolvedPage =
              pdfPage instanceof Promise ? null : pdfDoc?.getPage?.(page.pageNum);
            if (resolvedPage) {
              scheduleRender(resolvedPage, page);
            } else {
              // Page not yet loaded; fetch it
              pdfDoc
                ?.getPage(page.pageNum)
                ?.then((p: any) => scheduleRender(p, page))
                ?.catch(() => {});
            }
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

  // Pre-fetch all pages (needed because getPage is async)
  let pagePromises: Map<number, Promise<any>> = new Map();

  async function loadFile(path: string): Promise<void> {
    cleanup();
    disposed = false;
    state.loading = true;
    state.error = "";
    state.pages = [];
    state.pageCount = 0;
    pagePromises = new Map();

    try {
      const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

      // Resolve worker — try bundled first, fall back to CDN
      try {
        const workerUrl = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url,
        );
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl.href;
      } catch {
        // Fallback CDN
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/legacy/build/pdf.worker.min.mjs";
      }

      const url = convertFileSrc(path);
      const loadingTask = pdfjsLib.getDocument({
        url,
        enableXfa: true,
        disableAutoFetch: false,
      });
      pdfDoc = await loadingTask.promise;

      const numPages = pdfDoc.numPages;
      state.pageCount = numPages;

      // Pre-fetch all pages
      for (let i = 1; i <= numPages; i++) {
        pagePromises.set(i, pdfDoc.getPage(i));
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

      // Wait for pages to resolve, then set up observer
      await Promise.allSettled(pagePromises.values());

      // Defer observer setup so DOM can bind canvas refs
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      setupObserver();

      if (observer) {
        for (const page of state.pages) {
          if (page.canvasRef) observer.observe(page.canvasRef);
        }
      }
    } catch (err) {
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
    pagePromises.clear();
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
