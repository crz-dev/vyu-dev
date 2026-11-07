// Intl helpers for values that are locale-sensitive outside components.
import type { LocaleCode } from "./locales";

export function formatNumber(
  value: number,
  locale: LocaleCode,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
  value: Date | number,
  locale: LocaleCode,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(value);
}

export function formatList(
  values: string[],
  locale: LocaleCode,
  options?: Intl.ListFormatOptions,
): string {
  return new Intl.ListFormat(locale, options).format(values);
}
