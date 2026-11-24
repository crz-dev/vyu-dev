use crate::types::{SubtitleAnchor, SubtitleCue, SubtitleTextRun};

#[derive(Clone, Copy, Default)]
struct RunFormat {
    bold: bool,
    italic: bool,
    underline: bool,
}

pub struct VttDocument {
    pub cues: Vec<SubtitleCue>,
}

pub fn parse(text: &str) -> VttDocument {
    let text = text.strip_prefix('\u{feff}').unwrap_or(text);
    let normalized = text.replace("\r\n", "\n").replace('\r', "\n");
    let mut cues = Vec::new();

    for block in normalized.split("\n\n") {
        let block = block.trim_matches('\n');
        if block.trim().is_empty() {
            continue;
        }
        let trimmed = block.trim_start();
        if trimmed.starts_with("WEBVTT")
            || trimmed.starts_with("NOTE")
            || trimmed.starts_with("STYLE")
            || trimmed.starts_with("REGION")
        {
            continue;
        }

        let mut lines = block.lines();
        let first = lines.next().unwrap_or("");
        let (timing_line, text_start) = if first.contains("-->") {
            (first, 0)
        } else {
            match lines.next() {
                Some(next) => (next, 1),
                None => continue,
            }
        };
        let Some((start, end, settings)) = parse_timing(timing_line) else {
            continue;
        };
        let text_lines: Vec<&str> = block.lines().skip(text_start + 1).collect();
        if text_lines.is_empty() {
            continue;
        }
        let anchor = anchor_from_settings(&settings);
        let raw_text = text_lines.join("\n");
        let lines = parse_text(&raw_text);
        if lines.is_empty() {
            continue;
        }
        cues.push(SubtitleCue {
            start,
            end: end.max(start + 0.05),
            lines,
            images: Vec::new(),
            anchor,
            background: None,
            font_size: None,
        });
    }

    cues.sort_by(|a, b| a.start.total_cmp(&b.start));
    VttDocument { cues }
}

fn parse_timing(line: &str) -> Option<(f64, f64, Vec<(String, String)>)> {
    let (left, right) = line.split_once("-->")?;
    let start = parse_timestamp(left.trim())?;
    let mut parts = right.trim().split_whitespace();
    let end = parse_timestamp(parts.next()?)?;
    let mut settings = Vec::new();
    for part in parts {
        if let Some((key, value)) = part.split_once(':') {
            settings.push((key.to_ascii_lowercase(), value.to_string()));
        }
    }
    Some((start, end, settings))
}

