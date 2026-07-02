// FFmpeg utilities
import type { MediaProperties } from "$lib/shared/types";
import { fetchMediaProperties } from "$lib/features/media/tools";

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

export function createFfmpegHelpers(deps: {
  filePath: () => string;
  setMediaProps: (v: MediaProperties | null) => void;
  setMediaPropsLoading: (v: boolean) => void;
}) {
  const runLoadMediaProperties = () => loadMediaProperties({
    get filePath() { return deps.filePath(); },
    setMediaProps: deps.setMediaProps,
    setMediaPropsLoading: deps.setMediaPropsLoading,
  });

  return {
    runLoadMediaProperties,
  };
}
