// File metadata
export function formatMetaDate(value: unknown): string {
  if (value === null || value === undefined) return "Unknown";
  const asNumber = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(asNumber)) return "Unknown";
  const ms = asNumber < 10_000_000_000 ? asNumber * 1000 : asNumber;
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "Unknown";
  return d.toLocaleString();
}

export function getMetaValue(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  return (obj as Record<string, unknown>)[key];
}
