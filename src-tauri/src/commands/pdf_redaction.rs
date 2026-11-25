// PDF redaction — replace affected pages with flattened images so hidden text,
// annotations, and form data cannot be recovered.
use std::collections::HashSet;
use std::path::PathBuf;

use base64::Engine as _;
use lopdf::{Dictionary, Document, Object, ObjectId, Stream};

use crate::types::RedactPdfRequest;

#[tauri::command]
pub async fn redact_pdf(request: RedactPdfRequest) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || redact_pdf_sync(request))
        .await
        .map_err(|e| format!("Thread join error: {e}"))?
}

struct PreparedPage {
    page_num: u32,
    bytes: Vec<u8>,
    width: u32,
    height: u32,
    width_pt: f64,
    height_pt: f64,
}

fn redact_pdf_sync(request: RedactPdfRequest) -> Result<(), String> {
    if request.pages.is_empty() {
        return Err("No redacted pages".into());
    }
    let source = PathBuf::from(&request.file_path);
    if !source.is_file() {
        return Err("Source file does not exist".into());
    }

    let prepared: Vec<PreparedPage> = request
        .pages
        .iter()
        .map(|page| {
            let bytes = base64::engine::general_purpose::STANDARD
                .decode(page.data_base64.as_bytes())
                .map_err(|e| format!("Failed to decode page {}: {e}", page.page_num))?;
            Ok(PreparedPage {
                page_num: page.page_num,
                bytes,
                width: page.width,
                height: page.height,
                width_pt: page.width_pt,
                height_pt: page.height_pt,
            })
        })
        .collect::<Result<_, String>>()?;

    let mut doc = Document::load(&source).map_err(|e| format!("Failed to open PDF: {e}"))?;
    apply_redaction(&mut doc, &prepared, request.clear_metadata)?;

    let temp_path = source.with_extension("pdf_redact_tmp");
    doc.save(&temp_path)
        .map_err(|e| format!("Failed to save redacted PDF: {e}"))?;
    std::fs::rename(&temp_path, &source)
        .map_err(|e| format!("Failed to replace PDF: {e}"))?;
    Ok(())
}

