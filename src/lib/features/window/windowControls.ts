import { getCurrentWindow } from "@tauri-apps/api/window";
import { invokeCleanupTempFolder } from "$lib/features/media/tools";

export async function minimizeWindow() {
  await getCurrentWindow().minimize();
}

export async function maximizeWindow() {
  await getCurrentWindow().toggleMaximize();
}

export async function closeWindow() {
  try {
    await invokeCleanupTempFolder();
  } catch {}
  await getCurrentWindow().close();
}
