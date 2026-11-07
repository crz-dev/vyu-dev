// Reports missing/extra translation keys, empty values, placeholder drift, and
// translation keys referenced in source that are not defined in English.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const messagesRoot = join(root, "src/lib/features/i18n/messages");
const sourceRoot = join(root, "src");
const locales = [
  "en",
  "es",
  "fr",
  "de",
  "it",
  "tr",
  "pt-BR",
  "ja",
  "zh-CN",
  "zh-TW",
  "ko",
  "ru",
];

const issues = [];
let checkedKeys = 0;
let checkedLocales = 0;

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    issues.push(`${relative(root, path)}: invalid JSON (${error.message})`);
    return {};
  }
}

function placeholders(value) {
  return [...value.matchAll(/\{(\w+)\}/g)]
    .map((match) => match[1])
    .sort()
    .join(",");
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, files);
    else files.push(path);
  }
  return files;
}

const namespaces = readdirSync(messagesRoot).filter((entry) =>
  statSync(join(messagesRoot, entry)).isDirectory(),
);

const PLURAL_SUFFIX = /^(.*)_(zero|one|two|few|many|other)$/;

function splitPlural(key) {
  const match = key.match(PLURAL_SUFFIX);
  return match
    ? { base: match[1], category: match[2] }
    : { base: key, category: null };
}

function pluralCategories(locale) {
  return new Intl.PluralRules(locale).resolvedOptions().pluralCategories;
}

const english = {};
const englishBases = {};
for (const namespace of namespaces) {
  const dict = readJson(join(messagesRoot, namespace, "en.json"));
  for (const [key, value] of Object.entries(dict)) {
    english[`${namespace}.${key}`] = value;
    const { base } = splitPlural(key);
    const fullBase = `${namespace}.${base}`;
    const current = englishBases[fullBase];
    // Prefer the "_other" form as the canonical representative.
    if (!current || key === `${base}_other` || key === base) {
      englishBases[fullBase] = value;
    }
  }
}

for (const [key, value] of Object.entries(english)) {
  const allowEmpty = key.endsWith(".suffix");
  if (!allowEmpty && (typeof value !== "string" || value.trim() === "")) {
    issues.push(`en: empty or non-string value for "${key}"`);
  }
}

for (const locale of locales) {
  checkedLocales++;
  const categories = new Set(pluralCategories(locale));
  for (const namespace of namespaces) {
    const path = join(messagesRoot, namespace, `${locale}.json`);
    if (!existsSync(path)) {
      issues.push(`${locale}: missing namespace file "${namespace}.json"`);
      continue;
    }
    const dict = readJson(path);

    for (const [fullBase, englishValue] of Object.entries(englishBases)) {
      if (!fullBase.startsWith(`${namespace}.`)) continue;
      const base = fullBase.slice(namespace.length + 1);
      const candidates = [
        base,
        `${base}_other`,
        ...[...categories].map((category) => `${base}_${category}`),
      ];
      const present = [...new Set(candidates)].filter(
        (candidate) => candidate in dict,
      );
      checkedKeys++;
      if (present.length === 0) {
        issues.push(`${locale}: missing "${fullBase}"`);
        continue;
      }
      // Compare placeholder sets against the most specific available form.
      const chosen =
        present.find((candidate) => candidate === `${base}_other`) ??
        present.find((candidate) => candidate === base) ??
        present[0];
      const value = dict[chosen];
      const allowEmpty = `${namespace}.${chosen}`.endsWith(".suffix");
      if (!allowEmpty && (typeof value !== "string" || value.trim() === "")) {
        issues.push(`${locale}: empty value for "${namespace}.${chosen}"`);
        continue;
      }
      const expected = placeholders(englishValue);
      const actual = placeholders(value);
      if (expected !== actual) {
        issues.push(
          `${locale}: placeholder mismatch for "${namespace}.${chosen}" (expected {${expected}}, got {${actual}})`,
        );
      }
    }

    for (const key of Object.keys(dict)) {
      const full = `${namespace}.${key}`;
      const { base, category } = splitPlural(key);
      const englishBase = `${namespace}.${base}`;
      const isPluralVariant = category !== null && englishBase in englishBases;
      if (!(full in english) && !isPluralVariant) {
        issues.push(`${locale}: extra key "${full}"`);
      }
    }
  }
}

// Find translation calls with literal keys. Dynamic keys are skipped.
const sourceFiles = walk(sourceRoot).filter(
  (path) => path.endsWith(".svelte") || path.endsWith(".ts"),
);
const callPattern = /(?:locale\.)?\b(t|tp)\(\s*["']([^"']+)["']/g;
const referenced = new Set();

for (const path of sourceFiles) {
  const content = readFileSync(path, "utf8");
  let match;
  while ((match = callPattern.exec(content))) {
    const [, fn, key] = match;
    if (fn === "tp") {
      const hasVariant = Object.keys(english).some((entry) =>
        entry.startsWith(`${key}_`),
      );
      if (!(key in english) && !hasVariant) {
        issues.push(`source: unknown plural key "${key}"`);
      }
      continue;
    }
    referenced.add(key);
  }
}

for (const key of referenced) {
  if (!(key in english)) {
    issues.push(`source: unknown key "${key}"`);
  }
}

if (issues.length > 0) {
  console.error(`i18n check failed with ${issues.length} issue(s):`);
  for (const issue of issues) console.error(`  - ${issue}`);
  process.exit(1);
}

console.log(
  `i18n check passed: ${Object.keys(english).length} keys, ${checkedLocales} locales, ${referenced.size} referenced keys.`,
);