fn apply_redaction(
    doc: &mut Document,
    pages: &[PreparedPage],
    clear_metadata: bool,
) -> Result<(), String> {
    let page_ids = doc.get_pages();

    // Capture form widgets that live on redacted pages before those pages are
    // flattened. Forms on untouched pages must remain editable.
    let redacted_page_ids: HashSet<ObjectId> = pages
        .iter()
        .filter_map(|page| page_ids.get(&page.page_num).copied())
        .collect();
    let mut redacted_widgets: HashSet<ObjectId> = HashSet::new();
    for page_id in &redacted_page_ids {
        for annot_id in page_annotation_refs(doc, *page_id) {
            if let Ok(annotation) = doc.get_dictionary(annot_id) {
                if is_widget(annotation) {
                    redacted_widgets.insert(annot_id);
                }
            }
        }
    }

    // Validate every page before mutating anything.
    for page in pages {
        if !page_ids.contains_key(&page.page_num) {
            return Err(format!("Page {} not found", page.page_num));
        }
        if page.width == 0 || page.height == 0 {
            return Err(format!("Page {} has no image", page.page_num));
        }
        if !(page.width_pt.is_finite() && page.height_pt.is_finite())
            || page.width_pt <= 0.0
            || page.height_pt <= 0.0
        {
            return Err(format!("Page {} has invalid dimensions", page.page_num));
        }
    }

    for page in pages {
        let page_id = page_ids[&page.page_num];

        let mut image_dict = Dictionary::new();
        image_dict.set("Type", Object::Name(b"XObject".to_vec()));
        image_dict.set("Subtype", Object::Name(b"Image".to_vec()));
        image_dict.set("Width", Object::Integer(page.width as i64));
        image_dict.set("Height", Object::Integer(page.height as i64));
        image_dict.set("ColorSpace", Object::Name(b"DeviceRGB".to_vec()));
        image_dict.set("BitsPerComponent", Object::Integer(8));
        image_dict.set("Filter", Object::Name(b"DCTDecode".to_vec()));
        let image_id = doc.add_object(Stream::new(image_dict, page.bytes.clone()));

        let content = format!(
            "q\n{:.4} 0 0 {:.4} 0 0 cm\n/Im0 Do\nQ\n",
            page.width_pt, page.height_pt
        );
        let content_id = doc.add_object(Stream::new(Dictionary::new(), content.into_bytes()));

        let mut xobjects = Dictionary::new();
        xobjects.set("Im0", Object::Reference(image_id));
        let mut resources = Dictionary::new();
        resources.set("XObject", Object::Dictionary(xobjects));

        let page_dict = doc
            .get_dictionary_mut(page_id)
            .map_err(|e| format!("Failed to access page {}: {e}", page.page_num))?;
        page_dict.set("Contents", Object::Reference(content_id));
        page_dict.set("Resources", Object::Dictionary(resources));
        page_dict.set(
            "MediaBox",
            vec![
                Object::Real(0.0),
                Object::Real(0.0),
                Object::Real(page.width_pt as f32),
                Object::Real(page.height_pt as f32),
            ],
        );
        page_dict.set(
            "CropBox",
            vec![
                Object::Real(0.0),
                Object::Real(0.0),
                Object::Real(page.width_pt as f32),
                Object::Real(page.height_pt as f32),
            ],
        );
        page_dict.set("Rotate", Object::Integer(0));
        page_dict.remove(b"Annots");
        page_dict.remove(b"Group");
        page_dict.remove(b"StructParents");
        page_dict.remove(b"PieceInfo");
        page_dict.remove(b"Thumb");
        page_dict.remove(b"Metadata");
    }

    // Forms and XFA can carry the redacted content outside the page stream.
    prune_acroform_fields(doc, &redacted_page_ids, &redacted_widgets)?;
    if let Ok(catalog) = doc.catalog_mut() {
        if clear_metadata {
            catalog.remove(b"Metadata");
            catalog.remove(b"Outlines");
            catalog.remove(b"Names");
            catalog.remove(b"OpenAction");
            catalog.remove(b"AA");
        }
    }
    if clear_metadata {
        doc.trailer.remove(b"Info");
        doc.trailer.remove(b"ID");
    }

    doc.prune_objects();
    doc.renumber_objects();
    doc.compress();
    Ok(())
}

fn page_annotation_refs(doc: &Document, page_id: ObjectId) -> Vec<ObjectId> {
    let Ok(page) = doc.get_dictionary(page_id) else {
        return Vec::new();
    };
    let items = match page.get(b"Annots") {
        Ok(Object::Array(items)) => items.clone(),
        Ok(Object::Reference(id)) => match doc.get_object(*id) {
            Ok(Object::Array(items)) => items.clone(),
            _ => return Vec::new(),
        },
        _ => return Vec::new(),
    };
    items
        .into_iter()
        .filter_map(|item| match item {
            Object::Reference(id) => Some(id),
            _ => None,
        })
        .collect()
}

fn prune_acroform_fields(
    doc: &mut Document,
    redacted_pages: &HashSet<ObjectId>,
    redacted_widgets: &HashSet<ObjectId>,
) -> Result<(), String> {
    let (acroform_obj, acroform_id) = match doc.catalog() {
        Ok(catalog) => match catalog.get(b"AcroForm") {
            Ok(Object::Reference(id)) => {
                (doc.get_object(*id).ok().cloned(), Some(*id))
            }
            Ok(object) => (Some(object.clone()), None),
            Err(_) => return Ok(()),
        },
        Err(_) => return Ok(()),
    };
    let Some(Object::Dictionary(acroform)) = acroform_obj else {
        return Ok(());
    };
    let mut acroform = acroform;

    // XFA duplicates page content and cannot be partially redacted.
    acroform.remove(b"XFA");

    let fields = match acroform.get(b"Fields") {
        Ok(Object::Array(items)) => items.clone(),
        Ok(Object::Reference(id)) => match doc.get_object(*id) {
            Ok(Object::Array(items)) => items.clone(),
            _ => Vec::new(),
        },
        _ => Vec::new(),
    };

    let kept: Vec<Object> = fields
        .into_iter()
        .filter(|item| match item {
            Object::Reference(id) => !field_is_redacted(
                doc,
                *id,
                redacted_pages,
                redacted_widgets,
                &mut HashSet::new(),
            ),
            _ => true,
        })
        .collect();

    if kept.is_empty() {
        if let Some(id) = acroform_id {
            doc.objects.remove(&id);
        }
        if let Ok(catalog) = doc.catalog_mut() {
            catalog.remove(b"AcroForm");
        }
        return Ok(());
    }

    acroform.set("Fields", kept);
    if let Some(id) = acroform_id {
        doc.objects.insert(id, Object::Dictionary(acroform));
    } else if let Ok(catalog) = doc.catalog_mut() {
        catalog.set("AcroForm", Object::Dictionary(acroform));
    }
    Ok(())
}

