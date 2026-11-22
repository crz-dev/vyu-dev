use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
#[cfg(any(target_os = "linux", target_os = "windows"))]
use std::process::Command;

use crate::constants::{BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST, BROWSER_UNSUPPORTED_VIDEO_EXTS_RUST};
use crate::util::{
    ffmpeg_binary_path, ffmpeg_command, ffmpeg_version, ffprobe_binary_path, ffprobe_command,
    ffprobe_version, hardware_h264_encoders, hash_path_xxh3, resolve_hardware_h264_encoder,
    resolve_output_path, unique_path,
};

// Write PSD file — binary header follows the PSD spec (magic "8BPS", version 1, RGB color mode, 8-bit channel)
fn write_psd_flat(path: &Path, width: u32, height: u32, rgb: &[u8]) -> Result<(), String> {
    let mut f = fs::File::create(path).map_err(|e| format!("Failed to create PSD: {e}"))?;

    f.write_all(b"8BPS").map_err(|e| e.to_string())?;
    f.write_all(&1u16.to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&[0u8; 6]).map_err(|e| e.to_string())?;
    f.write_all(&3u16.to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&(height as u32).to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&(width as u32).to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&8u16.to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&3u16.to_be_bytes())
        .map_err(|e| e.to_string())?;

    f.write_all(&0u32.to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&0u32.to_be_bytes())
        .map_err(|e| e.to_string())?;
    f.write_all(&0u32.to_be_bytes())
        .map_err(|e| e.to_string())?;

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

// Convert for browser
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

    let temp_dir = std::env::temp_dir()
        .join("Vyu-temp")
        .join(format!("browser-{}", hash_path_xxh3(path)));
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

fn preset_values(preset: &str) -> (&'static str, &'static str) {
    match preset {
        "Fast" | "fast" => ("fast", "28"),
        "Quality" | "quality" => ("slow", "18"),
        "Lossless" | "lossless" => ("veryslow", "0"),
        _ => ("medium", "23"),
    }
}

fn jpeg_quality_value(preset: &str) -> &'static str {
    match preset {
        "Fast" | "fast" => "5",
        "Quality" | "quality" => "2",
        "Lossless" | "lossless" => "1",
        _ => "3",
    }
}

fn append_video_quality(args: &mut Vec<String>, encoder: &str, preset: &str) {
    let (x264_preset, crf) = preset_values(preset);
    match encoder {
        "h264_nvenc" => {
            args.extend([
                "-preset".into(),
                "p5".into(),
                "-rc".into(),
                "vbr".into(),
                "-cq".into(),
                crf.into(),
            ]);
        }
        "h264_qsv" => {
            args.extend(["-global_quality".into(), crf.into()]);
        }
        "h264_amf" => {
            args.extend(["-qp_i".into(), crf.into(), "-qp_p".into(), crf.into()]);
        }
        _ => {
            args.extend([
                "-preset".into(),
                x264_preset.into(),
                "-crf".into(),
                crf.into(),
            ]);
        }
    }
}

fn append_webp_quality(args: &mut Vec<String>, preset: &str) {
    match preset {
        "Fast" | "fast" => args.extend(["-quality".into(), "50".into()]),
        "Balanced" | "balanced" => args.extend(["-quality".into(), "75".into()]),
        "Quality" | "quality" => args.extend(["-quality".into(), "90".into()]),
        "Lossless" | "lossless" => args.extend(["-lossless".into(), "1".into()]),
        _ => {}
    }
}

