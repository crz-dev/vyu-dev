# Architecture

Frontend: `src/` — Svelte 5 runes, single-page app, no SSR, no routes beyond `+page.svelte`.

Backend: `src-tauri/src/commands/` — one module per domain.

Shared backend:

- `util.rs`
- `window_state.rs`
- `types.rs`
- `constants.rs`

`lib.rs` should remain limited to startup and wiring (`run()` + `setup()`).

## Ownership map

Before creating code, find the existing owner.

| Concern                                   | Module                                                |
| ----------------------------------------- | ----------------------------------------------------- |
| Open/close, navigate, display state       | `features/media/media.svelte.ts`                      |
| Zoom, pan, fit, fullscreen                | `features/viewer/viewer.svelte.ts`                    |
| Image/video/PDF views                     | `features/viewer/*`                                   |
| Pan, drag interaction                     | `features/viewer/panDrag.ts`                          |
| Viewer effects (resize, refit)            | `features/viewer/viewerEffects.svelte.ts`             |
| Viewer CSS styling                        | `features/viewer/viewerStyle.svelte.ts`               |
| Rotation, flip, brightness, crop, export  | `features/editing/editing.svelte.ts`                  |
| Playback                                  | `features/media/playback.svelte.ts`                   |
| Playback bridge (toggle, volume, speed)   | `features/media/playbackBridge.ts`                    |
| Playback position polling                 | `features/media/playbackPoller.svelte.ts`             |
| Playback helpers (on-ended, frame-step)   | `features/media/playbackHelpers.ts`                   |
| Timeline scrubbing                        | `features/media/scrubbing.svelte.ts`                  |
| Loop mode                                 | `features/media/loopMode.svelte.ts`                   |
| Timer display                             | `features/media/timer.svelte.ts`                      |
| Clips                                     | `features/media/clips.svelte.ts`                      |
| Slideshow                                 | `features/media/slideshow.svelte.ts`                  |
| Corruption detection                      | `features/media/corruption.svelte.ts`                 |
| FFmpeg helpers (install, ffprobe, props)  | `features/media/ffmpeg.ts`                            |
| CD color per file                         | `features/media/cdColor.ts`                           |
| Tauri invoke wrappers                     | `features/media/tools.ts`                             |
| Markers                                   | `features/markers/*`                                  |
| PDF rendering                             | `features/pdf/pdf.svelte.ts`                          |
| Drawing / markup                          | `features/markup/markup.svelte.ts`                    |
| Markup actions                            | `features/markup/markupActions.ts`                    |
| Theme                                     | `features/theme/theme.svelte.ts`                      |
| Typography                                | `features/font/font.svelte.ts`                        |
| Audio effects engine                      | `features/effects/effects-engine.ts`                  |
| Equalizer                                 | `features/equalizer/*`                                |
| Visualizer windows                        | `features/visualizer/*`                               |
| File open / delete / navigation           | `features/fileActions/*`                              |
| Clipboard paste intake                    | `features/fileActions/paste.ts`                       |
| Window controls                           | `features/window/windowControls.ts`                   |
| Context menu state                        | `features/stores/contextMenu.svelte.ts`               |
| Menu visibility state                     | `features/stores/menuVisibility.svelte.ts`            |
| Global mouse handler                      | `features/actions/globalMouseHandler.ts`              |
| Context actions                           | `features/actions/*`                                  |
| Properties actions                        | `features/actions/propertiesActions.ts`               |
| Edit/export orchestration                 | `features/edit-dialogs/*`                             |
| Dialogs                                   | `features/dialogs/*`                                  |
| Menus                                     | `features/menus/*`                                    |
| Timeline                                  | `features/timeline/*`                                 |
| Navigation / sort / folder watcher        | `features/navigation/*`                               |
| Library view                              | `features/library/*`                                  |
| Library section grouping                  | `features/library/sections.ts`                        |
| Toasts                                    | `features/toast/*`                                    |
| Filesystem scans / folder cache           | `services/files.ts`                                   |
| Storage                                   | `services/storage.ts`                                 |
| Shared thumbnail cache                    | `services/thumbnailCache.ts`                          |
| Clipboard                                 | `services/clipboard.ts`                               |
| Filename tooltip                          | `services/filenameTooltip.ts`                         |
| Session state                             | `services/session.ts`                                 |
| Database persistence (SQLite)             | `database/` (Rust), `services/database.ts` (frontend) |
| Constants                                 | `shared/constants.ts`                                 |
| Shared types                              | `shared/types.ts`                                     |
| Keybinds                                  | `shared/keybinds.ts`                                  |
| Media-kind detection                      | `shared/media-kind.ts`                                |
| Shared UI primitives                      | `shared/*.svelte`                                     |
| File metadata formatting                  | `shared/file-meta.ts`                                 |
| Privacy utilities                         | `shared/privacy.ts`                                   |
| Initialization (drag-drop, paste, resume) | `routes/init.ts`                                      |
| Collection directory operations           | `commands/collections.rs`                             |
| Sidecar binary execution (songrec)        | `commands/external_apps.rs`                           |
| Window state persistence                  | `window_state.rs`                                     |
| Thumbnail generation, cache, dedup        | `commands/thumbnail.rs`                               |

