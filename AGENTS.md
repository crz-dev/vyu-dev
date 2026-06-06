> Read `SESSION.md` before anything else. It has current state, last change, and what's next.

# Vyu — Agent Notes

Tauri 2 + Svelte 5 (runes) + TypeScript + pnpm. Windows desktop media viewer. Replaces Windows Photos. Private by architecture — no telemetry, no internet, files never leave the device.

See `ARCHITECTURE.md` for module map and where new code goes.

## Commands

| Task       | Command                   |
| ---------- | ------------------------- |
| Dev        | `pnpm tauri dev`          |
| Build      | `pnpm tauri build`        |
| Type check | `pnpm check`              |
| Format     | `pnpm prettier --write .` |

**Prereqs:** Rust toolchain + FFmpeg on PATH. Not bundled — `install_ffmpeg()` via winget when missing.

## Hard rules — read first, read last

- **State goes in `src/lib/features/*/` only.** `src/routes/+page.svelte` is a layout shell.
- **New top-level dependencies (npm, cargo) need an explicit reason stated before adding.**
- **SvelteKit routes stay as-is.** This is intentionally a single-page app.
- **FFmpeg stays external.** Backend shells out to `ffmpeg` on PATH.
- **Top-level toolbar icons stay fixed.** Shell bar design is locked.

## Conventions

- Svelte 5 runes — `$state`, `$derived`, `$effect`. No legacy `let`/`$:` reactivity.
- TypeScript strict mode. `tsconfig.json` extends `.svelte-kit/tsconfig.json`.
- No SSR — `+layout.ts` exports `ssr = false`.
- `localStorage` keys use `vyu-` prefix.
- Vite port 1420, `strictPort: true`. Window decorations disabled — app draws its own title bar.
- `IMAGE_EXTS`, `VIDEO_EXTS`, `AUDIO_EXTS`, `DOCUMENT_EXTS` in `shared/constants.ts` must stay in sync with `*_RUST` constants in `src-tauri/src/lib.rs`.
- Cache: thumbnails → `%LOCALAPPDATA%/vyu/cache/thumbnails/`, displays → `%LOCALAPPDATA%/vyu/cache/displays/`, temp → `%TEMP%/Vyu-temp/`.
- `pdfjs-dist` is dynamically imported — only loads when a PDF opens.

## Style

- No decorative ASCII section headers (`// ── ... ──`). Folder structure is the section header.
- No `// DATAFLOW:` comments. Module exports are the doc.
- No JSDoc on private helpers. Comments explain _why_, never _what_.
- No defensive null chains re-checking what an earlier guard already covered.
- Early returns over nested if/else.
- One blank line between functions. None between a function and its return.
- Imports: stdlib → third-party → `$lib/*`, single blank line between groups.
- `let` for `$state` declarations.
- No emoji or exclamation points in user-facing strings. Tone is terse.
- `console.error` only for caught-and-swallowed failures. No logging on the happy path.
- Named functions over anonymous arrows in event handlers unless the closure captures something specific.

## Backend (Rust)

All Tauri commands in `src-tauri/src/lib.rs` — known wart, will split by domain later.
Covers: thumbnails, display image prep (TIFF/PSD/JXL/RAW/HEIC → PNG), video remuxing, clip extraction, conversion, compression, crop/edit, integrity check, file ops, window state.

## Hard rules — repeated for recency

- **State goes in `src/lib/features/*/` only.**
- **New top-level dependencies need an explicit reason stated before adding.**
