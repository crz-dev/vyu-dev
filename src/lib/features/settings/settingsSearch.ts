export interface SettingsSectionInfo {
  id: string;
  label: string;
  description?: string;
}

export interface SettingsSearchEntry {
  kind: "section" | "setting";
  sectionId: string;
  sectionLabel: string;
  groupLabel: string;
  label: string;
  hint: string;
  order: number;
}

export interface SettingsSearchResult extends SettingsSearchEntry {
  score: number;
}

interface SearchIndexMeta {
  normalizedLabel: string;
  normalizedHint: string;
  normalizedGroup: string;
  normalizedAliases: string;
  normalizedSection: string;
}

const SETTINGS_SEARCH_ALIASES: Record<string, string[]> = {
  theme: [
    "dark",
    "light",
    "system",
    "appearance",
    "style",
    "look",
    "color",
    "colour",
    "mode",
    "oled",
    "black",
  ],
  "oled true black": ["oled", "black", "dark", "contrast", "screen"],
  font: [
    "typeface",
    "typography",
    "text",
    "letter",
    "type",
    "family",
    "geist",
    "satoshi",
  ],
  "interface scale": [
    "zoom",
    "ui",
    "size",
    "bigger",
    "smaller",
    "scaling",
    "magnify",
  ],
  density: ["compact", "comfortable", "spacing", "tight", "loose", "layout"],
  "reduced motion": [
    "animation",
    "animations",
    "motion",
    "accessibility",
    "transitions",
  ],
  "high contrast": ["accessibility", "readability", "contrast", "visibility"],
  "file skip transition": [
    "file",
    "skip",
    "next",
    "previous",
    "transition",
    "fade",
    "slide",
    "animation",
  ],
  "transparency background": [
    "checkerboard",
    "transparent",
    "alpha",
    "png",
    "background",
    "alpha channel",
  ],
  "auto-hide cursor": ["mouse", "pointer", "cursor", "fullscreen", "idle"],

  "resume playback": [
    "continue",
    "resume",
    "remember",
    "position",
    "timestamp",
    "where",
  ],
  "resume threshold": ["threshold", "minimum", "resume", "continue", "delay"],
  "volume boost": [
    "loud",
    "louder",
    "audio",
    "sound",
    "volume",
    "amplify",
    "boost",
    "clipping",
    "mute",
    "muted",
  ],
  "remember volume": [
    "audio",
    "sound",
    "volume",
    "loudness",
    "remember",
    "last",
    "mute",
    "muted",
  ],
  "default volume": [
    "audio",
    "sound",
    "volume",
    "loudness",
    "start",
    "initial",
    "mute",
    "muted",
  ],
  "background audio in library": [
    "music",
    "audio",
    "library",
    "background",
    "continue",
  ],
  "remember speed": ["speed", "rate", "playback", "remember", "last"],
  "default speed": ["speed", "rate", "tempo", "playback", "start", "initial"],
  "seek step": [
    "seek",
    "skip",
    "arrow",
    "jump",
    "step",
    "scrub",
    "forward",
    "backward",
    "relative",
    "percentage",
    "percent",
  ],
  "relative seek": [
    "seek",
    "percentage",
    "percent",
    "duration",
    "proportional",
  ],
  "autoplay media": ["autoplay", "auto", "play", "start", "open"],
  "end of playback": ["end", "loop", "repeat", "stop", "finish", "eof"],
  "sleep timer": ["sleep", "timer", "shutdown", "after", "power"],
  "timer length": ["sleep", "timer", "duration", "minutes", "length"],

  "remember unapplied edits": ["save", "drafts", "edits", "undo", "remember"],
  "confirm before applying": ["confirm", "apply", "warning", "prompt", "save"],
  "confirm close while editing": [
    "confirm",
    "close",
    "discard",
    "warning",
    "unsaved",
  ],
  "file backups": ["backup", "backups", "safety", "undo", "restore"],
  "backup folder": ["backup", "folder", "directory", "path", "location"],
  "image format": [
    "image",
    "picture",
    "photo",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "format",
    "extension",
  ],
  "image quality": [
    "image",
    "picture",
    "photo",
    "quality",
    "compression",
    "jpeg",
    "webp",
  ],
  "image output folder": [
    "image",
    "picture",
    "photo",
    "output",
    "folder",
    "directory",
    "save",
    "destination",
  ],
  "video format": [
    "video",
    "mp4",
    "webm",
    "mkv",
    "format",
    "extension",
    "codec",
  ],
  "video quality": ["video", "quality", "compression", "bitrate", "preset"],
  "video output folder": [
    "video",
    "output",
    "folder",
    "directory",
    "save",
    "destination",
  ],
  "auto-open exports": ["open", "exports", "after", "automatic", "auto"],
  "keep original file date": [
    "date",
    "timestamp",
    "modified",
    "preserve",
    "original",
    "metadata",
  ],

  "conversion quality": [
    "convert",
    "conversion",
    "encode",
    "encoding",
    "quality",
    "codec",
    "preset",
    "compress",
  ],
  "default output folder": [
    "output",
    "folder",
    "directory",
    "destination",
    "save",
    "convert",
  ],
  "open output folder": ["open", "output", "folder", "destination", "explorer"],
  "auto-open conversions": ["auto", "open", "convert", "conversion", "after"],
  "overwrite existing": ["overwrite", "replace", "existing", "file", "clobber"],
  "delete original after conversion": [
    "delete",
    "remove",
    "original",
    "trash",
    "convert",
    "conversion",
  ],
  "delete original after clip export": [
    "delete",
    "remove",
    "original",
    "clip",
    "export",
    "trash",
  ],
  "cover art": ["cover", "art", "album", "artwork", "metadata", "thumbnail"],
  "preserve metadata": ["metadata", "tags", "exif", "preserve", "keep"],
  "gpu encoding": [
    "gpu",
    "hardware",
    "acceleration",
    "encode",
    "nvidia",
    "amd",
    "intel",
    "fast",
  ],
  ffmpeg: ["ffmpeg", "binary", "tool", "encoder", "toolchain"],

  "thumbnail size": [
    "thumbnail",
    "thumbnails",
    "preview",
    "size",
    "image",
    "resolution",
  ],
  "visible file types": [
    "file",
    "types",
    "extensions",
    "filter",
    "images",
    "video",
    "audio",
    "documents",
    "pdf",
  ],
  "show folders": ["folder", "folders", "directories", "show", "hide"],
  "show thumbnails": [
    "thumbnail",
    "thumbnails",
    "preview",
    "previews",
    "images",
    "show",
    "hide",
  ],
  "record recents": ["recent", "recents", "history", "record", "remember"],
  "recent files limit": ["recent", "history", "limit", "count", "number"],
  "remove after": [
    "recent",
    "history",
    "retention",
    "days",
    "expire",
    "remove",
    "after",
  ],
  "clear recent files": ["clear", "recent", "history", "remove"],
  "privacy mode": ["privacy", "blur", "hide", "secret", "private", "mask"],
  "blur strength": ["blur", "privacy", "strength", "amount", "intensity"],
  "hide file names": ["privacy", "hide", "names", "filename", "mask"],
  "reveal on hover": ["privacy", "hover", "reveal", "show", "names"],

  "always on top": ["top", "topmost", "overlay", "pin", "window", "float"],
  "single instance": ["instance", "multiple", "windows", "one", "duplicate"],
  "keep screen awake": ["awake", "sleep", "screen", "power", "display"],
  "pause when unfocused": [
    "focus",
    "unfocused",
    "blur",
    "pause",
    "background",
    "minimize",
  ],
  "hardware acceleration": [
    "gpu",
    "hardware",
    "acceleration",
    "performance",
    "graphics",
    "speed",
  ],
  "battery saver thumbnails": [
    "battery",
    "saver",
    "power",
    "thumbnails",
    "laptop",
    "efficiency",
  ],
  "startup view": ["startup", "launch", "open", "start", "view", "initial"],
  "default media app": [
    "default",
    "app",
    "association",
    "media",
    "windows",
    "file type",
  ],
  "explorer context menu": [
    "explorer",
    "right",
    "click",
    "context",
    "menu",
    "shell",
    "windows",
  ],
  "thumbnail limit": ["thumbnail", "cache", "limit", "size", "storage"],
  cache: ["cache", "clear", "storage", "temporary", "thumbnails"],
  "app data": [
    "data",
    "database",
    "config",
    "configuration",
    "storage",
    "folder",
  ],
  version: ["version", "update", "updates", "about", "build"],
  "check for updates on launch": [
    "update",
    "updates",
    "launch",
    "startup",
    "check",
  ],

  "file backups are off": ["backup", "warning", "risk", "safety"],
  "clear markers": ["clear", "markers", "timestamps", "reset"],
  "clear file backups": ["clear", "backups", "delete", "remove"],
  "clear temp files": ["clear", "temp", "temporary", "cache", "files"],
  "reset all settings": ["reset", "settings", "restore", "defaults", "factory"],
  "factory reset": ["factory", "reset", "wipe", "erase", "defaults"],
  "delete ffmpeg": ["delete", "ffmpeg", "remove", "binary"],
  "uninstall vyu": ["uninstall", "remove", "app", "windows"],

  "color blind mode": [
    "colour",
    "colorblind",
    "protan",
    "deutan",
    "tritan",
    "vision",
    "daltonize",
  ],
  "reduce transparency": ["opaque", "solid", "blur", "glass", "transparent"],
  "strong focus rings": ["keyboard", "outline", "focus", "accessible"],
  "bold text": ["weight", "font", "thick", "readability"],
  "text spacing": ["line", "letter", "spacing", "readability", "dyslexia"],
  "viewer background": ["canvas", "background", "black", "gray", "theme"],
  "larger viewer controls": ["player", "media", "controls", "bigger"],
  "volume limit": ["hearing", "safe", "maximum", "loud", "cap"],
  "mono audio": ["hearing", "channels", "stereo", "single", "deaf"],
  "left / right balance": ["balance", "pan", "left", "right", "stereo"],
  "volume normalization": ["loudness", "even", "compressor", "audio"],
  "reduce loud sounds": ["limiter", "peaks", "hearing", "audio", "loud"],
  "boost quiet dialogue": ["speech", "dialogue", "voice", "compressor"],
  "visual sound alerts": ["deaf", "hearing", "flash", "notification", "sound"],
  "audio cues": ["sound", "tone", "beep", "navigation", "feedback"],
  "large click targets": ["motor", "targets", "buttons", "bigger", "hitbox"],
  "larger scrollbars": ["motor", "scroll", "thumb", "size"],
  "large timeline": ["motor", "seek", "progress", "bigger", "scrub"],
  "always show controls": ["motor", "player", "controls", "persistent"],
  "keyboard shortcut sheet": ["shortcuts", "keyboard", "cheat", "reference"],
  "reduce pan sensitivity": ["motor", "drag", "pan", "sensitivity"],
  "skip delete confirmations": ["danger", "delete", "prompt", "confirmation"],
  "reduce distractions": ["focus", "declutter", "distraction", "cognitive"],
  "focus mode": ["cognitive", "focus", "minimal", "chrome"],
  "simplified menus": ["cognitive", "menu", "declutter", "simple"],
  "hide media details": ["details", "metadata", "codec", "size", "cognitive"],
  "pause on focus loss": ["focus", "unfocused", "pause", "background"],
  "library privacy blur": ["privacy", "blur", "library", "secret"],
  grayscale: ["gray", "grey", "monochrome", "color", "colour", "vision"],
  "inherit windows settings": [
    "windows",
    "system",
    "text",
    "scale",
    "contrast",
    "animations",
  ],
  "remember last tab": [
    "settings",
    "accessibility",
    "dialog",
    "tab",
    "remember",
  ],
  "hide danger zone": ["danger", "settings", "hide", "section", "zone"],
};

