use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use crate::constants::{
    BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST, BROWSER_UNSUPPORTED_VIDEO_EXTS_RUST, CREATE_NO_WINDOW,
};
use crate::util::{ffmpeg_command, hash_path_xxh3, resolve_output_path, unique_path};

/// Write a minimal flat (single-layer, no transparency) PSD file.
/// Image data is raw planar: all R, then all G, then all B.
fn write_psd_flat(path: &Path, width: u32, height: u32, rgb: &[u8]) -> Result<(), String> {
    let mut f = fs::File::create(path).map_err(|e| format!("Failed to create PSD: {e}"))?;

    f.write_all(b"8BPS").map_err(|e| e.to_string())?;
    f.write_all(&1u16.to_be_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&[0u8; 6]).map_err(|e| e.to_string())?;
    f.write_all(&3u16.to_be_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&(height as u32).to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&(width as u32).to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&8u16.to_be_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&3u16.to_be_bytes())
        .map_err(|e| e.to_string())?;

    f.write_all(&0u32.to_be_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&0u32.to_be_bytes()).map_err(|e| e.to_string())?;
    f.write_all(&0u32.to_be_bytes()).map_err(|e| e.to_string())?;

    f.write_all(&0u16.to_be_bytes())
        .map_err(|e| e.to_string())?;

    let n = match (width as usize).checked_mul(height as usize) {
        Some(n) if n <= 1_000_000_000 => n,
        _ => return Err("Image dimensions too large for PSD export".into()),
    };
    let mut r_plane = Vec::with_capacity(n);
    let mut g_plane = Vec::with_capacity(n);
    let mut b_plane = Vec::with_capacity(n);
    for px in rgb.chunks_exact(3) {
        r_plane.push(px[0]);
        g_plane.push(px[1]);
        b_plane.push(px[2]);
    }
    f.write_all(&r_plane).map_err(|e| e.to_string())?;
    f.write_all(&g_plane).map_err(|e| e.to_string())?;
    f.write_all(&b_plane).map_err(|e| e.to_string())?;

    Ok(())
}

