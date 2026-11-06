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
  supported: boolean;
}

export interface MediaTrackCatalog {
  audio: MediaTrack[];
  subtitles: MediaTrack[];
}

export interface SubtitleSidecar {
  path: string;
  name: string;
}

export interface BatchStatItem {
  path: string;
  size: number;
  mtime_ms: number;
  birthtime_ms: number;
}

export interface CropBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}
