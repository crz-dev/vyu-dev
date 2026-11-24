use std::collections::HashMap;

use crate::types::{SubtitleAnchor, SubtitleCue, SubtitleTextRun};

const DEFAULT_PLAY_RES_X: f32 = 1920.0;
const DEFAULT_PLAY_RES_Y: f32 = 1080.0;

#[derive(Clone, Copy)]
struct Rgba {
    r: u8,
    g: u8,
    b: u8,
    /// Opacity, 0..=255.
    a: u8,
}

impl Rgba {
    fn white() -> Self {
        Self {
            r: 255,
            g: 255,
            b: 255,
            a: 255,
        }
    }

    fn black() -> Self {
        Self {
            r: 0,
            g: 0,
            b: 0,
            a: 255,
        }
    }

    fn css(self) -> String {
        format!(
            "rgba({}, {}, {}, {:.3})",
            self.r,
            self.g,
            self.b,
            self.a as f32 / 255.0
        )
    }

    fn with_opacity(self, opacity: u8) -> Self {
        Self { a: opacity, ..self }
    }
}

#[derive(Clone)]
struct AssStyle {
    font: String,
    size: f32,
    primary: Rgba,
    outline_color: Rgba,
    back_color: Rgba,
    bold: bool,
    italic: bool,
    underline: bool,
    border_style: u32,
    outline: f32,
    alignment: u8,
    margin_l: f32,
    margin_r: f32,
    margin_v: f32,
}

impl Default for AssStyle {
    fn default() -> Self {
        Self {
            font: "Arial".into(),
            size: 28.0,
            primary: Rgba::white(),
            outline_color: Rgba::black(),
            back_color: Rgba::black(),
            bold: false,
            italic: false,
            underline: false,
            border_style: 1,
            outline: 1.5,
            alignment: 2,
            margin_l: 20.0,
            margin_r: 20.0,
            margin_v: 20.0,
        }
    }
}

pub struct AssDocument {
    pub cues: Vec<SubtitleCue>,
    pub play_res_x: u32,
    pub play_res_y: u32,
}

pub fn parse(text: &str) -> AssDocument {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    let mut section = "";
    let mut play_x = DEFAULT_PLAY_RES_X;
    let mut play_y = DEFAULT_PLAY_RES_Y;
    let mut has_play_res = false;
    let mut is_v4 = false;
    let mut style_format: Vec<String> = Vec::new();
    let mut event_format: Vec<String> = Vec::new();
    let mut styles: HashMap<String, AssStyle> = HashMap::new();
    let mut cues: Vec<SubtitleCue> = Vec::new();

    for raw_line in text.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with(';') {
            continue;
        }
        if line.starts_with('[') {
            section = line.trim_matches(['[', ']']);
            if section.eq_ignore_ascii_case("V4 Styles") {
                is_v4 = true;
                if !has_play_res {
                    play_x = 384.0;
                    play_y = 288.0;
                }
            } else if section.eq_ignore_ascii_case("V4+ Styles") {
                is_v4 = false;
            }
            continue;
        }

        if section.eq_ignore_ascii_case("Script Info") {
            if let Some((key, value)) = line.split_once(':') {
                let key = key.trim();
                let value = value.trim();
                if key.eq_ignore_ascii_case("PlayResX") {
                    if let Ok(value) = value.parse::<f32>() {
                        if value > 0.0 {
                            play_x = value;
                            has_play_res = true;
                        }
                    }
                } else if key.eq_ignore_ascii_case("PlayResY") {
                    if let Ok(value) = value.parse::<f32>() {
                        if value > 0.0 {
                            play_y = value;
                            has_play_res = true;
                        }
                    }
                } else if key.eq_ignore_ascii_case("ScriptType") {
                    let lower = value.to_ascii_lowercase();
                    if lower.contains("v4.00") && !lower.contains("v4.00+") {
                        is_v4 = true;
                        if !has_play_res {
                            play_x = 384.0;
                            play_y = 288.0;
                        }
                    }
                }
            }
            continue;
        }

        if section.eq_ignore_ascii_case("V4+ Styles") || section.eq_ignore_ascii_case("V4 Styles") {
            if let Some(rest) = strip_prefix_ci(line, "Format:") {
                style_format = split_list(rest);
            } else if let Some(rest) = strip_prefix_ci(line, "Style:") {
                if let Some((name, style)) = parse_style(rest, &style_format, is_v4) {
                    styles.insert(name.to_ascii_lowercase(), style);
                }
            }
            continue;
        }

        if section.eq_ignore_ascii_case("Events") {
            if let Some(rest) = strip_prefix_ci(line, "Format:") {
                event_format = split_list(rest);
            } else if let Some(rest) = strip_prefix_ci(line, "Dialogue:") {
                if let Some(cue) = parse_event(rest, &event_format, &styles, play_x, play_y, is_v4)
                {
                    cues.push(cue);
                }
            }
            continue;
        }
    }

    if play_x <= 0.0 {
        play_x = if is_v4 { 384.0 } else { DEFAULT_PLAY_RES_X };
    }
    if play_y <= 0.0 {
        play_y = if is_v4 { 288.0 } else { DEFAULT_PLAY_RES_Y };
    }
    cues.sort_by(|a, b| a.start.total_cmp(&b.start));

    AssDocument {
        cues,
        play_res_x: play_x.round().max(1.0) as u32,
        play_res_y: play_y.round().max(1.0) as u32,
    }
}

