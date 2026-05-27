# Vyu — Agent Notes

## Quick Commands

| Task                        | Command                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------ |
| Install deps                | `pnpm install`                                                                       |
| Dev (Tauri + SvelteKit SPA) | `pnpm tauri dev`                                                                     |
| Production build            | `pnpm tauri build`                                                                   |
| Type check                  | `pnpm check` (runs `svelte-kit sync && svelte-check`)                                |
| Format                      | `pnpm prettier --write .` (Prettier + `prettier-plugin-svelte`)                      |
| Lint                        | ESLint is config-only (`eslint-config-prettier`) — no rules, just disables conflicts |

**Prerequisites:** Rust toolchain (Tauri backend) + FFmpeg on PATH (video processing, thumbnails, format conversion). FFmpeg is **not bundled** — the app checks via `check_ffprobe()` and offers `install_ffmpeg()` (winget on Windows only).

## Architecture

**Tauri 2** desktop app with a **SvelteKit static SPA** frontend. Single-page app — `adapter-static` with `fallback: "index.html"`, no SSR.

### Two halves

| Layer                     | Location                             | Role                                                                                                   |
| ------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| Frontend (Svelte 5 runes) | `src/`                               | UI, state machines, viewer logic, all in-browser rendering                                             |
| Backend (Rust)            | `src-tauri/src/lib.rs` (~1753 lines) | Tauri commands: file I/O, FFmpeg orchestration, thumbnails, clipboard, trash, zip, media integrity/fix |

### Frontend structure

- **`src/routes/+page.svelte`** (~2416 lines) — the entire app. All state, keybinds, template.
- **`src/lib/features/`** — feature modules with `.svelte.ts` state files and `.svelte` components:
  - `viewer/` — zoom, pan, rotate, flip, crop state + fullscreen overlay
  - `timeline/` — timestamp markers on video scrubber
  - `media/` — core file loading, playback, clips, slideshow, Tauri invoke wrappers
  - `pdf/` — PDF.js document loading, per-page canvas rendering (`pdf.svelte.ts`)
  - `navigation/` — thumbnail bar
  - `dialogs/` — settings, about, help, feedback, accessibility, file properties
  - `menus/` — floating edit/process/slideshow/dropdown menus
  - `editing/` — crop overlay
- **`src/lib/services/`** — backend-agnostic utilities: file scanning, localStorage, clipboard, context menus
- **`src/lib/shared/`** — constants (4 extension lists: image/video/audio/document), types, keybinds, Tooltip
- **`src/lib/styles/`** — modular CSS (variables, layout, components, overlays, tooltips, animations)

### Supported media

| Type     | Extensions                                                                     | Notes                                                                     |
| -------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Image    | JPG, PNG, GIF, WebP, BMP, SVG, AVIF, HEIC/HEIF, TIFF, PSD, JXL, 24 RAW formats | Unsupported formats decoded via Rust `image` crate or FFmpeg → cached PNG |
| Video    | MP4, WebM, MKV, AVI, MOV, WMV, MPEG, TS, M2TS, M4V                             | TS/M2TS remuxed to MP4 via `ffmpeg -c copy` for browser playback          |
| Audio    | MP3, WAV, FLAC, OGG, AAC, WMA, M4A, Opus, AIFF, ALAC                           | Waveform thumbnails via FFmpeg                                            |
| Document | PDF                                                                            | Rendered with pdfjs-dist (dynamically imported, code-split)               |

### Backend (Rust)

All Tauri commands in `src-tauri/src/lib.rs`. Key capabilities:

- Thumbnail generation (video frames, image resize, audio waveform)
- Display image prep (decode TIFF/PSD/JXL/RAW/HEIC → cached PNG in `%LOCALAPPDATA%/vyu/cache/displays/`)
- Video remuxing (TS/M2TS → MP4)
- Clip extraction, merge, export
- Media conversion (format + preset) and compression (zip)
- Crop/edit export via FFmpeg filters
- Media integrity check and fix
- File delete, trash, rename, copy, backup, show in explorer
- Window state persistence (position/size/maximized)

## Key Conventions

- **Svelte 5 runes mode** — `$state`, `$derived`, `$effect`. No legacy `let`/`$:` syntax.
- **TypeScript strict** — `tsconfig.json` extends `.svelte-kit/tsconfig.json` with `strict: true`.
- **No SSR** — `+layout.ts` exports `ssr = false`.
- **LocalStorage persistence** — all user state uses `vyu-` prefix. Stale entries capped at 500 per group on startup. See `DATAFLOW.md` for full key map.
- **Vite port 1420** — hardcoded in `vite.config.js` and `tauri.conf.json` with `strictPort: true`. Must be available.
- **Window decorations disabled** — `decorations: false` in `tauri.conf.json`; app draws its own title bar.
- **Asset protocol enabled** — `assetProtocol` with scope `**` in `tauri.conf.json` for loading local media.

## Important Files

| File                                       | Why it matters                                                               |
| ------------------------------------------ | ---------------------------------------------------------------------------- |
| `src/routes/+page.svelte`                  | Main app entry — all state, keybinds, template                               |
| `src-tauri/src/lib.rs`                     | All Tauri `#[tauri::command]` handlers                                       |
| `src/lib/features/media/media.svelte.ts`   | Core file loading, navigation, display state                                 |
| `src/lib/features/viewer/viewer.svelte.ts` | Image/video viewer state machine                                             |
| `src/lib/features/pdf/pdf.svelte.ts`       | PDF.js loading, canvas rendering, scale control                              |
| `src/lib/services/storage.ts`              | localStorage read/write for all persisted state                              |
| `src/lib/services/files.ts`                | Folder scanning with LRU cache (max 50 folders)                              |
| `src/lib/shared/constants.ts`              | Extension lists, constants — must match `*_RUST` in `lib.rs`                 |
| `DATAFLOW.md`                              | Detailed data flow: file open, navigation, video lifecycle, localStorage map |

## Gotchas

- **Do not add SvelteKit routes** — intentionally a single-page app. All UI goes in `+page.svelte` or `src/lib/` components.
- **FFmpeg uses `Command::new("ffmpeg")`** — relies on system PATH, not bundled.
- **Extension lists must stay in sync** — `IMAGE_EXTS`, `VIDEO_EXTS`, `AUDIO_EXTS`, `DOCUMENT_EXTS` in `constants.ts` have matching `*_RUST` constants in `lib.rs`. Also `BROWSER_UNSUPPORTED_IMAGE_EXTS`, `REMUX_VIDEO_EXTS` and their Rust counterparts.
- **Thumbnail cache** — `%LOCALAPPDATA%/vyu/cache/thumbnails/`, hashed by path, invalidated by source mtime.
- **Display cache** — `%LOCALAPPDATA%/vyu/cache/displays/` as PNGs for unsupported images.
- **Temp backups** — `%TEMP%/Vyu-temp/`, cleaned on app start and close.
- **pdfjs-dist is dynamically imported** — only loaded when a PDF is opened (code-split). Worker is injected via `globalThis.pdfjsWorker`.
- **Slideshow skips PDFs** — documents are never auto-advanced in slideshow mode.
