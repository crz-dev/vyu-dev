<script lang="ts">
  import { fade, fly } from "svelte/transition";
  import { showToast } from "$lib/components/toast.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";
  import type { DrawPoint } from "$lib/features/markup/markup.svelte";
  import {
    loadSavedSignatures,
    saveSavedSignatures,
    type SavedSignature,
  } from "$lib/services/storage";

  const t = locale.t;

  let {
    open,
    onApply,
    onCancel,
  }: {
    open: boolean;
    onApply: (paths: DrawPoint[][]) => void;
    onCancel: () => void;
  } = $props();

  const WIDTH = 420;
  const HEIGHT = 150;
  const MAX_SAVED_SIGNATURES = 8;

  let canvasEl: HTMLCanvasElement | null = $state(null);
  let paths = $state<DrawPoint[][]>([]);
  let current: DrawPoint[] | null = null;
  let drawing = false;
  let savedSignatures = $state<SavedSignature[]>([]);
  let savedOpen = $state(false);
  let savedWrapEl: HTMLDivElement | null = $state(null);
  let fileInputEl: HTMLInputElement | null = $state(null);

  function setupCanvas(node: HTMLCanvasElement) {
    const dpr = window.devicePixelRatio || 1;
    node.width = Math.floor(WIDTH * dpr);
    node.height = Math.floor(HEIGHT * dpr);
    node.style.width = "100%";
    node.style.height = "auto";
    const ctx = node.getContext("2d");
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#111";
      ctx.fillStyle = "#111";
      ctx.lineWidth = 2.2;
    }
    canvasEl = node;
    return {
      destroy() {
        canvasEl = null;
      },
    };
  }

  function toPoint(e: PointerEvent): DrawPoint {
    const rect = canvasEl?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || rect.height <= 0) return { x: 0, y: 0 };
    return {
      x: Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
    };
  }

  function drawPath(
    ctx: CanvasRenderingContext2D,
    points: DrawPoint[],
    width: number,
    height: number,
  ) {
    if (points.length === 0) return;
    const first = points[0];
    ctx.beginPath();
    ctx.moveTo(first.x * width, first.y * height);
    if (points.length === 1) {
      ctx.arc(
        first.x * width,
        first.y * height,
        ctx.lineWidth / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      return;
    }
    if (points.length === 2) {
      ctx.lineTo(points[1].x * width, points[1].y * height);
      ctx.stroke();
      return;
    }
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];
      const next = points[i + 1];
      ctx.quadraticCurveTo(
        point.x * width,
        point.y * height,
        ((point.x + next.x) / 2) * width,
        ((point.y + next.y) / 2) * height,
      );
    }
    const last = points[points.length - 1];
    ctx.lineTo(last.x * width, last.y * height);
    ctx.stroke();
  }

  function redraw() {
    const canvas = canvasEl;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    for (const path of paths) {
      drawPath(ctx, path, WIDTH, HEIGHT);
    }
    if (current) drawPath(ctx, current, WIDTH, HEIGHT);
  }

  function appendPoints(e: PointerEvent) {
    if (!drawing || !current) return;
    const coalesced =
      typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : [];
    const events = coalesced.length > 0 ? coalesced : [e];
    let changed = false;
    for (const event of events) {
      const point = toPoint(event);
      const last = current[current.length - 1];
      if (
        Math.abs(point.x - last.x) < 0.0015 &&
        Math.abs(point.y - last.y) < 0.0015
      ) {
        continue;
      }
      current.push(point);
      changed = true;
    }
    if (changed) redraw();
  }

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing = true;
    current = [toPoint(e)];
    redraw();
  }

  function onPointerMove(e: PointerEvent) {
    appendPoints(e);
  }

  function onPointerUp(e: PointerEvent) {
    if (!drawing) return;
    drawing = false;
    if (current && current.length >= 2) {
      paths = [...paths, current];
    }
    current = null;
    redraw();
    try {
      (e.currentTarget as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  function clear() {
    paths = [];
    current = null;
    redraw();
  }

  function apply() {
    if (paths.length === 0) return;
    // Paths are normalized to the pad's displayed size for drawing. Convert y
    // to a width-normalized space so the signature keeps its true aspect ratio
    // when it is scaled onto a page with a different aspect.
    const rect = canvasEl?.getBoundingClientRect();
    const aspect =
      rect && rect.width > 0 ? rect.height / rect.width : HEIGHT / WIDTH;
    onApply(
      paths.map((path) =>
        path.map((point) => ({ x: point.x, y: point.y * aspect })),
      ),
    );
  }

  function pixelBounds(pathsToMeasure: DrawPoint[][]) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const path of pathsToMeasure) {
      for (const point of path) {
        const x = point.x * WIDTH;
        const y = point.y * HEIGHT;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    if (!Number.isFinite(minX)) {
      return { minX: 0, minY: 0, width: WIDTH, height: HEIGHT };
    }
    return {
      minX,
      minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  function makeThumbnail(pathsToDraw: DrawPoint[][]): string {
    const thumbWidth = 180;
    const thumbHeight = 60;
    const padding = 8;
    const canvas = document.createElement("canvas");
    canvas.width = thumbWidth;
    canvas.height = thumbHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";
    const bounds = pixelBounds(pathsToDraw);
    const scale = Math.min(
      (thumbWidth - padding * 2) / bounds.width,
      (thumbHeight - padding * 2) / bounds.height,
    );
    const offsetX = (thumbWidth - bounds.width * scale) / 2;
    const offsetY = (thumbHeight - bounds.height * scale) / 2;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, thumbWidth, thumbHeight);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const path of pathsToDraw) {
      if (path.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(
        offsetX + (path[0].x * WIDTH - bounds.minX) * scale,
        offsetY + (path[0].y * HEIGHT - bounds.minY) * scale,
      );
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(
          offsetX + (path[i].x * WIDTH - bounds.minX) * scale,
          offsetY + (path[i].y * HEIGHT - bounds.minY) * scale,
        );
      }
      ctx.stroke();
    }
    return canvas.toDataURL("image/png");
  }

  function saveCurrent() {
    if (paths.length === 0) return;
    const thumb = makeThumbnail(paths);
    const signature: SavedSignature = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: Date.now(),
      paths: paths.map((path) => path.map((point) => ({ ...point }))),
      thumb,
    };
    savedSignatures = [signature, ...savedSignatures].slice(
      0,
      MAX_SAVED_SIGNATURES,
    );
    saveSavedSignatures(savedSignatures);
    savedOpen = false;
    showToast({
      message: t("shell.viewer.pdf.signSavedToast"),
      color: "blue",
    });
  }

  function useSaved(signature: SavedSignature) {
    paths = signature.paths.map((path) =>
      path.map((point) => ({ x: point.x, y: point.y })),
    );
    current = null;
    savedOpen = false;
    requestAnimationFrame(redraw);
  }

  function deleteSaved(id: string) {
    savedSignatures = savedSignatures.filter((item) => item.id !== id);
    saveSavedSignatures(savedSignatures);
  }

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = src;
    });
  }

  function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Failed to read image"));
      };
      reader.onerror = () => reject(reader.error ?? new Error("Read failed"));
      reader.readAsDataURL(file);
    });
  }

  async function imageToPaths(file: File): Promise<DrawPoint[][]> {
    const dataUrl = await readFileAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const maxWidth = 420;
    const maxHeight = 170;
    const ratio = Math.min(
      1,
      maxWidth / image.naturalWidth,
      maxHeight / image.naturalHeight,
    );
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const source = document.createElement("canvas");
    source.width = width;
    source.height = height;
    const sourceCtx = source.getContext("2d", {
      willReadFrequently: true,
    });
    if (!sourceCtx) throw new Error("Could not read image");
    sourceCtx.drawImage(image, 0, 0, width, height);
    const data = sourceCtx.getImageData(0, 0, width, height).data;

    let hasAlpha = false;
    let edgeLuma = 0;
    let edgeCount = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const alpha = data[i + 3];
        if (alpha < 248) hasAlpha = true;
        const isEdge = x < 2 || y < 2 || x >= width - 2 || y >= height - 2;
        if (isEdge && alpha >= 24) {
          edgeLuma +=
            0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
          edgeCount++;
        }
      }
    }
    const invert = !hasAlpha && edgeCount > 0 && edgeLuma / edgeCount < 110;

    const ink = new Uint8Array(width * height);
    let inkCount = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixel = y * width + x;
        const i = pixel * 4;
        const alpha = data[i + 3];
        if (alpha < 24) continue;
        const luma =
          0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
        const isInk = hasAlpha ? luma < 210 : invert ? luma > 160 : luma < 170;
        if (!isInk) continue;
        ink[pixel] = 1;
        inkCount++;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    // Light ink on a transparent background has no dark pixels; fall back to
    // the alpha silhouette in that case.
    if (inkCount === 0 && hasAlpha) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixel = y * width + x;
          if (data[pixel * 4 + 3] < 24) continue;
          ink[pixel] = 1;
          inkCount++;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (maxX < minX || maxY < minY) return [];

    const cropWidth = maxX - minX + 1;
    const cropHeight = maxY - minY + 1;
    const fit = Math.min(
      (WIDTH * 0.9) / cropWidth,
      (HEIGHT * 0.78) / cropHeight,
    );
    const offsetX = (WIDTH - cropWidth * fit) / 2;
    const offsetY = (HEIGHT - cropHeight * fit) / 2;
    const result: DrawPoint[][] = [];

    // Compose the bitmap from horizontal ink runs. Rows are close enough that
    // the round pen strokes merge into a smooth, solid shape when scaled.
    for (let y = minY; y <= maxY; y++) {
      let runStart = -1;
      for (let x = minX; x <= maxX + 1; x++) {
        const isInk = x <= maxX && ink[y * width + x] === 1;
        if (isInk && runStart < 0) {
          runStart = x;
        } else if (!isInk && runStart >= 0) {
          const runEnd = x - 1;
          const normalizedY = (offsetY + (y - minY + 0.5) * fit) / HEIGHT;
          result.push([
            {
              x: (offsetX + (runStart - minX) * fit) / WIDTH,
              y: normalizedY,
            },
            {
              x: (offsetX + (runEnd - minX + 0.5) * fit) / WIDTH,
              y: normalizedY,
            },
          ]);
          runStart = -1;
        }
      }
    }

    return result;
  }

  async function handleUpload(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const uploaded = await imageToPaths(file);
      if (uploaded.length === 0) throw new Error("No signature found");
      paths = uploaded;
      current = null;
      savedOpen = false;
      requestAnimationFrame(redraw);
    } catch {
      showToast({
        message: t("shell.viewer.pdf.signUploadFailed"),
        color: "red",
      });
    }
  }

  $effect(() => {
    if (!open) {
      savedOpen = false;
      return;
    }
    paths = [];
    current = null;
    savedSignatures = loadSavedSignatures();
    requestAnimationFrame(redraw);
  });

  $effect(() => {
    if (!savedOpen || !savedWrapEl) return;
    const closeOnOutsideClick = (event: Event) => {
      if (
        event.target instanceof Node &&
        savedWrapEl &&
        !savedWrapEl.contains(event.target)
      ) {
        savedOpen = false;
      }
    };
    document.addEventListener("pointerdown", closeOnOutsideClick, true);
    return () =>
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
  });
