<div align="center">

# View YOUR universe (Vyu)

**A media viewer actually built for this decade. And for you.**

![Platform: Windows](https://img.shields.io/badge/Platform-Windows-0078d4)
![Version: Dev](https://img.shields.io/badge/Version-Dev-orange)
![License: Vyu Dev](https://img.shields.io/badge/License-Vyu%20Dev-blueviolet)

</div>

---

Vyu is a free, fast Windows media viewer for all common media types: images, video, audio, and PDFs. It is meant to replace the usual mix: Windows Photos for images, VLC or mpv for video and audio, and a separate PDF reader. One app, one interface.

It covers the everyday playback workflow of VLC and mpv: broad format support, audio tracks and text subtitles, speed control, loops, queues, and an equalizer. Around that it adds a library, an editor, and Windows integrations beyond playback. There are no accounts, no telemetry, and no extensions. Local playback and editing work offline; remote media, Song ID, and the optional update check are the only features that use the network.

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

## What it does

- **Images:** zoom, pan, rotate, crop, color adjustments, markup, conversion, and wallpaper or lock-screen output.
- **Video:** timeline markers, clips, speed and frame controls, tracks, subtitles, resume, sleep timer, crop, and export.
- **Audio:** vinyl and cassette layouts, waveform scrubbing, 10-band EQ, effects, 8D modes, filter presets, and visualizers.
- **Library and playback:** grid, river, list, and filmstrip views; recents, collections, favorites, search, queue, background audio, picture-in-picture, keyboard controls, and session persistence.
- **Sharing:** clipboard, Explorer, open-in apps, print, Bluetooth, wallpaper, lock screen, and desktop shortcuts.
- **Appearance:** themes, accessibility, privacy mode, and profiles.
- **Documents and extras:** PDF rendering and markup, integrity repair with FFmpeg, and optional Song ID.

## For developers

Vyu is a Tauri 2 app. Rust handles native filesystem operations, FFmpeg, SQLite, and Windows integration. The UI is Svelte 5 and TypeScript, built as a static SvelteKit SPA and rendered in WebView2. SQLite stores per-file metadata; localStorage stores app settings. See [ARCHITECTURE.md](./ARCHITECTURE.md) for ownership and invariants, and [AGENTS.md](./AGENTS.md) for working rules.

### Requirements

- Windows with the WebView2 runtime, usually included with Windows 11 and current Windows 10.
- Rust via [rustup.rs](https://rustup.rs), plus the MSVC C++ Build Tools.
- Node.js and pnpm. The repository pins pnpm 11.17.0 through `packageManager`; corepack can install it.
- Internet and Windows `tar` or 7-Zip when FFmpeg must be fetched.
- SongRec Windows binary only if you need Song ID. Place it at `src-tauri/binaries/songrec-x86_64-pc-windows-msvc.exe`; the checked-in placeholder is not a working binary.

### Commands

| Task              | Command                                            |
| ----------------- | -------------------------------------------------- |
| Install           | `pnpm install`                                     |
| Dev               | `pnpm tauri dev`                                   |
| UI preview        | `pnpm dev`                                         |
| Frontend check    | `pnpm check`                                       |
| Translation check | `pnpm check:i18n`                                  |
| Sidecar check     | `pnpm check:sidecar`                               |
| Rust check        | `cargo check --manifest-path src-tauri/Cargo.toml` |
| Rust tests        | `cargo test --manifest-path src-tauri/Cargo.toml`  |
| Frontend build    | `pnpm build`                                       |
| Desktop build     | `pnpm tauri build`                                 |
| Format check      | `pnpm prettier --check <paths>`                    |
| Repair FFmpeg     | `pnpm ffmpeg:ensure`                               |

- `pnpm check` covers Svelte and TypeScript; `cargo check` covers Rust. `cargo test` runs Rust unit tests, and there is no frontend test runner.
- Use `pnpm build` for bundle or import changes. Reserve `pnpm tauri build` for releases.
- `pnpm format` rewrites the repository; `cargo fmt --check` is not currently clean.
- The dev server uses port 1420. `pnpm dev` previews the UI in a browser, but file and media features need the desktop runtime.

### Project layout

```text
src/          SvelteKit UI, feature modules, services, shared components, styles
src-tauri/    Rust commands, SQLite, window and system state, FFmpeg resources
```

### Working notes

- Do not edit generated output: `.svelte-kit/`, `build/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/resources/`.
- Never commit the real SongRec binary. `pnpm check:sidecar` enforces the placeholder.
- `pnpm tauri dev` uses real app data. Back up `%APPDATA%/com.vyu.desktop` and `%LOCALAPPDATA%/com.vyu.desktop` before testing destructive settings.
- User-facing text is translated through `locale.t()`. Add new keys to every locale and run `pnpm check:i18n`.

## Feedback

Please try Vyu and tell me if it covers everything you need. If something is missing or broken, I'm open to feedback.

## Contributing

Bug reports and feature requests are welcome. Code pull requests are not currently accepted; see [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

This version of Vyu is in development. The [Vyu Dev License](./LICENSE) lets you read and learn from the source, but modifications, redistribution, and reuse in other projects aren't permitted yet. Moving to GPL-3.0 with the first stable release.
