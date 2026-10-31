// Danger Zone IPC wrappers
import { invoke } from "@tauri-apps/api/core";

export type MarkerClearMode = "timestamps" | "clips" | "all";

export interface UninstallResult {
  started: boolean;
  openedSettings: boolean;
}

export function invokeClearAllMarkers(mode: MarkerClearMode): Promise<number> {
  return invoke("clear_all_markers", { mode });
}

export function invokeFactoryResetDatabase(): Promise<number> {
  return invoke("factory_reset_database");
}

export function invokeDeleteBundledFfmpeg(): Promise<number> {
  return invoke("delete_bundled_ffmpeg");
}

export function invokeRunUninstaller(): Promise<UninstallResult> {
  return invoke("run_uninstaller");
}
