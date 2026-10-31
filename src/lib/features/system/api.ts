// System IPC wrappers
import { invoke } from "@tauri-apps/api/core";

export interface SystemConfig {
  hardwareAcceleration: boolean;
  singleInstance: boolean;
  thumbnailCacheLimitMb: number;
}

export interface RuntimeInfo {
  os: string;
  arch: string;
  exePath: string;
  args: string[];
  safeMode: boolean;
}

export interface RestartStatus {
  hardwareAcceleration: boolean;
  singleInstance: boolean;
}

export interface LoginStartState {
  supported: boolean;
  enabled: boolean;
}

export interface PowerStatus {
  supported: boolean;
  onBattery: boolean;
  percent: number;
  charging: boolean;
}

export interface CacheStats {
  thumbnails: number;
  displays: number;
  coverArt: number;
  total: number;
  thumbnailLimit: number;
}

export interface UpdateCheckResult {
  status: "update" | "current" | "no-releases" | "error";
  currentVersion: string;
  latestVersion: string | null;
  releaseUrl: string | null;
  message: string;
}

export function invokeGetSystemConfig(): Promise<SystemConfig> {
  return invoke("get_system_config");
}

export function invokeGetRuntimeInfo(): Promise<RuntimeInfo> {
  return invoke("get_runtime_info");
}

export function invokeOpenDevTools(): Promise<void> {
  return invoke("open_devtools");
}

export function invokeGetSystemRestartStatus(): Promise<RestartStatus> {
  return invoke("get_system_restart_status");
}

export function invokeSetHardwareAcceleration(enabled: boolean): Promise<void> {
  return invoke("set_hardware_acceleration", { enabled });
}

export function invokeSetSingleInstance(enabled: boolean): Promise<void> {
  return invoke("set_single_instance", { enabled });
}

export function invokeSetThumbnailCacheLimit(
  megabytes: number,
): Promise<number> {
  return invoke("set_thumbnail_cache_limit", { megabytes });
}

export function invokeSetKeepAwake(
  mode: "none" | "system" | "display",
): Promise<void> {
  return invoke("set_keep_awake", { mode });
}

export function invokeGetPowerStatus(): Promise<PowerStatus> {
  return invoke("get_power_status");
}

export function invokeGetStartOnLogin(): Promise<LoginStartState> {
  return invoke("get_start_on_login");
}

export function invokeSetStartOnLogin(enabled: boolean): Promise<void> {
  return invoke("set_start_on_login", { enabled });
}

export function invokeGetExplorerContextMenu(): Promise<boolean> {
  return invoke("get_explorer_context_menu");
}

export function invokeSetExplorerContextMenu(enabled: boolean): Promise<void> {
  return invoke("set_explorer_context_menu", { enabled });
}

export function invokeGetCacheStats(): Promise<CacheStats> {
  return invoke("get_cache_stats");
}

export function invokeClearAllCaches(): Promise<number> {
  return invoke("clear_all_caches");
}

export function invokeOpenAppFolder(
  kind: "data" | "config" | "cache",
): Promise<void> {
  return invoke("open_app_folder", { kind });
}

export function invokeOpenDefaultAppsSettings(): Promise<void> {
  return invoke("open_default_apps_settings");
}

export function invokeRestartApp(): Promise<void> {
  return invoke("restart_app");
}

export function invokeRestartAppMode(safeMode: boolean): Promise<void> {
  return invoke("restart_app_mode", { safeMode });
}

export function invokeResetSystemIntegrations(): Promise<void> {
  return invoke("reset_system_integrations");
}

export function invokeCheckForUpdates(): Promise<UpdateCheckResult> {
  return invoke("check_for_updates");
}