fn parse_timestamp(value: &str) -> Option<f64> {
    let value = value.trim();
    let parts: Vec<&str> = value.split(':').collect();
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

fn anchor_from_settings(settings: &[(String, String)]) -> Option<SubtitleAnchor> {
    let mut position = None;
    let mut line = None;
    let mut size = None;
    let mut align = "center";
    for (key, value) in settings {
        match key.as_str() {
            "position" => {
                let first = value.split(',').next().unwrap_or("");
                position = first
                    .trim_end_matches('%')
                    .parse::<f32>()
                    .ok()
                    .filter(|value| value.is_finite());
            }
            "line" => {
                if let Some(percent) = value
                    .trim_end_matches('%')
                    .parse::<f32>()
                    .ok()
                    .filter(|_| value.ends_with('%'))
                    .filter(|value| value.is_finite())
                {
                    line = Some(percent);
                } else if value.starts_with('-') {
                    line = Some(95.0);
                }
            }
            "size" => {
                size = value
                    .trim_end_matches('%')
                    .parse::<f32>()
                    .ok()
                    .filter(|value| value.is_finite());
            }
            "align" => align = value.as_str(),
            _ => {}
        }
    }
    if position.is_none() && line.is_none() && size.is_none() {
        return None;
    }
    let x = position.unwrap_or(50.0).clamp(0.0, 100.0);
    let y = line.unwrap_or(88.0).clamp(0.0, 100.0);
    let horizontal = match align {
        "start" | "left" => 0,
        "end" | "right" => 2,
        _ => 1,
    };
    let vertical = if y < 33.0 {
        2
    } else if y > 66.0 {
        0
    } else {
        1
    };
    let alignment = vertical * 3 + horizontal + 1;
    Some(SubtitleAnchor {
        alignment,
        x,
        y,
        max_width: size.map(|value| value.clamp(10.0, 100.0)),
    })
}

fn parse_text(raw: &str) -> Vec<Vec<SubtitleTextRun>> {
    let mut lines: Vec<Vec<SubtitleTextRun>> = Vec::new();
    let mut line: Vec<SubtitleTextRun> = Vec::new();
    let mut buffer = String::new();
    let mut format = RunFormat::default();
    let mut skip_ruby_text = false;
    let chars: Vec<char> = raw.chars().collect();
    let mut index = 0;

    while index < chars.len() {
        let ch = chars[index];
        if ch == '<' {
            flush_run(&mut buffer, &mut line, format);
            let mut end = index + 1;
            let mut tag = String::new();
            while end < chars.len() && chars[end] != '>' {
                tag.push(chars[end]);
                end += 1;
            }
            if end >= chars.len() {
                buffer.push('<');
                index += 1;
                continue;
            }
            if tag
                .trim()
                .trim_end_matches('/')
                .trim()
                .eq_ignore_ascii_case("br")
            {
                flush_run(&mut buffer, &mut line, format);
                push_line(&mut lines, &mut line);
            } else if !apply_tag(&tag, &mut format, &mut skip_ruby_text) && !skip_ruby_text {
                buffer.push('<');
                buffer.push_str(&tag);
                buffer.push('>');
            }
            index = end + 1;
            continue;
        }

        if ch == '&' {
            if let Some((decoded, consumed)) = parse_entity(&chars[index..]) {
                if !skip_ruby_text {
                    buffer.push(decoded);
                }
                index += consumed;
                continue;
            }
        }

        if skip_ruby_text {
            index += 1;
            continue;
        }

        if ch == '\n' {
            flush_run(&mut buffer, &mut line, format);
            push_line(&mut lines, &mut line);
            index += 1;
            continue;
        }

        buffer.push(ch);
        index += 1;
    }

    flush_run(&mut buffer, &mut line, format);
    push_line(&mut lines, &mut line);
    trim_lines(&mut lines);
    lines
}

fn apply_tag(tag: &str, format: &mut RunFormat, skip_ruby_text: &mut bool) -> bool {
    let tag = tag.trim();
    let closing = tag.starts_with('/');
    let name = tag
        .trim_start_matches('/')
        .trim_end_matches('/')
        .split(|ch: char| ch.is_whitespace() || ch == '.')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    match name.as_str() {
        "b" => {
            format.bold = !closing;
            true
        }
        "i" => {
            format.italic = !closing;
            true
        }
        "u" => {
            format.underline = !closing;
            true
        }
        "br" => true,
        "rt" => {
            *skip_ruby_text = !closing;
            true
        }
        "c" | "v" | "lang" | "ruby" | "rp" | "font" | "span" => true,
        _ => false,
    }
}

fn flush_run(buffer: &mut String, line: &mut Vec<SubtitleTextRun>, format: RunFormat) {
    if buffer.is_empty() {
        return;
    }
    let text = std::mem::take(buffer);
    if text.is_empty() {
        return;
    }
    line.push(SubtitleTextRun {
        text,
        font: None,
        size: None,
        color: None,
        outline_color: None,
        outline_width: None,
        bold: format.bold,
        italic: format.italic,
        underline: format.underline,
    });
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

fn parse_entity(chars: &[char]) -> Option<(char, usize)> {
    let mut end = 1;
    while end < chars.len() && end <= 12 && chars[end] != ';' {
        end += 1;
    }
    if end >= chars.len() || chars[end] != ';' {
        return None;
    }
    let name: String = chars[1..end].iter().collect();
    let decoded = if let Some(number) = name.strip_prefix('#') {
        let value = if let Some(hex) = number
            .strip_prefix('x')
            .or_else(|| number.strip_prefix('X'))
        {
            u32::from_str_radix(hex, 16).ok()?
        } else {
            number.parse::<u32>().ok()?
        };
        char::from_u32(value)?
    } else {
        match name.as_str() {
            "amp" => '&',
            "lt" => '<',
            "gt" => '>',
            "nbsp" => '\u{00a0}',
            "quot" => '"',
            "apos" => '\'',
            _ => return None,
        }
    };
    Some((decoded, end + 1))
}

#[cfg(test)]
mod tests {
    use super::parse;

    const SAMPLE: &str = r#"WEBVTT

1
00:00:01.000 --> 00:00:03.000 align:start position:10%
<v Speaker>Hello <i>world</i> &amp; friends

2
00:00:04.000 --> 00:00:06.000 line:90%
Second <b>cue</b>
with two lines
"#;

    #[test]
    fn parses_cues_and_timing() {
        let document = parse(SAMPLE);
        assert_eq!(document.cues.len(), 2);
        assert!((document.cues[0].start - 1.0).abs() < 0.001);
        assert!((document.cues[0].end - 3.0).abs() < 0.001);
        assert_eq!(document.cues[0].lines[0][0].text, "Hello ");
        assert!(document.cues[0].lines[0][1].italic);
        assert_eq!(document.cues[0].lines[0][1].text, "world");
        assert_eq!(document.cues[0].lines[0][2].text, " & friends");
    }

    #[test]
    fn applies_position_and_lines() {
        let document = parse(SAMPLE);
        let anchor = document.cues[0].anchor.as_ref().unwrap();
        assert!((anchor.x - 10.0).abs() < 0.01);
        assert_eq!(anchor.alignment, 1);
        let second = document.cues[1].anchor.as_ref().unwrap();
        assert!((second.y - 90.0).abs() < 0.01);
        assert_eq!(second.alignment, 2);
    }

    #[test]
    fn keeps_plain_cues_without_settings() {
        let document = parse("WEBVTT\n\n00:01.000 --> 00:02.000\nplain");
        assert_eq!(document.cues.len(), 1);
        assert!(document.cues[0].anchor.is_none());
        assert_eq!(document.cues[0].lines[0][0].text, "plain");
    }
}