const SECTION_SEARCH_ALIASES: Record<string, string[]> = {
  appearance: ["look", "feel", "visual"],
  playback: ["player", "media", "sound", "audio"],
  editor: ["edit", "editing", "export", "exports"],
  process: ["convert", "conversion", "encode", "encoding", "compress"],
  library: ["files", "browse", "browser", "gallery"],
  system: ["windows", "startup", "storage", "updates"],
  keybinds: ["shortcuts", "keyboard", "hotkeys", "keys", "bindings"],
  debug: ["diagnostics", "logs", "troubleshooting", "developer"],
  "danger-zone": ["destructive", "uninstall", "reset", "wipe", "delete"],
};

export function normalizeSearchText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map(normalizeSearchText)
    .filter(Boolean);
}

function aliasesFor(label: string): string[] {
  return SETTINGS_SEARCH_ALIASES[normalizeSearchText(label)] ?? [];
}

function buildMeta(entry: SettingsSearchEntry): SearchIndexMeta {
  const aliases =
    entry.kind === "section"
      ? (SECTION_SEARCH_ALIASES[entry.sectionId] ?? [])
      : aliasesFor(entry.label);
  return {
    normalizedLabel: normalizeSearchText(entry.label),
    normalizedHint: normalizeSearchText(entry.hint),
    normalizedGroup: normalizeSearchText(entry.groupLabel),
    normalizedAliases: aliases.map(normalizeSearchText).join(" "),
    normalizedSection: normalizeSearchText(entry.sectionId),
  };
}

