import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  AUDIO_EXTS,
  DOCUMENT_EXTS,
  type SortMode,
} from "$lib/shared/constants";
import { getFileExt, getFileName } from "$lib/services/files";
import { locale } from "$lib/features/i18n/locale.svelte";
import type { BatchStatItem } from "$lib/shared/types";

const IMAGE_SET = new Set(IMAGE_EXTS);
const VIDEO_SET = new Set(VIDEO_EXTS);
const AUDIO_SET = new Set(AUDIO_EXTS);
const DOCUMENT_SET = new Set(DOCUMENT_EXTS);

// Size tiers
type Tier = "small" | "medium" | "large";

function getTier(count: number): Tier {
  if (count < 100) return "small";
  if (count <= 1000) return "medium";
  return "large";
}

// Type sort — no adaptation
const TYPE_LABELS = [
  "Images",
  "Videos",
  "Audio",
  "Documents",
  "Folders",
  "Other",
];

function extCategory(ext: string): string {
  if (IMAGE_SET.has(ext)) return "Images";
  if (VIDEO_SET.has(ext)) return "Videos";
  if (AUDIO_SET.has(ext)) return "Audio";
  if (DOCUMENT_SET.has(ext)) return "Documents";
  if (ext === "") return "Folders";
  return "Other";
}

// Name sort — adaptive alpha ranges
interface AlphaRange {
  label: string;
  test: (c: string) => boolean;
}

const NAME_RANGES: Record<Tier, AlphaRange[]> = {
  small: [
    { label: "#", test: (c) => !/[a-zA-Z]/.test(c) },
    { label: "A-F", test: (c) => c >= "a" && c <= "f" },
    { label: "G-L", test: (c) => c >= "g" && c <= "l" },
    { label: "M-R", test: (c) => c >= "m" && c <= "r" },
    { label: "S-Z", test: (c) => c >= "s" && c <= "z" },
  ],
  medium: [
    { label: "#", test: (c) => !/[a-zA-Z]/.test(c) },
    { label: "A-C", test: (c) => c >= "a" && c <= "c" },
    { label: "D-F", test: (c) => c >= "d" && c <= "f" },
    { label: "G-I", test: (c) => c >= "g" && c <= "i" },
    { label: "J-L", test: (c) => c >= "j" && c <= "l" },
    { label: "M-O", test: (c) => c >= "m" && c <= "o" },
    { label: "P-R", test: (c) => c >= "p" && c <= "r" },
    { label: "S-U", test: (c) => c >= "s" && c <= "u" },
    { label: "V-Z", test: (c) => c >= "v" && c <= "z" },
  ],
  large: [
    { label: "#", test: (c) => !/[a-zA-Z]/.test(c) },
    { label: "A", test: (c) => c === "a" },
    { label: "B", test: (c) => c === "b" },
    { label: "C", test: (c) => c === "c" },
    { label: "D", test: (c) => c === "d" },
    { label: "E", test: (c) => c === "e" },
    { label: "F", test: (c) => c === "f" },
    { label: "G", test: (c) => c === "g" },
    { label: "H", test: (c) => c === "h" },
    { label: "I", test: (c) => c === "i" },
    { label: "J", test: (c) => c === "j" },
    { label: "K", test: (c) => c === "k" },
    { label: "L", test: (c) => c === "l" },
    { label: "M", test: (c) => c === "m" },
    { label: "N", test: (c) => c === "n" },
    { label: "O", test: (c) => c === "o" },
    { label: "P", test: (c) => c === "p" },
    { label: "Q", test: (c) => c === "q" },
    { label: "R", test: (c) => c === "r" },
    { label: "S", test: (c) => c === "s" },
    { label: "T", test: (c) => c === "t" },
    { label: "U", test: (c) => c === "u" },
    { label: "V", test: (c) => c === "v" },
    { label: "W", test: (c) => c === "w" },
    { label: "X", test: (c) => c === "x" },
    { label: "Y", test: (c) => c === "y" },
    { label: "Z", test: (c) => c === "z" },
  ],
};

function alphaLabel(t: Tier, first: string): string {
  const lower = first.toLowerCase();
  for (const r of NAME_RANGES[t]) {
    if (r.test(lower)) return r.label;
  }
  return "#";
}

// Size sort — adaptive ranges
const KB = 1024;
const MB = 1024 * KB;
const GB = 1024 * MB;

interface SizeRange {
  label: string;
  test: (bytes: number) => boolean;
}