fn strip_prefix_ci<'a>(value: &'a str, prefix: &str) -> Option<&'a str> {
    if value.len() >= prefix.len() && value[..prefix.len()].eq_ignore_ascii_case(prefix) {
        Some(&value[prefix.len()..])
    } else {
        None
    }
}

fn split_list(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(|item| item.trim().to_string())
        .filter(|item| !item.is_empty())
        .collect()
}

fn split_record(rest: &str, count: usize) -> Vec<&str> {
    if count == 0 {
        return rest.split(',').map(str::trim).collect();
    }
    let mut out = Vec::with_capacity(count);
    let mut iter = rest.splitn(count, ',');
    for _ in 0..count {
        out.push(iter.next().unwrap_or("").trim());
    }
    out
}

fn field<'a>(fields: &'a [&str], format: &[String], name: &str) -> Option<&'a str> {
    let index = format
        .iter()
        .position(|item| item.eq_ignore_ascii_case(name))?;
    fields.get(index).copied()
}

fn parse_style(rest: &str, format: &[String], is_v4: bool) -> Option<(String, AssStyle)> {
    let fields = split_record(rest, format.len().max(1));
    let name = field(&fields, format, "Name")?;
    if name.is_empty() {
        return None;
    }
    let mut style = AssStyle::default();
    if let Some(value) = field(&fields, format, "Fontname") {
        if !value.is_empty() {
            style.font = value.to_string();
        }
    }
    if let Some(value) = field(&fields, format, "Fontsize").and_then(parse_number) {
        style.size = value.max(1.0);
    }
    if let Some(value) = field(&fields, format, "PrimaryColour").and_then(parse_color) {
        style.primary = value;
    }
    if let Some(value) = field(&fields, format, "OutlineColour").and_then(parse_color) {
        style.outline_color = value;
    }
    if let Some(value) = field(&fields, format, "BackColour").and_then(parse_color) {
        style.back_color = value;
    }
    if let Some(value) = field(&fields, format, "Bold") {
        style.bold = parse_flag(value);
    }
    if let Some(value) = field(&fields, format, "Italic") {
        style.italic = parse_flag(value);
    }
    if let Some(value) = field(&fields, format, "Underline") {
        style.underline = parse_flag(value);
    }
    if let Some(value) = field(&fields, format, "BorderStyle").and_then(|v| v.parse().ok()) {
        style.border_style = value;
    }
    if let Some(value) = field(&fields, format, "Outline").and_then(parse_number) {
        style.outline = value.max(0.0);
    }
    if let Some(value) = field(&fields, format, "Alignment").and_then(|v| v.parse().ok()) {
        style.alignment = normalize_alignment(value, is_v4);
    }
    if let Some(value) = field(&fields, format, "MarginL").and_then(parse_number) {
        style.margin_l = value.max(0.0);
    }
    if let Some(value) = field(&fields, format, "MarginR").and_then(parse_number) {
        style.margin_r = value.max(0.0);
    }
    if let Some(value) = field(&fields, format, "MarginV").and_then(parse_number) {
        style.margin_v = value.max(0.0);
    }
    Some((name.to_string(), style))
}

