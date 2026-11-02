// PDF annotations — apply markup strokes as native PDF annotation objects
use std::path::PathBuf;

use lopdf::{dictionary, Dictionary, Document, Object, ObjectId};

use crate::types::{ApplyMarkupRequest, MarkupStrokeData};
use crate::util::hash_path_xxh3;

#[derive(Clone, Copy)]
struct PageGeometry {
    x0: f64,
    y0: f64,
    width: f64,
    height: f64,
    rotation: i32,
}

fn object_number(object: &Object) -> Option<f64> {
    match object {
        Object::Integer(value) => Some(*value as f64),
        Object::Real(value) => Some(*value as f64),
        _ => None,
    }
}

fn inherited_page_entry(doc: &Document, page_id: ObjectId, key: &[u8]) -> Option<Object> {
    let mut current = page_id;
    for _ in 0..32 {
        let dict = doc.get_dictionary(current).ok()?;
        if let Ok(value) = dict.get(key) {
            return Some(value.clone());
        }
        match dict.get(b"Parent") {
            Ok(Object::Reference(parent)) => current = *parent,
            _ => return None,
        }
    }
    None
}

fn page_box(doc: &Document, object: &Object) -> Option<[f64; 4]> {
    let object = match object {
        Object::Reference(id) => doc.get_object(*id).ok()?,
        other => other,
    };
    let Object::Array(values) = object else {
        return None;
    };
    if values.len() < 4 {
        return None;
    }
    Some([
        object_number(&values[0])?,
        object_number(&values[1])?,
        object_number(&values[2])?,
        object_number(&values[3])?,
    ])
}

fn page_geometry(
    doc: &Document,
    page_id: ObjectId,
    fallback_width: f64,
    fallback_height: f64,
) -> PageGeometry {
    let rotation = inherited_page_entry(doc, page_id, b"Rotate")
        .and_then(|value| match value {
            Object::Integer(value) => Some(value as i32),
            Object::Real(value) => Some(value.round() as i32),
            _ => None,
        })
        .map(|value| ((value % 360) + 360) % 360)
        .unwrap_or(0);

    let box_values = inherited_page_entry(doc, page_id, b"CropBox")
        .and_then(|value| page_box(doc, &value))
        .or_else(|| {
            inherited_page_entry(doc, page_id, b"MediaBox")
                .and_then(|value| page_box(doc, &value))
        });

    let [x0, y0, x1, y1] = box_values.unwrap_or_else(|| {
        if rotation == 90 || rotation == 270 {
            [0.0, 0.0, fallback_height, fallback_width]
        } else {
            [0.0, 0.0, fallback_width, fallback_height]
        }
    });
    let left = x0.min(x1);
    let bottom = y0.min(y1);
    let width = (x1 - x0).abs().max(1.0);
    let height = (y1 - y0).abs().max(1.0);

    PageGeometry {
        x0: left,
        y0: bottom,
        width,
        height,
        rotation,
    }
}

/// Convert normalized display coordinates (top-left origin) to PDF user space.
fn norm_to_pdf(geo: PageGeometry, nx: f64, ny: f64) -> (f64, f64) {
    let (ux, uy) = match geo.rotation {
        90 => (ny, nx),
        180 => (1.0 - nx, ny),
        270 => (1.0 - ny, 1.0 - nx),
        _ => (nx, 1.0 - ny),
    };
    (geo.x0 + ux * geo.width, geo.y0 + uy * geo.height)
}

