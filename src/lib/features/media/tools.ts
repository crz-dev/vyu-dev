import { invoke } from "@tauri-apps/api/core";
import type { MediaProperties, ClipJobResult } from "$lib/shared/types";
import { getFileExt } from "$lib/services/files";
import type { EditSnapshot } from "$lib/features/editing/editing.svelte";
import type {
  DrawStroke,
  MarkupStroke,
  PlacedShape,
  PlacedLine,
  FreehandStroke,
  HighlightFreehand,
  HighlightStraight,
} from "$lib/features/markup/markup.svelte";

async function loadImageAsElement(filePath: string): Promise<HTMLImageElement> {
  const { readFile } = await import("@tauri-apps/plugin-fs");
  const bytes = await readFile(filePath);
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);

  const img = new Image();
  img.src = url;
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Failed to load image"));
  });
  URL.revokeObjectURL(url);
  return img;
}

async function saveCanvasToFile(
  canvas: HTMLCanvasElement,
  outputPath: string,
): Promise<void> {
  const ext = getFileExt(outputPath) || "png";
  const mimeType =
    ext === "jpg" || ext === "jpeg"
      ? "image/jpeg"
      : ext === "webp"
        ? "image/webp"
        : "image/png";

  const outBlob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b!), mimeType, 0.92);
  });
  const arrayBuffer = await outBlob.arrayBuffer();
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  await writeFile(outputPath, new Uint8Array(arrayBuffer));
}

export async function exportCroppedImage(
  filePath: string,
  bounds: { left: number; top: number; right: number; bottom: number },
  outputPath: string,
) {
  const img = await loadImageAsElement(filePath);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const cropX = Math.round(bounds.left * w);
  const cropY = Math.round(bounds.top * h);
  const cropW = Math.round(w * (1 - bounds.left - bounds.right));
  const cropH = Math.round(h * (1 - bounds.top - bounds.bottom));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, cropW);
  canvas.height = Math.max(1, cropH);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");
  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  await saveCanvasToFile(canvas, outputPath);
}

export async function invokeGetThumbnail(path: string): Promise<string> {
  return invoke("get_thumbnail", { path });
}

export async function invokeGetMediaProperties(
  path: string,
): Promise<MediaProperties> {
  return invoke("get_media_properties", { path });
}

export async function invokeCheckFfprobe(): Promise<boolean> {
  return invoke("check_ffprobe");
}

export async function invokeInstallFfmpeg(): Promise<void> {
  return invoke("install_ffmpeg");
}

export async function invokeProcessVideoClips(
  path: string,
  outputDir: string,
  segments: { start: number; end: number }[],
  mode: "separate" | "merge",
  deleteOriginal: boolean,
): Promise<ClipJobResult> {
  return invoke("process_video_clips", {
    path,
    outputDir,
    segments,
    mode,
    deleteOriginal,
  });
}

export async function invokeDeleteFile(path: string): Promise<void> {
  return invoke("delete_file", { path });
}

export async function invokeTrashFile(path: string): Promise<void> {
  return invoke("trash_file", { path });
}

export async function invokeShowInExplorer(path: string): Promise<void> {
  return invoke("show_in_explorer", { path });
}

export async function invokeOpenDirectory(path: string): Promise<void> {
  return invoke("open_directory", { path });
}

export async function invokeRenameFile(
  oldPath: string,
  newPath: string,
): Promise<void> {
  return invoke("rename_file", { oldPath, newPath });
}

export async function invokeCopyFile(
  source: string,
  destination: string,
): Promise<void> {
  return invoke("copy_file", { source, destination });
}

export async function invokeCopyFileUnique(
  source: string,
  outputDir: string,
): Promise<string> {
  return invoke("copy_file_unique", { source, outputDir });
}

export async function invokeCopyImageToClipboard(path: string): Promise<void> {
  return invoke("copy_image_to_clipboard", { path });
}

export async function invokeCleanupTempFolder(): Promise<void> {
  return invoke("cleanup_temp_folder");
}

export async function invokeFixMedia(
  path: string,
  mode: "copy" | "replace",
): Promise<{ success: boolean; output_path: string; error: string }> {
  return invoke("fix_media", { path, mode });
}

export async function invokeGetClipboardFilePath(): Promise<string | null> {
  return invoke("get_clipboard_file_path");
}

