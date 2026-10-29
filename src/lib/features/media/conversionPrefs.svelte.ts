// Conversion / process preferences
import {
  loadClipPreferences,
  loadProcessAudioBitrate,
  loadProcessAutoOpen,
  loadProcessCoverArtMode,
  loadProcessDeleteOriginal,
  loadProcessGpuEncoding,
  loadProcessOverwrite,
  loadProcessPreserveMetadata,
  loadProcessQuality,
  loadShareOutputDir,
  saveClipPreferences,
  saveProcessAudioBitrate,
  saveProcessAutoOpen,
  saveProcessCoverArtMode,
  saveProcessDeleteOriginal,
  saveProcessGpuEncoding,
  saveProcessOverwrite,
  saveProcessPreserveMetadata,
  saveProcessQuality,
  saveShareOutputDir,
  type CoverArtMode,
  type ProcessQuality,
} from "$lib/services/storage";

function createConversionPrefs() {
  let quality = $state<ProcessQuality>(loadProcessQuality());
  let outputDir = $state(loadShareOutputDir());
  let deleteOriginal = $state(loadProcessDeleteOriginal());
  let audioBitrate = $state(loadProcessAudioBitrate());
  let overwriteExisting = $state(loadProcessOverwrite());
  let gpuEncoding = $state(loadProcessGpuEncoding());
  let autoOpenConverted = $state(loadProcessAutoOpen());
  let preserveMetadata = $state(loadProcessPreserveMetadata());
  let coverArtMode = $state<CoverArtMode>(loadProcessCoverArtMode());
  let clipOutputDir = $state(loadClipPreferences().outputDir);

  function setQuality(value: ProcessQuality) {
    quality = value;
    saveProcessQuality(value);
  }

  function setOutputDir(dir: string) {
    outputDir = dir;
    saveShareOutputDir(dir);
  }

  function setDeleteOriginal(enabled: boolean) {
    deleteOriginal = enabled;
    saveProcessDeleteOriginal(enabled);
  }

  function setAudioBitrate(bitrate: number) {
    audioBitrate = bitrate;
    saveProcessAudioBitrate(bitrate);
  }

  function setOverwriteExisting(enabled: boolean) {
    overwriteExisting = enabled;
    saveProcessOverwrite(enabled);
  }

  function setGpuEncoding(enabled: boolean) {
    gpuEncoding = enabled;
    saveProcessGpuEncoding(enabled);
  }

  function setAutoOpenConverted(enabled: boolean) {
    autoOpenConverted = enabled;
    saveProcessAutoOpen(enabled);
  }

  function setPreserveMetadata(enabled: boolean) {
    preserveMetadata = enabled;
    saveProcessPreserveMetadata(enabled);
  }

  function setCoverArtMode(mode: CoverArtMode) {
    coverArtMode = mode;
    saveProcessCoverArtMode(mode);
  }

  function setClipOutputDir(dir: string) {
    clipOutputDir = dir;
    saveClipPreferences({
      outputDir: dir,
      useCustomPath: dir.length > 0,
    });
  }

  function refreshClipOutputDir() {
    clipOutputDir = loadClipPreferences().outputDir;
  }

  return {
    get quality() {
      return quality;
    },
    get outputDir() {
      return outputDir;
    },
    get deleteOriginal() {
      return deleteOriginal;
    },
    get audioBitrate() {
      return audioBitrate;
    },
    get overwriteExisting() {
      return overwriteExisting;
    },
    get gpuEncoding() {
      return gpuEncoding;
    },
    get autoOpenConverted() {
      return autoOpenConverted;
    },
    get preserveMetadata() {
      return preserveMetadata;
    },
    get coverArtMode() {
      return coverArtMode;
    },
    get clipOutputDir() {
      return clipOutputDir;
    },
    setQuality,
    setOutputDir,
    setDeleteOriginal,
    setAudioBitrate,
    setOverwriteExisting,
    setGpuEncoding,
    setAutoOpenConverted,
    setPreserveMetadata,
    setCoverArtMode,
    setClipOutputDir,
    refreshClipOutputDir,
  };
}

export const conversionPrefs = createConversionPrefs();