fn parse_event(
    rest: &str,
    format: &[String],
    styles: &HashMap<String, AssStyle>,
    play_x: f32,
    play_y: f32,
    is_v4: bool,
) -> Option<SubtitleCue> {
    let fields = split_record(rest, format.len().max(1));
    let start = field(&fields, format, "Start").and_then(parse_time)?;
    let end = field(&fields, format, "End").and_then(parse_time)?;
    if end <= start {
        return None;
    }
    let style_name = field(&fields, format, "Style").unwrap_or("");
    let mut base = styles
        .get(&style_name.to_ascii_lowercase())
        .cloned()
        .unwrap_or_default();
    if let Some(value) = field(&fields, format, "MarginL").and_then(parse_number) {
        if value > 0.0 {
            base.margin_l = value;
        }
    }
    if let Some(value) = field(&fields, format, "MarginR").and_then(parse_number) {
        if value > 0.0 {
            base.margin_r = value;
        }
    }
    if let Some(value) = field(&fields, format, "MarginV").and_then(parse_number) {
        if value > 0.0 {
            base.margin_v = value;
        }
    }
    let text = field(&fields, format, "Text")?;
    let (lines, anchor, background) =
        parse_dialogue_text(text, &base, styles, play_x, play_y, is_v4)?;
    Some(SubtitleCue {
        start,
        end,
        lines,
        images: Vec::new(),
        anchor: Some(anchor),
        background,
        font_size: Some(base.size),
    })
}

fn parse_dialogue_text(
    raw: &str,
    base: &AssStyle,
    styles: &HashMap<String, AssStyle>,
    play_x: f32,
    play_y: f32,
    is_v4: bool,
) -> Option<(Vec<Vec<SubtitleTextRun>>, SubtitleAnchor, Option<String>)> {
    let mut current = base.clone();
    let mut anchor = anchor_from_style(base, play_x, play_y);
    let mut explicit_position = false;
    let mut drawing = false;
    let mut lines: Vec<Vec<SubtitleTextRun>> = Vec::new();
    let mut line: Vec<SubtitleTextRun> = Vec::new();
    let mut buffer = String::new();
    let chars: Vec<char> = raw.chars().collect();
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];
        if ch == '{' {
            flush_run(&mut buffer, &mut line, &current);
            let mut end = index + 1;
            let mut block = String::new();
            while end < chars.len() && chars[end] != '}' {
                block.push(chars[end]);
                end += 1;
            }
            if end < chars.len() {
                apply_tags(
                    &block,
                    &mut current,
                    base,
                    styles,
                    &mut anchor,
                    &mut explicit_position,
                    &mut drawing,
                    play_x,
                    play_y,
                    is_v4,
                );
                index = end + 1;
            } else {
                buffer.push('{');
                index += 1;
            }
            continue;
        }

        if ch == '\\' && index + 1 < chars.len() {
            match chars[index + 1] {
                'N' => {
                    flush_run(&mut buffer, &mut line, &current);
                    push_line(&mut lines, &mut line);
                    index += 2;
                }
                'n' => {
                    buffer.push(' ');
                    index += 2;
                }
                'h' => {
                    buffer.push('\u{00a0}');
                    index += 2;
                }
                '{' => {
                    buffer.push('{');
                    index += 2;
                }
                '}' => {
                    buffer.push('}');
                    index += 2;
                }
                '\\' => {
                    buffer.push('\\');
                    index += 2;
                }
                _ => {
                    buffer.push('\\');
                    buffer.push(chars[index + 1]);
                    index += 2;
                }
            }
            continue;
        }

        if !drawing {
            buffer.push(ch);
        }
        index += 1;
    }

    flush_run(&mut buffer, &mut line, &current);
    push_line(&mut lines, &mut line);

    trim_lines(&mut lines);
    if lines.is_empty() {
        return None;
    }

    let background = if base.border_style == 3 {
        Some(base.back_color.css())
    } else {
        None
    };
    Some((lines, anchor, background))
}