export function buildSettingsIndex(
  root: HTMLElement,
  sections: SettingsSectionInfo[],
  sectionPrefix = "settings",
): SettingsSearchResult[] {
  const entries: SettingsSearchEntry[] = [];
  const sectionIndex = new Map(
    sections.map((section, index) => [section.id, index]),
  );

  for (const section of sections) {
    entries.push({
      kind: "section",
      sectionId: section.id,
      sectionLabel: section.label,
      groupLabel: "",
      label: section.label,
      hint: section.description ?? "",
      order: (sectionIndex.get(section.id) ?? 0) * 1000,
    });
  }

  const sectionIdPrefix = `${sectionPrefix}-section-`;
  let docOrder = 0;
  for (const sectionEl of root.querySelectorAll<HTMLElement>(
    ".settings-section",
  )) {
    const sectionId = sectionEl.id.startsWith(sectionIdPrefix)
      ? sectionEl.id.slice(sectionIdPrefix.length)
      : "";
    const section = sections.find((candidate) => candidate.id === sectionId);
    if (!section) continue;
    const baseOrder = (sectionIndex.get(sectionId) ?? 0) * 1000;

    let groupLabel = "";
    for (const node of sectionEl.querySelectorAll<HTMLElement>(
      ".settings-group-label, [data-settings-label]",
    )) {
      if (
        node.classList.contains("settings-group-label") &&
        !node.hasAttribute("data-settings-label")
      ) {
        groupLabel = node.textContent?.trim() ?? "";
        continue;
      }
      const label = node.dataset.settingsLabel?.trim() ?? "";
      if (!label) continue;
      entries.push({
        kind: "setting",
        sectionId,
        sectionLabel: section.label,
        groupLabel,
        label,
        hint: node.dataset.settingsHint?.trim() ?? "",
        order: baseOrder + ++docOrder,
      });
    }
  }

  return entries.map((entry) => ({ ...entry, score: 0 }));
}