export async function invokeExportCroppedMedia(
  path: string,
  outputPath: string,
  left: number,
  top: number,
  right: number,
  bottom: number,
  width: number,
  height: number,
  rotation: number,
): Promise<void> {
  return invoke("export_cropped_media", {
    path,
    outputPath,
    left,
    top,
    right,
    bottom,
    width,
    height,
    rotation,
  });
}

export async function invokeConvertMedia(
  path: string,
  outputDir: string,
  format: string,
  preset: string,
  customOutput?: string,
): Promise<string> {
  return invoke("convert_media", {
    path,
    outputDir,
    format,
    preset,
    customOutput: customOutput ?? null,
  });
}

export async function invokeConvertAudioToWaveformVideo(
  path: string,
  outputDir: string,
  customOutput?: string,
): Promise<string> {
  return invoke("convert_audio_to_waveform_video", {
    path,
    outputDir,
    customOutput: customOutput ?? null,
  });
}

export async function invokeConvertImageToPdf(
  path: string,
  outputDir: string,
  customOutput?: string,
): Promise<string> {
  return invoke("convert_image_to_pdf", {
    path,
    outputDir,
    customOutput: customOutput ?? null,
  });
}

export async function invokeExtractCoverArt(
  path: string,
): Promise<string | null> {
  return invoke("extract_cover_art", { path });
}

export async function exportEditedImage(
  filePath: string,
  snapshot: EditSnapshot,
  outputPath: string,
) {
  const img = await loadImageAsElement(filePath);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const isQuarterTurn = Math.abs(snapshot.rotation % 180) === 90;
  let b = snapshot.cropBounds;

  // Crop bounds are set relative to the displayed (rotated) image.
  // For quarter-turn rotations, swap the bounds to match natural coordinates.
  if (isQuarterTurn) {
    const normRot = ((snapshot.rotation % 360) + 360) % 360;
    if (normRot === 90) {
      // 90° CW: displayed width = natural height, displayed height = natural width
      b = {
        left: snapshot.cropBounds.top,
        top: snapshot.cropBounds.right,
        right: snapshot.cropBounds.bottom,
        bottom: snapshot.cropBounds.left,
      };
    } else {
      // 270° CW (= -90°): displayed width = natural height, displayed height = natural width
      b = {
        left: snapshot.cropBounds.bottom,
        top: snapshot.cropBounds.left,
        right: snapshot.cropBounds.top,
        bottom: snapshot.cropBounds.right,
      };
    }
  }

  const cropW = Math.round(w * (1 - b.left - b.right));
  const cropH = Math.round(h * (1 - b.top - b.bottom));
  const cropX = Math.round(b.left * w);
  const cropY = Math.round(b.top * h);

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  if (isQuarterTurn) {
    canvas.width = Math.max(1, cropH);
    canvas.height = Math.max(1, cropW);
  } else if (snapshot.rotation !== 0) {
    // Arbitrary rotation — expand canvas to fit the full rotated image
    const cos = Math.abs(Math.cos((snapshot.rotation * Math.PI) / 180));
    const sin = Math.abs(Math.sin((snapshot.rotation * Math.PI) / 180));
    canvas.width = Math.max(1, Math.round(cropW * cos + cropH * sin));
    canvas.height = Math.max(1, Math.round(cropW * sin + cropH * cos));
  } else {
    canvas.width = Math.max(1, cropW);
    canvas.height = Math.max(1, cropH);
  }

  // Ensure the expanded canvas is transparent, not black
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const filterParts: string[] = [];
  if (snapshot.brightness !== 1)
    filterParts.push(`brightness(${snapshot.brightness})`);
  if (snapshot.contrast !== 1)
    filterParts.push(`contrast(${snapshot.contrast})`);
  if (snapshot.saturation !== 1)
    filterParts.push(`saturate(${snapshot.saturation})`);
  if (snapshot.hue !== 0) filterParts.push(`hue-rotate(${snapshot.hue}deg)`);
  if (filterParts.length > 0) {
    ctx.filter = filterParts.join(" ");
  }

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);

  if (snapshot.rotation !== 0) {
    ctx.rotate((snapshot.rotation * Math.PI) / 180);
  }

  if (snapshot.flipped || snapshot.flippedVertical) {
    ctx.scale(snapshot.flipped ? -1 : 1, snapshot.flippedVertical ? -1 : 1);
  }

  ctx.drawImage(
    img,
    cropX,
    cropY,
    cropW,
    cropH,
    -cropW / 2,
    -cropH / 2,
    cropW,
    cropH,
  );

  ctx.restore();

  await saveCanvasToFile(canvas, outputPath);
}