fn field_is_redacted(
    doc: &Document,
    field_id: ObjectId,
    redacted_pages: &HashSet<ObjectId>,
    redacted_widgets: &HashSet<ObjectId>,
    seen: &mut HashSet<ObjectId>,
) -> bool {
    if !seen.insert(field_id) {
        return false;
    }
    if redacted_widgets.contains(&field_id) {
        return true;
    }
    let Ok(dict) = doc.get_dictionary(field_id) else {
        return false;
    };
    if is_widget(dict) {
        if let Ok(Object::Reference(page_id)) = dict.get(b"P") {
            if redacted_pages.contains(page_id) {
                return true;
            }
        }
    }
    let kids = match dict.get(b"Kids") {
        Ok(Object::Array(items)) => items.clone(),
        Ok(Object::Reference(id)) => match doc.get_object(*id) {
            Ok(Object::Array(items)) => items.clone(),
            _ => Vec::new(),
        },
        _ => Vec::new(),
    };
    for kid in kids {
        if let Object::Reference(kid_id) = kid {
            if field_is_redacted(
                doc,
                kid_id,
                redacted_pages,
                redacted_widgets,
                seen,
            ) {
                return true;
            }
        }
    }
    false
}

fn is_widget(dict: &Dictionary) -> bool {
    matches!(
        dict.get(b"Subtype"),
        Ok(Object::Name(name)) if name == b"Widget"
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use lopdf::dictionary;

    fn build_doc() -> (Document, lopdf::ObjectId) {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let content_id = doc.add_object(Stream::new(
            Dictionary::new(),
            b"BT /F1 12 Tf 72 720 Td (SECRET) Tj ET".to_vec(),
        ));
        let annot_id = doc.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Widget",
            "Rect" => vec![Object::Real(0.0), Object::Real(0.0), Object::Real(10.0), Object::Real(10.0)],
            "FT" => "Tx",
            "T" => Object::string_literal("secretField"),
        });
        let page_id = doc.add_object(dictionary! {
            "Type" => "Page",
            "Parent" => Object::Reference(pages_id),
            "MediaBox" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(595), Object::Integer(842)],
            "Contents" => Object::Reference(content_id),
            "Annots" => vec![Object::Reference(annot_id)],
        });
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page_id)],
                "Count" => Object::Integer(1),
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
            "AcroForm" => dictionary! { "Fields" => vec![Object::Reference(annot_id)] },
        });
        doc.trailer.set("Root", Object::Reference(catalog_id));
        (doc, page_id)
    }

    #[test]
    fn widget_detection_checks_subtype() {
        let widget = dictionary! { "Subtype" => "Widget" };
        let highlight = dictionary! { "Subtype" => "Highlight" };
        assert!(is_widget(&widget));
        assert!(!is_widget(&highlight));
    }

    #[test]
    fn redaction_preserves_forms_on_untouched_pages() {
        let mut doc = Document::with_version("1.5");
        let pages_id = doc.new_object_id();
        let content1 = doc.add_object(Stream::new(
            Dictionary::new(),
            b"BT /F1 12 Tf 72 720 Td (SECRET) Tj ET".to_vec(),
        ));
        let content2 = doc.add_object(Stream::new(
            Dictionary::new(),
            b"BT /F1 12 Tf 72 720 Td (KEEP) Tj ET".to_vec(),
        ));
        let page1_id = doc.new_object_id();
        let page2_id = doc.new_object_id();
        let widget1 = doc.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Widget",
            "Rect" => vec![Object::Real(0.0), Object::Real(0.0), Object::Real(10.0), Object::Real(10.0)],
            "FT" => "Tx",
            "T" => Object::string_literal("secretField"),
            "P" => Object::Reference(page1_id),
        });
        let widget2 = doc.add_object(dictionary! {
            "Type" => "Annot",
            "Subtype" => "Widget",
            "Rect" => vec![Object::Real(0.0), Object::Real(0.0), Object::Real(10.0), Object::Real(10.0)],
            "FT" => "Tx",
            "T" => Object::string_literal("keepField"),
            "P" => Object::Reference(page2_id),
        });
        doc.objects.insert(
            page1_id,
            Object::Dictionary(dictionary! {
                "Type" => "Page",
                "Parent" => Object::Reference(pages_id),
                "MediaBox" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(595), Object::Integer(842)],
                "Contents" => Object::Reference(content1),
                "Annots" => vec![Object::Reference(widget1)],
            }),
        );
        doc.objects.insert(
            page2_id,
            Object::Dictionary(dictionary! {
                "Type" => "Page",
                "Parent" => Object::Reference(pages_id),
                "MediaBox" => vec![Object::Integer(0), Object::Integer(0), Object::Integer(595), Object::Integer(842)],
                "Contents" => Object::Reference(content2),
                "Annots" => vec![Object::Reference(widget2)],
            }),
        );
        doc.objects.insert(
            pages_id,
            Object::Dictionary(dictionary! {
                "Type" => "Pages",
                "Kids" => vec![Object::Reference(page1_id), Object::Reference(page2_id)],
                "Count" => Object::Integer(2),
            }),
        );
        let catalog_id = doc.add_object(dictionary! {
            "Type" => "Catalog",
            "Pages" => Object::Reference(pages_id),
            "AcroForm" => dictionary! {
                "Fields" => vec![Object::Reference(widget1), Object::Reference(widget2)],
            },
        });
        doc.trailer.set("Root", Object::Reference(catalog_id));

        let pages = vec![PreparedPage {
            page_num: 1,
            bytes: vec![0xFF, 0xD8, 0xFF, 0xD9],
            width: 8,
            height: 8,
            width_pt: 595.0,
            height_pt: 842.0,
        }];
        apply_redaction(&mut doc, &pages, false).unwrap();

        let pages = doc.get_pages();
        let page2_id = pages[&2];
        assert!(
            doc.get_dictionary(page2_id)
                .unwrap()
                .get(b"Annots")
                .is_ok(),
            "untouched page lost its widget"
        );

        let acroform = doc
            .catalog()
            .unwrap()
            .get(b"AcroForm")
            .and_then(Object::as_dict)
            .unwrap();
        let fields = acroform.get(b"Fields").and_then(Object::as_array).unwrap();
        assert_eq!(fields.len(), 1, "only the redacted page field is removed");
        let mut keep = false;
        for field in fields {
            let dict = field.as_reference().unwrap();
            let dict = doc.get_dictionary(dict).unwrap();
            if let Ok(Object::String(name, _)) = dict.get(b"T") {
                if name == b"keepField" {
                    keep = true;
                }
            }
        }
        assert!(keep);
    }

    #[test]
    fn replaces_page_content_and_removes_old_text() {
        let (mut doc, _) = build_doc();
        let pages = vec![PreparedPage {
            page_num: 1,
            bytes: vec![0xFF, 0xD8, 0xFF, 0xD9],
            width: 8,
            height: 8,
            width_pt: 595.0,
            height_pt: 842.0,
        }];

        apply_redaction(&mut doc, &pages, true).unwrap();

        let page_id = doc.get_pages()[&1];
        let content = doc.get_page_content(page_id).unwrap();
        let text = String::from_utf8_lossy(&content);
        assert!(!text.contains("SECRET"));
        assert!(text.contains("/Im0"));
        for object in doc.objects.values() {
            if let Object::Stream(stream) = object {
                assert!(
                    !String::from_utf8_lossy(&stream.content).contains("SECRET"),
                    "redacted text survived in a stream"
                );
            }
        }
        assert!(doc.catalog().unwrap().get(b"AcroForm").is_err());
    }
}
