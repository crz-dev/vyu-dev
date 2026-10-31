// System-level configuration and power state
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Arc;
use std::time::Duration;

pub const CONFIG_FILE: &str = "system.json";
pub const DEFAULT_CACHE_LIMIT_MB: u64 = 500;
pub const MIN_CACHE_LIMIT_MB: u64 = 100;
pub const MAX_CACHE_LIMIT_MB: u64 = 4096;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(default, rename_all = "camelCase")]
pub struct SystemConfig {
    pub hardware_acceleration: bool,
    pub single_instance: bool,
    pub thumbnail_cache_limit_mb: u64,
    pub launch_minimized: bool,
    pub clear_cache_on_exit: bool,
}

impl Default for SystemConfig {
    fn default() -> Self {
        Self {
            hardware_acceleration: true,
            single_instance: true,
            thumbnail_cache_limit_mb: DEFAULT_CACHE_LIMIT_MB,
            launch_minimized: false,
            clear_cache_on_exit: false,
        }
    }
}

impl SystemConfig {
    pub fn sanitized(mut self) -> Self {
        self.thumbnail_cache_limit_mb = self
            .thumbnail_cache_limit_mb
            .clamp(MIN_CACHE_LIMIT_MB, MAX_CACHE_LIMIT_MB);
        self
    }
}

pub struct SystemState {
    pub config: std::sync::Mutex<SystemConfig>,
    pub startup_config: SystemConfig,
    pub config_dir: PathBuf,
    pub keep_awake: Arc<AtomicU8>,
}

impl SystemState {
    pub fn new(config: SystemConfig, config_dir: PathBuf) -> Self {
        Self {
            startup_config: config.clone(),
            config: std::sync::Mutex::new(config),
            config_dir,
            keep_awake: Arc::new(AtomicU8::new(0)),
        }
    }
}

/// Resolve `%APPDATA%/{identifier}` before a Tauri app handle exists.
pub fn config_dir(identifier: &str) -> Option<PathBuf> {
    std::env::var_os("APPDATA").map(|base| PathBuf::from(base).join(identifier))
}

pub fn load_config(identifier: &str) -> SystemConfig {
    let Some(dir) = config_dir(identifier) else {
        return SystemConfig::default();
    };
    load_config_from(&dir)
}

pub fn load_config_from(dir: &Path) -> SystemConfig {
    let path = dir.join(CONFIG_FILE);
    let Ok(contents) = fs::read_to_string(path) else {
        return SystemConfig::default();
    };
    serde_json::from_str::<SystemConfig>(&contents)
        .map(SystemConfig::sanitized)
        .unwrap_or_default()
}

pub fn save_config(dir: &Path, config: &SystemConfig) -> Result<(), String> {
    fs::create_dir_all(dir).map_err(|e| format!("Failed to create config directory: {e}"))?;
    let path = dir.join(CONFIG_FILE);
    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize system settings: {e}"))?;
    fs::write(path, json).map_err(|e| format!("Failed to write system settings: {e}"))
}

pub fn safe_mode_enabled() -> bool {
    std::env::args().any(|arg| arg == "--safe-mode")
}

pub fn start_keep_awake_monitor(flag: Arc<AtomicU8>) {
    std::thread::spawn(move || {
        let mut applied: u8 = u8::MAX;
        loop {
            let mode = flag.load(Ordering::Relaxed);
            if mode != applied {
                apply_keep_awake(mode);
                applied = mode;
            }
            std::thread::sleep(Duration::from_millis(500));
        }
    });
}

#[cfg(target_os = "windows")]
fn apply_keep_awake(mode: u8) {
    use windows::Win32::System::Power::{
        SetThreadExecutionState, ES_CONTINUOUS, ES_DISPLAY_REQUIRED, ES_SYSTEM_REQUIRED,
    };

    let flags = match mode {
        1 => ES_CONTINUOUS | ES_SYSTEM_REQUIRED,
        2 => ES_CONTINUOUS | ES_SYSTEM_REQUIRED | ES_DISPLAY_REQUIRED,
        _ => ES_CONTINUOUS,
    };
    unsafe {
        let _ = SetThreadExecutionState(flags);
    }
}

#[cfg(not(target_os = "windows"))]
fn apply_keep_awake(_mode: u8) {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn defaults_keep_gpu_and_single_instance() {
        let config = SystemConfig::default();
        assert!(config.hardware_acceleration);
        assert!(config.single_instance);
        assert_eq!(config.thumbnail_cache_limit_mb, DEFAULT_CACHE_LIMIT_MB);
    }

    #[test]
    fn cache_limit_is_clamped() {
        let config = SystemConfig {
            thumbnail_cache_limit_mb: 10,
            ..SystemConfig::default()
        }
        .sanitized();
        assert_eq!(config.thumbnail_cache_limit_mb, MIN_CACHE_LIMIT_MB);

        let config = SystemConfig {
            thumbnail_cache_limit_mb: 9000,
            ..SystemConfig::default()
        }
        .sanitized();
        assert_eq!(config.thumbnail_cache_limit_mb, MAX_CACHE_LIMIT_MB);
    }
}