function scoreEntry(
  entry: SettingsSearchEntry,
  meta: SearchIndexMeta,
  tokens: string[],
  query: string,
): number {
  const combined = [
    meta.normalizedLabel,
    meta.normalizedHint,
    meta.normalizedGroup,
    meta.normalizedAliases,
    meta.normalizedSection,
  ]
    .filter(Boolean)
    .join(" ");

  if (!tokens.every((token) => combined.includes(token))) return 0;

  if (meta.normalizedLabel === query) return 100;
  if (meta.normalizedLabel.startsWith(query)) return 80;
  if (meta.normalizedLabel.includes(query)) return 60;
  if (tokens.every((token) => meta.normalizedLabel.includes(token))) return 55;
  if (meta.normalizedAliases.includes(query)) return 50;
  if (tokens.every((token) => meta.normalizedAliases.includes(token)))
    return 45;
  if (meta.normalizedHint.includes(query)) return 30;
  if (meta.normalizedGroup.includes(query)) return 20;
  return 10;
}

export function searchSettings(
  index: SettingsSearchEntry[],
  rawQuery: string,
): SettingsSearchResult[] {
  const query = normalizeSearchText(rawQuery);
  const tokens = tokenize(rawQuery);
  if (!query || tokens.length === 0) return [];

  const results: SettingsSearchResult[] = [];
  for (const entry of index) {
    const score = scoreEntry(entry, buildMeta(entry), tokens, query);
    if (score > 0) results.push({ ...entry, score });
  }

  return results.sort(
    (a, b) =>
      b.score - a.score || a.order - b.order || a.label.localeCompare(b.label),
  );
}

