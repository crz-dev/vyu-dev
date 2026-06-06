import { open } from "@tauri-apps/plugin-dialog";
import { ALL_EXTS, AUDIO_EXTS } from "$lib/shared/constants";

export interface FileOpenDeps {
  loadFile: (path: string) => Promise<void>;
}

export function createFileOpenActions(deps: FileOpenDeps) {
  async function openFileDialog() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Media", extensions: ALL_EXTS }],
    });
    if (selected) await deps.loadFile(selected as string);
  }

  async function pickAudioFile() {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Audio", extensions: AUDIO_EXTS }],
    });
    if (selected) await deps.loadFile(selected as string);
  }

  async function openConvertedFile(path: string) {
    await deps.loadFile(path);
  }

  return { openFileDialog, pickAudioFile, openConvertedFile };
}