fn push_line(lines: &mut Vec<Vec<SubtitleTextRun>>, line: &mut Vec<SubtitleTextRun>) {
    if line.is_empty() {
        return;
    }
    lines.push(std::mem::take(line));
}

fn trim_lines(lines: &mut Vec<Vec<SubtitleTextRun>>) {
    for line in lines.iter_mut() {
        while line.first().is_some_and(|run| run.text.trim().is_empty()) {
            line.remove(0);
        }
        while line.last().is_some_and(|run| run.text.trim().is_empty()) {
            line.pop();
        }
        if let Some(first) = line.first_mut() {
            first.text = first.text.trim_start().to_string();
        }
        if let Some(last) = line.last_mut() {
            last.text = last.text.trim_end().to_string();
        }
    }
    lines.retain(|line| line.iter().any(|run| !run.text.is_empty()));
}

fn flush_run(buffer: &mut String, line: &mut Vec<SubtitleTextRun>, style: &AssStyle) {
    if buffer.is_empty() {
        return;
    }
    let text = std::mem::take(buffer);
    if text.is_empty() {
        return;
    }
    line.push(SubtitleTextRun {
        text,
        font: if style.font.is_empty() {
            None
        } else {
            Some(style.font.clone())
        },
        size: Some(style.size),
        color: Some(style.primary.css()),
        outline_color: Some(style.outline_color.css()),
        outline_width: Some(if style.border_style == 3 {
            0.0
        } else {
            style.outline
        }),
        bold: style.bold,
        italic: style.italic,
        underline: style.underline,
    });
}

