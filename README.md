# Vyu

A local-first media viewer for Windows — replacement for Windows Photos.

## Philosophy

No telemetry. No cloud. No accounts. Files never leave your device.

Vyu works entirely offline. All state (timestamps, clip boundaries, preferences) lives in
localStorage scoped to your machine. No network requests are made, ever.

## Features

- View images (JPG, PNG, GIF, WebP, BMP, SVG) and videos (MP4, WebM, MKV, AVI, MOV, WMV)
- Fullscreen mode with overlay controls and auto-hiding UI
- Frame-accurate video timeline with scrubbing
- Timestamp markers — bookmark points in videos with custom labels
- Clip boundaries — mark start/end segments for export
- Keyboard-driven navigation (arrows, Ctrl+arrows to edges, Alt+arrows always navigates)
- Image adjustments — brightness, contrast, saturation, hue, rotation, flip
- Crop overlay with corner/edge handles
- Slideshow with interval, order (next/shuffle), video mode (skip/full), transitions (fade/slide)
- Volume and playback speed controls (diamond scrubber + slider modes)
- Context menus with copy frame, copy path, file properties, delete, show in explorer
- Drag-and-drop file open, paste from clipboard
- File rename inline in the title bar
- Thumbnail bar for quick navigation within a folder
- Process menu — convert and compress media via FFmpeg
- Accessibility and help dialogs with keyboard navigation
- Dark theme throughout

## Tech Stack

| Layer            | Technology                                       |
| ---------------- | ------------------------------------------------ |
| Desktop shell    | [Tauri 2](https://tauri.app)                     |
| UI framework     | [Svelte 5](https://svelte.dev) (runes mode)      |
| Meta-framework   | [SvelteKit](https://kit.svelte.dev) (static SPA) |
| Language         | TypeScript (strict)                              |
| Package manager  | pnpm                                             |
| Video processing | FFmpeg (bundled, auto-install)                   |

## Getting Started

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm tauri dev

# Build for production
pnpm tauri build
```

Requires Rust toolchain for Tauri's native backend.

## Project Structure

```
src/
├── app.css              # Global stylesheet — imports from lib/styles/
├── app.html             # HTML shell with inline reset CSS
├── app.d.ts             # Ambient type declarations (__APP_VERSION__)
├── routes/
│   ├── +layout.svelte   # Root layout — imports app.css, disables SSR
│   ├── +layout.ts       # export const ssr = false
│   └── +page.svelte     # Main page — all app state, orchestration, and template
└── lib/
    ├── shared/          # Constants, types, keybinds, Tooltip component
    │   ├── constants.ts # IMAGE_EXTS, VIDEO_EXTS, VOLUME_SEGMENTS, LOOP_MODES
    │   ├── types.ts     # CtxMenu, Timestamp, ClipBoundary, MediaProperties, etc.
    │   ├── keybinds.ts  # Keyboard shortcut handler (returns keydown closure)
    │   └── Tooltip.svelte
    ├── features/
    │   ├── viewer/      # Viewer state machine + fullscreen overlay component
    │   │   ├── viewer.svelte.ts       # Zoom, pan, rotate, flip, crop state
    │   │   └── ViewerControls.svelte  # Fullscreen overlay UI (topbar, nav, controls)
    │   ├── timeline/    # Video timeline state + marker rendering
    │   │   ├── timeline.svelte.ts        # Timestamp CRUD logic
    │   │   └── TimelineMarkers.svelte    # Rendered markers on the video scrubber
    │   ├── media/       # Media state, playback, clips, slideshow, tools
    │   │   ├── media.svelte.ts        # Core state: loadFile, navigate, closeFile
    │   │   ├── playback.svelte.ts     # Play, pause, volume, speed, progress
    │   │   ├── clips.svelte.ts        # Clip boundary pairs (start/end segments)
    │   │   ├── slideshow.svelte.ts    # Slideshow timer, order, transitions
    │   │   ├── MediaBar.svelte        # Bottom bar: file info, zoom, fullscreen, clips
    │   │   ├── PlaybackControls.svelte # Video controls: play, volume, speed, loop
    │   │   ├── mediaSources.ts        # FFprobe availability, media properties fetch
    │   │   └── mediaTools.ts          # Tauri invoke wrappers (clip, delete, convert, etc.)
    │   ├── navigation/  # Thumbnail strip for folder browsing
    │   │   └── ThumbnailBar.svelte
    │   ├── dialogs/     # Context menu, settings, about, help, feedback, accessibility
    │   │   ├── Dialog.svelte
    │   │   ├── SettingsDialog.svelte
    │   │   ├── AboutDialog.svelte
    │   │   ├── HelpDialog.svelte
    │   │   ├── FeedbackDialog.svelte
    │   │   └── AccessibilityDialog.svelte
    │   ├── menus/       # Floating menus: edit, process, slideshow, app dropdown
    │   │   ├── AppMenu.svelte
    │   │   ├── AppDropdownMenu.svelte
    │   │   ├── EditMenu.svelte
    │   │   ├── ProcessMenu.svelte
    │   │   └── SlideshowMenu.svelte
    │   └── editing/     # Image/video crop overlay
    │       └── CropOverlay.svelte
    ├── services/        # Backend-agnostic utilities
    │   ├── files.ts     # readMediaFilesInFolder, folder cache, path helpers
    │   ├── storage.ts   # localStorage wrapper (volume, timestamps, clips, prefs)
    │   ├── session.ts   # Context menu positioning, floating tooltips
    │   └── clipboard.ts # Copy image/frame/path/properties to clipboard
    └── styles/          # Modular CSS (BEM-like)
        ├── variables.css
        ├── layout.css
        ├── components.css
        ├── overlays.css
        ├── tooltips.css
        └── animations.css
```

A detailed data flow reference is available in [DATAFLOW.md](./DATAFLOW.md).

## Roadmap

- [ ] Multi-monitor fullscreen support
- [ ] RAW image format support
- [ ] Video rotation metadata handling
- [ ] Batch clip export queue
- [ ] SRT/subtitle overlay for videos
- [ ] Color-managed display (ICC profile support)
- [ ] Touchpad gesture navigation (swipe between files)
- [ ] System theme integration (light mode)
- [ ] Linux support