fn build_convert_args(
    input: &Path,
    output: &Path,
    ext: &str,
    preset: &str,
    audio_bitrate: u32,
    preserve_metadata: bool,
    encoder: &str,
) -> Vec<String> {
    let mut args: Vec<String> = vec![
        "-y".into(),
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-i".into(),
        input.to_string_lossy().to_string(),
    ];
    let bitrate = format!("{audio_bitrate}k");
    let (_, crf) = preset_values(preset);

    match ext {
        "mp4" => {
            args.extend(["-c:v".into(), encoder.into()]);
            append_video_quality(&mut args, encoder, preset);
            args.extend([
                "-c:a".into(),
                "aac".into(),
                "-b:a".into(),
                bitrate.clone(),
                "-movflags".into(),
                "+faststart".into(),
            ]);
        }
        "mkv" => {
            args.extend(["-c:v".into(), encoder.into()]);
            append_video_quality(&mut args, encoder, preset);
            args.extend(["-c:a".into(), "aac".into(), "-b:a".into(), bitrate.clone()]);
        }
        "webm" => {
            args.extend([
                "-c:v".into(),
                "libvpx-vp9".into(),
                "-crf".into(),
                crf.into(),
                "-b:v".into(),
                "0".into(),
                "-c:a".into(),
                "libopus".into(),
                "-b:a".into(),
                bitrate.clone(),
            ]);
        }
        "gif" => {
            args.extend([
                "-vf".into(),
                "fps=30,scale=480:-1:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer".into(),
                "-loop".into(),
                "0".into(),
            ]);
        }
        "png" => {
            args.extend(["-c:v".into(), "png".into()]);
        }
        "jpg" | "jpeg" => {
            args.extend(["-q:v".into(), jpeg_quality_value(preset).into()]);
        }
        "webp" => {
            args.extend(["-c:v".into(), "libwebp".into()]);
            append_webp_quality(&mut args, preset);
        }
        "mp3" => {
            args.extend([
                "-c:a".into(),
                "libmp3lame".into(),
                "-b:a".into(),
                bitrate.clone(),
            ]);
        }
        "wav" => {
            args.extend(["-c:a".into(), "pcm_s16le".into()]);
        }
        "flac" => {
            args.extend([
                "-c:a".into(),
                "flac".into(),
                "-compression_level".into(),
                "5".into(),
            ]);
        }
        "ogg" => {
            args.extend([
                "-c:a".into(),
                "libvorbis".into(),
                "-b:a".into(),
                bitrate.clone(),
            ]);
        }
        "aac" => {
            args.extend(["-c:a".into(), "aac".into(), "-b:a".into(), bitrate.clone()]);
        }
        "opus" => {
            args.extend([
                "-c:a".into(),
                "libopus".into(),
                "-b:a".into(),
                bitrate.clone(),
            ]);
        }
        _ => {}
    }

    if preserve_metadata {
        args.extend([
            "-map_metadata".into(),
            "0".into(),
            "-map_chapters".into(),
            "0".into(),
        ]);
    }

    args.push(output.to_string_lossy().to_string());
    args
}

