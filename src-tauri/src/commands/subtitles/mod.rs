pub mod ass;
pub mod bitmap;
pub mod vtt;

use crate::types::{SubtitleCue, SubtitleDocument};

pub fn is_bitmap_codec(codec: &str) -> bool {
    matches!(codec, "hdmv_pgs_subtitle" | "dvd_subtitle" | "vobsub")
}

pub fn is_text_codec(codec: &str) -> bool {
    !matches!(
        codec,
        "dvd_subtitle" | "hdmv_pgs_subtitle" | "dvb_subtitle" | "dvb_teletext" | "xsub" | "vobsub"
    )
}

pub fn is_supported_codec(codec: &str) -> bool {
    is_bitmap_codec(codec) || is_text_codec(codec)
}

pub fn text_document(cues: Vec<SubtitleCue>, play_res_x: u32, play_res_y: u32) -> SubtitleDocument {
    SubtitleDocument {
        kind: "text".into(),
        cues,
        images: Vec::new(),
        canvas_width: play_res_x,
        canvas_height: play_res_y,
        play_res_x,
        play_res_y,
    }
}

pub fn bitmap_document(
    cues: Vec<SubtitleCue>,
    images: Vec<String>,
    canvas_width: u32,
    canvas_height: u32,
) -> SubtitleDocument {
    SubtitleDocument {
        kind: "bitmap".into(),
        cues,
        images,
        canvas_width,
        canvas_height,
        play_res_x: canvas_width,
        play_res_y: canvas_height,
    }
}
