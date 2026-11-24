use std::collections::HashSet;
use std::fs;
use std::path::Path;

use image::codecs::png::{CompressionType, FilterType, PngEncoder};
use image::ImageEncoder;
use libbitsub_core::pgs::PgsParser;
use libbitsub_core::vobsub::VobSubParser;
use serde::{Deserialize, Serialize};

use crate::types::{SubtitleCue, SubtitleCueImage};

pub const CACHE_VERSION: u32 = 1;

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BitmapManifest {
    pub version: u32,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub cues: Vec<SubtitleCue>,
    pub images: Vec<String>,
}

pub struct BitmapSource {
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub cues: Vec<SubtitleCue>,
    pub images: Vec<String>,
}

pub fn load_manifest(path: &Path) -> Option<BitmapSource> {
    let bytes = fs::read(path).ok()?;
    let manifest: BitmapManifest = serde_json::from_slice(&bytes).ok()?;
    if manifest.version != CACHE_VERSION {
        return None;
    }
    let cache_dir = path.parent()?;
    if manifest.images.is_empty()
        || manifest.images.iter().any(|image| {
            Path::new(image).parent() != Some(cache_dir) || !Path::new(image).is_file()
        })
    {
        return None;
    }
    let allowed: HashSet<&str> = manifest.images.iter().map(String::as_str).collect();
    for cue in &manifest.cues {
        for image in &cue.images {
            if Path::new(&image.path).parent() != Some(cache_dir)
                || !Path::new(&image.path).is_file()
                || !allowed.contains(image.path.as_str())
            {
                return None;
            }
        }
    }
    Some(BitmapSource {
        canvas_width: manifest.canvas_width.max(1),
        canvas_height: manifest.canvas_height.max(1),
        cues: manifest.cues,
        images: manifest.images,
    })
}

pub fn save_manifest(path: &Path, source: &BitmapSource) -> Result<u64, String> {
    let manifest = BitmapManifest {
        version: CACHE_VERSION,
        canvas_width: source.canvas_width,
        canvas_height: source.canvas_height,
        cues: source.cues.clone(),
        images: source.images.clone(),
    };
    let bytes = serde_json::to_vec(&manifest)
        .map_err(|error| format!("Failed to encode subtitle cache manifest: {error}"))?;
    fs::write(path, &bytes)
        .map_err(|error| format!("Failed to write subtitle cache manifest: {error}"))?;
    Ok(bytes.len() as u64)
}

pub fn decode_pgs(data: &[u8], out_dir: &Path, key: &str) -> Result<BitmapSource, String> {
    let mut parser = PgsParser::new();
    parser.parse(data);
    let count = parser.count();
    if count == 0 {
        return Err("The image subtitle track is empty".into());
    }
    let canvas_width = {
        let value = parser.screen_width() as u32;
        if value > 0 {
            value
        } else {
            1920
        }
    };
    let canvas_height = {
        let value = parser.screen_height() as u32;
        if value > 0 {
            value
        } else {
            1080
        }
    };
    let mut pending = Vec::new();
    let mut cues = Vec::new();
    let mut images = Vec::new();
    let mut base = 0usize;

    for index in 0..count {
        let start = sanitize_time(parser.get_cue_start_time(index) / 1000.0);
        let end = normalize_end(
            start,
            sanitize_time(parser.get_cue_end_time(index) / 1000.0),
        );
        let Some(frame) = parser.render_at_index(index) else {
            continue;
        };
        let mut frame_images = Vec::new();
        for composition in frame.compositions {
            if composition.width == 0 || composition.height == 0 {
                continue;
            }
            if !has_visible_pixels(&composition.rgba) {
                continue;
            }
            frame_images.push(PendingImage {
                x: composition.x as u32,
                y: composition.y as u32,
                width: composition.width as u32,
                height: composition.height as u32,
                rgba: composition.rgba,
            });
        }
        if !frame_images.is_empty() {
            pending.push(PendingCue {
                start,
                end,
                images: frame_images,
            });
            if pending.len() >= PENDING_BATCH {
                flush_pending_cues(
                    out_dir,
                    key,
                    &mut pending,
                    &mut cues,
                    &mut images,
                    &mut base,
                )?;
            }
        }
    }

    flush_pending_cues(
        out_dir,
        key,
        &mut pending,
        &mut cues,
        &mut images,
        &mut base,
    )?;
    if cues.is_empty() {
        return Err("The image subtitle track has no visible frames".into());
    }
    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    Ok(BitmapSource {
        canvas_width,
        canvas_height,
        cues,
        images,
    })
}