/// Converts a media file to a browser-compatible format for opening in the browser.
fn convert_for_browser(path: &str) -> Result<Option<String>, String> {
    let ext = PathBuf::from(path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_lowercase();

    let target_ext = if BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST.contains(&ext.as_str()) {
        "webp"
    } else if BROWSER_UNSUPPORTED_VIDEO_EXTS_RUST.contains(&ext.as_str()) {
        "webm"
    } else {
        return Ok(None);
    };

    let temp_dir = std::env::temp_dir().join("Vyu-temp").join("browser");
    // Clean up any stale files from previous browser conversions
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create browser temp dir: {e}"))?;

    let input = PathBuf::from(path);
    let base_name = input
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output");
    let out_name = format!("{}_browser.{}", base_name, target_ext);
    let output_path = unique_path(temp_dir.join(&out_name));

    let mut args: Vec<String> = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-i".into(),
        path.to_string(),
    ];

    match target_ext {
        "webp" => {
            args.push("-c:v".into());
            args.push("libwebp".into());
            args.push("-quality".into());
            args.push("80".into());
        }
        "webm" => {
            args.push("-c:v".into());
            args.push("libvpx-vp9".into());
            args.push("-c:a".into());
            args.push("libopus".into());
            args.push("-b:v".into());
            args.push("1M".into());
        }
        _ => {}
    }

    args.push(output_path.to_string_lossy().to_string());

    let output = ffmpeg_command()
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    if output.status.success() {
        Ok(Some(output_path.to_string_lossy().to_string()))
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[tauri::command]
pub fn convert_media(
    path: String,
    output_dir: String,
    format: String,
    preset: String,
    custom_output: Option<String>,
) -> Result<String, String> {
    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let ext = format.to_lowercase();

    let output_path = resolve_output_path(&input, &output_dir, custom_output.as_deref(), "_converted", &ext);
    let output_path = unique_path(output_path);

    // PSD encoding: FFmpeg has no PSD encoder, so write it directly using the image crate.
    if ext == "psd" {
        let img = image::open(&input).map_err(|e| format!("Failed to decode image: {e}"))?;
        let rgb = img.to_rgb8();
        write_psd_flat(&output_path, rgb.width(), rgb.height(), &rgb)?;
        return Ok(output_path.to_string_lossy().to_string());
    }

    let mut args: Vec<String> = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-i".into(),
        input.to_string_lossy().to_string(),
    ];

    match ext.as_str() {
        "mp4" => {
            args.push("-c:v".into());
            args.push("libx264".into());
            args.push("-c:a".into());
            args.push("aac".into());
            args.push("-movflags".into());
            args.push("+faststart".into());
        }
        "webm" => {
            args.push("-c:v".into());
            args.push("libvpx-vp9".into());
            args.push("-c:a".into());
            args.push("libopus".into());
        }
        "mkv" => {
            args.push("-c:v".into());
            args.push("libx264".into());
            args.push("-c:a".into());
            args.push("aac".into());
        }
        "gif" => {
            args.push("-vf".into());
            args.push("fps=30,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer".into());
            args.push("-loop".into());
            args.push("0".into());
        }
        "png" => {
            args.push("-c:v".into());
            args.push("png".into());
        }
        "jpg" | "jpeg" => {
            args.push("-q:v".into());
            args.push("2".into());
        }
        "webp" => {
            args.push("-c:v".into());
            args.push("libwebp".into());
        }
        "mp3" => {
            args.push("-c:a".into());
            args.push("libmp3lame".into());
            args.push("-q:a".into());
            args.push("2".into());
        }
        "wav" => {
            args.push("-c:a".into());
            args.push("pcm_s16le".into());
        }
        "flac" => {
            args.push("-c:a".into());
            args.push("flac".into());
            args.push("-compression_level".into());
            args.push("5".into());
        }
        "ogg" => {
            args.push("-c:a".into());
            args.push("libvorbis".into());
            args.push("-q:a".into());
            args.push("4".into());
        }
        "aac" => {
            args.push("-c:a".into());
            args.push("aac".into());
            args.push("-b:a".into());
            args.push("192k".into());
        }
        "opus" => {
            args.push("-c:a".into());
            args.push("libopus".into());
            args.push("-b:a".into());
            args.push("128k".into());
        }
        _ => {}
    }

    if ext != "gif"
        && ext != "png"
        && ext != "jpg"
        && ext != "jpeg"
        && ext != "webp"
        && ext != "mp3"
        && ext != "wav"
        && ext != "flac"
        && ext != "ogg"
        && ext != "aac"
        && ext != "opus"
    {
        match preset.as_str() {
            "Fast" => {
                args.push("-preset".into());
                args.push("fast".into());
                args.push("-crf".into());
                args.push("28".into());
            }
            "Balanced" => {
                args.push("-preset".into());
                args.push("medium".into());
                args.push("-crf".into());
                args.push("23".into());
            }
            "Quality" => {
                args.push("-preset".into());
                args.push("slow".into());
                args.push("-crf".into());
                args.push("18".into());
            }
            "Lossless" => {
                args.push("-preset".into());
                args.push("veryslow".into());
                args.push("-crf".into());
                args.push("0".into());
            }
            _ => {}
        }
    } else if ext == "webp" {
        match preset.as_str() {
            "Fast" => {
                args.push("-quality".into());
                args.push("50".into());
            }
            "Balanced" => {
                args.push("-quality".into());
                args.push("75".into());
            }
            "Quality" => {
                args.push("-quality".into());
                args.push("90".into());
            }
            "Lossless" => {
                args.push("-lossless".into());
                args.push("1".into());
            }
            _ => {}
        }
    }

    args.push(output_path.to_string_lossy().to_string());

    let output = ffmpeg_command()
        .args(&args)
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

    if output.status.success() {
        Ok(output_path.to_string_lossy().to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}

#[tauri::command]
pub fn convert_audio_to_waveform_video(
    app: tauri::AppHandle,
    path: String,
    output_dir: String,
    custom_output: Option<String>,
) -> Result<String, String> {
    use std::io::BufRead;
    use tauri::Emitter;

    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let output_path = resolve_output_path(&input, &output_dir, custom_output.as_deref(), "_waveform", "mp4");
    let output_path = unique_path(output_path);

    // Step 1: Generate background image to temp file
    let temp_dir = std::env::temp_dir().join("Vyu-temp");
    let _ = fs::create_dir_all(&temp_dir);
    let temp_image = temp_dir.join(format!("vyu_wave_{}.jpg", hash_path_xxh3(&path)));

    // Try embedded artwork first
    let has_artwork = ffmpeg_command()
        .args([
            "-y", "-hide_banner", "-loglevel", "error",
            "-i", &input.to_string_lossy(),
            "-an", "-frames:v", "1",
            &temp_image.to_string_lossy(),
        ])
        .output()
        .map(|o| {
            o.status.success()
                && temp_image.exists()
                && temp_image.metadata().map(|m| m.len()).unwrap_or(0) > 1024
        })
        .unwrap_or(false);

    if !has_artwork {
        let wf_output = ffmpeg_command()
            .args([
                "-y", "-hide_banner", "-loglevel", "error",
                "-i", &input.to_string_lossy(),
                "-filter_complex",
                "[0:a]showwavespic=s=1920x1080:colors=white",
                "-frames:v", "1",
                &temp_image.to_string_lossy(),
            ])
            .output()
            .map_err(|e| format!("Failed to generate waveform: {e}"))?;
        if !wf_output.status.success() {
            let _ = fs::remove_file(&temp_image);
            return Err(
                String::from_utf8_lossy(&wf_output.stderr).trim().to_string(),
            );
        }
    }

    // Step 2: Probe audio duration
    let duration_ms: f64 = Command::new("ffprobe")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "csv=p=0",
            &input.to_string_lossy(),
        ])
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                String::from_utf8(o.stdout)
                    .ok()?
                    .trim()
                    .parse::<f64>()
                    .ok()
                    .map(|s| s * 1000.0)
            } else {
                None
            }
        })
        .unwrap_or(0.0);

    // Step 3: Create video from image + audio with progress
    let mut args: Vec<String> = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-progress".into(),
        "pipe:1".into(),
        "-loop".into(),
        "1".into(),
        "-i".into(),
        temp_image.to_string_lossy().to_string(),
        "-i".into(),
        input.to_string_lossy().to_string(),
        "-filter_complex".into(),
        "[0:v]scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:black,format=yuv420p[v]"
            .into(),
        "-map".into(),
        "[v]".into(),
        "-map".into(),
        "1:a".into(),
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "medium".into(),
        "-crf".into(),
        "23".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "192k".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-movflags".into(),
        "+faststart".into(),
        "-shortest".into(),
    ];
    args.push(output_path.to_string_lossy().to_string());

    let mut child = ffmpeg_command()
        .args(&args)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| {
            let _ = fs::remove_file(&temp_image);
            format!("Failed to start ffmpeg: {e}")
        })?;

    let stderr_handle = child.stderr.take();

    if let Some(stdout) = child.stdout.take() {
        let reader = std::io::BufReader::new(stdout);
        for line in reader.lines() {
            if let Ok(line) = line {
                if line.starts_with("out_time_ms=") {
                    if let Some(ms_str) = line.strip_prefix("out_time_ms=") {
                        if let Ok(current_ms) = ms_str.trim().parse::<f64>() {
                            let pct = if duration_ms > 0.0 {
                                ((current_ms / duration_ms) * 100.0).min(99.0) as u32
                            } else {
                                0
                            };
                            let _ = app.emit("conversion-progress", pct);
                        }
                    }
                }
            }
        }
    }

    let status = child.wait().map_err(|e| {
        let _ = fs::remove_file(&temp_image);
        format!("Failed to wait for ffmpeg: {e}")
    })?;

    let _ = fs::remove_file(&temp_image);

    if status.success() {
        let _ = app.emit("conversion-progress", 100u32);
        Ok(output_path.to_string_lossy().to_string())
    } else {
        let err_msg = stderr_handle
            .and_then(|mut s| {
                let mut buf = String::new();
                let _ = std::io::Read::read_to_string(&mut s, &mut buf);
                Some(buf)
            })
            .filter(|s: &String| !s.trim().is_empty())
            .unwrap_or_else(|| "Conversion failed".to_string());
        Err(err_msg.trim().to_string())
    }
}