## State pattern

- App-scoped state uses singleton exports (`export const x = createX()`).
- Multiple-instance state uses factories (`export function createX()`).
- `+page.svelte` is a composition shell and owns no business logic.
- DOM elements may live in `+page.svelte`, but state belongs in feature modules.

## Communication pattern

Modules communicate through direct imports.

Rules:

- Feature modules may import from `shared/` and `services/`.
- Feature modules may import other feature modules when ownership is clear.
- Circular imports indicate a boundary problem.
- `+page.svelte` imports features. Features do not import `+page.svelte`.
- Components should communicate through their feature module rather than importing sibling feature modules directly.
- Raw Tauri `invoke()` calls belong only in approved wrapper files.

## Storage

Two persistence layers:

**SQLite** (`database/` + `services/database.ts`) — primary store for per-file metadata
(timestamps, clip boundaries, resume positions, EQ settings, CD color).
DB at `%APPDATA%/com.vyu.app/vyu.db`, WAL mode, single `Mutex<Connection>`.

**localStorage** (`services/storage.ts`) — app-wide settings, UI preferences,
collections, favorites, recent files. Keys use the `vyu-` prefix.
Per-file keys: `vyu-{kind}-{path}`. App-wide keys: `vyu-{name}`.
Storage cleanup is centralized.

## File watching

Use `watchImmediate()` with a 300ms debounce.

On change:

1. Rescan.
2. Re-sort.
3. Adjust current index if files moved or disappeared.

## Known constraints

These decisions are intentional and should not be changed without discussion.

| Constraint                                             | Reason                                               |
| ------------------------------------------------------ | ---------------------------------------------------- |
| Thumbnail cache uses `$state<Record>` instead of `Map` | Svelte proxy tracking depends on property access.    |
| `pdfjs-dist` remains dynamic                           | Keeps startup bundle smaller.                        |
| Sort-related stat uses batch IPC call                  | Eliminates per-call IPC overhead for stat.           |
| Thumbnail cache evicted at 500MB soft limit            | Prevents unbounded disk usage.                       |
| Temp dirs use hash-based subdirectories                | Prevents concurrent-operation conflicts.             |
| Cross-volume rename uses copy+delete fallback          | Required for `ERROR_NOT_SAME_DEVICE`.                |
| JPEG scale-down via `jpeg-decoder` (not `image`)       | `image` uses `zune-jpeg` which lacks IDCT scaling    |
| Dedicated semaphore pools: 16 image, 2 video, 2 audio  | Prevents fast image work from blocking behind FFmpeg |
| Atomic eviction counter (best-effort, synced on query) | Eliminates full directory scans from hot path        |
| Inflight dedup keyed by `{hash}_{size}` (no mtime)     | Allows metadata stat inside `spawn_blocking`         |