function rowKey(sectionId: string, label: string, hint: string): string {
  return `${sectionId}\u0000${label}\u0000${hint}`;
}

function applyRowVisibility(
  rows: HTMLElement[],
  sectionId: string,
  matchedRows: Set<string>,
): void {
  let parentMatched = false;
  for (const row of rows) {
    const isSubrow = row.classList.contains("settings-subrow");
    const label = row.dataset.settingsLabel?.trim() ?? "";
    const hint = row.dataset.settingsHint?.trim() ?? "";
    const ownMatch =
      label !== "" && matchedRows.has(rowKey(sectionId, label, hint));
    const visible = ownMatch || (isSubrow && parentMatched);
    row.classList.toggle("settings-search-hidden", !visible);
    if (!isSubrow) parentMatched = ownMatch;
  }
}

export function applySettingsSearchFilter(
  root: HTMLElement,
  results: SettingsSearchResult[],
  active = true,
  sectionPrefix = "settings",
): void {
  for (const el of root.querySelectorAll(".settings-search-hidden")) {
    el.classList.remove("settings-search-hidden");
  }
  if (!active) return;

  const matchedSections = new Set(results.map((entry) => entry.sectionId));
  const sectionsWithRows = new Set(
    results
      .filter((entry) => entry.kind === "setting")
      .map((entry) => entry.sectionId),
  );
  const matchedRows = new Set(
    results
      .filter((entry) => entry.kind === "setting")
      .map((entry) => rowKey(entry.sectionId, entry.label, entry.hint)),
  );

  const sectionIdPrefix = `${sectionPrefix}-section-`;
  for (const sectionEl of root.querySelectorAll<HTMLElement>(
    ".settings-section",
  )) {
    const sectionId = sectionEl.id.startsWith(sectionIdPrefix)
      ? sectionEl.id.slice(sectionIdPrefix.length)
      : "";
    if (!matchedSections.has(sectionId)) {
      sectionEl.classList.add("settings-search-hidden");
      continue;
    }
    if (!sectionsWithRows.has(sectionId)) continue;

    const rowsByCard = new Map<HTMLElement, HTMLElement[]>();
    const looseRows: HTMLElement[] = [];
    for (const row of sectionEl.querySelectorAll<HTMLElement>(
      ".settings-row",
    )) {
      const card = row.closest<HTMLElement>(".settings-card");
      if (card) {
        const rows = rowsByCard.get(card) ?? [];
        rows.push(row);
        rowsByCard.set(card, rows);
      } else {
        looseRows.push(row);
      }
    }

    for (const [card, rows] of rowsByCard) {
      applyRowVisibility(rows, sectionId, matchedRows);
      const hasVisibleRow = rows.some(
        (row) => !row.classList.contains("settings-search-hidden"),
      );
      card.classList.toggle("settings-search-hidden", !hasVisibleRow);
    }
    applyRowVisibility(looseRows, sectionId, matchedRows);

    for (const label of sectionEl.querySelectorAll<HTMLElement>(
      ".settings-group-label",
    )) {
      if (label.closest(".settings-card")) continue;
      const next = label.nextElementSibling;
      if (
        next instanceof HTMLElement &&
        next.classList.contains("settings-card")
      ) {
        label.classList.toggle(
          "settings-search-hidden",
          next.classList.contains("settings-search-hidden"),
        );
      }
    }
  }
}