export async function renderMarkupOnImage(
  filePath: string,
  strokes: MarkupStroke[],
  outputPath: string,
) {
  const img = await loadImageAsElement(filePath);

  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  ctx.drawImage(img, 0, 0, w, h);

  for (const stroke of strokes) {
    if (stroke.type === "freehand") {
      renderFreehand(ctx, stroke, w, h);
    } else if (stroke.type === "shape") {
      renderShape(ctx, stroke, w, h);
    } else if (stroke.type === "line") {
      renderLine(ctx, stroke, w, h);
    } else if (stroke.type === "highlight") {
      if (stroke.mode === "free") {
        renderHighlightFreehand(ctx, stroke, w, h);
      } else {
        renderHighlightStraightBar(
          ctx,
          stroke.x1,
          stroke.y1,
          stroke.x2,
          stroke.y2,
          w,
          h,
          stroke.color,
          stroke.thickness,
          stroke.opacity,
        );
      }
    }
  }
  ctx.globalAlpha = 1;

  await saveCanvasToFile(canvas, outputPath);
}

function arrowSize(thickness: number) {
  return Math.max(10, thickness * 4);
}

function drawArrowhead(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
) {
  const a = Math.PI / 6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x - size * Math.cos(angle - a), y - size * Math.sin(angle - a));
  ctx.lineTo(x - size * Math.cos(angle + a), y - size * Math.sin(angle + a));
  ctx.closePath();
  ctx.fill();
}

