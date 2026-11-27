export interface ContextMenu {
  x: number;
  y: number;
  visible: boolean;
}

export interface VideoMarker {
  id: string;
  time: number;
  title?: string;
}

export interface ClipBoundary {
  id: string;
  time: number;
  kind: "start" | "end";
  title?: string;
}

export interface MediaChapter {
  start: number;
  end: number;
  title: string;
}

export interface ClipPair {
  start: number;
  end: number;
  startId: string;
  endId: string;
}

export interface ClipJobResult {
  outputs: string[];
  deleted_original: boolean;
  output_dir: string;
}

export interface MediaProperties {
  container?: string;
  video_codec?: string;
  audio_codec?: string;
  pixel_format?: string;
  color_space?: string;
  color_primaries?: string;
  color_transfer?: string;
  bit_depth?: string;
  frame_rate?: string;
}

export interface MediaTrack {
  index: number;
  kind: "audio" | "subtitle";
  codec: string | null;
  language: string | null;
  title: string | null;
  channels: number | null;
  channelLayout: string | null;
  isDefault: boolean;
  bitmap: boolean;
  supported: boolean;
}

export interface MediaTrackCatalog {
  audio: MediaTrack[];
  subtitles: MediaTrack[];
}

export interface AudioLoudnessInfo {
  /** Gain in dB to apply for a -18 LUFS reference. */
  gainDb: number;
  /** Linear true-peak amplitude (1.0 = full scale), when known. */
  peak: number | null;
  source: "tag" | "scan";
}

export interface SubtitleSidecar {
  path: string;
  name: string;
  bitmap: boolean;
}

export interface SubtitleTextRun {
  text: string;
  font: string | null;
  size: number | null;
  color: string | null;
  outlineColor: string | null;
  outlineWidth: number | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export interface SubtitleCueImage {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SubtitleAnchor {
  /** Numpad layout: 1 bottom-left, 2 bottom-center, ... 9 top-right. */
  alignment: number;
  /** Horizontal position as a percentage of the subtitle canvas. */
  x: number;
  /** Vertical position as a percentage of the subtitle canvas. */
  y: number;
  maxWidth: number | null;
}

export interface SubtitleCue {
  start: number;
  end: number;
  lines: SubtitleTextRun[][];
  images: SubtitleCueImage[];
  anchor: SubtitleAnchor | null;
  background: string | null;
  fontSize: number | null;
}

export interface SubtitleDocument {
  kind: "text" | "bitmap";
  cues: SubtitleCue[];
  images: string[];
  canvasWidth: number;
  canvasHeight: number;
  playResX: number;
  playResY: number;
}

export type SubtitleSize = "small" | "default" | "large";
export type SubtitlePreset =
  | "fileStyles"
  | "default"
  | "highContrast"
  | "yellow"
  | "custom";
export type SubtitleOutline = "none" | "thin" | "thick";
export type SubtitleBackground = "none" | "soft" | "solid";

export interface SubtitleStyleSettings {
  preset: SubtitlePreset;
  useFileStyles: boolean;
  size: SubtitleSize;
  fontFamily: string;
  textColor: string;
  outline: SubtitleOutline;
  background: SubtitleBackground;
}

export interface BatchStatItem {
  path: string;
  size: number;
  mtime_ms: number;
  birthtime_ms: number;
}

export interface LibraryTypeCounts {
  images: number;
  videos: number;
  audio: number;
  documents: number;
}

export type LibraryViewKind =
  | "folder"
  | "recents"
  | "favorites"
  | "collections";

export interface LibraryViewInfo {
  kind: LibraryViewKind;
  path: string | null;
  name: string;
  fileCount: number;
  folderCount: number;
  totalSize: number;
  loading: boolean;
  modifiedMs: number | null;
  typeCounts: LibraryTypeCounts;
  collectionCount: number;
  linkedCollectionCount: number;
  customCollectionCount: number;
}

export interface CropBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