#[tauri::command]
pub async fn apply_markup_to_pdf(request: ApplyMarkupRequest) -> Result<(), String> {
    let req = request;
    let path = req.file_path.clone();

    tauri::async_runtime::spawn_blocking(move || {
        let source = PathBuf::from(&path);
        if !source.exists() {
            return Err("Source file does not exist".into());
        }

        // Backup original before modifying
        let temp_dir = std::env::temp_dir().join("Vyu-temp").join("originals");
        std::fs::create_dir_all(&temp_dir)
            .map_err(|e| format!("Failed to create backup dir: {e}"))?;
        let ext = source
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bak");
        let hash = hash_path_xxh3(&path);
        let backup_path = temp_dir.join(format!("{}.{}", hash, ext));
        std::fs::copy(&source, &backup_path)
            .map_err(|e| format!("Failed to backup PDF: {e}"))?;

        // Open the PDF with lopdf
        let mut doc = Document::load(&source)
            .map_err(|e| format!("Failed to open PDF: {e}"))?;

        let pages = doc.get_pages();

        let mut total_annotations = 0usize;

        for page_data in &req.pages {
            if page_data.strokes.is_empty() {
                continue;
            }

            let page_num = page_data.page_num;
            let pw = page_data.width;
            let ph = page_data.height;

            let page_id = match pages.get(&page_num) {
                Some(id) => *id,
                None => {
                    eprintln!("Page {page_num} not found in document, skipping");
                    continue;
                }
            };
            let geo = page_geometry(&doc, page_id, pw, ph);

            let mut annot_ids = Vec::new();

            for stroke in &page_data.strokes {
                match stroke_to_annot(stroke, geo) {
                    Ok(mut annot_dict) => {
                        annot_dict.set("P", Object::Reference(page_id));
                        let annot_id = doc.add_object(annot_dict);
                        annot_ids.push(annot_id);
                    }
                    Err(e) => {
                        eprintln!("Skipping stroke: {e}");
                    }
                }
            }

            if annot_ids.is_empty() {
                continue;
            }

            // Read existing /Annots refs
            let mut existing_refs: Vec<Object> = Vec::new();
            if let Ok(page_dict) = doc.get_dictionary(page_id) {
                if let Ok(annots_obj) = page_dict.get(b"Annots") {
                    match annots_obj {
                        Object::Array(arr) => {
                            existing_refs = arr.clone();
                        }
                        Object::Reference(ref_id) => {
                            if let Ok(obj) = doc.get_object(*ref_id) {
                                if let Object::Array(arr) = obj {
                                    existing_refs = arr.clone();
                                }
                            }
                        }
                        _ => {}
                    }
                }
            }

            existing_refs.reserve(annot_ids.len());
            for id in &annot_ids {
                existing_refs.push(Object::Reference(*id));
            }

            // Write Annots back as a direct array (not a reference)
            let page = doc
                .get_dictionary_mut(page_id)
                .map_err(|e| format!("Failed to get page {page_num}: {e}"))?;
            page.set("Annots", existing_refs);

            total_annotations += annot_ids.len();
        }

        eprintln!(
            "Applied {total_annotations} annotations to {} pages",
            req.pages.len()
        );

        // Save to temp file then rename for atomicity
        let temp_path = source.with_extension("pdf_tmp_apply");
        doc.save(&temp_path)
            .map_err(|e| format!("Failed to save PDF: {e}"))?;
        std::fs::rename(&temp_path, &source)
            .map_err(|e| format!("Failed to replace PDF: {e}"))?;

        Ok(())
    })
    .await
    .map_err(|e| format!("Thread join error: {e}"))?
}

fn stroke_to_annot(
    stroke: &MarkupStrokeData,
    geo: PageGeometry,
) -> Result<Dictionary, String> {
    match stroke {
        MarkupStrokeData::Freehand(s) => freehand_to_ink(s, geo),
        MarkupStrokeData::Highlight(s) => highlight_to_annot(s, geo),
        MarkupStrokeData::Shape(s) => shape_to_annot(s, geo),
        MarkupStrokeData::Line(s) => line_to_annot(s, geo),
        MarkupStrokeData::Text(s) => text_to_freetext(s, geo),
    }
}

// ── Coordinate helpers ──

