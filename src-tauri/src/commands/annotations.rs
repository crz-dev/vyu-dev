// PDF annotations — apply markup strokes as native PDF annotation objects
use std::path::PathBuf;

use lopdf::{dictionary, Dictionary, Document, Object};

use crate::types::{ApplyMarkupRequest, MarkupStrokeData};
use crate::util::hash_path_xxh3;

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

            let mut annot_ids = Vec::new();

            for stroke in &page_data.strokes {
                match stroke_to_annot(stroke, pw, ph) {
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
    pw: f64,
    ph: f64,
) -> Result<Dictionary, String> {
    match stroke {
        MarkupStrokeData::Freehand(s) => freehand_to_ink(s, pw, ph),
        MarkupStrokeData::Highlight(s) => highlight_to_annot(s, pw, ph),
        MarkupStrokeData::Shape(s) => shape_to_annot(s, pw, ph),
        MarkupStrokeData::Line(s) => line_to_annot(s, pw, ph),
        MarkupStrokeData::Text(s) => text_to_freetext(s, pw, ph),
    }
}

// ── Coordinate helpers ──

/// Convert normalized (0-1, top-left origin) to PDF point (bottom-left origin)
fn norm_to_pdf(nx: f64, ny: f64, pw: f64, ph: f64) -> (f64, f64) {
    (nx * pw, (1.0 - ny) * ph)
}

/// Compute annotation Rect [llx, lly, urx, ury] from bounding box
fn bbox_to_rect(min_x: f64, min_y: f64, max_x: f64, max_y: f64, pw: f64, ph: f64) -> Vec<Object> {
    let (llx, lly) = norm_to_pdf(min_x, max_y, pw, ph);
    let (urx, ury) = norm_to_pdf(max_x, min_y, pw, ph);
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
    pw: f64,
    ph: f64,
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
        let (px, py) = norm_to_pdf(p.x, p.y, pw, ph);
        ink_coords.push(Object::Real(px as f32));
        ink_coords.push(Object::Real(py as f32));
    }

    Ok(dictionary! {
        "Type" => "Annot",
        "Subtype" => "Ink",
        "Rect" => bbox_to_rect(min_x, min_y, max_x, max_y, pw, ph),
        "InkList" => vec![Object::Array(ink_coords)],
        "C" => color,
        "Border" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(s.thickness.max(1.0) as i64)],
        "CA" => Object::Real(s.opacity as f32),
    })
}

// ── Highlight → Highlight annotation ──

