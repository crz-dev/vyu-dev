// Window controls
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invokeCleanupTempFolder } from "$lib/features/media/tools";
import { eqEngine } from "$lib/features/equalizer/equalizer-engine";

export async function minimizeWindow() {
  await getCurrentWindow().minimize();
}

export async function maximizeWindow() {
  await getCurrentWindow().toggleMaximize();
}

export async function closeWindow() {
  eqEngine.destroy();
  try {
    await invokeCleanupTempFolder();
  } catch {}
  await getCurrentWindow().close();
}