function renderFreehand(
  ctx: CanvasRenderingContext2D,
  stroke: FreehandStroke,
  w: number,
  h: number,
) {
  const pts = stroke.points;
  if (pts.length < 1) return;
  ctx.beginPath();
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (pts.length === 1) {
    ctx.arc(pts[0].x * w, pts[0].y * h, stroke.thickness / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  } else {
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * w, pts[i].y * h);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function renderHighlightFreehand(
  ctx: CanvasRenderingContext2D,
  stroke: HighlightFreehand,
  w: number,
  h: number,
) {
  const pts = stroke.points;
  if (pts.length < 1) return;
  ctx.beginPath();
  ctx.globalAlpha = stroke.opacity;
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.thickness;
  ctx.lineCap = "butt";
  ctx.lineJoin = "miter";

  if (pts.length === 1) {
    ctx.arc(pts[0].x * w, pts[0].y * h, stroke.thickness / 2, 0, Math.PI * 2);
    ctx.fillStyle = stroke.color;
    ctx.fill();
  } else {
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * w, pts[i].y * h);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function renderHighlightStraightBar(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  w: number,
  h: number,
  color: string,
  thickness: number,
  opacity: number,
) {
  const px1 = x1 * w;
  const py1 = y1 * h;
  const px2 = x2 * w;
  const py2 = y2 * h;
  const angle = Math.atan2(py2 - py1, px2 - px1);
  const halfThick = thickness / 2;
  const cos = Math.cos(angle + Math.PI / 2);
  const sin = Math.sin(angle + Math.PI / 2);

  ctx.beginPath();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.moveTo(px1 + cos * halfThick, py1 + sin * halfThick);
  ctx.lineTo(px2 + cos * halfThick, py2 + sin * halfThick);
  ctx.lineTo(px2 - cos * halfThick, py2 - sin * halfThick);
  ctx.lineTo(px1 - cos * halfThick, py1 - sin * halfThick);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;
}

function renderShape(
  ctx: CanvasRenderingContext2D,
  s: PlacedShape,
  w: number,
  h: number,
) {
  const cx = s.cx * w;
  const cy = s.cy * h;
  const halfW = (s.width * w) / 2;
  const halfH = (s.height * h) / 2;
  const sw = s.width * w;
  const sh = s.height * h;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(s.rotation);
  ctx.globalAlpha = s.opacity;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();

  if (s.shape === "square") {
    if (s.cornerRadius > 0) {
      const r = s.cornerRadius * Math.min(sw, sh);
      ctx.roundRect(-halfW, -halfH, sw, sh, r);
    } else {
      ctx.rect(-halfW, -halfH, sw, sh);
    }
    ctx.stroke();
  } else if (s.shape === "circle") {
    ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
    ctx.stroke();
  } else if (s.shape === "triangle") {
    ctx.moveTo(0, -halfH);
    ctx.lineTo(halfW, halfH);
    ctx.lineTo(-halfW, halfH);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderLine(
  ctx: CanvasRenderingContext2D,
  l: PlacedLine,
  w: number,
  h: number,
) {
  ctx.beginPath();
  ctx.globalAlpha = l.opacity;
  ctx.strokeStyle = l.color;
  ctx.lineWidth = l.thickness;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.fillStyle = l.color;

  if (!l.isPath) {
    const x1 = l.x1 * w,
      y1 = l.y1 * h;
    const x2 = l.x2 * w,
      y2 = l.y2 * h;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    const aSize = arrowSize(l.thickness);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    if (l.lineType === "arrow" || l.lineType === "bidirectional-arrow") {
      drawArrowhead(ctx, x2, y2, angle, aSize);
    }
    if (l.lineType === "bidirectional-arrow") {
      drawArrowhead(ctx, x1, y1, angle + Math.PI, aSize);
    }
  } else {
    const pts = l.points;
    if (pts.length < 1) return;
    ctx.moveTo(pts[0].x * w, pts[0].y * h);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x * w, pts[i].y * h);
    }
    ctx.stroke();

    if (pts.length >= 2) {
      const aSize = arrowSize(l.thickness);
      const last = pts[pts.length - 1];
      const prev = pts[pts.length - 2];
      const endAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
      if (l.lineType === "arrow" || l.lineType === "bidirectional-arrow") {
        drawArrowhead(ctx, last.x * w, last.y * h, endAngle, aSize);
      }
      if (l.lineType === "bidirectional-arrow") {
        const first = pts[0];
        const second = pts.length > 1 ? pts[1] : pts[0];
        const startAngle = Math.atan2(first.y - second.y, first.x - second.x);
        drawArrowhead(ctx, first.x * w, first.y * h, startAngle, aSize);
      }
    }
  }
  ctx.globalAlpha = 1;
}

export async function invokeExportEditedMedia(
  path: string,
  outputPath: string,
  snapshot: EditSnapshot,
  width: number,
  height: number,
): Promise<void> {
  return invoke("export_edited_media", {
    path,
    outputPath,
    brightness: snapshot.brightness,
    contrast: snapshot.contrast,
    saturation: snapshot.saturation,
    hue: snapshot.hue,
    rotation: snapshot.rotation,
    flipped: snapshot.flipped,
    flippedVertical: snapshot.flippedVertical,
    cropLeft: snapshot.cropBounds.left,
    cropTop: snapshot.cropBounds.top,
    cropRight: snapshot.cropBounds.right,
    cropBottom: snapshot.cropBounds.bottom,
    width,
    height,
  });
}

// Share: Send to

export async function invokePrintFile(path: string): Promise<void> {
  return invoke("print_file", { path });
}

export async function invokeSendBluetooth(path: string): Promise<void> {
  return invoke("send_bluetooth", { path });
}

export async function invokeSetWallpaper(path: string): Promise<void> {
  return invoke("set_wallpaper", { path });
}

export async function invokeSetLockScreen(path: string): Promise<void> {
  return invoke("set_lock_screen", { path });
}

export async function invokeCreateDesktopShortcut(path: string): Promise<void> {
  return invoke("create_desktop_shortcut", { path });
}

// Share: Open with

export async function invokeOpenInPhotos(path: string): Promise<void> {
  return invoke("open_in_photos", { path });
}

export async function invokeOpenInPaint(path: string): Promise<void> {
  return invoke("open_in_paint", { path });
}

export async function invokeOpenInVlc(path: string): Promise<void> {
  return invoke("open_in_vlc", { path });
}

export async function invokeOpenInSpotify(path: string): Promise<void> {
  return invoke("open_in_spotify", { path });
}

export async function invokeOpenInBrowser(path: string): Promise<void> {
  return invoke("open_in_browser", { path });
}

export async function invokeOpenWithDialog(path: string): Promise<void> {
  return invoke("open_with_dialog", { path });
}
