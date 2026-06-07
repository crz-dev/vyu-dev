import type { MediaProperties } from "$lib/shared/types";
import {
  loadMediaProperties,
  refreshFfprobeAvailability,
  installFfmpegAndWait,
} from "./ffmpeg";

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
