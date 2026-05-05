import type { MediaProperties } from "$lib/shared/types";
import {
  fetchMediaProperties,
  detectFfprobeAvailability,
  installFfmpegWithPolling,
} from "$lib/features/media/sources";

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
