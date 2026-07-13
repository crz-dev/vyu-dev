<div align="center">

# View YOUR universe (Vyu)

**A media viewer actually built for this decade — and for you.**

![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078d4)
![Status: Alpha](https://img.shields.io/badge/status-alpha-orange)
![License: Vyu Alpha](https://img.shields.io/badge/license-Vyu%20Alpha-blueviolet)

</div>

---

Vyu opens images, videos, audios, and more — with real editing, clipping, converting, and format support built in. No telemetry, no accounts, no extensions needed. Everything works out of the box and stays on your machine offline. It's the much needed replacement for Windows Photos and ancient-looking viewers.

## Features

### Images (JPG, PNG, GIF, WebP, BMP, SVG, AVIF, HEIC/HEIF, TIFF, PSD, JXL, and 20+ RAW camera formats.)

Zoom to pixel level, pan, rotate, flip. Adjust brightness, contrast, saturation, and hue with live preview. Crop with aspect-ratio presets. Full markup toolkit: draw, shapes, arrows, highlight, text. Apply edits in-place or export as a new file. Convert between formats, copy to clipboard, set as wallpaper or lock screen.

### Video (MP4, WebM, MKV, AVI, MOV, WMV, MPEG, M4V, TS, M2TS.)

Frame-accurate timeline with labelled markers, A-B loop, and clip boundaries. Extract segments individually or merged. Adjust playback speed (0.25x–3x), step frame by frame, or grab the current frame as PNG. Apply edits (rotation, flip, brightness, contrast, saturation, hue), then crop and export.

### Audio (MP3, WAV, FLAC, OGG, AAC, WMA, M4A, Opus, AIFF, ALAC.)

Two UI modes: Retro (vinyl disc) and Modern (cassette deck), with waveform scrubbing, markers, and clip boundaries. 10-band equalizer with per-file presets. Reverb, chorus, distortion, and pitch shift effects. Spatial audio modes: mono, stereo, surround, 8D. Filter presets: nightcore, lo-fi, 8-bit, radio. Four visualizers (pulse bars, spectrum curve, oscilloscope, particle diamonds) in floating windows. Cover art extraction.

### Other (PDFs, Damaged Files)

Page-by-page rendering via pdfjs-dist, only loads when you open a PDF. Zoom and pan, same controls as the image viewer. App attempts rebuilding of damaged and corrupted files.

### Across the app

- **Themes:** select dark/light themes, fonts, layouts, and animations.
- **Library:** grid, list, river, or filmstrip view. Tabs for current folder, recents, collections, and favorites. Multi-select, sort, section grouping.
- **Edit anywhere:** crop, markup, effects, and format conversion on any media type.
- **Sharing:** copy to clipboard, show in Explorer, open in external apps (Photos, Paint, VLC, Spotify, browser), print, send via Bluetooth, set as wallpaper or lock screen.
- **Slideshow:** configurable interval, shuffle, fade/slide/cut transitions.
- **Integrity check:** detect corruption and repair via FFmpeg.
- **Accessibility:** color blind mode, reduced motion, high contrast, font scaling, screen reader support.
- **Keyboard-driven:** keybind coverage. F for fullscreen, arrows to browse, space to play, etc.
- **Song identification:** identify tracks via Shazam (SongRec sidecar).
- **Privacy mode:** obscures thumbnails and file paths for streaming, disables recents.
- **Session persistence:** window position, playback resume points, last-used settings, all remembered across restarts.

---

# For developers

## Design decisions

A few choices shaped Vyu's architecture. Worth knowing before you start changing things.

**Tauri, not Electron.** Smaller binary, lower memory, direct filesystem access without bundling a second browser engine. The trade-off is a Rust toolchain on your machine.

**SvelteKit as a static SPA.** `adapter-static` with `fallback: "index.html"` — no SSR, no server, just a single-page app in the Tauri webview. Simple pipeline, fully testable in a browser.

**Svelte 5 runes, no legacy syntax.** `$state`, `$derived`, `$effect` throughout. No `let` / `$:`.

**localStorage for persistence.** All user state — volume, theme, timestamps, clip boundaries, loop mode, resume points — lives in localStorage with a `vyu-` prefix. No backend, no database. Tied to the browser profile, so wiping browser data wipes Vyu's state too. For a single-user desktop app, that's a fair trade.

**FFmpeg on PATH.** Vyu shells out to `ffmpeg` and `ffprobe` for thumbnails, remuxing, waveforms, integrity checks, conversion, and clip export. Bundling FFmpeg would bloat the installer; PATH keeps it lean. Vyu checks on startup and offers a winget install if it's missing.

**No router.** Intentionally no SvelteKit routes. All UI lives in `src/routes/+page.svelte` and `src/lib/`. Routes would add complexity with no real benefit at this scale.

**Custom title bar.** `decorations: false` in `tauri.conf.json` — Vyu draws its own so it blends with the theme and shows the filename for inline rename.

**Features live in their own modules.** Each concern — viewer, editing, playback, clips, PDF, markup, theme, file watching — is a self-contained module under `src/lib/features/`. `+page.svelte` is a layout shell that wires them together; new state and handlers belong in a feature module, not in the page.

## Tech stack

| Layer                    | Tool                                    |
| ------------------------ | --------------------------------------- |
| Desktop shell            | Tauri 2                                 |
| UI framework             | Svelte 5 (runes mode)                   |
| Meta-framework           | SvelteKit (static SPA, no SSR)          |
| Language                 | TypeScript (strict)                     |
| Package manager          | pnpm                                    |
| Video / image processing | FFmpeg (system PATH, not bundled)       |
| PDF rendering            | pdfjs-dist (code-split, dynamic import) |
| State persistence        | localStorage                            |

## Prerequisites

- **Rust toolchain** — [rustup.rs](https://rustup.rs)
- **Node.js + pnpm** — `npm install -g pnpm` or [corepack](https://nodejs.org/api/corepack.html)
- **FFmpeg** — not bundled; Vyu will offer to install via winget on first launch if missing

## Commands

| Task       | Command                   |
| ---------- | ------------------------- |
| Install    | `pnpm install`            |
| Dev        | `pnpm tauri dev`          |
| Build      | `pnpm tauri build`        |
| Type check | `pnpm check`              |
| Format     | `pnpm prettier --write .` |

Dev server is pinned to port **1420** (`strictPort: true`). Make sure it's free.

## Project structure

<pre style="background: #1e1e1e; color: #e0e0e0;">
src/                    # Frontend (Svelte + TypeScript)
├── routes/
│   ├── +page.svelte    # Layout shell — wires feature modules together
│   └── +layout.ts      # Disables SSR
├── lib/
│   ├── features/       # Feature modules: media, viewer, timeline, editing, pdf, navigation, dialogs, menus
│   ├── services/       # Folder scanning, localStorage, clipboard, context menus
│   ├── shared/         # Constants, types, keybinds, tooltip, shell, toast
│   └── styles/         # Modular CSS — variables, layout, components, overlays, animations
└── static/             # Static assets

src-tauri/              # Backend (Rust)
├── src/
│   ├── lib.rs          # run() + setup() — ~170 lines
│   ├── constants.rs    # Extension lists, magic numbers
│   ├── types.rs        # Shared structs (MediaKind, ThumbState, etc.)
│   ├── util.rs         # Helpers (run_ffmpeg, hash_path_xxh3, check_cache, etc.)
│   └── commands/       # One file per domain: thumbnail, display, editing, conversion, clips, file_ops, clipboard, integrity, external_apps
├── tauri.conf.json     # App config, file associations, bundle
├── Cargo.toml          # Rust dependencies
└── capabilities/       # Tauri 2 capability permissions
</pre>

Module ownership map lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md). Open an issue before sending a PR for anything non-trivial, follow existing patterns, keep the diff focused.

## License

Vyu is in alpha. The [Vyu Alpha License](./LICENSE) lets you read and learn from the source, but modifications, redistribution, and reuse in other projects aren't permitted yet. Moving to GPL-3.0 with the first stable release.