#[tauri::command]
pub async fn convert_media(
    path: String,
    output_dir: String,
    format: String,
    preset: String,
    custom_output: Option<String>,
    audio_bitrate: u32,
    preserve_metadata: bool,
    overwrite: bool,
    gpu_encoding: bool,
    hardware_encoder: Option<String>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let input = PathBuf::from(&path);
        if !input.exists() {
            return Err("Source file does not exist".into());
        }

        let ext = format.to_lowercase();
        let mut output_path = resolve_output_path(
            &input,
            &output_dir,
            custom_output.as_deref(),
            "_converted",
            &ext,
        );
        if custom_output.is_none() && !overwrite {
            output_path = unique_path(output_path);
        } else {
            if output_path == input {
                return Err("Output path matches the source file".into());
            }
            if output_path.exists() {
                if let (Ok(source), Ok(target)) = (
                    std::fs::canonicalize(&input),
                    std::fs::canonicalize(&output_path),
                ) {
                    if source == target {
                        return Err("Output path matches the source file".into());
                    }
                }
            }
        }

        // PSD encoding: FFmpeg has no PSD encoder, so write it directly using the image crate.
        if ext == "psd" {
            let img = image::open(&input).map_err(|e| format!("Failed to decode image: {e}"))?;
            let rgb = img.to_rgb8();
            write_psd_flat(&output_path, rgb.width(), rgb.height(), &rgb)?;
            return Ok(output_path.to_string_lossy().to_string());
        }

        let hardware_encoder = if gpu_encoding && (ext == "mp4" || ext == "mkv") {
            resolve_hardware_h264_encoder(hardware_encoder.as_deref())
        } else {
            None
        };
        let encoder = hardware_encoder.unwrap_or("libx264");
        let args = build_convert_args(
            &input,
            &output_path,
            &ext,
            &preset,
            audio_bitrate,
            preserve_metadata,
            encoder,
        );

        let output = ffmpeg_command()
            .args(&args)
            .output()
            .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;

        if output.status.success() {
            return Ok(output_path.to_string_lossy().to_string());
        }

        if hardware_encoder.is_some() {
            let fallback_args = build_convert_args(
                &input,
                &output_path,
                &ext,
                &preset,
                audio_bitrate,
                preserve_metadata,
                "libx264",
            );
            let fallback = ffmpeg_command()
                .args(&fallback_args)
                .output()
                .map_err(|e| format!("Failed to start ffmpeg fallback: {e}"))?;
            if fallback.status.success() {
                return Ok(output_path.to_string_lossy().to_string());
            }
            return Err(String::from_utf8_lossy(&fallback.stderr).trim().to_string());
        }

        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

#[tauri::command]
pub async fn convert_audio_to_waveform_video(
    app: tauri::AppHandle,
    path: String,
    output_dir: String,
    custom_output: Option<String>,
    audio_bitrate: u32,
    overwrite: bool,
    cover_art_mode: String,
    preset: String,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        convert_audio_to_waveform_video_sync(
            app,
            path,
            output_dir,
            custom_output,
            audio_bitrate,
            overwrite,
            cover_art_mode,
            preset,
        )
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

fn convert_audio_to_waveform_video_sync(
    app: tauri::AppHandle,
    path: String,
    output_dir: String,
    custom_output: Option<String>,
    audio_bitrate: u32,
    overwrite: bool,
    cover_art_mode: String,
    preset: String,
) -> Result<String, String> {
    use std::io::BufRead;
    use tauri::Emitter;

    let input = PathBuf::from(&path);
    if !input.exists() {
        return Err("Source file does not exist".into());
    }

    let mut output_path = resolve_output_path(
        &input,
        &output_dir,
        custom_output.as_deref(),
        "_waveform",
        "mp4",
    );
    if custom_output.is_none() && !overwrite {
        output_path = unique_path(output_path);
    }

    // Step 1: Generate background image to temp file
    let temp_dir = std::env::temp_dir().join("Vyu-temp");
    let _ = fs::create_dir_all(&temp_dir);
    let temp_image = temp_dir.join(format!("vyu_wave_{}.jpg", hash_path_xxh3(&path)));

    // Try embedded artwork first unless the user explicitly requested a waveform.
    let has_artwork = cover_art_mode != "waveform"
        && ffmpeg_command()
            .args([
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                &input.to_string_lossy(),
                "-an",
                "-frames:v",
                "1",
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
                "-y",
                "-hide_banner",
                "-loglevel",
                "error",
                "-i",
                &input.to_string_lossy(),
                "-filter_complex",
                "[0:a]showwavespic=s=1920x1080:colors=white",
                "-frames:v",
                "1",
                &temp_image.to_string_lossy(),
            ])
            .output()
            .map_err(|e| format!("Failed to generate waveform: {e}"))?;
        if !wf_output.status.success() {
            let _ = fs::remove_file(&temp_image);
            return Err(String::from_utf8_lossy(&wf_output.stderr)
                .trim()
                .to_string());
        }
    }

    // Step 2: Probe audio duration
    let duration_ms: f64 = ffprobe_command()
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "csv=p=0",
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
    let (encoder_preset, encoder_crf) = preset_values(&preset);
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
        encoder_preset.into(),
        "-crf".into(),
        encoder_crf.into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        format!("{audio_bitrate}k"),
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
pub async fn convert_image_to_pdf(
    path: String,
    output_dir: String,
    custom_output: Option<String>,
    overwrite: bool,
) -> Result<String, String> {
    use image::codecs::jpeg::JpegEncoder;

    tauri::async_runtime::spawn_blocking(move || {
        let input = PathBuf::from(&path);
        if !input.exists() {
            return Err("Source file does not exist".into());
        }

        let mut output_path = resolve_output_path(&input, &output_dir, custom_output.as_deref(), "_converted", "pdf");
        if custom_output.is_none() && !overwrite {
            output_path = unique_path(output_path);
        }

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
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegInfo {
    ffmpeg_path: String,
    ffmpeg_version: String,
    ffprobe_path: String,
    ffprobe_version: String,
    hardware_encoders: Vec<String>,
}

#[tauri::command]
pub fn get_ffmpeg_info() -> FfmpegInfo {
    FfmpegInfo {
        ffmpeg_path: ffmpeg_binary_path().to_string(),
        ffmpeg_version: ffmpeg_version(),
        ffprobe_path: ffprobe_binary_path().to_string(),
        ffprobe_version: ffprobe_version(),
        hardware_encoders: hardware_h264_encoders()
            .iter()
            .map(|encoder| encoder.to_string())
            .collect(),
    }
}

#[cfg(target_os = "windows")]
fn read_registry_string(
    hkey: windows::Win32::System::Registry::HKEY,
    subkey: &str,
    value: Option<&str>,
) -> Option<String> {
    use windows::core::{HSTRING, PCWSTR};
    use windows::Win32::System::Registry::{RegGetValueW, RRF_RT_REG_SZ};

    let subkey_wide = HSTRING::from(subkey);
    let value_wide = value.map(HSTRING::from);
    let value_ptr = value_wide
        .as_ref()
        .map(|v| PCWSTR::from_raw(v.as_ptr()))
        .unwrap_or(PCWSTR::null());
    let mut size = 0u32;
    let status = unsafe {
        RegGetValueW(
            hkey,
            &subkey_wide,
            value_ptr,
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
            hkey,
            &subkey_wide,
            value_ptr,
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
fn default_browser_executable() -> Option<String> {
    use windows::Win32::System::Registry::{HKEY_CLASSES_ROOT, HKEY_CURRENT_USER};

    // Prefer https: Windows can leave http pinned to Edge even when the user
    // chose another default browser.
    let prog_id = read_registry_string(
        HKEY_CURRENT_USER,
        r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\https\UserChoice",
        Some("ProgId"),
    )
    .or_else(|| {
        read_registry_string(
            HKEY_CURRENT_USER,
            r"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice",
            Some("ProgId"),
        )
    })?;
    let command = read_registry_string(
        HKEY_CLASSES_ROOT,
        &format!(r"{prog_id}\shell\open\command"),
        None,
    )?;
    let command = command.trim();
    let executable = if let Some(rest) = command.strip_prefix('"') {
        rest.split('"').next()?
    } else {
        command.split_whitespace().next()?
    };
    if Path::new(executable).is_file() {
        Some(executable.to_string())
    } else {
        None
    }
}

fn extract_video_frame_sync(path: &str, time_secs: f64) -> Result<String, String> {
    let temp_dir = std::env::temp_dir().join("Vyu-temp").join("frames");
    fs::create_dir_all(&temp_dir).map_err(|e| format!("Failed to create frame dir: {e}"))?;
    let output_path = unique_path(temp_dir.join(format!("frame-{}.png", hash_path_xxh3(path))));
    let output = output_path.to_string_lossy().to_string();
    let timestamp = time_secs.max(0.0).to_string();
    let result = ffmpeg_command()
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            timestamp.as_str(),
            "-i",
            path,
            "-frames:v",
            "1",
            &output,
        ])
        .output()
        .map_err(|e| format!("Failed to start ffmpeg: {e}"))?;
    if !result.status.success() {
        return Err(String::from_utf8_lossy(&result.stderr).trim().to_string());
    }
    Ok(output)
}

#[tauri::command]
pub async fn extract_video_frame(path: String, time_secs: f64) -> Result<String, String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    tauri::async_runtime::spawn_blocking(move || extract_video_frame_sync(&path, time_secs))
        .await
        .map_err(|e| format!("Thread join error: {e}"))?
}

/// Open in browser
#[tauri::command]
pub async fn open_in_browser(path: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if !p.exists() {
        return Err("File does not exist".into());
    }

    #[cfg(target_os = "windows")]
    let browser =
        default_browser_executable().ok_or_else(|| "NO_DEFAULT_BROWSER".to_string())?;

    let path_clone = path.clone();
    let converted = tauri::async_runtime::spawn_blocking(move || convert_for_browser(&path_clone))
        .await
        .map_err(|e| format!("Thread join error: {e}"))?;
    let open_path = match converted {
        Ok(Some(ref c)) => c.as_str(),
        _ => &path,
    };
    #[cfg(target_os = "windows")]
    {
        let web_path = open_path
            .replace('%', "%25")
            .replace('\\', "/")
            .replace(' ', "%20")
            .replace('#', "%23")
            .replace('?', "%3F");
        let url = format!("file:///{}", web_path);
        Command::new(browser)
            .arg(url)
            .spawn()
            .map_err(|e| format!("Failed to open in browser: {e}"))?;
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
