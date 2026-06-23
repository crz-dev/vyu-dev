import type { MediaProperties } from "$lib/shared/types";
import {
  fetchMediaProperties,
  detectFfprobeAvailability,
  installFfmpegWithPolling,
} from "$lib/features/media/tools";

export async function loadMediaProperties(opts: {
  filePath: string;
  setMediaProps: (v: MediaProperties | null) => void;
  setMediaPropsLoading: (v: boolean) => void;
}) {
  opts.setMediaPropsLoading(true);
  const props = await fetchMediaProperties(opts.filePath);
  opts.setMediaProps(props);
  opts.setMediaPropsLoading(false);
}

export async function refreshFfprobeAvailability(opts: {
  setFfprobeChecked: (v: boolean) => void;
  setFfprobeAvailable: (v: boolean) => void;
}) {
  opts.setFfprobeChecked(false);
  const available = await detectFfprobeAvailability();
  opts.setFfprobeAvailable(available);
  opts.setFfprobeChecked(true);
}

export async function installFfmpegAndWait(opts: {
  setFfmpegInstallError: (v: string) => void;
  setFfmpegInstalling: (v: boolean) => void;
  setFfprobeAvailable: (v: boolean) => void;
  setFfprobeChecked: (v: boolean) => void;
  loadMediaProperties: () => Promise<void>;
}) {
  opts.setFfmpegInstallError("");
  opts.setFfmpegInstalling(true);
  const result = await installFfmpegWithPolling();
  opts.setFfprobeAvailable(result.available);
  opts.setFfprobeChecked(true);
  opts.setFfmpegInstallError(result.error);
  if (result.available) {
    opts.setFfmpegInstallError("");
    await opts.loadMediaProperties();
  }
  opts.setFfmpegInstalling(false);
}

export function createFfmpegHelpers(deps: {
  filePath: () => string;
  setMediaProps: (v: MediaProperties | null) => void;
  setMediaPropsLoading: (v: boolean) => void;
  setFfmpegInstallError: (v: string) => void;
  setFfmpegInstalling: (v: boolean) => void;
  setFfprobeAvailable: (v: boolean) => void;
  setFfprobeChecked: (v: boolean) => void;
}) {
  const ffmpegSetters = {
    setFfmpegInstallError: deps.setFfmpegInstallError,
    setFfmpegInstalling: deps.setFfmpegInstalling,
    setFfprobeAvailable: deps.setFfprobeAvailable,
    setFfprobeChecked: deps.setFfprobeChecked,
  };
  const ffprobeSetters = {
    setFfprobeChecked: deps.setFfprobeChecked,
    setFfprobeAvailable: deps.setFfprobeAvailable,
  };
  const mediaPropsSetters = {
    get filePath() {
      return deps.filePath();
    },
    setMediaProps: deps.setMediaProps,
    setMediaPropsLoading: deps.setMediaPropsLoading,
  };
  const runInstallFfmpeg = () =>
    installFfmpegAndWait({
      ...ffmpegSetters,
      loadMediaProperties: () => loadMediaProperties(mediaPropsSetters),
    });
  const runRefreshFfprobe = () => refreshFfprobeAvailability(ffprobeSetters);
  const runLoadMediaProperties = () => loadMediaProperties(mediaPropsSetters);

  return {
    ffmpegSetters,
    ffprobeSetters,
    mediaPropsSetters,
    runInstallFfmpeg,
    runRefreshFfprobe,
    runLoadMediaProperties,
  };
}

export function createEnsureFfprobe(deps: {
  getFfprobeChecked: () => boolean;
  getFfprobeAvailable: () => boolean;
  setFfprobeChecked: (v: boolean) => void;
  setFfprobeAvailable: (v: boolean) => void;
  setFfmpegInstallError: (v: string) => void;
  setFfmpegInstalling: (v: boolean) => void;
  filePath: () => string;
  setMediaProps: (v: MediaProperties | null) => void;
  setMediaPropsLoading: (v: boolean) => void;
}) {
  return async function ensureFfprobe() {
    if (!deps.getFfprobeChecked()) {
      await refreshFfprobeAvailability({
        setFfprobeChecked: deps.setFfprobeChecked,
        setFfprobeAvailable: deps.setFfprobeAvailable,
      });
    }
    if (!deps.getFfprobeAvailable()) {
      await installFfmpegAndWait({
        setFfmpegInstallError: deps.setFfmpegInstallError,
        setFfmpegInstalling: deps.setFfmpegInstalling,
        setFfprobeAvailable: deps.setFfprobeAvailable,
        setFfprobeChecked: deps.setFfprobeChecked,
        loadMediaProperties: () =>
          loadMediaProperties({
            filePath: deps.filePath(),
            setMediaProps: deps.setMediaProps,
            setMediaPropsLoading: deps.setMediaPropsLoading,
          }),
      });
    }
    return deps.getFfprobeAvailable();
  };
}
