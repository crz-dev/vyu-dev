import { invoke } from "@tauri-apps/api/core";

export interface WindowsAccessibility {
  textScaleFactor: number;
  highContrast: boolean;
}

export function invokeGetWindowsAccessibility(): Promise<WindowsAccessibility> {
  return invoke<WindowsAccessibility>("get_windows_accessibility");
}
