# i18n

UI translations live in `messages/<namespace>/<locale>.json`. One folder per
feature area, one file per supported locale. English is the source of truth.
Run `pnpm check:i18n` after changing messages or translation calls.

## Using it

```svelte
<script lang="ts">
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;
</script>

<button aria-label={t("media.play")}>{t("media.play")}</button>
```

- `t(key, params?)` — lookup with English fallback and `{name}` interpolation.
- `tp(key, count, params?)` — plural lookup. Provide `_one`, `_few`, `_many`,
  `_other` variants as required by the language; `_other` is the fallback.
- `locale.current` / `locale.preference` — resolved code and saved preference.
- `locale.formatNumber` / `locale.formatDate` — locale-aware formatting.

The `.svelte.ts` store reads `$state` inside `t()`, so any template that calls
`t()` re-renders when the language changes.

## Keys

Inside `messages/settings/es.json`, the key `appearance.language.label` is used
as `t("settings.appearance.language.label")`: the folder name is the namespace
prefix and the JSON key is appended to it.

- Use `component.element` style names, e.g. `media.play`, `library.empty.title`.
- Never use English sentences as keys.
- Keep placeholders byte-identical across locales: `{count}`, `{name}`.
- Keep JSON keys sorted.
- Do not put the namespace prefix inside the JSON file.
- Brand names (Vyu, Geist, Satoshi, FFmpeg) are not translated.
- Language names in the picker stay in their own language.

## Rules

- Translate user-facing strings only. Do not translate log messages,
  `console.*`, Rust errors, CSS, class names, `data-*` values, or IDs.
- Do not translate strings used as keys/lookups (keybind IDs, section IDs,
  storage keys, media format identifiers).
- If a label is stored in a module-level constant, store the message key and
  call `t()` at render time so it follows language changes.
- Count-based messages use `tp()` and receive `{count}` automatically.
- English fallback is intentional: a missing key shows English, never a raw key.
- Add every new key to `en.json` and to all translations in the same change.

## Fonts

`<html lang>` is kept in sync with the resolved locale. `--cjk-font` in
`styles/variables.css` uses that to pick the CJK fallback per script:
JhengHei for `zh-TW`, YaHei for `zh-CN`, Yu Gothic for `ja`, Malgun for `ko`.