/// Compute annotation Rect [llx, lly, urx, ury] from a normalized bounding box.
fn bbox_to_rect(
    geo: PageGeometry,
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
) -> Vec<Object> {
    let corners = [
        norm_to_pdf(geo, min_x, min_y),
        norm_to_pdf(geo, max_x, min_y),
        norm_to_pdf(geo, min_x, max_y),
        norm_to_pdf(geo, max_x, max_y),
    ];
    let llx = corners.iter().map(|p| p.0).fold(f64::MAX, f64::min);
    let urx = corners.iter().map(|p| p.0).fold(f64::MIN, f64::max);
    let lly = corners.iter().map(|p| p.1).fold(f64::MAX, f64::min);
    let ury = corners.iter().map(|p| p.1).fold(f64::MIN, f64::max);
    vec![
        Object::Real(llx as f32),
        Object::Real(lly as f32),
        Object::Real(urx as f32),
        Object::Real(ury as f32),
    ]
}

/// Parse hex color "#rrggbb" to [r, g, b] in 0..1 range
fn parse_hex_color(hex: &str) -> Result<[f64; 3], String> {
    let hex = hex.trim_start_matches('#');
    if hex.len() != 6 {
        return Err(format!("Invalid hex color: {hex}"));
    }
    let r = u8::from_str_radix(&hex[0..2], 16).map_err(|_| "Invalid hex")?;
    let g = u8::from_str_radix(&hex[2..4], 16).map_err(|_| "Invalid hex")?;
    let b = u8::from_str_radix(&hex[4..6], 16).map_err(|_| "Invalid hex")?;
    Ok([r as f64 / 255.0, g as f64 / 255.0, b as f64 / 255.0])
}

fn color_obj(hex: &str) -> Result<Vec<Object>, String> {
    let [r, g, b] = parse_hex_color(hex)?;
    Ok(vec![
        Object::Real(r as f32),
        Object::Real(g as f32),
        Object::Real(b as f32),
    ])
}

/// Map frontend font name to a standard PDF base font
fn map_font(family: &str) -> &str {
    match family {
        "Arial" | "Segoe UI" | "Verdana" | "Geist" | "Satoshi" => "Helvetica",
        "Times New Roman" | "Georgia" => "Times-Roman",
        "Courier New" => "Courier",
        _ => "Helvetica",
    }
}

// ── Freehand → Ink annotation ──

fn freehand_to_ink(
    s: &crate::types::FreehandStrokeData,
    geo: PageGeometry,
) -> Result<Dictionary, String> {
    if s.points.is_empty() {
        return Err("Freehand stroke has no points".into());
    }

    let color = color_obj(&s.color)?;

    // Compute bounding box
    let mut min_x = f64::MAX;
    let mut min_y = f64::MAX;
    let mut max_x = f64::MIN;
    let mut max_y = f64::MIN;
    for p in &s.points {
        if p.x < min_x { min_x = p.x; }
        if p.y < min_y { min_y = p.y; }
        if p.x > max_x { max_x = p.x; }
        if p.y > max_y { max_y = p.y; }
    }

    // Build InkList: alternating x,y pairs in PDF coords
    let mut ink_coords = Vec::new();
    for p in &s.points {
        let (px, py) = norm_to_pdf(geo, p.x, p.y);
        ink_coords.push(Object::Real(px as f32));
        ink_coords.push(Object::Real(py as f32));
    }

    Ok(dictionary! {
        "Type" => "Annot",
        "Subtype" => "Ink",
        "Rect" => bbox_to_rect(geo, min_x, min_y, max_x, max_y),
        "InkList" => vec![Object::Array(ink_coords)],
        "C" => color,
        "Border" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(s.thickness.max(1.0) as i64)],
        "CA" => Object::Real(s.opacity as f32),
    })
}

// ── Highlight → Highlight annotation ──

fn quad_points_from_rect(rect: &[Object]) -> Vec<Object> {
    let llx = object_number(&rect[0]).unwrap_or(0.0) as f32;
    let lly = object_number(&rect[1]).unwrap_or(0.0) as f32;
    let urx = object_number(&rect[2]).unwrap_or(0.0) as f32;
    let ury = object_number(&rect[3]).unwrap_or(0.0) as f32;
    vec![
        Object::Real(llx),
        Object::Real(ury),
        Object::Real(urx),
        Object::Real(ury),
        Object::Real(llx),
        Object::Real(lly),
        Object::Real(urx),
        Object::Real(lly),
    ]
}

