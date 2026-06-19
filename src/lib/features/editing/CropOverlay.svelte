<script lang="ts">
  import { editing } from "$lib/features/editing/editing.svelte";

  let {
    containerEl,
    mediaEl,
  }: { containerEl: HTMLElement | null; mediaEl: HTMLElement | null } =
    $props();

  let dragging = $state<
    "tl" | "tr" | "bl" | "br" | "tm" | "bm" | "ml" | "mr" | "move" | null
  >(null);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let dragStartBounds = $state({ left: 0, top: 0, right: 0, bottom: 0 });
  let overlayRect = $state({ left: 0, top: 0, width: 0, height: 0 });
  let resizeObs: ResizeObserver | null = $state(null);

  function updateOverlayRect() {
    if (!containerEl || !mediaEl) return;
    const cr = containerEl.getBoundingClientRect();
    const mr = mediaEl.getBoundingClientRect();
    overlayRect = {
      left: mr.left - cr.left,
      top: mr.top - cr.top,
      width: mr.width,
      height: mr.height,
    };
  }

  $effect(() => {
    if (editing.cropMode && mediaEl && containerEl) {
      updateOverlayRect();
      if (!resizeObs) {
        resizeObs = new ResizeObserver(() => updateOverlayRect());
        resizeObs.observe(mediaEl);
        resizeObs.observe(containerEl);
      }
    } else {
      if (resizeObs) {
        resizeObs.disconnect();
        resizeObs = null;
      }
    }
  });

  function handleMouseDown(
    e: MouseEvent,
    handle: "tl" | "tr" | "bl" | "br" | "tm" | "bm" | "ml" | "mr" | "move",
  ) {
    e.preventDefault();
    e.stopPropagation();
    editing.pushUndo();
    dragging = handle;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartBounds = { ...editing.snapshot.cropBounds };

    if (handle !== "move") {
      editing.snapshot.cropAspectRatio = null;
    }

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (
      !dragging ||
      !mediaEl ||
      overlayRect.width <= 0 ||
      overlayRect.height <= 0
    )
      return;

    const dx = (e.clientX - dragStartX) / overlayRect.width;
    const dy = (e.clientY - dragStartY) / overlayRect.height;

    const minSize = 0.05;

    if (dragging === "move") {
      const cropWidth = 1 - dragStartBounds.left - dragStartBounds.right;
      const cropHeight = 1 - dragStartBounds.top - dragStartBounds.bottom;
      const newLeft = Math.max(
        0,
        Math.min(dragStartBounds.left + dx, 1 - cropWidth),
      );
      const newTop = Math.max(
        0,
        Math.min(dragStartBounds.top + dy, 1 - cropHeight),
      );
      editing.snapshot.cropBounds.left = newLeft;
      editing.snapshot.cropBounds.top = newTop;
      editing.snapshot.cropBounds.right = 1 - newLeft - cropWidth;
      editing.snapshot.cropBounds.bottom = 1 - newTop - cropHeight;
      return;
    }

    switch (dragging) {
      case "tl":
        editing.setCropBounds({
          left: Math.max(
            0,
            Math.min(
              dragStartBounds.left + dx,
              1 - dragStartBounds.right - minSize,
            ),
          ),
          top: Math.max(
            0,
            Math.min(
              dragStartBounds.top + dy,
              1 - dragStartBounds.bottom - minSize,
            ),
          ),
        });
        break;
      case "tr":
        editing.setCropBounds({
          right: Math.max(
            0,
            Math.min(
              dragStartBounds.right - dx,
              1 - dragStartBounds.left - minSize,
            ),
          ),
          top: Math.max(
            0,
            Math.min(
              dragStartBounds.top + dy,
              1 - dragStartBounds.bottom - minSize,
            ),
          ),
        });
        break;
      case "bl":
        editing.setCropBounds({
          left: Math.max(
            0,
            Math.min(
              dragStartBounds.left + dx,
              1 - dragStartBounds.right - minSize,
            ),
          ),
          bottom: Math.max(
            0,
            Math.min(
              dragStartBounds.bottom - dy,
              1 - dragStartBounds.top - minSize,
            ),
          ),
        });
        break;
      case "br":
        editing.setCropBounds({
          right: Math.max(
            0,
            Math.min(
              dragStartBounds.right - dx,
              1 - dragStartBounds.left - minSize,
            ),
          ),
          bottom: Math.max(
            0,
            Math.min(
              dragStartBounds.bottom - dy,
              1 - dragStartBounds.top - minSize,
            ),
          ),
        });
        break;
      case "tm":
        editing.setCropBounds({
          top: Math.max(
            0,
            Math.min(
              dragStartBounds.top + dy,
              1 - dragStartBounds.bottom - minSize,
            ),
          ),
        });
        break;
      case "bm":
        editing.setCropBounds({
          bottom: Math.max(
            0,
            Math.min(
              dragStartBounds.bottom - dy,
              1 - dragStartBounds.top - minSize,
            ),
          ),
        });
        break;
      case "ml":
        editing.setCropBounds({
          left: Math.max(
            0,
            Math.min(
              dragStartBounds.left + dx,
              1 - dragStartBounds.right - minSize,
            ),
          ),
        });
        break;
      case "mr":
        editing.setCropBounds({
          right: Math.max(
            0,
            Math.min(
              dragStartBounds.right - dx,
              1 - dragStartBounds.left - minSize,
            ),
          ),
        });
        break;
    }
  }

  function handleMouseUp() {
    dragging = null;
    window.removeEventListener("mousemove", handleMouseMove);
    window.removeEventListener("mouseup", handleMouseUp);
  }

  $effect(() => {
    if (!editing.cropMode || overlayRect.width <= 0 || overlayRect.height <= 0)
      return;
    if (!editing.cropShouldCenter) return;
    editing.cropShouldCenter = false;

    const ratio = editing.snapshot.cropAspectRatio;
    if (ratio === null) {
      editing.setCropBounds({ left: 0, top: 0, right: 0, bottom: 0 });
    } else {
      const containerRatio = overlayRect.width / overlayRect.height;
      const rel = ratio / containerRatio;
      let w: number, h: number;
      if (rel >= 1) {
        w = 1;
        h = 1 / rel;
      } else {
        h = 1;
        w = rel;
      }
      const marginX = (1 - w) / 2;
      const marginY = (1 - h) / 2;
      editing.setCropBounds({
        left: marginX,
        top: marginY,
        right: marginX,
        bottom: marginY,
      });
    }
  });

  $effect(() => {
    if (!editing.cropMode && dragging) {
      dragging = null;
    }
  });
