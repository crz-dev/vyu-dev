import type { LocaleCode } from "./locales";

export type MessageDict = Record<string, string>;

// Every namespace is a folder of one JSON file per locale. Keeping namespaces
// separate makes translation diffs reviewable and lets features own their copy.
const modules = import.meta.glob<{ default: MessageDict }>(
  "./messages/*/*.json",
  { eager: true },
);

function buildMessages(): Partial<Record<LocaleCode, MessageDict>> {
  const result: Partial<Record<LocaleCode, MessageDict>> = {};

  for (const [path, module] of Object.entries(modules)) {
    const match = path.match(/\.\/messages\/([^/]+)\/([^/]+)\.json$/);
    if (!match) continue;
    // Layout is messages/<namespace>/<locale>.json.
    const [, namespace, locale] = match;
    const target = (result[locale as LocaleCode] ??= {});
    const values = module.default ?? {};
    for (const [key, value] of Object.entries(values)) {
      target[`${namespace}.${key}`] = value;
    }
  }

  return result;
}

export const messages = buildMessages();