</script>

<svelte:window
  onkeydowncapture={(e) => {
    if (!open || e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    if (savedOpen) {
      savedOpen = false;
      return;
    }
    onCancel();
  }}
/>

{#if open}
  <div
    class="pdf-password-overlay pdf-signature-overlay"
    role="presentation"
    transition:fade={{ duration: 210 }}
    onmousedown={(e) => {
      if (e.target === e.currentTarget) onCancel();
    }}
  >
    <div
      class="delete-dialog props-dialog pdf-signature-card"
      role="dialog"
      aria-modal="true"
      aria-label={t("shell.viewer.pdf.sign")}
      transition:fly={{ y: 12, duration: 190, opacity: 0.08 }}
    >
      <div class="props-header-bar">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 2l7 8-7 12-7-12 7-8Z" />
          <path d="M12 2v20" />
          <circle cx="12" cy="10" r="1.5" />
        </svg>
        <div>
          <p class="delete-title">{t("shell.viewer.pdf.sign")}</p>
          <p class="delete-subtitle">{t("shell.viewer.pdf.signHint")}</p>
        </div>
        <button
          type="button"
          class="dialog-close-x"
          onclick={onCancel}
          aria-label={t("common.close")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="pdf-signature-toolbar">
        <div class="pdf-sig-saved-wrap" bind:this={savedWrapEl}>
          <button
            type="button"
            class="pdf-sig-tool"
            class:open={savedOpen}
            aria-haspopup="true"
            aria-expanded={savedOpen}
            onclick={() => (savedOpen = !savedOpen)}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M6 3h9l5 5v13H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="M15 3v5h5M8 13h8M8 17h5"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{t("shell.viewer.pdf.signSaved")}</span>
            <svg
              class="pdf-sig-chevron"
              class:open={savedOpen}
              width="9"
              height="9"
              viewBox="0 0 24 24"
              fill="none"
            >
              <path
                d="m6 9 6 6 6-6"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>

          {#if savedOpen}
            <div
              class="pdf-sig-saved-menu"
              transition:fly={{ y: -4, duration: 150, opacity: 0.05 }}
            >
              {#if savedSignatures.length === 0}
                <div class="pdf-sig-saved-empty">
                  {t("shell.viewer.pdf.signSavedEmpty")}
                </div>
              {:else}
                {#each savedSignatures as signature (signature.id)}
                  <div class="pdf-sig-saved-row">
                    <button
                      type="button"
                      class="pdf-sig-saved-use"
                      onclick={() => useSaved(signature)}
                    >
                      <img
                        class="pdf-sig-saved-thumb"
                        src={signature.thumb}
                        alt=""
                        draggable="false"
                      />
                      <span>
                        {locale.formatDate(signature.createdAt, {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </button>
                    <button
                      type="button"
                      class="pdf-sig-saved-delete"
                      onclick={() => deleteSaved(signature.id)}
                      aria-label={t("shell.viewer.pdf.signDelete")}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6v14H5V6" />
                        <path d="M10 11v5M14 11v5" />
                      </svg>
                    </button>
                  </div>
                {/each}
              {/if}
            </div>
          {/if}
        </div>

        <div class="pdf-sig-toolbar-actions">
          <button
            type="button"
            class="pdf-sig-tool"
            onclick={saveCurrent}
            disabled={paths.length === 0}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 3h11l3 3v15H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="M8 3v6h8V3M8 21v-7h8v7"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
            <span>{t("shell.viewer.pdf.signSave")}</span>
          </button>
          <button
            type="button"
            class="pdf-sig-tool"
            onclick={() => fileInputEl?.click()}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <rect
                x="3"
                y="3"
                width="18"
                height="18"
                rx="2"
                stroke="currentColor"
                stroke-width="1.6"
              />
              <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
              <path
                d="m4 17 4.5-4.5 4 4L16 13l4 4"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span>{t("shell.viewer.pdf.signUpload")}</span>
          </button>
          <input
            bind:this={fileInputEl}
            class="pdf-sig-file-input"
            type="file"
            accept="image/*"
            onchange={handleUpload}
          />
        </div>
      </div>

      <div class="props-list">
        <canvas
          class="pdf-signature-canvas"
          use:setupCanvas
          onpointerdown={onPointerDown}
          onpointermove={onPointerMove}
          onpointerup={onPointerUp}
          onpointercancel={onPointerUp}
          aria-label={t("shell.viewer.pdf.signHint")}
        ></canvas>
      </div>

      <div class="props-actions-card pdf-signature-actions">
        <div class="props-actions">
          <button
            type="button"
            class="props-btn props-btn-secondary"
            onclick={clear}
            disabled={paths.length === 0}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M5 19h14M8 15l7-7a2.1 2.1 0 0 1 3 3l-7 7H8v-3Z"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {t("shell.viewer.pdf.signClear")}
          </button>
          <button
            type="button"
            class="props-btn props-btn-secondary"
            onclick={onCancel}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M18 6L6 18M6 6l12 12"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
              />
            </svg>
            {t("common.cancel")}
          </button>
          <button
            type="button"
            class="props-btn"
            onclick={apply}
            disabled={paths.length === 0}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path
                d="M20 6L9 17l-5-5"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            {t("common.apply")}
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
