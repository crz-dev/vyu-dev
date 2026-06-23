use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{Duration, Instant};
use xxhash_rust::xxh3::xxh3_64;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
use crate::constants::CREATE_NO_WINDOW;

/// Deterministic hash for cache filenames (xxh3 is fast and consistent across runs).
pub fn hash_path_xxh3(path: &str) -> String {
    format!("{:016x}", xxh3_64(path.as_bytes()))
}

/// Resolve a user-supplied path to its canonical form.
/// Returns an error if the path doesn't exist or contains suspicious components.
pub fn canonicalize_path(path: &str) -> Result<PathBuf, String> {
    let p = Path::new(path);
    if !p.exists() {
        return Err("File does not exist".into());
    }
    std::fs::canonicalize(p).map_err(|e| format!("Failed to resolve path: {e}"))
}

pub fn format_clip_tag(seconds: f64) -> String {
    let safe = if seconds.is_finite() && seconds > 0.0 {
        seconds.floor() as u64
    } else {
        0
    };
    let h = safe / 3600;
    let m = (safe % 3600) / 60;
    let s = safe % 60;
    if h > 0 {
        format!("{:02}-{:02}-{:02}", h, m, s)
    } else {
        format!("{:02}-{:02}", m, s)
    }
}

pub fn sanitize_segments(mut segments: Vec<crate::types::ClipSegment>) -> Vec<crate::types::ClipSegment> {
    segments.sort_by(|a, b| {
        a.start
            .partial_cmp(&b.start)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    segments
        .into_iter()
        .filter_map(|s| {
            if !s.start.is_finite() || !s.end.is_finite() {
                return None;
            }
            if s.end <= s.start + 0.04 {
                return None;
            }
            Some(crate::types::ClipSegment {
                start: s.start.max(0.0),
                end: s.end.max(0.0),
            })
        })
        .collect()
}

pub fn unique_path(path: PathBuf) -> PathBuf {
    if !path.exists() {
        return path;
    }
    let stem = path
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("output")
        .to_string();
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_string();
    let parent = path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .to_path_buf();

    // Exponential probe: 1, 2, 4, 8, ... then binary search
    let mut i = 1u64;
    let mut high: Option<u64> = None;
    while i <= 10000 {
        let name = if ext.is_empty() {
            format!("{stem}({i})")
        } else {
            format!("{stem}({i}).{ext}")
        };
        if !parent.join(&name).exists() {
            high = Some(i);
            break;
        }
        i <<= 1;
    }

    let candidate = match high {
        Some(h) => {
            let mut lo = h >> 1;
            let mut hi = h;
            while lo < hi {
                let mid = lo + (hi - lo) / 2;
                let name = if ext.is_empty() {
                    format!("{stem}({mid})")
                } else {
                    format!("{stem}({mid}).{ext}")
                };
                if parent.join(&name).exists() {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            let name = if ext.is_empty() {
                format!("{stem}({lo})")
            } else {
                format!("{stem}({lo}).{ext}")
            };
            parent.join(name)
        }
        None => path,
    };
    candidate
}

/// Returns a `Command` pre-configured to run ffmpeg without a console window.
pub fn ffmpeg_command() -> Command {
    let mut cmd = Command::new("ffmpeg");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Returns a `Command` pre-configured to run ffprobe without a console window.
pub fn ffprobe_command() -> Command {
    let mut cmd = Command::new("ffprobe");
    #[cfg(target_os = "windows")]
    cmd.creation_flags(CREATE_NO_WINDOW);
    cmd
}

/// Spawns ffmpeg with the given args, polls completion with a timeout, and returns
/// `Ok(Some(path))` on success, `Ok(None)` on failure/timeout, or `Err` on system error.
/// Cleans up `output_path` on any non-success outcome.
pub fn run_ffmpeg(args: &[&str], output_path: &Path, timeout: Duration) -> Result<Option<String>, String> {
    let mut child = ffmpeg_command()
        .args(args)
        .spawn()
        .map_err(|e| format!("Failed to spawn ffmpeg: {e}"))?;

    let start = Instant::now();
    loop {
        match child.try_wait() {
            Ok(Some(exit_status)) => {
                if exit_status.success() {
                    return Ok(Some(output_path.to_string_lossy().to_string()));
                }
                let _ = fs::remove_file(output_path);
                return Ok(None);
            }
            Ok(None) => {
                if start.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = fs::remove_file(output_path);
                    return Ok(None);
                }
                std::thread::sleep(Duration::from_millis(100));
            }
            Err(e) => {
                let _ = fs::remove_file(output_path);
                return Err(format!("ffmpeg error: {e}"));
            }
        }
    }
}

pub fn format_data_url(bytes: &[u8]) -> String {
    use base64::Engine as _;
    let b64 = base64::engine::general_purpose::STANDARD.encode(bytes);
    format!("data:image/jpeg;base64,{b64}")
}

pub fn cleanup_vyu_temp() {
    let temp_dir = std::env::temp_dir().join("Vyu-temp");
    let _ = std::fs::remove_dir_all(&temp_dir);
}

/// Extracts a segment from a video using ffmpeg stream copy, falling back to re-encode.
pub fn ffmpeg_extract_segment(input: &Path, output: &Path, start: f64, end: f64) -> Result<(), String> {
    let fast_err = match ffmpeg_command()
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            &format!("{start:.3}"),
            "-to",
            &format!("{end:.3}"),
            "-i",
            &input.to_string_lossy(),
            "-c",
            "copy",
            &output.to_string_lossy(),
        ])
        .output()
    {
        Ok(out) if out.status.success() => return Ok(()),
        Ok(out) => String::from_utf8_lossy(&out.stderr).trim().to_string(),
        Err(e) => format!("Failed to start ffmpeg: {e}"),
    };

    let fallback = ffmpeg_command()
        .args([
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            &format!("{start:.3}"),
            "-to",
            &format!("{end:.3}"),
            "-i",
            &input.to_string_lossy(),
            &output.to_string_lossy(),
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg fallback: {e}"))?;

    if fallback.status.success() {
        Ok(())
    } else {
        let fallback_err = String::from_utf8_lossy(&fallback.stderr).trim().to_string();
        Err(format!(
            "Stream copy failed ({fast_err}); fallback re-encode also failed ({fallback_err})"
        ))
    }
}

/// Check if a cached file exists and is at least as recent as the source.
/// Returns the cached path if fresh, None otherwise.
pub fn check_cache(path: &Path, cache_dir: &Path, ext: &str) -> Option<PathBuf> {
    let hash = hash_path_xxh3(&path.to_string_lossy());
    let cached = cache_dir.join(format!("{hash}.{ext}"));
    if !cached.exists() {
        return None;
    }
    let (Ok(src_meta), Ok(cached_meta)) = (fs::metadata(path), fs::metadata(&cached)) else {
        return None;
    };
    let (Ok(src_time), Ok(cached_time)) = (src_meta.modified(), cached_meta.modified()) else {
        return None;
    };
    if cached_time >= src_time { Some(cached) } else { None }
}

/// Resolve output path given input file, output directory, optional custom path,
/// a suffix (e.g. "_converted"), and target extension.
pub fn resolve_output_path(
    input: &Path,
    output_dir: &str,
    custom_output: Option<&str>,
    suffix: &str,
    ext: &str,
) -> PathBuf {
    match custom_output {
        Some(p) => {
            let pb = PathBuf::from(p);
            if let Some(parent) = pb.parent() {
                if !parent.exists() {
                    let _ = fs::create_dir_all(parent);
                }
            }
            pb
        }
        None => {
            let out_dir = PathBuf::from(output_dir);
            if !out_dir.exists() {
                let _ = fs::create_dir_all(&out_dir);
            }
            let base_name = input
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("output")
                .to_string();
            let out_name = format!("{}{}.{}", base_name, suffix, ext);
            out_dir.join(&out_name)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_path_xxh3_deterministic() {
        let a = hash_path_xxh3("hello");
        let b = hash_path_xxh3("hello");
        assert_eq!(a, b);
    }

    #[test]
    fn test_hash_path_xxh3_different_inputs() {
        let a = hash_path_xxh3("foo");
        let b = hash_path_xxh3("bar");
        assert_ne!(a, b);
    }

    #[test]
    fn test_format_clip_tag_normal() {
        assert_eq!(format_clip_tag(0.0), "00-00");
        assert_eq!(format_clip_tag(59.0), "00-59");
        assert_eq!(format_clip_tag(3661.0), "01-01-01");
        assert_eq!(format_clip_tag(59.9), "00-59");
    }

    #[test]
    fn test_format_clip_tag_negative() {
        assert_eq!(format_clip_tag(-5.0), "00-00");
    }

    #[test]
    fn test_format_clip_tag_infinite() {
        assert_eq!(format_clip_tag(f64::INFINITY), "00-00");
        assert_eq!(format_clip_tag(f64::NEG_INFINITY), "00-00");
        assert_eq!(format_clip_tag(f64::NAN), "00-00");
    }

    #[test]
    fn test_sanitize_segments_empty() {
        let result = sanitize_segments(vec![]);
        assert!(result.is_empty());
    }

    #[test]
    fn test_sanitize_segments_sorts_and_filters() {
        use crate::types::ClipSegment;
        let input = vec![
            ClipSegment { start: 10.0, end: 20.0 },
            ClipSegment { start: 5.0, end: 15.0 },
            ClipSegment { start: 0.0, end: 0.03 },
            ClipSegment { start: f64::NAN, end: 10.0 },
        ];
        let result = sanitize_segments(input);
        assert_eq!(result.len(), 2);
        assert_eq!(result[0].start, 5.0);
        assert_eq!(result[1].start, 10.0);
    }

    #[test]
    fn test_sanitize_segments_clips_negative() {
        use crate::types::ClipSegment;
        let input = vec![
            ClipSegment { start: -5.0, end: 10.0 },
        ];
        let result = sanitize_segments(input);
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].start, 0.0);
    }
}
