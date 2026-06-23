// Media state setters
import { markerStore } from "$lib/features/markers/markers.svelte";
import { loadCdColorForFile } from "$lib/features/media/cdColor";
import type { MediaProperties } from "$lib/shared/types";
import type { MediaState } from "$lib/features/media/media.svelte";

export interface SetMediaStateSetters {
  setFilePath: (v: string) => void;
  setFileSrc: (v: string) => void;
  setFileName: (v: string) => void;
  setIsVideo: (v: boolean) => void;
  setIsAudio: (v: boolean) => void;
  setIsPdf: (v: boolean) => void;
  setFileList: (v: string[]) => void;
  setCurrentIndex: (v: number) => void;
  setFileSize: (v: string) => void;
  setFileSizeBytes: (v: number) => void;
  setFileDimensions: (v: string) => void;
  setFileCreated: (v: string) => void;
  setFileModified: (v: string) => void;
  setFileInfoLoading: (v: boolean) => void;
  setIsLoadingFile: (v: boolean) => void;
  setLoadingFadingOut: (v: boolean) => void;
  setImageNaturalWidth: (v: number) => void;
  setImageNaturalHeight: (v: number) => void;
  setRawCurrentSecs: (v: number) => void;
  setRawDurationSecs: (v: number) => void;
  setProgress: (v: number) => void;
  setPlaying: (v: boolean) => void;
  setRotation: (v: number) => void;
  setFlipped: (v: boolean) => void;
  setCdColor: (v: string) => void;
  setCdColorIndex: (v: number) => void;
  setCoverArtSrc: (v: string) => void;
  setMediaProps: (v: MediaProperties | null) => void;
  setMediaPropsLoading: (v: boolean) => void;
  setBoundaries: (v: import("$lib/shared/types").ClipBoundary[]) => void;
}

export function createSetMediaState(s: SetMediaStateSetters) {
  return function setMediaState(data: Partial<MediaState>) {
    if (data.filePath !== undefined) s.setFilePath(data.filePath);
    if (data.fileSrc !== undefined) s.setFileSrc(data.fileSrc);
    if (data.fileName !== undefined) s.setFileName(data.fileName);
    if (data.isVideo !== undefined) s.setIsVideo(data.isVideo);
    if (data.isAudio !== undefined) s.setIsAudio(data.isAudio);
    if (data.isAudio && data.filePath) {
      loadCdColorForFile(data.filePath, {
        setCdColor: s.setCdColor,
        setCdColorIndex: s.setCdColorIndex,
        setCoverArtSrc: s.setCoverArtSrc,
      });
    }
    if (data.isPdf !== undefined) s.setIsPdf(data.isPdf);
    if (data.fileList !== undefined) s.setFileList(data.fileList);
    if (data.currentIndex !== undefined) s.setCurrentIndex(data.currentIndex);
    if (data.fileSize !== undefined) s.setFileSize(data.fileSize);
    if (data.fileSizeBytes !== undefined)
      s.setFileSizeBytes(data.fileSizeBytes);
    if (data.fileDimensions !== undefined)
      s.setFileDimensions(data.fileDimensions);
    if (data.fileCreated !== undefined) s.setFileCreated(data.fileCreated);
    if (data.fileModified !== undefined) s.setFileModified(data.fileModified);
    if (data.fileInfoLoading !== undefined)
      s.setFileInfoLoading(data.fileInfoLoading);
    if (data.isLoadingFile !== undefined)
      s.setIsLoadingFile(data.isLoadingFile);
    if (data.loadingFadingOut !== undefined)
      s.setLoadingFadingOut(data.loadingFadingOut);
    if (data.imageRotation !== undefined) s.setRotation(data.imageRotation);
    if (data.imageFlipped !== undefined) s.setFlipped(data.imageFlipped);
    if (data.imageNaturalWidth !== undefined)
      s.setImageNaturalWidth(data.imageNaturalWidth);
    if (data.imageNaturalHeight !== undefined)
      s.setImageNaturalHeight(data.imageNaturalHeight);
    if (data.rawCurrentSecs !== undefined)
      s.setRawCurrentSecs(data.rawCurrentSecs);
    if (data.rawDurationSecs !== undefined)
      s.setRawDurationSecs(data.rawDurationSecs);
    if (data.progress !== undefined) s.setProgress(data.progress);
    if (data.playing !== undefined) s.setPlaying(data.playing);
    if (data.timestamps !== undefined) markerStore.timestamps = data.timestamps;
    if (data.clipBoundaries !== undefined) s.setBoundaries(data.clipBoundaries);
    if (data.resumePoint !== undefined)
      markerStore.resumePoint = data.resumePoint;
  };
}

export type SetMediaState = ReturnType<typeof createSetMediaState>;
