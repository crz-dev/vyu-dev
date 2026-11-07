// Supported UI locales. `label` is intentionally written in the language itself
// so the picker stays readable while the UI is in another language.
export const LOCALES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "pt-BR", label: "Português" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "de", label: "Deutsch" },
  { code: "tr", label: "Türkçe" },
  { code: "ru", label: "Русский" },
  { code: "zh-CN", label: "简体中文" },
  { code: "zh-TW", label: "繁體中文" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
] as const;

export type LocaleCode = (typeof LOCALES)[number]["code"];
export type LanguagePreference = "system" | LocaleCode;

export const DEFAULT_LOCALE: LocaleCode = "en";

const LOCALE_CODES = new Set<string>(LOCALES.map((entry) => entry.code));

export function isLocaleCode(value: string): value is LocaleCode {
  return LOCALE_CODES.has(value);
}

export function isLanguagePreference(
  value: string,
): value is LanguagePreference {
  return value === "system" || isLocaleCode(value);
}

function matchLocale(tag: string): LocaleCode | null {
  const normalized = tag.replace(/_/g, "-").toLowerCase();
  const exact = LOCALES.find(
    (entry) => entry.code.toLowerCase() === normalized,
  );
  if (exact) return exact.code;

  const base = normalized.split("-")[0];
  if (base === "pt") return "pt-BR";
  if (base === "zh") {
    if (
      normalized.includes("hant") ||
      normalized === "zh-tw" ||
      normalized === "zh-hk" ||
      normalized === "zh-mo"
    ) {
      return "zh-TW";
    }
    return "zh-CN";
  }

  const byBase = LOCALES.find(
    (entry) => entry.code.toLowerCase().split("-")[0] === base,
  );
  return byBase?.code ?? null;
}

// Resolve "system" against the webview language list. The first supported
// match wins so a secondary browser language cannot override the primary one.
export function resolveLocale(preference: LanguagePreference): LocaleCode {
  if (preference !== "system") {
    return isLocaleCode(preference) ? preference : DEFAULT_LOCALE;
  }
  if (typeof navigator === "undefined") return DEFAULT_LOCALE;

  const candidates =
    navigator.languages && navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language];

  for (const candidate of candidates) {
    if (!candidate) continue;
    const match = matchLocale(candidate);
    if (match) return match;
  }
  return DEFAULT_LOCALE;
}