fn highlight_to_annot(
    s: &crate::types::HighlightStrokeData,
    geo: PageGeometry,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;

    if s.mode == "straight" {
        let x1 = s.x1.unwrap_or(0.0);
        let y1 = s.y1.unwrap_or(0.0);
        let x2 = s.x2.unwrap_or(0.0);
        let y2 = s.y2.unwrap_or(0.0);

        let rect = bbox_to_rect(
            geo,
            x1.min(x2),
            y1.min(y2),
            x1.max(x2),
            y1.max(y2),
        );
        let quads = quad_points_from_rect(&rect);

        Ok(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Highlight",
            "Rect" => rect,
            "QuadPoints" => quads,
            "C" => color,
            "CA" => Object::Real(s.opacity as f32),
        })
    } else {
        if s.points.is_empty() {
            return Err("Free highlight has no points".into());
        }

        let mut min_x = f64::MAX;
        let mut min_y = f64::MAX;
        let mut max_x = f64::MIN;
        let mut max_y = f64::MIN;
        for p in &s.points {
            if p.x < min_x { min_x = p.x; }
            if p.y < min_y { min_y = p.y; }
            if p.x > max_x { max_x = p.x; }
            if p.y > max_y { max_y = p.y; }
        }

        let rect = bbox_to_rect(geo, min_x, min_y, max_x, max_y);
        let quads = quad_points_from_rect(&rect);

        Ok(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Highlight",
            "Rect" => rect,
            "QuadPoints" => quads,
            "C" => color,
            "CA" => Object::Real(s.opacity as f32),
        })
    }
}

// ── Shape → Square / Circle / Polygon annotation ──

fn shape_to_annot(
    s: &crate::types::ShapeStrokeData,
    geo: PageGeometry,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;
    let half_w = s.width / 2.0;
    let half_h = s.height / 2.0;
    let rect = bbox_to_rect(
        geo,
        s.cx - half_w,
        s.cy - half_h,
        s.cx + half_w,
        s.cy + half_h,
    );

    let border = vec![
        Object::Integer(0),
        Object::Integer(0),
        Object::Integer(s.thickness.max(1.0) as i64),
    ];

    match s.shape.as_str() {
        "square" => {
            let mut dict = dictionary! {
                "Type" => "Annot",
                "Subtype" => "Square",
                "Rect" => rect,
                "C" => color.clone(),
                "Border" => border,
            };
            if s.fill {
                let ic = color_obj(&s.color)?;
                dict.set("IC", ic);
            }
            Ok(dict)
        }
        "circle" => {
            let mut dict = dictionary! {
                "Type" => "Annot",
                "Subtype" => "Circle",
                "Rect" => rect,
                "C" => color.clone(),
                "Border" => border,
            };
            if s.fill {
                let ic = color_obj(&s.color)?;
                dict.set("IC", ic);
            }
            Ok(dict)
        }
        "triangle" => {
            // Triangle vertices in PDF user space
            let top = norm_to_pdf(geo, s.cx, s.cy - half_h);
            let right = norm_to_pdf(geo, s.cx + half_w, s.cy + half_h);
            let left = norm_to_pdf(geo, s.cx - half_w, s.cy + half_h);

            let mut dict = dictionary! {
                "Type" => "Annot",
                "Subtype" => "Polygon",
                "Rect" => rect,
                "Vertices" => vec![
                    Object::Real(top.0 as f32), Object::Real(top.1 as f32),
                    Object::Real(right.0 as f32), Object::Real(right.1 as f32),
                    Object::Real(left.0 as f32), Object::Real(left.1 as f32),
                ],
                "C" => color.clone(),
                "Border" => border,
                "IT" => "Polygon",
            };
            if s.fill {
                let ic = color_obj(&s.color)?;
                dict.set("IC", ic);
            }
            Ok(dict)
        }
        _ => Err(format!("Unknown shape: {}", s.shape)),
    }
}

// ── Line → Line annotation ──