const SIZE_RANGES: Record<Tier, SizeRange[]> = {
  small: [
    { label: "Tiny (<1 MB)", test: (b) => b < MB },
    { label: "Small (1-10 MB)", test: (b) => b < 10 * MB },
    { label: "Medium (10-100 MB)", test: (b) => b < 100 * MB },
    { label: "Large (100 MB-1 GB)", test: (b) => b < GB },
    { label: "Huge (>1 GB)", test: () => true },
  ],
  medium: [
    { label: "<100 KB", test: (b) => b < 100 * KB },
    { label: "100 KB-1 MB", test: (b) => b < MB },
    { label: "1-10 MB", test: (b) => b < 10 * MB },
    { label: "10-100 MB", test: (b) => b < 100 * MB },
    { label: "100 MB-1 GB", test: (b) => b < GB },
    { label: "1-10 GB", test: (b) => b < 10 * GB },
    { label: ">10 GB", test: () => true },
  ],
  large: [
    { label: "<100 KB", test: (b) => b < 100 * KB },
    { label: "100 KB-1 MB", test: (b) => b < MB },
    { label: "1-10 MB", test: (b) => b < 10 * MB },
    { label: "10-100 MB", test: (b) => b < 100 * MB },
    { label: "100-500 MB", test: (b) => b < 500 * MB },
    { label: "500 MB-1 GB", test: (b) => b < GB },
    { label: "1-10 GB", test: (b) => b < 10 * GB },
    { label: "10-50 GB", test: (b) => b < 50 * GB },
    { label: "50-100 GB", test: (b) => b < 100 * GB },
    { label: ">100 GB", test: () => true },
  ],
};

function sizeLabel(t: Tier, bytes: number): string {
  for (const r of SIZE_RANGES[t]) {
    if (r.test(bytes)) return r.label;
  }
  return "Other";
}

// Date-modified sort — adaptive labels
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Grouping keys stay stable English identifiers so sorting and lookups do not
// depend on the active language; only the rendered labels are translated.
const TYPE_LABEL_KEYS: Record<string, string> = {
  Images: "library.sections.type.images",
  Videos: "library.sections.type.videos",
  Audio: "library.sections.type.audio",
  Documents: "library.sections.type.documents",
  Folders: "library.sections.type.folders",
  Other: "library.sections.type.other",
};

const SIZE_LABEL_KEYS: Record<string, string> = {
  "Tiny (<1 MB)": "library.sections.size.tiny",
  "Small (1-10 MB)": "library.sections.size.small",
  "Medium (10-100 MB)": "library.sections.size.medium",
  "Large (100 MB-1 GB)": "library.sections.size.large",
  "Huge (>1 GB)": "library.sections.size.huge",
  "<100 KB": "library.sections.size.lt100kb",
  "100 KB-1 MB": "library.sections.size.100kb1mb",
  "1-10 MB": "library.sections.size.1mb10mb",
  "10-100 MB": "library.sections.size.10mb100mb",
  "100 MB-1 GB": "library.sections.size.100mb1gb",
  "1-10 GB": "library.sections.size.1gb10gb",
  ">10 GB": "library.sections.size.gt10gb",
  "100-500 MB": "library.sections.size.100mb500mb",
  "500 MB-1 GB": "library.sections.size.500mb1gb",
  "10-50 GB": "library.sections.size.10gb50gb",
  "50-100 GB": "library.sections.size.50gb100gb",
  ">100 GB": "library.sections.size.gt100gb",
};

const DATE_LABEL_KEYS: Record<string, string> = {
  Today: "library.sections.date.today",
  Yesterday: "library.sections.date.yesterday",
  "This Week": "library.sections.date.thisWeek",
  "Last Week": "library.sections.date.lastWeek",
  "This Month": "library.sections.date.thisMonth",
  "Last Month": "library.sections.date.lastMonth",
  Older: "library.sections.date.older",
  Unknown: "library.sections.date.unknown",
};

const COLLECTION_LABEL_KEYS: Record<string, string> = {
  "Custom collection": "library.sections.collection.custom",
  "Linked folder": "library.sections.collection.linked",
  Other: "library.sections.type.other",
};

/** Resolve a stable grouping key to a localized section label. */
export function translateSectionLabel(label: string): string {
  const key =
    TYPE_LABEL_KEYS[label] ??
    SIZE_LABEL_KEYS[label] ??
    DATE_LABEL_KEYS[label] ??
    COLLECTION_LABEL_KEYS[label];
  if (key) return locale.t(key);
  const monthYear = label.match(/^([A-Z][a-z]+) (\d{4})$/);
  if (monthYear) {
    const monthIndex = MONTH_NAMES.indexOf(monthYear[1]);
    if (monthIndex >= 0) {
      return locale.formatDate(new Date(Number(monthYear[2]), monthIndex, 1), {
        month: "long",
        year: "numeric",
      });
    }
  }
  return label;
}

