// External apps
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(target_os = "windows")]
use windows::core::Interface;
use serde::Serialize;

use crate::constants::CREATE_NO_WINDOW;
use crate::util::{canonicalize_path, ffprobe_command};

#[derive(Serialize)]
pub struct SongIdentification {
    pub title: String,
    pub artist: String,
}

#[tauri::command]
pub async fn identify_song(
    app: tauri::AppHandle,
    file_path: String,
) -> Result<Option<SongIdentification>, String> {
    use tauri_plugin_shell::ShellExt;

    let p = PathBuf::from(&file_path);
    if !p.exists() {
        return Err("File does not exist".into());
    }

    let sidecar = app
        .shell()
        .sidecar("songrec")
        .map_err(|e| format!("Failed to create sidecar command: {e}"))?;

    let output = sidecar
        .args(["audio-file-to-recognized-song", &file_path])
        .output()
        .await
        .map_err(|e| format!("Failed to run songrec: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid songrec output: {e}"))?;

    match value.get("track") {
        Some(track) => {
            let title = track
                .get("title")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();
            let artist = track
                .get("subtitle")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown")
                .to_string();
            Ok(Some(SongIdentification { title, artist }))
        }
        None => Ok(None),
    }
}

#[tauri::command]
pub fn print_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        let wide_path = windows::core::HSTRING::from(&path);
        unsafe {
            let hinst = windows::Win32::UI::Shell::ShellExecuteW(
                None,
                windows::core::w!("print"),
                &wide_path,
                None,
                None,
                windows::Win32::UI::WindowsAndMessaging::SW_SHOWDEFAULT,
            );
            if hinst.is_invalid() {
                return Err("Failed to open print dialog".into());
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Printing is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn send_bluetooth(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("fsquirt.exe")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-send", &path])
            .spawn()
            .map_err(|e| format!("Failed to launch Bluetooth wizard: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Bluetooth transfer is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn set_wallpaper(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        let wide_path = windows::core::HSTRING::from(&path);
        unsafe {
            windows::Win32::UI::WindowsAndMessaging::SystemParametersInfoW(
                windows::Win32::UI::WindowsAndMessaging::SPI_SETDESKWALLPAPER,
                0,
                Some(wide_path.as_ptr() as _),
                windows::Win32::UI::WindowsAndMessaging::SPIF_UPDATEINIFILE
                    | windows::Win32::UI::WindowsAndMessaging::SPIF_SENDCHANGE,
            )
            .map_err(|e| format!("SystemParametersInfoW failed: {e}"))?;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Setting wallpaper is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn set_lock_screen(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        let local_app = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| {
            std::env::var("USERPROFILE").unwrap_or_default() + "\\AppData\\Local"
        });
        let wallpapers_dir = PathBuf::from(&local_app).join("vyu").join("wallpapers");
        fs::create_dir_all(&wallpapers_dir)
            .map_err(|e| format!("Failed to create wallpapers dir: {e}"))?;
        let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("png");
        let dest = wallpapers_dir.join(format!("lockscreen.{ext}"));
        fs::copy(&p, &dest).map_err(|e| format!("Failed to copy image: {e}"))?;

        let wide_dest = windows::core::HSTRING::from(dest.to_string_lossy().to_string());
        unsafe {
            let mut key = Default::default();
            let open_err = windows::Win32::System::Registry::RegOpenKeyExW(
                windows::Win32::System::Registry::HKEY_CURRENT_USER,
                windows::core::w!(r"Software\Microsoft\Windows\CurrentVersion\Lock Screen"),
                Some(0),
                windows::Win32::System::Registry::KEY_SET_VALUE,
                &mut key,
            );
            if open_err.0 != 0 {
                return Err(format!(
                    "Failed to open registry key: error {:#x}",
                    open_err.0
                ));
            }

            let data_bytes =
                std::slice::from_raw_parts(wide_dest.as_ptr() as *const u8, wide_dest.len() * 2);
            let set_err = windows::Win32::System::Registry::RegSetValueExW(
                key,
                windows::core::w!("Wallpaper"),
                Some(0),
                windows::Win32::System::Registry::REG_SZ,
                Some(data_bytes),
            );
            let _ = windows::Win32::System::Registry::RegCloseKey(key);
            if set_err.0 != 0 {
                return Err(format!(
                    "Failed to set registry value: error {:#x}",
                    set_err.0
                ));
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Setting lock screen is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn create_desktop_shortcut(path: String) -> Result<(), String> {
    let p = canonicalize_path(&path)?;
    #[cfg(target_os = "windows")]
    {
        unsafe {
            let hr = windows::Win32::System::Com::CoInitializeEx(
                None,
                windows::Win32::System::Com::COINIT_APARTMENTTHREADED,
            );
            if hr.is_err() && hr.0 != 0 {
                return Err(format!(
                    "COM initialization failed: HRESULT {:#x}",
                    hr.0
                ));
            }

            let com_result = (|| -> Result<(), String> {
                let shell_link: windows::Win32::UI::Shell::IShellLinkW =
                    windows::Win32::System::Com::CoCreateInstance(
                        &windows::Win32::UI::Shell::ShellLink,
                        None,
                        windows::Win32::System::Com::CLSCTX_INPROC_SERVER,
                    )
                    .map_err(|e| format!("Failed to create IShellLink: {e}"))?;

                let wide_path = windows::core::HSTRING::from(&path);
                shell_link
                    .SetPath(&wide_path)
                    .map_err(|e| format!("SetPath failed: {e}"))?;
                shell_link
                    .SetDescription(windows::core::w!("Shortcut created by Vyu"))
                    .map_err(|e| format!("SetDescription failed: {e}"))?;

                let persist: windows::Win32::System::Com::IPersistFile = shell_link
                    .cast()
                    .map_err(|e| format!("IPersistFile cast failed: {e}"))?;

                let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
                let file_stem =
                    p.file_stem().and_then(|s| s.to_str()).unwrap_or("shortcut");
                let lnk_path = format!("{user_profile}\\Desktop\\{file_stem}.lnk");

                let final_lnk = if Path::new(&lnk_path).exists() {
                    let mut counter = 2u32;
                    loop {
                        let candidate =
                            format!("{user_profile}\\Desktop\\{file_stem} ({counter}).lnk");
                        if !Path::new(&candidate).exists() {
                            break candidate;
                        }
                        counter += 1;
                        if counter > 999 {
                            return Err("Too many duplicates on Desktop".into());
                        }
                    }
                } else {
                    lnk_path
                };

                let wide_lnk = windows::core::HSTRING::from(&final_lnk);
                persist
                    .Save(&wide_lnk, true)
                    .map_err(|e| format!("IPersistFile::Save failed: {e}"))?;

                Ok(())
            })();

            windows::Win32::System::Com::CoUninitialize();
            return com_result;
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Creating shortcuts is only supported on Windows.".into());
    }
    #[allow(unreachable_code)]
    Ok(())
}

#[tauri::command]
pub fn open_in_photos(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        let wide_path = windows::core::HSTRING::from(&path);
        unsafe {
            let hinst = windows::Win32::UI::Shell::ShellExecuteW(
                None,
                windows::core::w!("open"),
                &wide_path,
                None,
                None,
                windows::Win32::UI::WindowsAndMessaging::SW_SHOWDEFAULT,
            );
            if hinst.is_invalid() {
                return Err(
                    "APP_NOT_FOUND:Photos:https://apps.microsoft.com/store/apps/microsoft-photos/9WZDNCRFJBH4"
                        .into(),
                );
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Opening in Photos is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn open_in_paint(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        let result = Command::new("mspaint")
            .creation_flags(CREATE_NO_WINDOW)
            .arg(&path)
            .spawn();
        match result {
            Ok(_) => {}
            Err(e) => {
                if e.kind() == std::io::ErrorKind::NotFound {
                    return Err(
                        "APP_NOT_FOUND:Paint:https://apps.microsoft.com/store/apps/microsoft-paint/9PCFS5B6T72H"
                            .into(),
                    );
                }
                return Err(format!("Failed to open Paint: {e}"));
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Opening in Paint is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn open_in_vlc(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        let local_app = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let known_paths = [
            format!("{local_app}\\VideoLAN\\VLC\\vlc.exe"),
            "C:\\Program Files\\VideoLAN\\VLC\\vlc.exe".to_string(),
            "C:\\Program Files (x86)\\VideoLAN\\VLC\\vlc.exe".to_string(),
        ];
        let mut vlc_path: Option<String> = None;
        for kp in &known_paths {
            if Path::new(kp).exists() {
                vlc_path = Some(kp.clone());
                break;
            }
        }
        if vlc_path.is_none() {
            let path_var = std::env::var("PATH").unwrap_or_default();
            for dir in path_var.split(';') {
                let candidate = format!("{dir}\\vlc.exe");
                if Path::new(&candidate).exists() {
                    vlc_path = Some(candidate);
                    break;
                }
            }
        }
        match vlc_path {
            Some(exe) => {
                Command::new(&exe)
                    .creation_flags(CREATE_NO_WINDOW)
                    .arg(&path)
                    .spawn()
                    .map_err(|e: std::io::Error| format!("Failed to launch VLC: {e}"))?;
            }
            None => {
                return Err("APP_NOT_FOUND:VLC:https://www.videolan.org/vlc/".into());
            }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Opening in VLC is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn open_in_spotify(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        let user_profile = std::env::var("USERPROFILE").unwrap_or_default();
        let vyu_dir = PathBuf::from(&user_profile).join("Music").join("Vyu");
        fs::create_dir_all(&vyu_dir)
            .map_err(|e| format!("Failed to create Music/Vyu directory: {e}"))?;

        let file_name = p
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("audio.mp3");
        let mut dest = vyu_dir.join(file_name);
        if dest.exists() {
            let stem = p.file_stem().and_then(|s| s.to_str()).unwrap_or("audio");
            let ext = p.extension().and_then(|e| e.to_str()).unwrap_or("mp3");
            let mut counter = 2u32;
            loop {
                let candidate = vyu_dir.join(format!("{stem} ({counter}).{ext}"));
                if !candidate.exists() {
                    dest = candidate;
                    break;
                }
                counter += 1;
                if counter > 9999 {
                    return Err("Too many duplicate files".into());
                }
            }
        }
        fs::copy(&p, &dest).map_err(|e| format!("Failed to copy file to Music/Vyu: {e}"))?;

        let local_app = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let spotify_exe = format!("{local_app}\\Spotify\\Spotify.exe");
        if !Path::new(&spotify_exe).exists() {
            return Err("APP_NOT_FOUND:Spotify:https://www.spotify.com/download/".into());
        }
        Command::new(&spotify_exe)
            .creation_flags(CREATE_NO_WINDOW)
            .arg("spotify:localfiles")
            .spawn()
            .map_err(|e| format!("Failed to launch Spotify: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Opening in Spotify is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn open_with_dialog(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32.exe")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["shell32.dll,OpenAs_RunDLL", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Open With dialog: {e}"))?;
    }
    #[cfg(not(target_os = "windows"))]
    {
        return Err("Open With dialog is only supported on Windows.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn get_media_properties(path: String) -> Result<crate::types::MediaProperties, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }

    let output = ffprobe_command()
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_streams",
            "-show_format",
            &path,
        ])
        .output()
        .map_err(|e| format!("ffprobe not available: {e}"))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let value: serde_json::Value = serde_json::from_slice(&output.stdout)
        .map_err(|e| format!("Invalid ffprobe output: {e}"))?;

    let streams = value
        .get("streams")
        .and_then(|s| s.as_array())
        .cloned()
        .unwrap_or_default();
    let video_stream = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("video"));
    let audio_stream = streams
        .iter()
        .find(|s| s.get("codec_type").and_then(|t| t.as_str()) == Some("audio"));

    Ok(crate::types::MediaProperties {
        container: value
            .get("format")
            .and_then(|f| f.get("format_name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        video_codec: video_stream
            .and_then(|s| s.get("codec_name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        audio_codec: audio_stream
            .and_then(|s| s.get("codec_name"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        pixel_format: video_stream
            .and_then(|s| s.get("pix_fmt"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        color_space: video_stream
            .and_then(|s| s.get("color_space"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        color_primaries: video_stream
            .and_then(|s| s.get("color_primaries"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        color_transfer: video_stream
            .and_then(|s| s.get("color_transfer"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        bit_depth: video_stream
            .and_then(|s| s.get("bits_per_raw_sample"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
        frame_rate: video_stream
            .and_then(|s| s.get("r_frame_rate"))
            .and_then(|n| n.as_str())
            .map(|s| s.to_string()),
    })
}

#[tauri::command]
pub fn open_devtools(window: tauri::WebviewWindow) {
    window.open_devtools();
}