#[tauri::command]
pub fn convert_image_to_pdf(
    path: String,
    output_dir: String,
    custom_output: Option<String>,
) -> Result<String, String> {
    use image::codecs::jpeg::JpegEncoder;

    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let output_path = resolve_output_path(&input, &output_dir, custom_output.as_deref(), "_converted", "pdf");
    let output_path = unique_path(output_path);

    let img = image::open(&input).map_err(|e| format!("Failed to open image: {e}"))?;
    let rgb = img.to_rgb8();
    let (w, h) = rgb.dimensions();

    let mut jpeg_data = Vec::new();
    let encoder = JpegEncoder::new_with_quality(&mut jpeg_data, 90);
    rgb.write_with_encoder(encoder)
        .map_err(|e| format!("Failed to encode JPEG: {e}"))?;

    let mut pdf: Vec<u8> = Vec::with_capacity(1024 + jpeg_data.len());
    let mut offsets: Vec<usize> = Vec::new();

    pdf.extend_from_slice(b"%PDF-1.4\n");
    offsets.push(pdf.len());
    pdf.extend_from_slice(b"1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    offsets.push(pdf.len());
    pdf.extend_from_slice(b"2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    offsets.push(pdf.len());
    let page = format!(
        "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {w} {h}] \
         /Resources << /XObject << /Img 5 0 R >> >> /Contents 4 0 R >>\nendobj\n"
    );
    pdf.extend_from_slice(page.as_bytes());
    offsets.push(pdf.len());
    let content = format!("q\n{w} 0 0 {h} 0 0 cm\n/Img Do\nQ\n");
    let content_stream = format!(
        "4 0 obj\n<< /Length {} >>\nstream\n{}\nendstream\nendobj\n",
        content.len(),
        content
    );
    pdf.extend_from_slice(content_stream.as_bytes());
    offsets.push(pdf.len());
    let img_header = format!(
        "5 0 obj\n<< /Type /XObject /Subtype /Image /Width {w} /Height {h} \
         /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length {len} >>\nstream\n",
        w = w,
        h = h,
        len = jpeg_data.len()
    );
    pdf.extend_from_slice(img_header.as_bytes());
    pdf.extend_from_slice(&jpeg_data);
    pdf.extend_from_slice(b"\nendstream\nendobj\n");

    let xref_start = pdf.len();
    pdf.extend_from_slice(b"xref\n");
    let total = offsets.len() + 1;
    pdf.extend_from_slice(format!("0 {total}\n").as_bytes());
    pdf.extend_from_slice(b"0000000000 65535 f \r\n");
    for offset in &offsets {
        let entry = format!("{:010} 00000 n \r\n", offset);
        pdf.extend_from_slice(entry.as_bytes());
    }

    pdf.extend_from_slice(
        format!("trailer\n<< /Size {total} /Root 1 0 R >>\nstartxref\n{xref_start}\n%%EOF\n")
            .as_bytes(),
    );

    fs::write(&output_path, &pdf).map_err(|e| format!("Failed to write PDF: {e}"))?;
    Ok(output_path.to_string_lossy().to_string())
}

/// Opens a media file in the default browser, converting unsupported formats first.
#[tauri::command]
pub fn open_in_browser(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }

    let converted = convert_for_browser(&path);
    let open_path = match converted {
        Ok(Some(ref c)) => c.as_str(),
        _ => &path,
    };
    #[cfg(target_os = "windows")]
    {
        let web_path = open_path
            .replace('\\', "/")
            .replace('#', "%23")
            .replace('?', "%3F");
        let url = format!("file:///{}", web_path);
        let wide_url = windows::core::HSTRING::from(&url);
        unsafe {
            let hinst = windows::Win32::UI::Shell::ShellExecuteW(
                None,
                windows::core::w!("open"),
                &wide_url,
                None,
                None,
                windows::Win32::UI::WindowsAndMessaging::SW_SHOWDEFAULT,
            );
            if hinst.is_invalid() {
                return Err("Failed to open in browser".into());
            }
        }
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&format!("file://{open_path}"))
            .spawn()
            .map_err(|e| format!("Failed to open in browser: {e}"))?;
        return Ok(());
    }
    #[cfg(not(any(target_os = "windows", target_os = "linux")))]
    {
        return Err("Opening in browser is not supported on this platform.".into());
    }
}
