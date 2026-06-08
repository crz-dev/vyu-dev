# Architecture

Frontend: `src/` — Svelte 5 runes, single-page app, no SSR, no routes beyond `+page.svelte`.
Backend: `src-tauri/src/lib.rs` — all Tauri commands (fs, FFmpeg, thumbnails, clipboard, integrity).

## Module ownership

Find the closest existing module before creating anything new.

| Concern                                         | Module                                                                                                   |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Open/close, navigate, display state             | `features/media/media.svelte.ts`                                                                         |
| Zoom, pan, fit, fullscreen                      | `features/viewer/viewer.svelte.ts`                                                                       |
| Media view components (image, video, PDF)       | `features/viewer/ImageView.svelte`, `features/viewer/VideoView.svelte`, `features/viewer/PDFView.svelte` |
| Rotation, flip, brightness, crop, export        | `features/editing/editing.svelte.ts`                                                                     |
| Video play/pause, volume, speed, scrub          | `features/media/playback.svelte.ts`                                                                      |
| Clip boundaries, in/out points, jobs            | `features/media/clips.svelte.ts`                                                                         |
| Slideshow timer, order, transitions             | `features/media/slideshow.svelte.ts`                                                                     |
| Markers, timestamps, AB loop, resume            | `features/markers/*`                                                                                     |
| PDF rendering                                   | `features/pdf/pdf.svelte.ts`                                                                             |
| Drawing / markup strokes                        | `features/markup/markup.svelte.ts`                                                                       |
| Theme                                           | `features/theme/theme.svelte.ts`                                                                         |
| Font / typography                               | `features/font/font.svelte.ts`                                                                           |
| Filesystem scans, folder cache                  | `services/files.ts`                                                                                      |
| localStorage read/write                         | `services/storage.ts`                                                                                    |
| Clipboard copy/paste                            | `services/clipboard.ts`                                                                                  |
| Window/dialog ephemera                          | `services/session.ts`                                                                                    |
| Tauri invoke wrappers, FFmpeg orchestration     | `features/media/tools.ts`, `features/media/ffmpeg.ts`, `features/media/sources.ts`                       |
| Extension lists, loop modes, time constants     | `shared/constants.ts`                                                                                    |
| Domain types (`VideoMarker`, `ClipBoundary`, …) | `shared/types.ts`                                                                                        |
| Keybinds dispatch                               | `shared/keybinds.ts`                                                                                     |
| Toast system (store + component)                | `features/toast/toast.svelte.ts`, `shared/Toast.svelte`                                                  |
| Media-kind detection                            | `shared/media-kind.ts`                                                                                   |
| Generic primitives (Shell, Tooltip, Marquee)    | `shared/*.svelte`                                                                                        |
| Dialogs (settings, about, help, feedback, …)    | `features/dialogs/*`                                                                                     |
| Menus (edit, process, slideshow, …)             | `features/menus/*`                                                                                       |
| Timeline (markers, scrubber)                    | `features/timeline/*`                                                                                    |
| Navigation (thumbnail bar, sort menu)           | `features/navigation/*`                                                                                  |

## State pattern

Runes modules export a singleton (`export const x = createX()`) for app-scoped state, or a factory (`createX()`) when multiple instances are needed.

`+page.svelte` reads from these modules and binds DOM refs into them — it owns no state, no business logic, no handlers. Push anything you'd add there into the relevant feature module instead.

Video/audio elements live in `+page.svelte`'s template (they're DOM), but their state is mirrored into the relevant module via `mediaElRef` callback or `bind:this` setter.

## Storage

`localStorage` with `vyu-` prefix. Per-file: `vyu-{kind}-{path}`. App-wide: `vyu-{name}`. `cleanupStaleStorageEntries()` caps per-file groups at 500 entries on startup. Full key map in `services/storage.ts`.

## File watching

`watchImmediate()` from `@tauri-apps/plugin-fs` with 300ms debounce — on fire, rescans folder, re-sorts, adjusts current index if open file moved or was deleted.