function dateGroupKey(t: Tier, ms: number, now: Date): string {
  if (!ms) return "Unknown";
  const d = new Date(ms);

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Check known labels in order from most recent to oldest
  if (d >= today) return "Today";
  if (d >= yesterday) return "Yesterday";
  if (d >= weekStart) return "This Week";
  if (t !== "small" && d >= lastWeekStart) return "Last Week";
  if (d >= monthStart) return "This Month";
  if (t !== "small" && d >= lastMonthStart) return "Last Month";

  // Large tier: group older items by month/year
  if (t === "large") {
    return `${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`;
  }

  return "Older";
}

// Section assembly
export interface Section {
  label: string;
  items: string[];
}

function buildSections(
  groups: Map<string, string[]>,
  orderedLabels: string[],
): Section[] {
  const seen = new Set<string>();
  const sections: Section[] = [];
  for (const label of orderedLabels) {
    if (seen.has(label)) continue;
    const items = groups.get(label);
    if (items && items.length > 0) {
      sections.push({ label: translateSectionLabel(label), items });
      seen.add(label);
    }
  }
  // Append any remaining groups not in the ordered list
  for (const [label, items] of groups) {
    if (!seen.has(label)) {
      sections.push({ label: translateSectionLabel(label), items });
      seen.add(label);
    }
  }
  return sections;
}

export function getSections(
  files: string[],
  sortMode: SortMode,
  stats: Record<string, BatchStatItem>,
  desc = false,
  openTimestamps?: Record<string, number>,
): Section[] {
  if (files.length === 0) return [];

  const t = getTier(files.length);
  const groups = new Map<string, string[]>();

  for (const path of files) {
    let key: string;
    if (sortMode === "type") {
      key = extCategory(getFileExt(path));
    } else if (sortMode === "name") {
      const name = getFileName(path);
      key = alphaLabel(t, name[0] || "");
    } else if (sortMode === "size") {
      const size = stats[path]?.size ?? -1;
      key = size >= 0 ? sizeLabel(t, size) : "Other";
    } else if (sortMode === "date-modified") {
      key = dateGroupKey(t, stats[path]?.mtime_ms ?? 0, new Date());
    } else if (sortMode === "date-opened") {
      const ts = openTimestamps?.[path] ?? 0;
      key = dateGroupKey(t, ts, new Date());
    } else if (sortMode === "date-created") {
      const ts = stats[path]?.birthtime_ms ?? 0;
      key = dateGroupKey(t, ts, new Date());
    } else if (sortMode === "date-favorited") {
      const ts = openTimestamps?.[path] ?? 0;
      key = dateGroupKey(t, ts, new Date());
    } else {
      key = "Other";
    }
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(path);
  }

  if (sortMode === "type") {
    const labels = desc ? [...TYPE_LABELS].reverse() : TYPE_LABELS;
    return buildSections(groups, labels);
  }
  if (sortMode === "name") {
    const labels = desc
      ? [...NAME_RANGES[t].map((r) => r.label)].reverse()
      : NAME_RANGES[t].map((r) => r.label);
    return buildSections(groups, labels);
  }
  if (sortMode === "size") {
    const labels = desc
      ? [...SIZE_RANGES[t].map((r) => r.label)].reverse()
      : SIZE_RANGES[t].map((r) => r.label);
    return buildSections(groups, labels);
  }
  if (
    sortMode === "date-modified" ||
    sortMode === "date-opened" ||
    sortMode === "date-created" ||
    sortMode === "date-favorited"
  ) {
    const knownOrder = [
      "Today",
      "Yesterday",
      "This Week",
      "Last Week",
      "This Month",
      "Last Month",
      "Older",
      "Unknown",
    ];
    const dateKeys = [...groups.keys()].sort((a, b) => {
      const ai = knownOrder.indexOf(a);
      const bi = knownOrder.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      const dateA = new Date(a).getTime();
      const dateB = new Date(b).getTime();
      if (!isNaN(dateA) && !isNaN(dateB)) return dateA - dateB;
      if (!isNaN(dateA)) return -1;
      if (!isNaN(dateB)) return 1;
      return a.localeCompare(b);
    });
    if (desc) dateKeys.reverse();
    return buildSections(groups, dateKeys);
  }
  return [];
}
