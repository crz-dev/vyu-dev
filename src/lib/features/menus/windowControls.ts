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

export async function toggleWindowVisibility() {
  const window = getCurrentWindow();
  if (await window.isMinimized()) {
    await window.unminimize();
    await window.show();
    await window.setFocus();
    return;
  }
  if (await window.isVisible()) {
    await window.hide();
    return;
  }
  await window.show();
  await window.setFocus();
}
