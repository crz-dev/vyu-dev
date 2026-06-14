import { viewer } from "./viewer.svelte";
import { editing } from "$lib/features/editing/editing.svelte";
import { markup } from "$lib/features/markup/markup.svelte";
import { markerStore } from "$lib/features/markers/markers.svelte";

export type ViewerStyleStore = ReturnType<typeof createViewerStyle>;

export function createViewerStyle() {
  const imageScale = $derived(viewer.state.zoomLevel / 100);
  const cropClipPath = $derived.by(() => {
    const bounds = editing.getCropBounds();
    if (!bounds) return "";
    return `inset(${(bounds.top * 100).toFixed(2)}% ${(bounds.right * 100).toFixed(2)}% ${(bounds.bottom * 100).toFixed(2)}% ${(bounds.left * 100).toFixed(2)}%)`;
  });
  const colorFilter = $derived.by(() => {
    const parts: string[] = [];
    const s = editing.snapshot;
    if (s.brightness !== 1) parts.push(`brightness(${s.brightness})`);
    if (s.contrast !== 1) parts.push(`contrast(${s.contrast})`);
    if (s.saturation !== 1) parts.push(`saturate(${s.saturation})`);
    if (s.hue !== 0) parts.push(`hue-rotate(${s.hue}deg)`);
    return parts.length ? ` filter: ${parts.join(" ")};` : "";
  });
  const imageStyle = $derived(
    `transform: translate(${viewer.state.translateX}px, ${viewer.state.translateY}px) scale(${imageScale}) rotate(${editing.snapshot.rotation}deg) scaleX(${editing.snapshot.flipped ? -1 : 1}) scaleY(${editing.snapshot.flippedVertical ? -1 : 1}); transform-origin: center center; display: block;${colorFilter}${cropClipPath ? ` clip-path: ${cropClipPath};` : ""}`,
  );
  const videoWrapperTransform = $derived(viewer.getVideoWrapperTransform());
  const videoInnerTransform = $derived(viewer.getVideoInnerTransform());
  const videoInnerStyle = $derived(
    `${videoInnerTransform}${colorFilter}${cropClipPath ? `; clip-path: ${cropClipPath}` : ""}`,
  );
  const panCursor = $derived(viewer.getPanCursor());
  const fsCursor = $derived(
    markup.drawActive
      ? markup.cursorStyle
      : !viewer.state.fsControlsVisible && !markerStore.tsEditMenu.visible
        ? "none"
        : panCursor,
  );

  return {
    get imageStyle() {
      return imageStyle;
    },
    get videoWrapperTransform() {
      return videoWrapperTransform;
    },
    get videoInnerStyle() {
      return videoInnerStyle;
    },
    get panCursor() {
      return panCursor;
    },
    get fsCursor() {
      return fsCursor;
    },
  };
}