pub fn decode_vobsub_idx(
    idx: &str,
    sub: Vec<u8>,
    out_dir: &Path,
    key: &str,
) -> Result<BitmapSource, String> {
    let mut parser = VobSubParser::new();
    parser.load_from_data(idx, sub);
    finish_vobsub(parser, out_dir, key)
}

pub fn decode_vobsub_mks(mks: &[u8], out_dir: &Path, key: &str) -> Result<BitmapSource, String> {
    let mut parser = VobSubParser::new();
    parser.load_from_mks(mks)?;
    finish_vobsub(parser, out_dir, key)
}

fn finish_vobsub(
    mut parser: VobSubParser,
    out_dir: &Path,
    key: &str,
) -> Result<BitmapSource, String> {
    let count = parser.count();
    if count == 0 {
        return Err("The image subtitle track is empty".into());
    }
    let canvas_width = {
        let value = parser.screen_width() as u32;
        if value > 0 {
            value
        } else {
            720
        }
    };
    let canvas_height = {
        let value = parser.screen_height() as u32;
        if value > 0 {
            value
        } else {
            480
        }
    };
    let mut pending = Vec::new();
    let mut cues = Vec::new();
    let mut images = Vec::new();
    let mut base = 0usize;

    for index in 0..count {
        let start = sanitize_time(parser.get_cue_start_time(index) / 1000.0);
        let end = normalize_end(
            start,
            sanitize_time(parser.get_cue_end_time(index) / 1000.0),
        );
        let Some(frame) = parser.render_at_index(index) else {
            continue;
        };
        if !has_visible_pixels(&frame.rgba) {
            continue;
        }
        pending.push(PendingCue {
            start,
            end,
            images: vec![PendingImage {
                x: frame.x as u32,
                y: frame.y as u32,
                width: frame.width as u32,
                height: frame.height as u32,
                rgba: frame.rgba,
            }],
        });
        if pending.len() >= PENDING_BATCH {
            flush_pending_cues(
                out_dir,
                key,
                &mut pending,
                &mut cues,
                &mut images,
                &mut base,
            )?;
        }
    }

    flush_pending_cues(
        out_dir,
        key,
        &mut pending,
        &mut cues,
        &mut images,
        &mut base,
    )?;
    if cues.is_empty() {
        return Err("The image subtitle track has no visible frames".into());
    }
    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    Ok(BitmapSource {
        canvas_width,
        canvas_height,
        cues,
        images,
    })
}

struct PendingImage {
    x: u32,
    y: u32,
    width: u32,
    height: u32,
    rgba: Vec<u8>,
}

struct PendingCue {
    start: f64,
    end: f64,
    images: Vec<PendingImage>,
}

const PENDING_BATCH: usize = 12;

fn flush_pending_cues(
    out_dir: &Path,
    key: &str,
    pending: &mut Vec<PendingCue>,
    cues: &mut Vec<SubtitleCue>,
    images: &mut Vec<String>,
    base: &mut usize,
) -> Result<(), String> {
    if pending.is_empty() {
        return Ok(());
    }
    let batch = std::mem::take(pending);
    let take = batch.len();
    let encoded = write_batch(out_dir, key, *base, batch)?;
    for (cue, cue_images) in encoded {
        images.extend(cue_images.into_iter().map(|image| image.path));
        cues.push(cue);
    }
    *base += take;
    Ok(())
}

