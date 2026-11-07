import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { invokeWriteFileAtomic } from "$lib/features/media/api";
import { stringToBase64 } from "$lib/shared/base64";
import {
  PROFILE_ICONS,
  sanitizeProfileSettings,
  type ProfileIcon,
  type ProfileRecord,
} from "$lib/services/storage";
import { locale } from "$lib/features/i18n/locale.svelte";

const PROFILE_FILE_FORMAT = "vyu-profile";
const PROFILE_FILE_VERSION = 1;
const MAX_PROFILE_FILE_BYTES = 2 * 1024 * 1024;

export interface ProfileFile {
  format: typeof PROFILE_FILE_FORMAT;
  version: typeof PROFILE_FILE_VERSION;
  name: string;
  color: string;
  icon: ProfileIcon;
  exportedAt: string;
  settings: Record<string, string>;
}

function profileSlug(name: string): string {
  const slug = name
    .replace(/[^\w\- ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  return slug || "profile";
}

function profileName(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, 32) : fallback;
}

function profileColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value
    : fallback;
}

function profileIcon(value: unknown): ProfileIcon {
  return typeof value === "string" &&
    PROFILE_ICONS.includes(value as ProfileIcon)
    ? (value as ProfileIcon)
    : "user";
}

export function parseProfileFile(text: string): ProfileFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(locale.t("settings.profiles.file.invalidJson"));
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(locale.t("settings.profiles.file.notVyu"));
  }

  const raw = parsed as Record<string, unknown>;
  if (
    raw.format !== PROFILE_FILE_FORMAT ||
    raw.version !== PROFILE_FILE_VERSION
  ) {
    throw new Error(locale.t("settings.profiles.file.unsupported"));
  }
  if (
    !raw.settings ||
    typeof raw.settings !== "object" ||
    Array.isArray(raw.settings)
  ) {
    throw new Error(locale.t("settings.profiles.file.missingSettings"));
  }

  return {
    format: PROFILE_FILE_FORMAT,
    version: PROFILE_FILE_VERSION,
    name: profileName(raw.name, locale.t("settings.profiles.file.defaultName")),
    color: profileColor(raw.color, "#a855f7"),
    icon: profileIcon(raw.icon),
    exportedAt:
      typeof raw.exportedAt === "string"
        ? raw.exportedAt
        : new Date().toISOString(),
    settings: sanitizeProfileSettings(raw.settings),
  };
}

export async function importProfileFile(): Promise<ProfileFile | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [
      { name: locale.t("settings.profiles.file.filter"), extensions: ["json"] },
    ],
  });
  if (!selected || Array.isArray(selected)) return null;

  const bytes = await readFile(selected);
  if (bytes.byteLength > MAX_PROFILE_FILE_BYTES) {
    throw new Error(locale.t("settings.profiles.file.tooLarge"));
  }

  const text = new TextDecoder("utf-8").decode(bytes);
  return parseProfileFile(text);
}

export async function exportProfileFile(
  profile: ProfileRecord,
  settings: Record<string, string>,
): Promise<boolean> {
  const path = await save({
    defaultPath: `vyu-settings-${profileSlug(profile.name)}.json`,
    filters: [
      { name: locale.t("settings.profiles.file.filter"), extensions: ["json"] },
    ],
  });
  if (!path) return false;

  const payload: ProfileFile = {
    format: PROFILE_FILE_FORMAT,
    version: PROFILE_FILE_VERSION,
    name: profile.name,
    color: profile.color,
    icon: profile.icon,
    exportedAt: new Date().toISOString(),
    settings,
  };

  await invokeWriteFileAtomic(
    path,
    stringToBase64(`${JSON.stringify(payload, null, 2)}\n`),
  );
  return true;
}
