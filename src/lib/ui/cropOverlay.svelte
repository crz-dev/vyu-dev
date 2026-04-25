<script lang="ts">
  import { viewer } from "$lib/core/viewer.svelte";

  let { containerEl }: { containerEl: HTMLElement | null } = $props();

  let dragging = $state<"tl" | "tr" | "bl" | "br" | "tm" | "bm" | "ml" | "mr" | "move" | null>(null);
  let dragStartX = $state(0);
  let dragStartY = $state(0);
  let dragStartBounds = $state({ left: 0, top: 0, right: 0, bottom: 0 });

  function handleMouseDown(e: MouseEvent, handle: "tl" | "tr" | "bl" | "br" | "tm" | "bm" | "ml" | "mr" | "move") {
    e.preventDefault();
    e.stopPropagation();
    dragging = handle;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragStartBounds = { ...viewer.state.cropBounds };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  }

  function handleMouseMove(e: MouseEvent) {
    if (!dragging || !containerEl) return;

    const rect = containerEl.getBoundingClientRect();
    const dx = (e.clientX - dragStartX) / rect.width;
    const dy = (e.clientY - dragStartY) / rect.height;

    const minSize = 0.05;

    if (dragging === "move") {
      const cropWidth = 1 - dragStartBounds.left - dragStartBounds.right;
      const cropHeight = 1 - dragStartBounds.top - dragStartBounds.bottom;
      const newLeft = Math.max(0, Math.min(dragStartBounds.left + dx, 1 - cropWidth));
      const newTop = Math.max(0, Math.min(dragStartBounds.top + dy, 1 - cropHeight));
      viewer.state.cropBounds.left = newLeft;
      viewer.state.cropBounds.top = newTop;
      viewer.state.cropBounds.right = 1 - newLeft - cropWidth;
      viewer.state.cropBounds.bottom = 1 - newTop - cropHeight;
      return;
    }

    switch (dragging) {
      case "tl":
        viewer.setCropBounds({
          left: Math.max(0, Math.min(dragStartBounds.left + dx, 1 - dragStartBounds.right - minSize)),
          top: Math.max(0, Math.min(dragStartBounds.top + dy, 1 - dragStartBounds.bottom - minSize)),
        });
        break;
      case "tr":
        viewer.setCropBounds({
          right: Math.max(0, Math.min(dragStartBounds.right - dx, 1 - dragStartBounds.left - minSize)),
          top: Math.max(0, Math.min(dragStartBounds.top + dy, 1 - dragStartBounds.bottom - minSize)),
        });
        break;
      case "bl":
        viewer.setCropBounds({
          left: Math.max(0, Math.min(dragStartBounds.left + dx, 1 - dragStartBounds.right - minSize)),
          bottom: Math.max(0, Math.min(dragStartBounds.bottom - dy, 1 - dragStartBounds.top - minSize)),
        });
        break;
      case "br":
        viewer.setCropBounds({
          right: Math.max(0, Math.min(dragStartBounds.right - dx, 1 - dragStartBounds.left - minSize)),
          bottom: Math.max(0, Math.min(dragStartBounds.bottom - dy, 1 - dragStartBounds.top - minSize)),
        });
        break;
      case "tm":
        viewer.setCropBounds({
          top: Math.max(0, Math.min(dragStartBounds.top + dy, 1 - dragStartBounds.bottom - minSize)),
        });
        break;
      case "bm":
        viewer.setCropBounds({
          bottom: Math.max(0, Math.min(dragStartBounds.bottom - dy, 1 - dragStartBounds.top - minSize)),
        });
        break;
      case "ml":
        viewer.setCropBounds({
          left: Math.max(0, Math.min(dragStartBounds.left + dx, 1 - dragStartBounds.right - minSize)),
        });
        break;
      case "mr":
        viewer.setCropBounds({
          right: Math.max(0, Math.min(dragStartBounds.right - dx, 1 - dragStartBounds.left - minSize)),
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
    if (!viewer.state.cropMode && dragging) {
      dragging = null;
    }
  });
</script>

{#if viewer.state.cropMode && containerEl}
  <div class="crop-overlay" role="presentation">
    <div class="crop-dim crop-dim-top" style="height: {viewer.state.cropBounds.top * 100}%"></div>
    <div class="crop-dim crop-dim-bottom" style="height: {viewer.state.cropBounds.bottom * 100}%"></div>
    <div class="crop-dim crop-dim-left" style="top: {viewer.state.cropBounds.top * 100}%; bottom: {viewer.state.cropBounds.bottom * 100}%; width: {viewer.state.cropBounds.left * 100}%"></div>
    <div class="crop-dim crop-dim-right" style="top: {viewer.state.cropBounds.top * 100}%; bottom: {viewer.state.cropBounds.bottom * 100}%; width: {viewer.state.cropBounds.right * 100}%"></div>
    <div
      class="crop-area"
      style="left: {viewer.state.cropBounds.left * 100}%; top: {viewer.state.cropBounds.top * 100}%; right: {viewer.state.cropBounds.right * 100}%; bottom: {viewer.state.cropBounds.bottom * 100}%;"
      onmousedown={(e) => handleMouseDown(e, "move")}
      role="button"
      aria-label="Crop area"
    >
      <div class="crop-grid">
        <div class="crop-grid-line h1"></div>
        <div class="crop-grid-line h2"></div>
        <div class="crop-grid-line v1"></div>
        <div class="crop-grid-line v2"></div>
      </div>
      <div class="crop-handle tl" onmousedown={(e) => handleMouseDown(e, "tl")} role="button" aria-label="Top-left corner"><div class="crop-handle-diamond"></div></div>
      <div class="crop-handle tr" onmousedown={(e) => handleMouseDown(e, "tr")} role="button" aria-label="Top-right corner"><div class="crop-handle-diamond"></div></div>
      <div class="crop-handle bl" onmousedown={(e) => handleMouseDown(e, "bl")} role="button" aria-label="Bottom-left corner"><div class="crop-handle-diamond"></div></div>
      <div class="crop-handle br" onmousedown={(e) => handleMouseDown(e, "br")} role="button" aria-label="Bottom-right corner"><div class="crop-handle-diamond"></div></div>
      <div class="crop-handle tm" onmousedown={(e) => handleMouseDown(e, "tm")} role="button" aria-label="Top edge"><div class="crop-handle-diamond"></div></div>
      <div class="crop-handle bm" onmousedown={(e) => handleMouseDown(e, "bm")} role="button" aria-label="Bottom edge"><div class="crop-handle-diamond"></div></div>
      <div class="crop-handle ml" onmousedown={(e) => handleMouseDown(e, "ml")} role="button" aria-label="Left edge"><div class="crop-handle-diamond"></div></div>
      <div class="crop-handle mr" onmousedown={(e) => handleMouseDown(e, "mr")} role="button" aria-label="Right edge"><div class="crop-handle-diamond"></div></div>
    </div>
  </div>
{/if}
