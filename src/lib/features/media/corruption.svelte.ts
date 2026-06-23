// Corruption state
import { invokeFixMedia } from "$lib/features/media/tools";
import { showToast } from "$lib/features/toast/toast.svelte";

export function createCorruption() {
  const state = $state({
    warning: false,
    reason: "",
    fixing: false,
    fixError: "",
  });

  function onImageError() {
    state.warning = true;
    state.reason = "This image may be corrupted or in an unsupported format.";
  }

  function onVideoError(videoEl: HTMLVideoElement | null) {
    const err = videoEl?.error;
    const reason = err
      ? `Video decode error (code: ${err.code})`
      : "This video may be corrupted.";
    state.warning = true;
    state.reason = reason;
  }

  function onAudioError(audioEl: HTMLAudioElement | null) {
    const err = audioEl?.error;
    const reason = err
      ? `Audio decode error (code: ${err.code})`
      : "This audio may be corrupted.";
    state.warning = true;
    state.reason = reason;
  }

  function dismiss() {
    state.warning = false;
    state.reason = "";
  }

  function hide() {
    state.warning = false;
  }

  function reset() {
    state.warning = false;
    state.reason = "";
    state.fixError = "";
  }

  async function fixCopy(opts: { filePath: string }) {
    state.fixing = true;
    state.fixError = "";
    try {
      const result = await invokeFixMedia(opts.filePath, "copy");
      if (result.success) {
        state.warning = false;
        showToast({
          message: `Fixed copy saved: ${result.output_path}`,
          color: "green",
          duration: 5000,
        });
      } else {
        state.fixError = result.error || "Failed to fix media";
      }
    } catch (e) {
      state.fixError = e instanceof Error ? e.message : "Failed to fix media";
    }
    state.fixing = false;
  }

  async function fixReplace(opts: {
    filePath: string;
    loadFile: (path: string) => Promise<void>;
  }) {
    state.fixing = true;
    state.fixError = "";
    try {
      const result = await invokeFixMedia(opts.filePath, "replace");
      if (result.success) {
        state.warning = false;
        await opts.loadFile(result.output_path);
        showToast({ message: "File fixed and replaced", color: "green" });
      } else {
        state.fixError = result.error || "Failed to fix media";
      }
    } catch (e) {
      state.fixError = e instanceof Error ? e.message : "Failed to fix media";
    }
    state.fixing = false;
  }

  return {
    state,
    onImageError,
    onVideoError,
    onAudioError,
    dismiss,
    hide,
    reset,
    fixCopy,
    fixReplace,
  };
}

export type CorruptionStore = typeof corruption;
export const corruption = createCorruption();
