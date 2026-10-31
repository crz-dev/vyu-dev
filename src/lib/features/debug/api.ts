// Debug IPC wrappers
import { invoke } from "@tauri-apps/api/core";
import type { DatabaseStats } from "$lib/features/debug/debugTypes";

export function invokeGetDatabaseStats(): Promise<DatabaseStats> {
  return invoke("get_database_stats");
}

export function invokeVacuumDatabase(): Promise<number> {
  return invoke("vacuum_database");
}