fn write_batch(
    out_dir: &Path,
    key: &str,
    base: usize,
    batch: Vec<PendingCue>,
) -> Result<Vec<(SubtitleCue, Vec<SubtitleCueImage>)>, String> {
    std::thread::scope(|scope| {
        let mut handles = Vec::with_capacity(batch.len());
        for (offset, cue) in batch.into_iter().enumerate() {
            let index = base + offset;
            handles.push(scope.spawn(move || encode_cue(out_dir, key, index, cue)));
        }
        let mut output = Vec::with_capacity(handles.len());
        for handle in handles {
            match handle.join() {
                Ok(result) => output.push(result?),
                Err(_) => {
                    return Err("Subtitle image encoding task panicked".to_string());
                }
            }
        }
        Ok(output)
    })
}

fn encode_cue(
    out_dir: &Path,
    key: &str,
    index: usize,
    cue: PendingCue,
) -> Result<(SubtitleCue, Vec<SubtitleCueImage>), String> {
    let mut cue_images = Vec::new();
    for (image_index, pending) in cue.images.into_iter().enumerate() {
        if let Some(image) = write_image(
            out_dir,
            key,
            index,
            image_index,
            pending.width,
            pending.height,
            &pending.rgba,
        )? {
            cue_images.push(with_position(image, pending.x, pending.y));
        }
    }
    let images = cue_images.clone();
    Ok((
        SubtitleCue {
            start: cue.start,
            end: cue.end,
            lines: Vec::new(),
            images: cue_images,
            anchor: None,
            background: None,
            font_size: None,
        },
        images,
    ))
}

fn sanitize_time(value: f64) -> f64 {
    if value.is_finite() && value >= 0.0 {
        value
    } else {
        0.0
    }
}

fn normalize_end(start: f64, end: f64) -> f64 {
    if !end.is_finite() || end <= start {
        start + 5.0
    } else {
        end
    }
}

fn has_visible_pixels(rgba: &[u8]) -> bool {
    rgba.chunks_exact(4).any(|pixel| pixel[3] != 0)
}

fn write_image(
    out_dir: &Path,
    key: &str,
    cue_index: usize,
    image_index: usize,
    width: u32,
    height: u32,
    rgba: &[u8],
) -> Result<Option<SubtitleCueImage>, String> {
    if width == 0 || height == 0 {
        return Ok(None);
    }
    let expected = width as usize * height as usize * 4;
    if rgba.len() < expected {
        return Ok(None);
    }
    let path = out_dir.join(format!("{key}_{cue_index}_{image_index}.png"));
    let file = fs::File::create(&path)
        .map_err(|error| format!("Failed to create subtitle image: {error}"))?;
    PngEncoder::new_with_quality(file, CompressionType::Fast, FilterType::Sub)
        .write_image(
            &rgba[..expected],
            width,
            height,
            image::ExtendedColorType::Rgba8,
        )
        .map_err(|error| format!("Failed to write subtitle image: {error}"))?;
    Ok(Some(SubtitleCueImage {
        path: path.to_string_lossy().to_string(),
        x: 0,
        y: 0,
        width,
        height,
    }))
}

/// Positions are filled by the caller for PGS/VobSub because the parser returns
/// composition bounds separately from the encoded image.
pub fn with_position(mut image: SubtitleCueImage, x: u32, y: u32) -> SubtitleCueImage {
    image.x = x;
    image.y = y;
    image
}

#[cfg(test)]
mod tests {
    use super::{has_visible_pixels, normalize_end};

    #[test]
    fn detects_visible_pixels() {
        assert!(!has_visible_pixels(&[0, 0, 0, 0, 0, 0, 0, 0]));
        assert!(has_visible_pixels(&[0, 0, 0, 0, 255, 255, 255, 255]));
    }

    #[test]
    fn normalizes_invalid_end_times() {
        assert!((normalize_end(2.0, 1.0) - 7.0).abs() < 0.001);
        assert!((normalize_end(2.0, 4.0) - 4.0).abs() < 0.001);
    }

    #[derive(Clone, Copy)]
    struct TestPaletteEntry {
        id: u8,
        y: u8,
        cr: u8,
        cb: u8,
        a: u8,
    }

    fn push_be_u16(out: &mut Vec<u8>, value: u16) {
        out.extend_from_slice(&value.to_be_bytes());
    }

