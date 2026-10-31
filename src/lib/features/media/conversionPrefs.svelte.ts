// Conversion / process preferences
import {
  loadProcessAudioBitrate,
  loadProcessAutoOpen,
  loadProcessCoverArtMode,
  loadProcessDeleteOriginal,
  loadProcessGpuEncoding,
  loadProcessHardwareEncoder,
  loadProcessKeepOriginalDate,
  loadProcessOpenOutputFolder,
  loadProcessOutputDir,
  loadProcessOverwrite,
  loadProcessPreserveMetadata,
  loadProcessQuality,
  saveProcessAudioBitrate,
  saveProcessAutoOpen,
  saveProcessCoverArtMode,
  saveProcessDeleteOriginal,
  saveProcessGpuEncoding,
  saveProcessHardwareEncoder,
  saveProcessKeepOriginalDate,
  saveProcessOpenOutputFolder,
  saveProcessOutputDir,
  saveProcessOverwrite,
  saveProcessPreserveMetadata,
  saveProcessQuality,
  type CoverArtMode,
  type HardwareEncoder,
  type ProcessQuality,
} from "$lib/services/storage";

function createConversionPrefs() {
  let quality = $state<ProcessQuality>(loadProcessQuality());
  let deleteOriginal = $state(loadProcessDeleteOriginal());
  let audioBitrate = $state(loadProcessAudioBitrate());
  let overwriteExisting = $state(loadProcessOverwrite());
  let gpuEncoding = $state(loadProcessGpuEncoding());
  let hardwareEncoder = $state<HardwareEncoder>(loadProcessHardwareEncoder());
  let autoOpenConverted = $state(loadProcessAutoOpen());
  let preserveMetadata = $state(loadProcessPreserveMetadata());
  let coverArtMode = $state<CoverArtMode>(loadProcessCoverArtMode());
  let outputDir = $state(loadProcessOutputDir());
  let openOutputFolder = $state(loadProcessOpenOutputFolder());
  let keepOriginalDate = $state(loadProcessKeepOriginalDate());

  function setQuality(value: ProcessQuality) {
    quality = value;
    saveProcessQuality(value);
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

  function setHardwareEncoder(encoder: HardwareEncoder) {
    hardwareEncoder = encoder;
    saveProcessHardwareEncoder(encoder);
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

  function setOutputDir(dir: string) {
    outputDir = dir;
    saveProcessOutputDir(dir);
  }

  function setOpenOutputFolder(enabled: boolean) {
    openOutputFolder = enabled;
    saveProcessOpenOutputFolder(enabled);
  }

  function setKeepOriginalDate(enabled: boolean) {
    keepOriginalDate = enabled;
    saveProcessKeepOriginalDate(enabled);
  }

  return {
    get quality() {
      return quality;
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
    get hardwareEncoder() {
      return hardwareEncoder;
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
    get outputDir() {
      return outputDir;
    },
    get openOutputFolder() {
      return openOutputFolder;
    },
    get keepOriginalDate() {
      return keepOriginalDate;
    },
    setQuality,
    setDeleteOriginal,
    setAudioBitrate,
    setOverwriteExisting,
    setGpuEncoding,
    setHardwareEncoder,
    setAutoOpenConverted,
    setPreserveMetadata,
    setCoverArtMode,
    setOutputDir,
    setOpenOutputFolder,
    setKeepOriginalDate,
  };
}

export const conversionPrefs = createConversionPrefs();