fn highlight_to_annot(
    s: &crate::types::HighlightStrokeData,
    pw: f64,
    ph: f64,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;

    if s.mode == "straight" {
        let x1 = s.x1.unwrap_or(0.0);
        let y1 = s.y1.unwrap_or(0.0);
        let x2 = s.x2.unwrap_or(0.0);
        let y2 = s.y2.unwrap_or(0.0);

        let (llx, lly) = norm_to_pdf(x1.min(x2), y1.max(y2), pw, ph);
        let (urx, ury) = norm_to_pdf(x1.max(x2), y1.min(y2), pw, ph);

        // QuadPoints: [tl_x tl_y tr_x tr_y bl_x bl_y br_x br_y]
        // where tl = top-left, tr = top-right, bl = bottom-left, br = bottom-right
        let (tl_x, tl_y) = norm_to_pdf(x1.min(x2), y1.min(y2), pw, ph);
        let (tr_x, tr_y) = norm_to_pdf(x1.max(x2), y1.min(y2), pw, ph);
        let (bl_x, bl_y) = norm_to_pdf(x1.min(x2), y1.max(y2), pw, ph);
        let (br_x, br_y) = norm_to_pdf(x1.max(x2), y1.max(y2), pw, ph);

        let rect = vec![
            Object::Real(llx as f32), Object::Real(lly as f32),
            Object::Real(urx as f32), Object::Real(ury as f32),
        ];
        let quads = vec![
            Object::Real(tl_x as f32), Object::Real(tl_y as f32),
            Object::Real(tr_x as f32), Object::Real(tr_y as f32),
            Object::Real(br_x as f32), Object::Real(br_y as f32),
            Object::Real(bl_x as f32), Object::Real(bl_y as f32),
        ];

        Ok(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Highlight",
            "Rect" => rect,
            "QuadPoints" => quads,
            "C" => color,
            "CA" => Object::Real(s.opacity as f32),
        })
    } else {
        // Free-mode highlight — use bounding box as single quad
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

        let (llx, lly) = norm_to_pdf(min_x, max_y, pw, ph);
        let (urx, ury) = norm_to_pdf(max_x, min_y, pw, ph);

        let (tl_x, tl_y) = norm_to_pdf(min_x, min_y, pw, ph);
        let (tr_x, tr_y) = norm_to_pdf(max_x, min_y, pw, ph);
        let (bl_x, bl_y) = norm_to_pdf(min_x, max_y, pw, ph);
        let (br_x, br_y) = norm_to_pdf(max_x, max_y, pw, ph);

        let rect = vec![
            Object::Real(llx as f32), Object::Real(lly as f32),
            Object::Real(urx as f32), Object::Real(ury as f32),
        ];
        let quads = vec![
            Object::Real(tl_x as f32), Object::Real(tl_y as f32),
            Object::Real(tr_x as f32), Object::Real(tr_y as f32),
            Object::Real(br_x as f32), Object::Real(br_y as f32),
            Object::Real(bl_x as f32), Object::Real(bl_y as f32),
        ];

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
    pw: f64,
    ph: f64,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;
    let half_w = s.width / 2.0;
    let half_h = s.height / 2.0;
    let (llx, lly) = norm_to_pdf(s.cx - half_w, s.cy + half_h, pw, ph);
    let (urx, ury) = norm_to_pdf(s.cx + half_w, s.cy - half_h, pw, ph);

    let rect = vec![
        Object::Real(llx as f32), Object::Real(lly as f32),
        Object::Real(urx as f32), Object::Real(ury as f32),
    ];

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
            // Triangle vertices in PDF coords (bottom-left origin)
            let top = norm_to_pdf(s.cx, s.cy - half_h, pw, ph);        // top vertex
            let right = norm_to_pdf(s.cx + half_w, s.cy + half_h, pw, ph); // right vertex
            let left = norm_to_pdf(s.cx - half_w, s.cy + half_h, pw, ph);  // left vertex

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
    pw: f64,
    ph: f64,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;

    let (x1_pdf, y1_pdf) = norm_to_pdf(s.x1, s.y1, pw, ph);
    let (x2_pdf, y2_pdf) = norm_to_pdf(s.x2, s.y2, pw, ph);

    // Bounding box
    let min_x = s.x1.min(s.x2);
    let max_x = s.x1.max(s.x2);
    let min_y = s.y1.min(s.y2);
    let max_y = s.y1.max(s.y2);

    let (llx, lly) = norm_to_pdf(min_x, max_y, pw, ph);
    let (urx, ury) = norm_to_pdf(max_x, min_y, pw, ph);

    let mut dict = dictionary! {
        "Type" => "Annot",
        "Subtype" => "Line",
        "Rect" => vec![
            Object::Real(llx as f32), Object::Real(lly as f32),
            Object::Real(urx as f32), Object::Real(ury as f32),
        ],
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
    pw: f64,
    ph: f64,
) -> Result<Dictionary, String> {
    let color = color_obj(&s.color)?;

    // Estimate text box dimensions from font size (approximate)
    let est_text_width = (s.text.len() as f64 * s.font_size * 0.55 + s.box_extra_width) / pw;
    let est_text_height = (s.font_size * 1.4) / ph;

    let half_w = est_text_width / 2.0;
    let half_h = est_text_height / 2.0;
    let (llx, lly) = norm_to_pdf(s.x - half_w, s.y + half_h, pw, ph);
    let (urx, ury) = norm_to_pdf(s.x + half_w, s.y - half_h, pw, ph);

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
        "Rect" => vec![
            Object::Real(llx as f32), Object::Real(lly as f32),
            Object::Real(urx as f32), Object::Real(ury as f32),
        ],
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