    fn push_be_u24(out: &mut Vec<u8>, value: u32) {
        out.push(((value >> 16) & 0xff) as u8);
        out.push(((value >> 8) & 0xff) as u8);
        out.push((value & 0xff) as u8);
    }

    fn write_segment(out: &mut Vec<u8>, pts: u32, kind: u8, payload: &[u8]) {
        push_be_u16(out, 0x5047);
        out.extend_from_slice(&pts.to_be_bytes());
        out.extend_from_slice(&0u32.to_be_bytes());
        out.push(kind);
        push_be_u16(out, payload.len() as u16);
        out.extend_from_slice(payload);
    }

    fn build_pcs(width: u16, height: u16, object_id: u16, x: u16, y: u16) -> Vec<u8> {
        let mut pcs = Vec::new();
        push_be_u16(&mut pcs, width);
        push_be_u16(&mut pcs, height);
        pcs.push(0x10);
        push_be_u16(&mut pcs, 0);
        pcs.push(0x80);
        pcs.push(0x00);
        pcs.push(0x00);
        pcs.push(0x01);
        push_be_u16(&mut pcs, object_id);
        pcs.push(0x00);
        pcs.push(0x00);
        push_be_u16(&mut pcs, x);
        push_be_u16(&mut pcs, y);
        pcs
    }

    fn build_wds(x: u16, y: u16, width: u16, height: u16) -> Vec<u8> {
        let mut wds = vec![0x01, 0x00];
        push_be_u16(&mut wds, x);
        push_be_u16(&mut wds, y);
        push_be_u16(&mut wds, width);
        push_be_u16(&mut wds, height);
        wds
    }

    fn build_pds(entries: &[TestPaletteEntry]) -> Vec<u8> {
        let mut pds = vec![0x00, 0x00];
        for entry in entries {
            pds.extend_from_slice(&[entry.id, entry.y, entry.cr, entry.cb, entry.a]);
        }
        pds
    }

    fn build_ods(width: u16, height: u16, rle: &[u8]) -> Vec<u8> {
        let mut ods = Vec::new();
        push_be_u16(&mut ods, 1);
        ods.push(0x00);
        ods.push(0xC0);
        push_be_u24(&mut ods, 4 + rle.len() as u32);
        push_be_u16(&mut ods, width);
        push_be_u16(&mut ods, height);
        ods.extend_from_slice(rle);
        ods
    }

    #[test]
    fn decodes_a_minimal_pgs_fixture() {
        let width = 16u16;
        let height = 8u16;
        let mut rle = Vec::new();
        for _ in 0..height {
            rle.extend_from_slice(&[0x00, 0x80 | width as u8, 1]);
            rle.extend_from_slice(&[0x00, 0x00]);
        }
        let palette = [
            TestPaletteEntry {
                id: 0,
                y: 16,
                cr: 128,
                cb: 128,
                a: 0,
            },
            TestPaletteEntry {
                id: 1,
                y: 235,
                cr: 128,
                cb: 128,
                a: 255,
            },
        ];
        let mut data = Vec::new();
        let pts = 90_000u32;
        write_segment(&mut data, pts, 0x16, &build_pcs(720, 480, 1, 40, 400));
        write_segment(&mut data, pts, 0x17, &build_wds(40, 400, width, height));
        write_segment(&mut data, pts, 0x14, &build_pds(&palette));
        write_segment(&mut data, pts, 0x15, &build_ods(width, height, &rle));
        write_segment(&mut data, pts, 0x80, &[]);

        let out = std::env::temp_dir().join(format!("vyu-pgs-test-{}", std::process::id()));
        let _ = std::fs::create_dir_all(&out);
        let source = super::decode_pgs(&data, &out, "pgs-test").expect("decode pgs");
        assert_eq!(source.canvas_width, 720);
        assert_eq!(source.canvas_height, 480);
        assert_eq!(source.cues.len(), 1);
        let image = &source.cues[0].images[0];
        assert_eq!((image.x, image.y), (40, 400));
        assert_eq!((image.width, image.height), (width as u32, height as u32));
        assert!(std::path::Path::new(&image.path).is_file());
        let _ = std::fs::remove_dir_all(out);
    }
}