</script>

{#if editing.cropMode && overlayRect.width > 0 && overlayRect.height > 0}
  <div
    class="crop-overlay"
    role="presentation"
    style="position: absolute; left: {overlayRect.left}px; top: {overlayRect.top}px; width: {overlayRect.width}px; height: {overlayRect.height}px;"
  >
    <div
      class="crop-dim crop-dim-top"
      style="height: {editing.snapshot.cropBounds.top * 100}%"
    ></div>
    <div
      class="crop-dim crop-dim-bottom"
      style="height: {editing.snapshot.cropBounds.bottom * 100}%"
    ></div>
    <div
      class="crop-dim crop-dim-left"
      style="top: {editing.snapshot.cropBounds.top * 100}%; bottom: {editing
        .snapshot.cropBounds.bottom * 100}%; width: {editing.snapshot.cropBounds
        .left * 100}%"
    ></div>
    <div
      class="crop-dim crop-dim-right"
      style="top: {editing.snapshot.cropBounds.top * 100}%; bottom: {editing
        .snapshot.cropBounds.bottom * 100}%; width: {editing.snapshot.cropBounds
        .right * 100}%"
    ></div>
    <div
      class="crop-area"
      style="left: {editing.snapshot.cropBounds.left * 100}%; top: {editing
        .snapshot.cropBounds.top * 100}%; right: {editing.snapshot.cropBounds
        .right * 100}%; bottom: {editing.snapshot.cropBounds.bottom * 100}%;"
      onmousedown={(e) => handleMouseDown(e, "move")}
      role="button"
      tabindex="0"
      aria-label="Crop area"
    >
      <div class="crop-grid">
        <div class="crop-grid-line h1"></div>
        <div class="crop-grid-line h2"></div>
        <div class="crop-grid-line v1"></div>
        <div class="crop-grid-line v2"></div>
      </div>
      <div
        class="crop-handle tl"
        onmousedown={(e) => handleMouseDown(e, "tl")}
        role="button"
        tabindex="0"
        aria-label="Top-left corner"
      >
        <div class="crop-handle-diamond"></div>
      </div>
      <div
        class="crop-handle tr"
        onmousedown={(e) => handleMouseDown(e, "tr")}
        role="button"
        tabindex="0"
        aria-label="Top-right corner"
      >
        <div class="crop-handle-diamond"></div>
      </div>
      <div
        class="crop-handle bl"
        onmousedown={(e) => handleMouseDown(e, "bl")}
        role="button"
        tabindex="0"
        aria-label="Bottom-left corner"
      >
        <div class="crop-handle-diamond"></div>
      </div>
      <div
        class="crop-handle br"
        onmousedown={(e) => handleMouseDown(e, "br")}
        role="button"
        tabindex="0"
        aria-label="Bottom-right corner"
      >
        <div class="crop-handle-diamond"></div>
      </div>
      <div
        class="crop-handle tm"
        onmousedown={(e) => handleMouseDown(e, "tm")}
        role="button"
        tabindex="0"
        aria-label="Top edge"
      >
        <div class="crop-handle-diamond"></div>
      </div>
      <div
        class="crop-handle bm"
        onmousedown={(e) => handleMouseDown(e, "bm")}
        role="button"
        tabindex="0"
        aria-label="Bottom edge"
      >
        <div class="crop-handle-diamond"></div>
      </div>
      <div
        class="crop-handle ml"
        onmousedown={(e) => handleMouseDown(e, "ml")}
        role="button"
        tabindex="0"
        aria-label="Left edge"
      >
        <div class="crop-handle-diamond"></div>
      </div>
      <div
        class="crop-handle mr"
        onmousedown={(e) => handleMouseDown(e, "mr")}
        role="button"
        tabindex="0"
        aria-label="Right edge"
      >
        <div class="crop-handle-diamond"></div>
      </div>
    </div>
  </div>
{/if}
