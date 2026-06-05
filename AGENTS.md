# Vyu — Agent Notes

Tauri 2 + Svelte 5 (runes) + TypeScript + pnpm. Windows desktop media viewer.

See `ARCHITECTURE.md` for module ownership, state patterns, and where to put new code.

## Commands

| Task       | Command                   |
| ---------- | ------------------------- |
| Install    | `pnpm install`            |
| Dev        | `pnpm tauri dev`          |
| Build      | `pnpm tauri build`        |
| Type check | `pnpm check`              |
| Format     | `pnpm prettier --write .` |

Lint is config-only (`eslint-config-prettier`) — no rules, just disables conflicts.

**Prereqs:** Rust toolchain + FFmpeg on PATH (video processing, thumbnails, conversion). FFmpeg is not bundled; the app offers `install_ffmpeg()` via winget on Windows when missing.

## Hard rules

These are non-negotiable. If a task seems to require breaking one of them, stop and ask.

- **Do not add state, handlers, or business logic to `src/routes/+page.svelte`.** It is a layout shell. New state goes in a feature module under `src/lib/features/*/`. See `ARCHITECTURE.md` for the ownership map.
- **Do not add SvelteKit routes.** This is intentionally a single-page app.
- **Do not bundle FFmpeg.** The backend shells out to `ffmpeg` on PATH.
- **Do not add new icons in the top-level toolbar that don't already exist in the design.** The shell bar is fixed.
- **Do not introduce a new top-level dependency** (npm, cargo) without an explicit reason in the PR description.

## Conventions

- **Svelte 5 runes** — `$state`, `$derived`, `$effect`. No legacy `let`/`$:` reactivity.
- **TypeScript strict** — `tsconfig.json` extends `.svelte-kit/tsconfig.json` with `strict: true`.
- **No SSR** — `+layout.ts` exports `ssr = false`.
- **localStorage** — all user state uses `vyu-` prefix. See `ARCHITECTURE.md` for the key scheme.
- **Vite port 1420** — hardcoded in `vite.config.js` and `tauri.conf.json` with `strictPort: true`.
- **Window decorations disabled** — `decorations: false` in `tauri.conf.json`; the app draws its own title bar.
- **Asset protocol enabled** — `assetProtocol` with scope `**` in `tauri.conf.json` for local media.
- **Extension lists stay in sync** — `IMAGE_EXTS`, `VIDEO_EXTS`, `AUDIO_EXTS`, `DOCUMENT_EXTS` in `shared/constants.ts` have matching `*_RUST` constants in `src-tauri/src/lib.rs`. Same for `BROWSER_UNSUPPORTED_IMAGE_EXTS` and `REMUX_VIDEO_EXTS`.
- **Cache locations** — thumbnails at `%LOCALAPPDATA%/vyu/cache/thumbnails/`, display images at `%LOCALAPPDATA%/vyu/cache/displays/`, temp at `%TEMP%/Vyu-temp/`.
- **pdfjs-dist is dynamically imported** — only loaded when a PDF is opened (code-split). Worker is injected via `globalThis.pdfjsWorker`.

## Style

The codebase is meant to read like a careful senior wrote it, not a model. The rules below exist because each one was the result of accumulated cruft from previous AI sessions.

- No decorative `// ── ... ──` ASCII section headers in source files. The folder structure is the section header.
- No `// DATAFLOW:` or `<!-- DATAFLOW -->` flow comments in source files. The module exports are the doc.
- No JSDoc on private helpers. Comments explain _why_, never _what_.
- No defensive null chains that re-check what an earlier guard already covered.
- Prefer early returns over nested `if`/`else`.
- One blank line between functions; none between a function and its return statement.
- Imports grouped: stdlib, third-party, `$lib/*` — single blank line between groups.
- Use `let` for `$state` declarations; never mix `const x = $state(...)` with non-state declarations on adjacent lines.
- No emoji, no exclamation points in user-facing strings. Vyu's tone is terse.
- No logging on the happy path. `console.error` only for caught-and-swallowed failures.
- Prefer `===` and `!==`. Never `==` or `!=`.
- Prefer named functions over anonymous arrow functions in event handlers (`onclick={handleClick}`, not `onclick={() => doThing()}`) unless the closure captures something specific.

## Backend (Rust)

All Tauri commands currently live in `src-tauri/src/lib.rs`. This is a known wart — it will be split by domain in a later refactor. Until then:

- Thumbnail generation: video frames, image resize, audio waveform
- Display image prep: TIFF/PSD/JXL/RAW/HEIC → cached PNG
- Video remuxing: TS/M2TS → MP4
- Clip extraction, merge, export
- Media conversion (format + preset) and compression (zip)
- Crop/edit export via FFmpeg filters
- Media integrity check and fix
- File ops: delete, trash, rename, copy, backup, show in explorer
- Window state persistence
