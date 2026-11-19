// HLS playback glue. WebView2 is Chromium-based and does not play .m3u8
// natively, so hls.js is imported lazily only when an HLS link is opened.
import type Hls from "hls.js";

export interface HlsHandle {
  destroy: () => void;
}

export function canPlayHlsNatively(videoEl: HTMLVideoElement): boolean {
  return videoEl.canPlayType("application/vnd.apple.mpegurl") !== "";
}

export async function attachHls(
  videoEl: HTMLVideoElement,
  url: string,
  onFatalError: () => void,
): Promise<HlsHandle | null> {
  const { default: HlsCtor } = await import("hls.js");
  if (!HlsCtor.isSupported()) return null;

  // Workers are disabled so the CSP does not need worker-src blob:.
  const hls: Hls = new HlsCtor({ enableWorker: false });
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    hls.destroy();
  };
  hls.on(HlsCtor.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    destroy();
    onFatalError();
  });
  hls.loadSource(url);
  hls.attachMedia(videoEl);

  return { destroy };
}
