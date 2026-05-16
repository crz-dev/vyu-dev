# Vyu

A local-first media viewer for Windows. No telemetry, no cloud, no accounts — just your files, in one window.

## About

Vyu is a lightweight alternative to Windows Photos and the built-in Media Player. It opens images, videos, audio files, and PDFs from your local disk — nothing leaves your machine. All state (timestamps, preferences, clip boundaries) stays in your browser's localStorage, scoped to your device. No network requests, ever. Works entirely offline.

## Features

- **Browse images** — JPG, PNG, GIF, WebP, BMP, SVG, AVIF, HEIC/HEIF, TIFF, PSD, JXL, and 24 RAW camera formats. Unsupported formats are decoded server-side to PNG automatically.
- **Play videos** — MP4, WebM, MKV, AVI, MOV, WMV, MPEG, TS, M2TS, M4V. TS/M2TS files are remuxed to MP4 for browser playback.
- **Listen to audio** — MP3, WAV, FLAC, OGG, AAC, WMA, M4A, Opus, AIFF, ALAC with waveform thumbnails.
- **View PDFs** — Rendered page by page with pdfjs-dist, loaded on demand.
- **Fullscreen mode** — Overlay controls that auto-hide after a moment of inactivity.
- **Zoom, pan, rotate, flip** — Scroll to zoom, drag to pan, keyboard shortcuts for rotation and flipping.
- **Image adjustments** — Brightness, contrast, saturation, and hue sliders.
- **Crop overlay** — Click-drag handles on corners and edges, with aspect ratio lock.
- **Video timeline** — Frame-accurate scrubber with timestamp markers and clip boundaries.
- **Timestamp markers** — Bookmark points in a video with optional labels. Saved per file.
- **Clip boundaries** — Mark start/end segments on a video and export them (separate files or merged).
- **A-B loop region** — Set a loop range for repeat playback.
- **Slideshow** — Configurable interval, next/shuffle order, skip-or-play-videos mode, fade/slide/none transitions.
- **Volume control** — Diamond scrubber and continuous slider mode, with keyboard shortcuts.
- **Playback speed** — Step through 0.25x–3x, with diamond and slider controls.
- **Keyboard navigation** — Arrow keys to browse, Ctrl+Arrow to jump to ends, Alt+Arrow to always navigate. Space to play/pause. F for fullscreen. Comma/period for frame stepping.
- **Context menus** — Right-click to copy image, copy video frame (as PNG), copy file path, show in explorer, view file properties, delete or trash.
- **Inline rename** — Click the filename in the title bar to rename the file on disk.
- **Thumbnail bar** — Browse sibling files in the same folder.
- **Process menu** — Convert media between formats (with presets) and compress files.
- **Media properties** — Dialog showing codec info, container, dimensions, bit depth, frame rate, and more (requires FFmpeg).
- **FFmpeg auto-install** — Detects if FFmpeg is available and offers to install it via winget.
- **Media integrity check & fix** — Detect corruption and attempt repair via FFmpeg.
- **Drag-and-drop** — Open files by dragging them onto the window.
- **Clipboard paste** — Open files copied to your clipboard.
- **Three themes** — Dark, light, and system-following, with animated transitions.
- **Custom title bar** — Drawn by the app, with window controls and the current filename.
- **Window state persistence** — Remembers position, size, and maximized state across sessions.
- **All state in localStorage** — Volume, timestamps, clips, loop mode, theme, slider mode, resume points — all survive restarts.

## Tech Stack

| Layer | Tool |
|-------|------|
| Desktop shell | Tauri 2 |
| UI framework | Svelte 5 (runes mode) |
| Meta-framework | SvelteKit (static SPA, no SSR) |
| Language | TypeScript (strict) |
| Package manager | pnpm |
| Video/image processing | FFmpeg (system PATH, not bundled) |
| PDF rendering | pdfjs-dist (code-split, dynamic import) |
| State persistence | localStorage |

## Getting Started

### Prerequisites

- **Rust toolchain** — needed to compile Tauri's native backend. Install from [rustup.rs](https://rustup.rs).
- **FFmpeg** — used for video processing, thumbnails, and format conversion. Not bundled with the app. If missing, Vyu will prompt to install it via winget.

### Install and run

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

## Project Structure

```
src/                    # Frontend (Svelte + TypeScript)
├── routes/
│   ├── +page.svelte    # Single-page app — all state and template
│   └── +layout.ts      # Disables SSR
├── lib/
│   ├── features/       # Feature modules with state files (.svelte.ts) and components
│   │   ├── media/      # File loading, playback, clips, slideshow
│   │   ├── viewer/     # Zoom, pan, rotate, fullscreen
│   │   ├── timeline/   # Timestamp markers on video scrubber
│   │   ├── editing/    # Crop overlay and image adjustments
│   │   ├── pdf/        # PDF document loading and rendering
│   │   ├── navigation/ # Thumbnail bar
│   │   ├── dialogs/    # Settings, about, help, feedback, accessibility, file properties
│   │   ├── menus/      # Edit, process, slideshow, app menus
│   │   └── theme/      # Dark/light/system theme with transitions
│   ├── services/       # Folder scanning, localStorage, clipboard, context menus
│   ├── shared/         # Constants, types, keybinds, tooltip, shell, toast
│   └── styles/         # Modular CSS (variables, layout, components, overlays)
src-tauri/              # Backend (Rust)
├── src/lib.rs          # All Tauri commands (~1750 lines)
├── tauri.conf.json     # Tauri configuration
├── Cargo.toml          # Rust dependencies
└── capabilities/       # Tauri 2 capability permissions
```

A detailed data flow reference is in [DATAFLOW.md](./DATAFLOW.md).

## Roadmap

- Multi-monitor fullscreen support
- Video rotation metadata handling
- Batch clip export queue
- SRT/subtitle overlay for videos
- Color-managed display (ICC profile support)
- Touchpad gesture navigation (swipe between files)
- Linux support
