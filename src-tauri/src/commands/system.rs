// System integration commands
use serde::Serialize;
use std::path::Path;
use std::sync::atomic::Ordering;
use std::time::Duration;
use tauri::{AppHandle, Manager, State};

use crate::state::system::{
    save_config, SystemConfig, SystemState, DEFAULT_CACHE_LIMIT_MB, MAX_CACHE_LIMIT_MB,
    MIN_CACHE_LIMIT_MB,
};

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const CONTEXT_KINDS: [&str; 5] = ["image", "video", "audio", "document", ".pdf"];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub os: String,
    pub arch: String,
    pub exe_path: String,
    pub args: Vec<String>,
    pub safe_mode: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RestartStatus {
    pub hardware_acceleration: bool,
    pub single_instance: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginStartState {
    pub supported: bool,
    pub enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PowerStatus {
    pub supported: bool,
    pub on_battery: bool,
    pub percent: u8,
    pub charging: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub thumbnails: u64,
    pub displays: u64,
    pub cover_art: u64,
    pub total: u64,
    pub thumbnail_limit: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub status: String,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_url: Option<String>,
    pub message: String,
}

fn lock_config(state: &State<'_, SystemState>) -> Result<SystemConfig, String> {
    state
        .config
        .lock()
        .map(|config| config.clone())
        .map_err(|e| format!("Failed to read system settings: {e}"))
}

fn update_config<F>(state: &State<'_, SystemState>, apply: F) -> Result<SystemConfig, String>
where
    F: FnOnce(&mut SystemConfig),
{
    let mut guard = state
        .config
        .lock()
        .map_err(|e| format!("Failed to update system settings: {e}"))?;
    apply(&mut guard);
    let config = guard.clone().sanitized();
    *guard = config.clone();
    save_config(&state.config_dir, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn get_system_config(state: State<'_, SystemState>) -> Result<SystemConfig, String> {
    lock_config(&state)
}

#[tauri::command]
pub fn get_runtime_info() -> RuntimeInfo {
    RuntimeInfo {
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        exe_path: current_exe_path().unwrap_or_default(),
        args: std::env::args().collect(),
        safe_mode: crate::state::system::safe_mode_enabled(),
    }
}

#[tauri::command]
pub fn get_system_restart_status(
    state: State<'_, SystemState>,
) -> Result<RestartStatus, String> {
    let config = lock_config(&state)?;
    Ok(RestartStatus {
        hardware_acceleration: config.hardware_acceleration
            != state.startup_config.hardware_acceleration,
        single_instance: config.single_instance != state.startup_config.single_instance,
    })
}

#[tauri::command]
pub fn set_hardware_acceleration(
    state: State<'_, SystemState>,
    enabled: bool,
) -> Result<(), String> {
    update_config(&state, |config| config.hardware_acceleration = enabled)?;
    Ok(())
}

#[tauri::command]
pub fn set_single_instance(state: State<'_, SystemState>, enabled: bool) -> Result<(), String> {
    update_config(&state, |config| config.single_instance = enabled)?;
    Ok(())
}

#[tauri::command]
pub fn set_thumbnail_cache_limit(
    app: AppHandle,
    state: State<'_, SystemState>,
    megabytes: u64,
) -> Result<u64, String> {
    let clamped = megabytes.clamp(MIN_CACHE_LIMIT_MB, MAX_CACHE_LIMIT_MB);
    update_config(&state, |config| {
        config.thumbnail_cache_limit_mb = clamped;
    })?;
    crate::commands::thumbnail::set_cache_limit_bytes(clamped * 1024 * 1024);
    Ok(crate::commands::thumbnail::enforce_cache_limit(&app))
}

#[tauri::command]
pub fn set_keep_awake(state: State<'_, SystemState>, mode: String) -> Result<(), String> {
    let value = match mode.as_str() {
        "system" => 1,
        "display" => 2,
        _ => 0,
    };
    state.keep_awake.store(value, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub fn get_power_status() -> PowerStatus {
    #[cfg(target_os = "windows")]
    {
        use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};

        let mut status = SYSTEM_POWER_STATUS::default();
        if unsafe { GetSystemPowerStatus(&mut status) }.is_err() {
            return PowerStatus {
                supported: false,
                on_battery: false,
                percent: 0,
                charging: false,
            };
        }
        if status.ACLineStatus == 255 {
            return PowerStatus {
                supported: false,
                on_battery: false,
                percent: 0,
                charging: false,
            };
        }
        PowerStatus {
            supported: true,
            on_battery: status.ACLineStatus == 0,
            percent: if status.BatteryLifePercent == 255 {
                0
            } else {
                status.BatteryLifePercent
            },
            charging: status.BatteryFlag & 8 != 0,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        PowerStatus {
            supported: false,
            on_battery: false,
            percent: 0,
            charging: false,
        }
    }
}

#[tauri::command]
pub fn get_start_on_login() -> LoginStartState {
    #[cfg(target_os = "windows")]
    {
        if cfg!(debug_assertions) {
            return LoginStartState {
                supported: false,
                enabled: false,
            };
        }
        let enabled = match current_exe_path() {
            Ok(exe) => read_reg_string(RUN_KEY, "Vyu")
                .map(|value| paths_match(&value, &exe))
                .unwrap_or(false),
            Err(_) => false,
        };
        LoginStartState {
            supported: true,
            enabled,
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        LoginStartState {
            supported: false,
            enabled: false,
        }
    }
}

#[tauri::command]
pub fn set_start_on_login(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if cfg!(debug_assertions) {
            return Err("Launch at login is available in installed builds.".into());
        }
        if enabled {
            let exe = current_exe_path()?;
            let value = format!("\"{exe}\"");
            write_reg_string(RUN_KEY, "Vyu", &value)
        } else {
            delete_reg_value(RUN_KEY, "Vyu")
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
        Err("Launch at login is only supported on Windows.".into())
    }
}

#[tauri::command]
pub fn get_explorer_context_menu() -> bool {
    #[cfg(target_os = "windows")]
    {
        CONTEXT_KINDS.iter().any(|kind| context_key_exists(kind))
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

#[tauri::command]
pub fn set_explorer_context_menu(enabled: bool) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        if enabled {
            let exe = current_exe_path()?;
            let command = format!("\"{exe}\" \"%1\"");
            let icon = format!("\"{exe}\",0");
            for kind in CONTEXT_KINDS {
                let path = context_key_path(kind);
                let key = create_reg_key(&path)?;
                let result = (|| {
                    set_reg_string(key, "", "Open with Vyu")?;
                    set_reg_string(key, "Icon", &icon)?;
                    let command_key = create_reg_key(&format!("{path}\\command"))?;
                    let command_result = set_reg_string(command_key, "", &command);
                    close_reg_key(command_key);
                    command_result
                })();
                close_reg_key(key);
                result?;
            }
            Ok(())
        } else {
            for kind in CONTEXT_KINDS {
                delete_reg_tree(&context_key_path(kind));
            }
            Ok(())
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = enabled;
        Err("Explorer integration is only supported on Windows.".into())
    }
}

#[tauri::command]
pub async fn get_cache_stats(app: AppHandle) -> Result<CacheStats, String> {
    let app_for_stats = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        let thumbs = crate::commands::thumbnail::thumb_cache_dir(&app_for_stats).to_path_buf();
        let displays = crate::commands::display::display_cache_dir(&app_for_stats);
        let covers = crate::commands::display::cover_art_cache_dir(&app_for_stats);
        let thumbnails = dir_size(&thumbs);
        let display_bytes = dir_size(&displays);
        let cover_bytes = dir_size(&covers);
        CacheStats {
            thumbnails,
            displays: display_bytes,
            cover_art: cover_bytes,
            total: thumbnails + display_bytes + cover_bytes,
            thumbnail_limit: crate::commands::thumbnail::cache_limit_bytes(),
        }
    })
    .await
    .map_err(|e| format!("Failed to calculate cache size: {e}"))
}

#[tauri::command]
pub async fn clear_all_caches(app: AppHandle) -> Result<u64, String> {
    let thumbnails = crate::commands::thumbnail::clear_thumbnail_cache(app.clone())
        .await
        .unwrap_or(0);
    let displays = crate::commands::display::clear_display_caches(&app);
    Ok(thumbnails + displays)
}

#[tauri::command]
pub fn open_app_folder(app: AppHandle, kind: String) -> Result<(), String> {
    let path = match kind.as_str() {
        "cache" => app.path().app_cache_dir(),
        "config" => app.path().app_config_dir(),
        _ => app.path().app_data_dir(),
    }
    .map_err(|e| format!("Failed to resolve app folder: {e}"))?;
    std::process::Command::new("explorer")
        .arg(path)
        .spawn()
        .map_err(|e| format!("Failed to open folder: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn open_default_apps_settings() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use windows::core::HSTRING;
        use windows::Win32::UI::Shell::ShellExecuteW;
        use windows::Win32::UI::WindowsAndMessaging::SW_SHOWDEFAULT;

        let target = HSTRING::from("ms-settings:defaultapps");
        let result = unsafe {
            ShellExecuteW(
                None,
                windows::core::w!("open"),
                &target,
                None,
                None,
                SW_SHOWDEFAULT,
            )
        };
        if result.is_invalid() || result.0 as isize <= 32 {
            return Err("Failed to open Windows Default Apps settings.".into());
        }
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("Default app settings are only supported on Windows.".into())
    }
}

fn spawn_restart(app: AppHandle, safe_mode: Option<bool>) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("main") {
        let skip_save = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false));
        crate::state::window::persist_window_state(&window, &skip_save);
    }
    crate::util::cleanup_vyu_temp();

    let exe = std::env::current_exe()
        .map_err(|e| format!("Failed to resolve executable path: {e}"))?;
    let mut command = std::process::Command::new(exe);
    for arg in std::env::args_os().skip(1) {
        let value = arg.to_string_lossy();
        if value == "--restart-delay" {
            continue;
        }
        if safe_mode.is_some() && value == "--safe-mode" {
            continue;
        }
        command.arg(arg);
    }
    if safe_mode == Some(true) {
        command.arg("--safe-mode");
    }
    command
        .arg("--restart-delay")
        .spawn()
        .map_err(|e| format!("Failed to restart vyu: {e}"))?;
    std::process::exit(0);
}

#[tauri::command]
pub fn restart_app(app: AppHandle) -> Result<(), String> {
    spawn_restart(app, None)
}

#[tauri::command]
pub fn restart_app_mode(app: AppHandle, safe_mode: bool) -> Result<(), String> {
    spawn_restart(app, Some(safe_mode))
}

#[tauri::command]
pub fn reset_system_integrations(state: State<'_, SystemState>) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let _ = delete_reg_value(RUN_KEY, "Vyu");
        for kind in CONTEXT_KINDS {
            delete_reg_tree(&context_key_path(kind));
        }
    }
    let defaults = SystemConfig::default();
    save_config(&state.config_dir, &defaults)?;
    if let Ok(mut config) = state.config.lock() {
        *config = defaults;
    }
    crate::commands::thumbnail::set_cache_limit_bytes(DEFAULT_CACHE_LIMIT_MB * 1024 * 1024);
    state.keep_awake.store(0, Ordering::Relaxed);
    Ok(())
}

#[tauri::command]
pub async fn check_for_updates(app: AppHandle) -> UpdateCheckResult {
    let current_version = app.package_info().version.to_string();
    tauri::async_runtime::spawn_blocking(move || fetch_latest_release(&current_version))
        .await
        .unwrap_or_else(|e| UpdateCheckResult {
            status: "error".into(),
            current_version: String::new(),
            latest_version: None,
            release_url: None,
            message: format!("Update check failed: {e}"),
        })
}

fn fetch_latest_release(current_version: &str) -> UpdateCheckResult {
    let url = "https://api.github.com/repos/crz-dev/vyu-dev/releases/latest";
    let fallback_url = "https://github.com/crz-dev/vyu-dev/releases";
    let response = ureq::get(url)
        .set("User-Agent", "vyu-updater")
        .set("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(10))
        .call();

    match response {
        Ok(response) => {
            let body = match response.into_string() {
                Ok(body) => body,
                Err(e) => {
                    return UpdateCheckResult {
                        status: "error".into(),
                        current_version: current_version.into(),
                        latest_version: None,
                        release_url: None,
                        message: format!("Could not read update response: {e}"),
                    };
                }
            };
            let value: serde_json::Value = match serde_json::from_str(&body) {
                Ok(value) => value,
                Err(e) => {
                    return UpdateCheckResult {
                        status: "error".into(),
                        current_version: current_version.into(),
                        latest_version: None,
                        release_url: None,
                        message: format!("Could not parse update response: {e}"),
                    };
                }
            };
            let tag = value
                .get("tag_name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .trim()
                .to_string();
            let release_url = value
                .get("html_url")
                .and_then(|v| v.as_str())
                .unwrap_or(fallback_url)
                .to_string();
            if tag.is_empty() {
                return UpdateCheckResult {
                    status: "no-releases".into(),
                    current_version: current_version.into(),
                    latest_version: None,
                    release_url: Some(fallback_url.into()),
                    message: "No releases published yet".into(),
                };
            }
            if is_newer_version(&tag, current_version) {
                UpdateCheckResult {
                    status: "update".into(),
                    current_version: current_version.into(),
                    latest_version: Some(tag),
                    release_url: Some(release_url),
                    message: "A newer version is available".into(),
                }
            } else {
                UpdateCheckResult {
                    status: "current".into(),
                    current_version: current_version.into(),
                    latest_version: Some(tag),
                    release_url: Some(release_url),
                    message: "You are on the latest version".into(),
                }
            }
        }
        Err(ureq::Error::Status(404, _)) => UpdateCheckResult {
            status: "no-releases".into(),
            current_version: current_version.into(),
            latest_version: None,
            release_url: Some(fallback_url.into()),
            message: "No releases published yet".into(),
        },
        Err(e) => UpdateCheckResult {
            status: "error".into(),
            current_version: current_version.into(),
            latest_version: None,
            release_url: None,
            message: format!("Could not check for updates: {e}"),
        },
    }
}

fn parse_version(value: &str) -> Vec<u64> {
    let core = value
        .trim()
        .trim_start_matches('v')
        .split(['-', '+'])
        .next()
        .unwrap_or("");
    core.split('.')
        .map(|part| {
            part.chars()
                .take_while(|c| c.is_ascii_digit())
                .collect::<String>()
                .parse::<u64>()
                .unwrap_or(0)
        })
        .collect()
}

fn is_newer_version(latest: &str, current: &str) -> bool {
    let latest = parse_version(latest);
    let current = parse_version(current);
    let len = latest.len().max(current.len());
    for i in 0..len {
        let a = latest.get(i).copied().unwrap_or(0);
        let b = current.get(i).copied().unwrap_or(0);
        if a != b {
            return a > b;
        }
    }
    false
}

fn dir_size(dir: &Path) -> u64 {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return 0;
    };
    let mut total = 0u64;
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            total += dir_size(&path);
        } else {
            total += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }
    total
}

#[cfg(target_os = "windows")]
fn context_key_path(kind: &str) -> String {
    format!(r"Software\Classes\SystemFileAssociations\{kind}\shell\Vyu")
}

#[cfg(target_os = "windows")]
fn current_exe_path() -> Result<String, String> {
    std::env::current_exe()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|e| format!("Failed to resolve executable path: {e}"))
}

#[cfg(target_os = "windows")]
fn paths_match(stored: &str, exe: &str) -> bool {
    let stored = stored.trim().trim_matches('"');
    stored.eq_ignore_ascii_case(exe)
}

#[cfg(target_os = "windows")]
fn context_key_exists(kind: &str) -> bool {
    use windows::Win32::System::Registry::{
        RegCloseKey, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, KEY_READ,
    };

    let path = windows::core::HSTRING::from(context_key_path(kind));
    let mut key = HKEY::default();
    let status = unsafe { RegOpenKeyExW(HKEY_CURRENT_USER, &path, Some(0), KEY_READ, &mut key) };
    if status.0 == 0 {
        unsafe {
            let _ = RegCloseKey(key);
        }
        true
    } else {
        false
    }
}

#[cfg(target_os = "windows")]
fn read_reg_string(subkey: &str, value: &str) -> Option<String> {
    use windows::Win32::System::Registry::{RegGetValueW, HKEY_CURRENT_USER, RRF_RT_REG_SZ};

    let subkey_wide = windows::core::HSTRING::from(subkey);
    let value_wide = windows::core::HSTRING::from(value);
    let mut size: u32 = 0;
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            &subkey_wide,
            &value_wide,
            RRF_RT_REG_SZ,
            None,
            None,
            Some(&mut size),
        )
    };
    if status.0 != 0 || size == 0 {
        return None;
    }
    let mut buffer = vec![0u16; (size as usize / 2).max(1)];
    let status = unsafe {
        RegGetValueW(
            HKEY_CURRENT_USER,
            &subkey_wide,
            &value_wide,
            RRF_RT_REG_SZ,
            None,
            Some(buffer.as_mut_ptr() as *mut core::ffi::c_void),
            Some(&mut size),
        )
    };
    if status.0 != 0 {
        return None;
    }
    let end = buffer.iter().position(|c| *c == 0).unwrap_or(buffer.len());
    Some(String::from_utf16_lossy(&buffer[..end]))
}

#[cfg(target_os = "windows")]
fn write_reg_string(subkey: &str, value: &str, data: &str) -> Result<(), String> {
    let key = create_reg_key(subkey)?;
    let result = set_reg_string(key, value, data);
    close_reg_key(key);
    result
}

#[cfg(target_os = "windows")]
fn delete_reg_value(subkey: &str, value: &str) -> Result<(), String> {
    use windows::Win32::System::Registry::{
        RegCloseKey, RegDeleteValueW, RegOpenKeyExW, HKEY, HKEY_CURRENT_USER, KEY_SET_VALUE,
    };

    let subkey_wide = windows::core::HSTRING::from(subkey);
    let value_wide = windows::core::HSTRING::from(value);
    let mut key = HKEY::default();
    let status = unsafe {
        RegOpenKeyExW(
            HKEY_CURRENT_USER,
            &subkey_wide,
            Some(0),
            KEY_SET_VALUE,
            &mut key,
        )
    };
    if status.0 != 0 {
        return Ok(());
    }
    let status = unsafe { RegDeleteValueW(key, &value_wide) };
    unsafe {
        let _ = RegCloseKey(key);
    }
    if status.0 != 0 && status.0 != 2 {
        return Err(format!(
            "Failed to remove registry value: error {:#x}",
            status.0
        ));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn create_reg_key(subkey: &str) -> Result<windows::Win32::System::Registry::HKEY, String> {
    use windows::Win32::System::Registry::{RegCreateKeyW, HKEY, HKEY_CURRENT_USER};

    let subkey_wide = windows::core::HSTRING::from(subkey);
    let mut key = HKEY::default();
    let status = unsafe { RegCreateKeyW(HKEY_CURRENT_USER, &subkey_wide, &mut key) };
    if status.0 != 0 {
        return Err(format!(
            "Failed to create registry key: error {:#x}",
            status.0
        ));
    }
    Ok(key)
}

#[cfg(target_os = "windows")]
fn set_reg_string(
    key: windows::Win32::System::Registry::HKEY,
    name: &str,
    value: &str,
) -> Result<(), String> {
    use windows::Win32::System::Registry::{RegSetValueExW, REG_SZ};

    let wide: Vec<u16> = value.encode_utf16().chain(std::iter::once(0)).collect();
    let name_wide = windows::core::HSTRING::from(name);
    let bytes = unsafe { std::slice::from_raw_parts(wide.as_ptr() as *const u8, wide.len() * 2) };
    let status = unsafe { RegSetValueExW(key, &name_wide, Some(0), REG_SZ, Some(bytes)) };
    if status.0 != 0 {
        return Err(format!(
            "Failed to set registry value: error {:#x}",
            status.0
        ));
    }
    Ok(())
}

#[cfg(target_os = "windows")]
fn close_reg_key(key: windows::Win32::System::Registry::HKEY) {
    unsafe {
        let _ = windows::Win32::System::Registry::RegCloseKey(key);
    }
}

#[cfg(target_os = "windows")]
fn delete_reg_tree(subkey: &str) {
    let subkey_wide = windows::core::HSTRING::from(subkey);
    unsafe {
        let _ = windows::Win32::System::Registry::RegDeleteTreeW(
            windows::Win32::System::Registry::HKEY_CURRENT_USER,
            &subkey_wide,
        );
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_versions_numerically() {
        assert!(is_newer_version("v0.2.0", "0.1.0"));
        assert!(is_newer_version("1.0.0", "0.9.9"));
        assert!(!is_newer_version("v0.1.0", "0.1.0"));
        assert!(!is_newer_version("0.1", "0.1.0"));
        assert!(!is_newer_version("0.0.9", "0.1.0"));
    }

    #[test]
    fn ignores_prerelease_suffixes() {
        assert!(!is_newer_version("v0.1.0-beta.2", "0.1.0"));
        assert!(is_newer_version("v0.1.1-beta", "0.1.0"));
    }
}
