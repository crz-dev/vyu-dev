// Window controls
import { getCurrentWindow } from "@tauri-apps/api/window";

export async function minimizeWindow() {
  await getCurrentWindow().minimize();
}

export async function maximizeWindow() {
  await getCurrentWindow().toggleMaximize();
}

export async function closeWindow() {
  await getCurrentWindow().close();
}