#[allow(clippy::too_many_arguments)]
fn apply_tags(
    block: &str,
    current: &mut AssStyle,
    base: &AssStyle,
    styles: &HashMap<String, AssStyle>,
    anchor: &mut SubtitleAnchor,
    explicit_position: &mut bool,
    drawing: &mut bool,
    play_x: f32,
    play_y: f32,
    is_v4: bool,
) {
    for tag in split_tags(block) {
        let tag = tag.trim();
        if tag.is_empty() {
            continue;
        }
        let lower = tag.to_ascii_lowercase();

        if let Some(rest) = lower.strip_prefix("alpha") {
            if let Some(opacity) = parse_alpha(rest) {
                current.primary = current.primary.with_opacity(opacity);
                current.outline_color = current.outline_color.with_opacity(opacity);
                current.back_color = current.back_color.with_opacity(opacity);
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("1a") {
            if let Some(opacity) = parse_alpha(rest) {
                current.primary = current.primary.with_opacity(opacity);
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("3a") {
            if let Some(opacity) = parse_alpha(rest) {
                current.outline_color = current.outline_color.with_opacity(opacity);
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("4a") {
            if let Some(opacity) = parse_alpha(rest) {
                current.back_color = current.back_color.with_opacity(opacity);
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("1c") {
            if let Some(color) = parse_color(rest) {
                current.primary = color;
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("3c") {
            if let Some(color) = parse_color(rest) {
                current.outline_color = color;
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("4c") {
            if let Some(color) = parse_color(rest) {
                current.back_color = color;
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("an") {
            if let Ok(value) = rest.parse::<u8>() {
                let alignment = value.clamp(1, 9);
                anchor.alignment = alignment;
                if !*explicit_position {
                    let style_anchor = anchor_from_style(current, play_x, play_y);
                    anchor.x = style_anchor.x;
                    anchor.y = style_anchor.y;
                    anchor.max_width = style_anchor.max_width;
                }
            }
            continue;
        }
        if lower.starts_with("pos(") {
            if let Some((x, y)) = parse_two_numbers(tag) {
                anchor.x = (x / play_x * 100.0).clamp(0.0, 100.0);
                anchor.y = (y / play_y * 100.0).clamp(0.0, 100.0);
                anchor.max_width = None;
                *explicit_position = true;
            }
            continue;
        }
        if lower.starts_with("move(") {
            if let Some((x, y)) = parse_two_numbers(tag) {
                anchor.x = (x / play_x * 100.0).clamp(0.0, 100.0);
                anchor.y = (y / play_y * 100.0).clamp(0.0, 100.0);
                anchor.max_width = None;
                *explicit_position = true;
            }
            continue;
        }
        if lower.starts_with("clip(") || lower.starts_with("iclip(") || lower.starts_with("org(") {
            continue;
        }
        if lower.starts_with("fade(") || lower.starts_with("fad(") {
            continue;
        }
        if lower.starts_with("t(") {
            continue;
        }
        if lower.starts_with("kf") || lower.starts_with("ko") || lower.starts_with("k") {
            continue;
        }
        if let Some(rest) = lower.strip_prefix("bord") {
            if let Ok(value) = rest.parse::<f32>() {
                if value.is_finite() {
                    current.outline = value.max(0.0);
                }
            }
            continue;
        }
        if lower.starts_with("shad") {
            // Shadows follow the outline; the overlay renders a soft shadow only.
            continue;
        }
        if lower.starts_with("fsp") {
            continue;
        }
        if lower.starts_with("fscx") {
            continue;
        }
        if lower.starts_with("fscy") {
            continue;
        }
        if let Some(rest) = lower.strip_prefix("fs") {
            if let Some(delta) = rest.strip_prefix('+').and_then(|v| v.parse::<f32>().ok()) {
                if delta.is_finite() {
                    current.size = (current.size + delta).max(1.0);
                }
            } else if let Some(delta) = rest.strip_prefix('-').and_then(|v| v.parse::<f32>().ok()) {
                if delta.is_finite() {
                    current.size = (current.size - delta).max(1.0);
                }
            } else if let Ok(value) = rest.parse::<f32>() {
                if value.is_finite() {
                    current.size = value.max(1.0);
                }
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix("fn") {
            if let Some(font) = tag.get(tag.len().saturating_sub(rest.len())..) {
                if !font.is_empty() {
                    current.font = font.to_string();
                }
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix('c') {
            if let Some(color) = parse_color(rest) {
                current.primary = color;
            }
            continue;
        }
        if lower == "b" || lower.starts_with("b1") {
            current.bold = true;
            continue;
        }
        if lower.starts_with("b0") {
            current.bold = false;
            continue;
        }
        if lower == "i" || lower.starts_with("i1") {
            current.italic = true;
            continue;
        }
        if lower.starts_with("i0") {
            current.italic = false;
            continue;
        }
        if lower == "u" || lower.starts_with("u1") {
            current.underline = true;
            continue;
        }
        if lower.starts_with("u0") {
            current.underline = false;
            continue;
        }
        if lower.starts_with('p') {
            if let Ok(value) = lower[1..].parse::<u8>() {
                *drawing = value > 0;
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix('r') {
            if rest.is_empty() {
                *current = base.clone();
            } else {
                let name = tag.get(tag.len() - rest.len()..).unwrap_or("").trim();
                if let Some(style) = styles.get(&name.to_ascii_lowercase()) {
                    *current = style.clone();
                } else {
                    *current = base.clone();
                }
            }
            continue;
        }
        if let Some(rest) = lower.strip_prefix('a') {
            if let Ok(value) = rest.parse::<u8>() {
                let alignment = legacy_alignment(value, is_v4);
                anchor.alignment = alignment;
                if !*explicit_position {
                    let style_anchor = anchor_from_style(current, play_x, play_y);
                    anchor.x = style_anchor.x;
                    anchor.y = style_anchor.y;
                    anchor.max_width = style_anchor.max_width;
                }
            }
            continue;
        }
    }
}

fn split_tags(block: &str) -> Vec<&str> {
    let mut out = Vec::new();
    let mut start = 0usize;
    let mut depth = 0usize;
    for (index, ch) in block.char_indices() {
        match ch {
            '(' => depth += 1,
            ')' => depth = depth.saturating_sub(1),
            '\\' if depth == 0 => {
                if index > start {
                    out.push(&block[start..index]);
                }
                start = index + 1;
            }
            _ => {}
        }
    }
    if start < block.len() {
        out.push(&block[start..]);
    }
    out
}

fn anchor_from_style(style: &AssStyle, play_x: f32, play_y: f32) -> SubtitleAnchor {
    let (horizontal, vertical) = alignment_parts(style.alignment);
    let margin_l = style.margin_l.max(0.0);
    let margin_r = style.margin_r.max(0.0);
    let margin_v = style.margin_v.max(0.0);
    let x = match horizontal {
        0 => margin_l / play_x * 100.0,
        2 => 100.0 - margin_r / play_x * 100.0,
        _ => 50.0,
    };
    let y = match vertical {
        0 => 100.0 - margin_v / play_y * 100.0,
        2 => margin_v / play_y * 100.0,
        _ => 50.0,
    };
    let available = match horizontal {
        0 => 100.0 - margin_l / play_x * 100.0,
        2 => 100.0 - margin_r / play_x * 100.0,
        _ => 100.0 - (margin_l + margin_r) / play_x * 100.0,
    };
    SubtitleAnchor {
        alignment: style.alignment.clamp(1, 9),
        x: if x.is_finite() {
            x.clamp(0.0, 100.0)
        } else {
            50.0
        },
        y: if y.is_finite() {
            y.clamp(0.0, 100.0)
        } else {
            50.0
        },
        max_width: Some(if available.is_finite() {
            available.clamp(10.0, 100.0)
        } else {
            100.0
        }),
    }
}

fn alignment_parts(alignment: u8) -> (u8, u8) {
    let alignment = alignment.clamp(1, 9);
    let horizontal = (alignment - 1) % 3;
    let vertical = (alignment - 1) / 3;
    (horizontal, vertical)
}

fn normalize_alignment(value: u8, is_v4: bool) -> u8 {
    if !is_v4 {
        return value.clamp(1, 9);
    }
    match value {
        1..=3 => value,
        5..=7 => value - 4 + 6,
        9..=11 => value - 8 + 3,
        _ => 2,
    }
}

fn legacy_alignment(value: u8, _is_v4: bool) -> u8 {
    match value {
        1..=3 => value,
        5..=7 => value - 4 + 6,
        9..=11 => value - 8 + 3,
        _ => 2,
    }
}

fn parse_number(value: &str) -> Option<f32> {
    value
        .trim()
        .trim_end_matches('%')
        .parse()
        .ok()
        .filter(|value: &f32| value.is_finite())
}

fn parse_flag(value: &str) -> bool {
    value
        .trim()
        .parse::<i32>()
        .map(|number| number != 0)
        .unwrap_or(false)
}

fn parse_time(value: &str) -> Option<f64> {
    let parts: Vec<&str> = value.trim().split(':').collect();
    let (hours, minutes, seconds) = match parts.as_slice() {
        [h, m, s] => (h.parse::<f64>().ok()?, m.parse::<f64>().ok()?, *s),
        [m, s] => (0.0, m.parse::<f64>().ok()?, *s),
        [s] => (0.0, 0.0, *s),
        _ => return None,
    };
    let seconds = seconds.replace(',', ".").parse::<f64>().ok()?;
    let value = hours * 3600.0 + minutes * 60.0 + seconds;
    value.is_finite().then_some(value)
}

fn parse_two_numbers(tag: &str) -> Option<(f32, f32)> {
    let open = tag.find('(')?;
    let close = tag.rfind(')')?;
    if close <= open {
        return None;
    }
    let mut parts = tag[open + 1..close].split(',');
    let x = parts
        .next()?
        .trim()
        .parse::<f32>()
        .ok()
        .filter(|value| value.is_finite())?;
    let y = parts
        .next()?
        .trim()
        .parse::<f32>()
        .ok()
        .filter(|value| value.is_finite())?;
    Some((x, y))
}

fn parse_alpha(raw: &str) -> Option<u8> {
    let value = raw
        .trim()
        .trim_matches('&')
        .trim_start_matches("H")
        .trim_start_matches('h');
    let alpha = u8::from_str_radix(value, 16).ok()?;
    Some(255u8.saturating_sub(alpha))
}

fn parse_color(raw: &str) -> Option<Rgba> {
    let cleaned = raw
        .trim()
        .trim_matches('&')
        .trim_start_matches("H")
        .trim_start_matches('h')
        .trim_start_matches("0x")
        .trim_start_matches("0X");
    if cleaned.is_empty() {
        return None;
    }
    let value = if cleaned.chars().all(|ch| ch.is_ascii_hexdigit()) {
        u32::from_str_radix(cleaned, 16).ok()?
    } else {
        cleaned.parse::<u32>().ok()?
    };
    if value > 0x00ff_ffff {
        let ass_alpha = ((value >> 24) & 0xff) as u8;
        Some(Rgba {
            r: (value & 0xff) as u8,
            g: ((value >> 8) & 0xff) as u8,
            b: ((value >> 16) & 0xff) as u8,
            a: 255u8.saturating_sub(ass_alpha),
        })
    } else {
        Some(Rgba {
            r: (value & 0xff) as u8,
            g: ((value >> 8) & 0xff) as u8,
            b: ((value >> 16) & 0xff) as u8,
            a: 255,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::parse;

    const HEADER: &str = r#"[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,2,20,20,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:03.50,Default,,0,0,0,,Hello\Nworld
Dialogue: 0,0:00:04.00,0:00:05.00,Default,,0,0,0,,{\an8\pos(960,80)\c&H00FFFF&\b1}Sign
"#;

    #[test]
    fn parses_basic_dialogue_and_style() {
        let document = parse(HEADER);
        assert_eq!(document.cues.len(), 2);
        let cue = &document.cues[0];
        assert!((cue.start - 1.0).abs() < 0.001);
        assert!((cue.end - 3.5).abs() < 0.001);
        assert_eq!(cue.lines.len(), 2);
        assert_eq!(cue.lines[0][0].text, "Hello");
        assert_eq!(cue.lines[1][0].text, "world");
        assert_eq!(cue.font_size, Some(48.0));
        let anchor = cue.anchor.as_ref().unwrap();
        assert_eq!(anchor.alignment, 2);
        assert!((anchor.y - 96.296).abs() < 0.01);
    }

    #[test]
    fn applies_position_and_color_tags() {
        let document = parse(HEADER);
        let cue = &document.cues[1];
        let anchor = cue.anchor.as_ref().unwrap();
        assert_eq!(anchor.alignment, 8);
        assert!((anchor.x - 50.0).abs() < 0.01);
        assert!((anchor.y - 7.407).abs() < 0.01);
        let run = &cue.lines[0][0];
        assert_eq!(run.color.as_deref(), Some("rgba(255, 255, 0, 1.000)"));
        assert!(run.bold);
    }

    #[test]
    fn drops_drawing_text() {
        let document = parse(HEADER);
        let cue = &document.cues[1];
        assert_eq!(cue.lines[0][0].text, "Sign");
    }

    #[test]
    fn returns_empty_for_plain_text_without_events() {
        let document = parse("not an ass file");
        assert!(document.cues.is_empty());
        assert_eq!(document.play_res_x, 1920);
        assert_eq!(document.play_res_y, 1080);
    }

    #[test]
    fn keeps_v4_plus_numpad_alignment() {
        let script = r#"[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Top,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H64000000,0,0,0,0,100,100,0,0,1,2,0,8,20,20,20,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:02.00,Top,,0,0,0,,Top text
"#;
        let document = parse(script);
        assert_eq!(document.cues.len(), 1);
        assert_eq!(document.cues[0].anchor.as_ref().unwrap().alignment, 8);
    }
}
