// Resource stubs for Tauri build validation
use std::path::Path;

fn main() {
    tauri_build::build();

    let out_dir = std::env::var("CARGO_MANIFEST_DIR").unwrap_or_default();
    let res_dir = Path::new(&out_dir).join("resources");

    for name in &["ffmpeg.exe", "ffprobe.exe"] {
        let path = res_dir.join(name);
        if !path.exists() {
            std::fs::write(&path, "stub").ok();
        }
    }
}
