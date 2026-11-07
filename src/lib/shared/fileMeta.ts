import { locale } from "$lib/features/i18n/locale.svelte";

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
