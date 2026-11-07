// Locale state — reactive UI language, translation lookup and Intl helpers.
import { loadLanguage, saveLanguage } from "$lib/services/storage";
import {
  DEFAULT_LOCALE,
  LOCALES,
  isLanguagePreference,
  resolveLocale,
  type LanguagePreference,
  type LocaleCode,
} from "./locales";
import { messages, type MessageDict } from "./messages";

export type { LanguagePreference, LocaleCode };
export { LOCALES };

export type MessageParams = Record<string, string | number>;

function interpolate(template: string, params?: MessageParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

function createLocale() {
  const stored = loadLanguage();
  const initialPreference: LanguagePreference = isLanguagePreference(stored)
    ? stored
    : "system";
  let preference = $state<LanguagePreference>(initialPreference);
  let current = $state<LocaleCode>(resolveLocale(initialPreference));

  function dictionary(locale: LocaleCode): MessageDict {
    return messages[locale] ?? {};
  }

  function applyDocumentLang() {
    if (typeof document !== "undefined") {
      document.documentElement.lang = current;
    }
  }

  function lookup(key: string): string | undefined {
    const translated = dictionary(current)[key];
    if (translated !== undefined) return translated;
    return messages[DEFAULT_LOCALE]?.[key];
  }

  // Reads `current`, so any template calling t() re-renders on language change.
  function t(key: string, params?: MessageParams): string {
    return interpolate(lookup(key) ?? key, params);
  }

  // Plural-aware lookup. Keys use suffixes (_one, _few, _many, _other) and
  // fall back to _other, then the base key, then English.
  function tp(key: string, count: number, params?: MessageParams): string {
    const category = new Intl.PluralRules(current).select(count);
    const candidates = [`${key}_${category}`, `${key}_other`, key];
    let template: string | undefined;
    for (const candidate of candidates) {
      template = lookup(candidate);
      if (template !== undefined) break;
    }
    return interpolate(template ?? key, { count, ...params });
  }

  function setLocale(next: LanguagePreference) {
    preference = next;
    current = resolveLocale(next);
    saveLanguage(next);
    applyDocumentLang();
  }

  function init() {
    applyDocumentLang();
  }

  function formatNumber(
    value: number,
    options?: Intl.NumberFormatOptions,
  ): string {
    return new Intl.NumberFormat(current, options).format(value);
  }

  function formatDate(
    value: Date | number,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    return new Intl.DateTimeFormat(current, options).format(value);
  }

  applyDocumentLang();

  return {
    get preference() {
      return preference;
    },
    get current() {
      return current;
    },
    get locale() {
      return LOCALES.find((entry) => entry.code === current) ?? LOCALES[0];
    },
    t,
    tp,
    setLocale,
    init,
    formatNumber,
    formatDate,
  };
}

export const locale = createLocale();
