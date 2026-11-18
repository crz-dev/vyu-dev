import { locale } from "$lib/features/i18n/locale.svelte";

export function formatByteSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatMetaDate(value: unknown): string {
  if (value === null || value === undefined) return locale.t("common.unknown");
  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber)) return locale.t("common.unknown");
  const ms = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return locale.t("common.unknown");
  return d.toLocaleString(locale.current);
}

export function getMetaValue(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return (obj as Record<string, unknown>)[key];
}
