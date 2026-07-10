// Derived prop objects for child components (extracted from +page.svelte)
import type { ClipBoundary, VideoMarker } from "$lib/shared/types";
import type { LoopMode } from "$lib/shared/constants";

export interface TimelineProps {
  progress: number;
  currentTimeSecs: number;
  isGifVideo: boolean;
  clipPairs: { startId: string; endId: string }[];
  clipBoundaries: ClipBoundary[];
  timestamps: VideoMarker[];
  abLoopRegion: { start: number; end: number } | null;
  loopStart: number | null;
  loopEnd: number | null;
  resumePoint: number | null;
  durationSecs: number;
  clipMarkerJustDragged: boolean;
  tsEditMenuVisible: boolean;
  startScrubbing: (e: MouseEvent) => void;
  getTimestampPct: (time: number) => number;
  startClipMarkerDrag: (e: MouseEvent, id: string) => void;
  removeClipBoundary: (id: string) => void;
  showClipBoundaryTooltip: (e: MouseEvent, marker: ClipBoundary) => void;
  hideTsTooltip: () => void;
  seekToTimestamp: (time: number) => void;
  openSegmentEditor: (e: MouseEvent, id: string) => void;
  startTimestampDrag: (e: MouseEvent, id: string) => void;
  timestampDragJustEnded: boolean;
  removeTimestamp: (id: string) => void;
  showTimestampTooltip: (e: MouseEvent, ts: VideoMarker) => void;
  openTimestampEditor: (e: MouseEvent, id: string) => void;
  showResumeTooltip: (e: MouseEvent) => void;
  hideResumeTooltip: () => void;
  seekToResumePoint: () => void;
  removeResumePoint: () => void;
  clearABLoop: () => void;
  formatTime: (time: number) => string;
  startLoopMarkerDrag: (e: MouseEvent, which: "start" | "end") => void;
  loopMarkerJustDragged: boolean;
  showLoopMarkerTooltip: (e: MouseEvent, which: "start" | "end") => void;
}

export function buildTimelineProps(
  deps: TimelineProps,
): Record<string, unknown> {
  return { ...deps };
}

export interface AudioMarkerProps {
  clipPairs: { startId: string; endId: string }[];
  abLoopRegion: { start: number; end: number } | null;
  clipMarkerJustDragged: boolean;
  timestampDragJustEnded: boolean;
  loopMarkerJustDragged: boolean;
  getTimestampPct: (time: number) => number;
  startClipMarkerDrag: (e: MouseEvent, id: string) => void;
  removeClipBoundary: (id: string) => void;
  showClipBoundaryTooltip: (e: MouseEvent, marker: ClipBoundary) => void;
  hideTsTooltip: () => void;
  seekToTimestamp: (time: number) => void;
  openSegmentEditor: (e: MouseEvent, id: string) => void;
  startTimestampDrag: (e: MouseEvent, id: string) => void;
  removeTimestamp: (id: string) => void;
  showTimestampTooltip: (e: MouseEvent, ts: VideoMarker) => void;
  openTimestampEditor: (e: MouseEvent, id: string) => void;
  showResumeTooltip: (e: MouseEvent) => void;
  hideResumeTooltip: () => void;
  seekToResumePoint: () => void;
  removeResumePoint: () => void;
  clearABLoop: () => void;
  formatTime: (time: number) => string;
  startLoopMarkerDrag: (e: MouseEvent, which: "start" | "end") => void;
  showLoopMarkerTooltip: (e: MouseEvent, which: "start" | "end") => void;
}

export function buildAudioMarkerProps(
  deps: AudioMarkerProps,
): Record<string, unknown> {
  return { ...deps };
}

export interface PlaybackProps {
  isGifVideo: boolean;
  isAudio: boolean;
  playing: boolean;
  looping: LoopMode;
  muted: boolean;
  volume: number;
  volumeHovered: boolean;
  volumeSegments: number;
  togglePlay: () => void;
  setLoopMode: (mode: LoopMode) => void;
  toggleMute: () => void;
  showVolumeOverlay: () => void;
  handleVolumeAreaLeave: () => void;
  handleVolumeScroll: (e: WheelEvent) => void;
  startVolumeDrag: (e: MouseEvent) => void;
  handleVolumeDiamondHover: (e: MouseEvent) => void;
  setVolume: (v: number) => void;
  playbackSpeed: number;
  speedHovered: boolean;
  setPlaybackSpeed: (v: number) => void;
  showSpeedOverlay: () => void;
  handleSpeedAreaLeave: () => void;
  handleSpeedScroll: (e: WheelEvent) => void;
  handleSpeedDiamondHover: (e: MouseEvent) => void;
  startSpeedDrag: (e: MouseEvent) => void;
  addTimestamp: () => void;
  addClipStart: () => void;
  addClipEnd: () => void;
  addLoopStart: () => void;
  addLoopEnd: () => void;
  hasLoopStart: boolean;
  hasLoopEnd: boolean;
  hasAnyMarkers: boolean;
  deleteAllMarkers: () => void;
  toggleTimer: () => void;
  currentTimeDisplay: () => string;
  durationDisplay: string;
  timerTooltip: string;
  toggleFullscreen: () => void;
  onTsMenuChange: (open: boolean) => void;
  volumeSliderMode: boolean;
  speedSliderMode: boolean;
  volumeSliderValue: number;
  speedSliderValue: number;
  toggleVolumeSliderMode: () => void;
  toggleSpeedSliderMode: () => void;
  startVolumeSliderDrag: (e: PointerEvent, track: HTMLDivElement) => void;
  startSpeedSliderDrag: (e: PointerEvent, track: HTMLDivElement) => void;
  handleVolumeSliderChange: (v: number) => void;
  handleSpeedSliderChange: (v: number) => void;
  showVolumeSliderTooltip: (trackEl: HTMLDivElement | null) => void;
  hideVolumeSliderTooltip: () => void;
  showSpeedSliderTooltip: (trackEl: HTMLDivElement | null) => void;
  hideSpeedSliderTooltip: () => void;
  volumeDragging: boolean;
  speedDragging: boolean;
}

export function buildPlaybackProps(
  deps: PlaybackProps,
): Record<string, unknown> {
  return { ...deps };
}
