<div align="center">

# View YOUR universe (Vyu)

**A media viewer actually built for this decade. And for you.**

![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078d4)
![Version: Dev](https://img.shields.io/badge/Version-Dev-orange)
![License: Vyu Dev](https://img.shields.io/badge/License-Vyu%20Dev-blueviolet)

</div>

---

Vyu is a Windows media viewer for images, video, audio, and PDFs. It covers the everyday playback workflow of VLC: broad format support, audio tracks and text subtitles, speed control, loops, queues, and an equalizer. Around that it adds a library, an editor, and Windows integrations beyond playback.

Local playback and editing work offline. Remote media, Song ID, and the optional update check are the only features that use the network. There are no accounts, no telemetry, and no extensions.

## Supported formats

| Type      | Formats                                                                                            |
| --------- | -------------------------------------------------------------------------------------------------- |
| Images    | JPG/JPEG, PNG, GIF, WebP, BMP, SVG, AVIF, TIFF/TIF, PSD, JXL, HEIC/HEIF                            |
| RAW       | DNG, CR2, CR3, NEF, NRW, ARW, SRF, SR2, RAF, RW2, ORF, PEF, 3FR, FFF, IIQ, KDC, MEF, MOS, X3F, GPR |
| Video     | MP4, WebM, MKV, AVI, MOV, WMV, MPEG/MPG, M4V, TS, M2TS                                             |
| Audio     | MP3, WAV, FLAC, OGG, AAC, WMA, M4A, Opus, AIFF, ALAC                                               |
| Documents | PDF                                                                                                |
| Subtitles | Embedded text tracks, external SRT/WebVTT                                                          |
| Streams   | HTTP(S) media links, HLS                                                                           |

Bitmap subtitle tracks are not supported. Remote streams play in-stream; recents, resume, markers, clips, and track inspection are local-file features.

## Features

### Images

- Open images from disk, by drag and drop, from the clipboard, or from the library.
- Zoom to pixel level, pan, rotate, flip, fit, and go fullscreen.
- Adjust brightness, contrast, saturation, and hue with live preview.
- Crop with fixed ratios or custom bounds.
- Draw, highlight, add shapes, arrows, and text.
- Apply edits in place or export a copy; convert formats; copy the image or path; set as wallpaper or lock screen.

### Video

- Timeline with labelled markers, A-B loop, and clip boundaries.
- Export clips separately or merged.
- Play at 0.1x to 3x, step frame by frame, or copy the current frame.
- Select embedded audio tracks and text subtitles, or load matching and external SRT/WebVTT files.
- Adjust subtitle timing and size, resume with an optional prompt, set seek steps, and use a sleep timer.
- Rotate, flip, adjust color, crop, and export.

### Audio

- Vinyl and cassette layouts with waveform scrubbing, markers, and clip boundaries.
- 10-band EQ with per-file settings and presets.
- Reverb, chorus, distortion, and pitch shift.
- Mono, stereo, surround, and 8D modes; Nightcore, Lo-Fi, 8-Bit, and Radio filters.
- Pulse, Spectrum, Heartbeat, and Diamonds visualizers in floating windows.
- Extract cover art.

### Library and playback

- Grid, river, list, and filmstrip views.
- Tabs for the current folder, recents, collections, and favorites.
- Multi-select, sorting, search, section grouping, and folder watching.
- Queue and up-next playback, including image slideshows with configurable interval, shuffle, and transitions.
- Background audio, picture-in-picture, fullscreen, keyboard controls, sleep timer, and session persistence.

### Editing and sharing

- Image and video edits, image and PDF markup, audio effects and EQ, and conversion for supported formats.
- Copy images, frames, PDF pages, or paths; reveal in Explorer.
- Open in Photos, Paint, VLC, Spotify, or a browser; print; send via Bluetooth.
- Set as wallpaper or lock screen; create desktop shortcuts.

### Appearance and accessibility

- Dark, light, system, or OLED true black.
- Fonts, interface scale, density, reduced motion, transparency, and color-blind filters.
- Privacy mode obscures thumbnails and paths.
- Profiles keep preferences separate, with options for a shared library and shared accessibility settings.

### Documents and recovery

- PDFs render page by page through pdfjs-dist only when opened.
- Integrity tools attempt FFmpeg repair of damaged media.
- Song ID is an optional online lookup through the SongRec sidecar.

## For developers

Vyu is a Tauri 2 app. Rust handles native filesystem operations, FFmpeg, SQLite, and Windows integration. The UI is Svelte 5 and TypeScript, built as a static SvelteKit SPA and rendered in WebView2. SQLite stores per-file metadata; localStorage stores app settings.

Ownership, data flow, and invariants live in [ARCHITECTURE.md](./ARCHITECTURE.md). Working rules and verification commands live in [AGENTS.md](./AGENTS.md).

### How it is built

- Tauri 2 with the system WebView2 instead of Electron. The app stays small, but development needs a Rust toolchain.
- Svelte 5 runes and strict TypeScript. `+page.svelte` is the composition root and the only application route.
- Bundled FFmpeg handles thumbnails, remuxing, waveforms, integrity checks, conversion, and clip export. When FFmpeg is missing, the first dev or build run downloads and verifies it.
- PDF rendering and HLS playback load lazily. Startup does not pull in pdfjs-dist or hls.js.
- Feature modules own domain logic, services own shared infrastructure, and components render.

### Requirements

- Windows with the WebView2 runtime, usually included with Windows 11 and current Windows 10.
- Rust via [rustup.rs](https://rustup.rs), plus the MSVC C++ Build Tools.
- Node.js and pnpm. The repository pins pnpm 11.17.0 through `packageManager`; corepack can install it.
- Internet when FFmpeg is first fetched. The download needs Windows `tar` or 7-Zip to extract.
- SongRec Windows binary is only needed for Song ID. Place it at `src-tauri/binaries/songrec-x86_64-pc-windows-msvc.exe`; the checked-in placeholder is not a working binary.

### Commands

| Task             | Command                                            |
| ---------------- | -------------------------------------------------- |
| Install          | `pnpm install`                                     |
| Dev              | `pnpm tauri dev`                                   |
| Frontend preview | `pnpm dev`                                         |
| Frontend check   | `pnpm check`                                       |
| i18n check       | `pnpm check:i18n`                                  |
| Sidecar check    | `pnpm check:sidecar`                               |
| Rust check       | `cargo check --manifest-path src-tauri/Cargo.toml` |
| Rust tests       | `cargo test --manifest-path src-tauri/Cargo.toml`  |
| Frontend build   | `pnpm build`                                       |
| Desktop build    | `pnpm tauri build`                                 |
| Format (writes)  | `pnpm format`                                      |
| Format check     | `pnpm prettier --check <paths>`                    |
| Repair FFmpeg    | `pnpm ffmpeg:ensure`                               |

- `pnpm check` covers Svelte and TypeScript. `cargo check` covers Rust.
- `cargo test` runs Rust unit tests. There is no frontend test runner.
- Use `pnpm build` for bundle or import changes, and reserve `pnpm tauri build` for release verification.
- `pnpm format` rewrites the repository. `cargo fmt --check` is not currently clean.
- The dev server is pinned to port 1420 with `strictPort`, so free that port before starting. `pnpm dev` previews the UI in a browser, but file and media features need the desktop runtime.

### Project layout

```text
src/                    # Frontend (Svelte + TypeScript)
├── routes/             # +page.svelte (composition root), +layout, +error
├── lib/features/       # Feature modules and their UI
├── lib/services/       # Files, storage, database, clipboard, init
├── lib/shared/         # Constants, types, keybinds, helpers
├── lib/components/     # Shared UI components
└── lib/styles/         # Modular CSS

static/                 # Static assets

src-tauri/
├── src/commands/       # One module per domain
├── src/database/       # SQLite connection, models, migrations
├── src/state/          # Window and system state
├── src/{lib,constants,types,util}.rs
├── resources/          # Provisioned FFmpeg (generated)
├── binaries/           # SongRec sidecar placeholder
├── capabilities/       # Tauri permissions
├── tauri.conf.json
└── Cargo.toml
```

### Working notes

- Read `ARCHITECTURE.md` before changing ownership, persistence, or platform integration.
- Do not edit generated output: `.svelte-kit/`, `build/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/resources/`.
- Never commit the real SongRec binary. `pnpm check:sidecar` enforces the placeholder.
- `pnpm tauri dev` uses real app data. Back up `%APPDATA%/com.vyu.desktop` and `%LOCALAPPDATA%/com.vyu.desktop` before testing destructive settings.
- User-facing text is translated through `locale.t()`. Add new keys to every locale and run `pnpm check:i18n`.

## Contributing

Bug reports and feature requests are welcome. Code pull requests are not currently accepted; see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This version of Vyu is in development. The [Vyu Dev License](./LICENSE) lets you read and learn from the source, but modifications, redistribution, and reuse in other projects aren't permitted yet. Moving to GPL-3.0 with the first stable release.
