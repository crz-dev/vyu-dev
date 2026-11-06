import {
  loadProcessAutoOpen,
  loadProcessCoverArtMode,
  loadProcessDeleteOriginal,
  loadProcessGpuEncoding,
  loadProcessKeepOriginalDate,
  loadProcessOpenOutputFolder,
  loadProcessOutputDir,
  loadProcessOverwrite,
  loadProcessPreserveMetadata,
  loadProcessQuality,
  saveProcessAutoOpen,
  saveProcessCoverArtMode,
  saveProcessDeleteOriginal,
  saveProcessGpuEncoding,
  saveProcessKeepOriginalDate,
  saveProcessOpenOutputFolder,
  saveProcessOutputDir,
  saveProcessOverwrite,
  saveProcessPreserveMetadata,
  saveProcessQuality,
  type CoverArtMode,
  type ProcessQuality,
} from "$lib/services/storage";

function createConversionPrefs() {
  let quality = $state<ProcessQuality>(loadProcessQuality());
  let deleteOriginal = $state(loadProcessDeleteOriginal());
  let overwriteExisting = $state(loadProcessOverwrite());
  let gpuEncoding = $state(loadProcessGpuEncoding());
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
    setOverwriteExisting,
    setGpuEncoding,
    setAutoOpenConverted,
    setPreserveMetadata,
    setCoverArtMode,
    setOutputDir,
    setOpenOutputFolder,
    setKeepOriginalDate,
  };
}

export const conversionPrefs = createConversionPrefs();
