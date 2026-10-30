<div align="center">

# View YOUR universe (Vyu)

**A media viewer actually built for this decade. And for you.**

![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078d4)
![Version: Dev](https://img.shields.io/badge/Version-Dev-orange)
![License: Vyu Dev](https://img.shields.io/badge/License-Vyu%20Dev-blueviolet)

</div>

---

Vyu opens images, videos, audios, and more — with real editing, clipping, converting, and format support built in. No telemetry, no accounts, no extensions needed. Everything works out of the box and stays on your machine offline. It's the much needed replacement for Windows Photos and ancient-looking viewers.

## Features

### Images

<kbd>JPG</kbd> <kbd>PNG</kbd> <kbd>GIF</kbd> <kbd>WebP</kbd> <kbd>BMP</kbd> <kbd>SVG</kbd> <kbd>AVIF</kbd> <kbd>HEIC/HEIF</kbd> <kbd>TIFF</kbd> <kbd>PSD</kbd> <kbd>JXL</kbd> <kbd>20 RAW</kbd>

Zoom to pixel level, pan, rotate, and flip. Adjust brightness, contrast, saturation, and hue with live preview. Crop with 16:9, 9:16, 1:1, or custom bounds. Draw, highlight, add shapes, arrows, and text. Apply edits in place or export a copy; convert formats, copy images or paths, and set as wallpaper or lock screen.

### Video

<kbd>MP4</kbd> <kbd>WebM</kbd> <kbd>MKV</kbd> <kbd>AVI</kbd> <kbd>MOV</kbd> <kbd>WMV</kbd> <kbd>MPEG</kbd> <kbd>M4V</kbd> <kbd>TS</kbd> <kbd>M2TS</kbd>

Timeline with labelled markers, A-B loop, and clip boundaries. Extract clips separately or merged. Play at 0.1x–3x, step frame by frame, or copy the current frame. Resume with an optional prompt and threshold, configurable seek steps, and a sleep timer. Apply rotation, flip, brightness, contrast, saturation, and hue; crop and export.

### Audio

<kbd>MP3</kbd> <kbd>WAV</kbd> <kbd>FLAC</kbd> <kbd>OGG</kbd> <kbd>AAC</kbd> <kbd>WMA</kbd> <kbd>M4A</kbd> <kbd>Opus</kbd> <kbd>AIFF</kbd> <kbd>ALAC</kbd>

Retro vinyl and Modern cassette layouts, waveform scrubbing, markers, and clip boundaries. 10-band EQ with per-file settings and presets. Reverb, chorus, distortion, and pitch shift. Mono, stereo, surround, and 8D modes. Nightcore, Lo-Fi, 8-Bit, and Radio filters. Pulse, Spectrum, Heartbeat, and Diamonds visualizers in floating windows. Cover-art extraction.

### Across the app

- **Themes & accessibility:** dark, light, system, or OLED true black; fonts, interface scale, density, reduced motion, transparency, color-blind filters.
- **Library:** grid, river, list, or filmstrip view. Tabs for the current folder, recents, collections, and favorites. Multi-select, sorting, and section grouping.
- **Documents & recovery:** PDFs render page by page through pdfjs-dist on demand; integrity tools attempt FFmpeg repair of damaged media.
- **Editing by type:** image and video edits, image/PDF markup, audio effects and EQ, and supported-format conversion.
- **Sharing:** copy images, frames, PDF pages, or file paths; reveal in Explorer; open in Photos, Paint, VLC, Spotify, or a browser; print, send via Bluetooth, or set as wallpaper or lock screen.
- **Slideshow:** configurable interval, shuffle, and None/Fade/Slide transitions.
- **Keyboard:** F for fullscreen, arrows to browse or seek, space to play, L for the Library, and more.
- **Privacy & playback:** privacy mode obscures thumbnails and paths; background audio keeps a track playing while you browse.
- **Session persistence:** window position, playback resume points, and last-used settings.
- **Song identification:** optional online lookup through the bundled SongRec sidecar.

---

<div align="center">

# For developers

</div>

## Design decisions

**Tauri, not Electron.** Vyu uses the system WebView instead of bundling another browser engine, which keeps the app small. The trade-off is a Rust toolchain on your machine.

**SvelteKit as a static SPA.** `adapter-static` with `fallback: "index.html"` — no SSR or server, one page route plus layout/error scaffolding. The UI runs in the Tauri webview; pure UI can be previewed in a browser, but file and media features need the desktop runtime.

**Svelte 5 runes, no legacy reactivity.** `$state`, `$derived`, and `$effect` throughout. `let` is used for `$state`; avoid legacy `let`/`$:` reactivity.

**Local SQLite plus localStorage.** Per-file metadata — timestamps, clips, resume points, EQ settings, and CD color — lives in a local SQLite database at `%APPDATA%/com.vyu.desktop/vyu.db`. App settings live in localStorage under a `vyu-` prefix. There is no server or account; clearing app data resets both.

**Bundled FFmpeg.** Vyu shells out to `ffmpeg` and `ffprobe` for thumbnails, remuxing, waveforms, integrity checks, conversion, and clip export. Tauri's dev/build hooks fetch the pinned FFmpeg 9.0.1 Essentials build into `src-tauri/resources` when it is missing. Internet is needed for that first fetch; `pnpm ffmpeg:ensure` repairs it manually.

**Custom title bar.** `decorations: false` in `tauri.conf.json` — Vyu draws its own so it blends with the theme and shows the filename for inline rename.

**Features live in their own modules.** Feature modules own domain logic and state. `+page.svelte` is the composition root: it wires modules together and owns page/view state. See `ARCHITECTURE.md` before changing ownership boundaries.

## Tech stack

| Layer                    | Tool                                    |
| ------------------------ | --------------------------------------- |
| Desktop shell            | Tauri 2                                 |
| UI framework             | Svelte 5 (runes mode)                   |
| Meta-framework           | SvelteKit (static SPA, no SSR)          |
| Language                 | TypeScript (strict)                     |
| Package manager          | pnpm                                    |
| Video / image processing | FFmpeg 9.0.1 Essentials (bundled)       |
| PDF rendering            | pdfjs-dist (code-split, dynamic import) |
| Persistence              | SQLite + localStorage                   |

## Prerequisites

- **Windows** with the WebView2 runtime (usually included with Windows 11 and current Windows 10).
- **Rust** via [rustup.rs](https://rustup.rs), plus the MSVC C++ Build Tools.
- **Node.js + pnpm** — `npm install -g pnpm` or [corepack](https://nodejs.org/api/corepack.html).
- **FFmpeg** — downloaded automatically before `pnpm tauri dev` or `pnpm tauri build`. The first run needs internet and either Windows `tar` or 7-Zip to extract the archive.

## Commands

| Task            | Command                                            |
| --------------- | -------------------------------------------------- |
| Install         | `pnpm install`                                     |
| Dev             | `pnpm tauri dev`                                   |
| Build           | `pnpm tauri build`                                 |
| Frontend check  | `pnpm check`                                       |
| Rust check      | `cargo check --manifest-path src-tauri/Cargo.toml` |
| Format (writes) | `pnpm format`                                      |
| Repair FFmpeg   | `pnpm ffmpeg:ensure`                               |

`pnpm check` covers Svelte and TypeScript; `cargo check` covers Rust. `pnpm build` verifies the frontend bundle, and `cargo test --manifest-path src-tauri/Cargo.toml` runs the Rust unit tests in `util.rs`, `types.rs`, and `editing.rs`. There is no frontend test suite. For a format check without writing files, use `pnpm prettier --check <paths>`.

The dev server is pinned to port **1420** (`strictPort: true`). Make sure it is free.

## Project structure

<pre style="background: #1e1e1e; color: #e0e0e0; text-align: left; display: inline-block;">
src/                    # Frontend (Svelte + TypeScript)
├── routes/             # +page.svelte (composition root), +layout, +error
├── lib/features/       # Feature modules and their UI
├── lib/services/       # Files, storage, database, clipboard, init
├── lib/shared/         # Constants, types, keybinds, helpers
├── lib/components/     # Shared UI components
└── lib/styles/         # Modular CSS

static/                 # Static assets

src-tauri/              # Rust backend
├── src/commands/       # One module per domain
├── src/database/       # SQLite connection, models, migrations
├── src/state/          # Window state persistence
├── src/{lib,constants,types,util}.rs
├── resources/          # Provisioned FFmpeg (generated)
├── binaries/           # SongRec sidecar
├── capabilities/       # Tauri permissions
├── tauri.conf.json
└── Cargo.toml
</pre>

Module ownership lives in [ARCHITECTURE.md](./ARCHITECTURE.md).

## Contributing

Bug reports and feature requests are welcome. Code pull requests are not currently accepted; see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This version of Vyu is in development. The [Vyu Dev License](./LICENSE) lets you read and learn from the source, but modifications, redistribution, and reuse in other projects aren't permitted yet. Moving to GPL-3.0 with the first stable release.