fn line_to_annot(
    s: &crate::types::LineStrokeData,
    geo: PageGeometry,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;

    let (x1_pdf, y1_pdf) = norm_to_pdf(geo, s.x1, s.y1);
    let (x2_pdf, y2_pdf) = norm_to_pdf(geo, s.x2, s.y2);

    let rect = bbox_to_rect(
        geo,
        s.x1.min(s.x2),
        s.y1.min(s.y2),
        s.x1.max(s.x2),
        s.y1.max(s.y2),
    );

    let mut dict = dictionary! {
        "Type" => "Annot",
        "Subtype" => "Line",
        "Rect" => rect,
        "L" => vec![
            Object::Real(x1_pdf as f32), Object::Real(y1_pdf as f32),
            Object::Real(x2_pdf as f32), Object::Real(y2_pdf as f32),
        ],
        "C" => color,
        "Border" => vec![
            Object::Integer(0),
            Object::Integer(0),
            Object::Integer(s.thickness.max(1.0) as i64),
        ],
    };

    if s.line_type == "arrow" || s.line_type == "bidirectional-arrow" {
        dict.set(
            "LE",
            vec![
                Object::Name(b"OpenArrow".to_vec()),
                Object::Name(b"None".to_vec()),
            ],
        );
    }
    if s.line_type == "bidirectional-arrow" {
        dict.set(
            "LE",
            vec![
                Object::Name(b"OpenArrow".to_vec()),
                Object::Name(b"OpenArrow".to_vec()),
            ],
        );
    }

    Ok(dict)
}

// ── Text → FreeText annotation ──

fn text_to_freetext(
    s: &crate::types::TextStrokeData,
    geo: PageGeometry,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;

    // Estimate text box dimensions from font size (approximate)
    let est_text_width =
        (s.text.len() as f64 * s.font_size * 0.55 + s.box_extra_width) / geo.width;
    let est_text_height = (s.font_size * 1.4) / geo.height;

    let half_w = est_text_width / 2.0;
    let half_h = est_text_height / 2.0;
    let rect = bbox_to_rect(
        geo,
        s.x - half_w,
        s.y - half_h,
        s.x + half_w,
        s.y + half_h,
    );

    let font_base = map_font(&s.font_family);
    let font_name = if s.bold {
        format!("{}-Bold", font_base)
    } else if s.italic {
        format!("{}-Oblique", font_base)
    } else {
        font_base.to_string()
    };
    let da = format!(
        "/{fn} {fs} Tf 0 0 0 rg",
        fn = font_name,
        fs = s.font_size,
    );

    let mut dict = dictionary! {
        "Type" => "Annot",
        "Subtype" => "FreeText",
        "Rect" => rect,
        "Contents" => Object::string_literal(s.text.as_str()),
        "C" => color,
        "DA" => Object::string_literal(da.as_str()),
        "Q" => Object::Integer(match s.align.as_str() {
            "center" => 1,
            "right" => 2,
            _ => 0,
        }),
    };

    if s.bg_enabled {
        if let Ok(bg) = color_obj(&s.bg_color) {
            dict.set("IC", bg);
        }
    }

    Ok(dict)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn geo(rotation: i32) -> PageGeometry {
        PageGeometry {
            x0: 10.0,
            y0: 20.0,
            width: 100.0,
            height: 200.0,
            rotation,
        }
    }

    fn close(a: f64, b: f64) -> bool {
        (a - b).abs() < 0.001
    }

    #[test]
    fn maps_display_corners_for_each_rotation() {
        let g0 = geo(0);
        assert!(close(norm_to_pdf(g0, 0.0, 0.0).1, 220.0));
        let g90 = geo(90);
        let (x, y) = norm_to_pdf(g90, 0.0, 0.0);
        assert!(close(x, 10.0) && close(y, 20.0));
        let (x, y) = norm_to_pdf(g90, 1.0, 0.0);
        assert!(close(x, 10.0) && close(y, 220.0));
        let g180 = geo(180);
        let (x, y) = norm_to_pdf(g180, 0.0, 0.0);
        assert!(close(x, 110.0) && close(y, 20.0));
        let g270 = geo(270);
        let (x, y) = norm_to_pdf(g270, 0.0, 0.0);
        assert!(close(x, 110.0) && close(y, 220.0));
    }
}
