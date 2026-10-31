# Architecture

Authoritative reference for ownership, data flow, persistence, and non-obvious invariants. Operational rules live in `AGENTS.md`; setup and project overview live in `README.md`.

## Boundaries

- **Frontend:** `src/` — Svelte 5 runes, TypeScript strict, SvelteKit static SPA, no SSR. One page route (`+page.svelte`); `+layout` and `+error` are scaffolding only.
- **Backend:** `src-tauri/src/` — Tauri 2 + Rust, Windows-only, Win32 APIs. `lib.rs` is startup, plugin registration, command wiring, and window lifecycle only.
- **Shared backend:** `util.rs`, `types.rs`, `constants.rs`, `state/`, `database/`.
- **Privacy boundary:** the webview CSP uses `connect-src 'self'` (`tauri.conf.json`), so frontend code cannot make arbitrary network requests. The bundled SongRec sidecar and the user-initiated update check in `commands/system.rs` are the only components that make network requests; external-app and browser launches are user-initiated.

## Composition and data flow

`+page.svelte` is the composition root. It creates feature instances, owns page/view reactive state and DOM refs, and wires callbacks and derived props. It is not a stateless shell.

```text
+page.svelte
  ├─ owns page/view state, DOM refs, feature instances
  ├─ renders Shell.svelte and feature components
  ├─ calls feature modules (navigation, clips, editing actions, playback UI, ...)
  └─ feature modules
       ├─ import services (files, database, storage, clipboard)
       ├─ import shared constants/types/helpers
       └─ call Tauri wrappers (features/media/api.ts, services/database.ts, services/files.ts)
            └─ Tauri commands; fallible commands return Result<T, String>; long-running work emits progress events
```

- **Feature modules** own domain logic and feature state. Some are stateful singletons/factories; `features/media/media.svelte.ts` is a stateless factory that receives page-held state through callbacks.
- **Pages and shell** may own view state and thin event wiring; domain rules belong in feature modules.
- **Tauri wrappers** centralize IPC. `features/media/api.ts` is the main wrapper; `features/system/api.ts` owns System/OS integration IPC; `features/debug/api.ts` owns database-maintenance IPC; `services/database.ts` owns DB IPC; `services/files.ts` owns filesystem/stat IPC. Components should not call `invoke()` directly.
- **Async loads** use a generation counter in `media.svelte.ts` so stale results are ignored. Long-running commands emit events such as `conversion-progress` and `edit-apply-progress`.

## Task-to-owner lookup

| Task                            | Start with                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Settings UI / preferences       | `features/dialogs/SettingsDialog.svelte` + the owning feature store                                    |
| Keybinds                        | `features/keybinds/*`, `shared/keybinds.ts`, `features/keybinds/KeybindsSettings.svelte`               |
| System / OS integration         | `features/system/*`, `commands/system.rs`, `state/system.rs`                                           |
| Debug / diagnostics             | `features/debug/*`, `commands/system.rs`, `commands/database.rs`                                       |
| Share, save-as, conversion      | `features/dialogs/Dialog.svelte`, `features/media/conversionPrefs.svelte.ts`, `commands/conversion.rs` |
| Playback / media bar            | `features/media/playback*.ts`, `features/media/MediaBar.svelte`, `features/media/media.svelte.ts`      |
| Editing / export                | `features/editing/*`, `commands/editing.rs`                                                            |
| Clips                           | `features/media/clips.svelte.ts`, `commands/clips.rs`                                                  |
| Library                         | `features/library/*`                                                                                   |
| File open / delete / navigation | `features/file-actions/*`, `features/navigation/*`, `commands/file_ops.rs`                             |
| Persistence                     | `services/storage.ts` (prefs), `services/database.ts` (SQLite), `src-tauri/src/database/*`             |
| Thumbnails / display            | `commands/thumbnail.rs`, `commands/display.rs`, `services/thumbnailCache.ts`                           |

## Ownership map

### App shell and composition

| Concern                                   | Module                    |
| ----------------------------------------- | ------------------------- |
| Composition root, page/view state, wiring | `src/routes/+page.svelte` |
| App shell / layout                        | `components/Shell.svelte` |
| Derived prop objects for child components | `shared/pageProps.ts`     |
| Dialogs                                   | `features/dialogs/*`      |
| Menus                                     | `features/menus/*`        |
| Shared UI primitives / toast system       | `components/*`            |

### Features

| Concern                                                | Module                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| Open/close, navigate, media loading logic              | `features/media/media.svelte.ts`                                               |
| Zoom, pan, fit, fullscreen                             | `features/viewer/viewer.svelte.ts`                                             |
| Image/video/PDF views                                  | `features/viewer/*`                                                            |
| Pan, drag interaction                                  | `features/viewer/panDrag.ts`                                                   |
| Viewer effects (resize, refit)                         | `features/viewer/viewerEffects.svelte.ts`                                      |
| Viewer CSS styling                                     | `features/viewer/viewerStyle.svelte.ts`                                        |
| Rotation, flip, brightness, crop, export               | `features/editing/editing.svelte.ts`                                           |
| Edit/export orchestration                              | `features/editing/editActions.svelte.ts`                                       |
| Playback                                               | `features/media/playback.svelte.ts`                                            |
| Playback preferences                                   | `features/media/playbackPrefs.svelte.ts`                                       |
| Process / conversion preferences                       | `features/media/conversionPrefs.svelte.ts`                                     |
| Sleep timer                                            | `features/media/sleepTimer.svelte.ts`                                          |
| Background audio in Library                            | `features/media/backgroundAudio.svelte.ts`, `components/NowPlayingPill.svelte` |
| Playback bridge (toggle, volume, speed)                | `features/media/playbackBridge.ts`                                             |
| Playback position polling                              | `features/media/playbackPoller.svelte.ts`                                      |
| Playback helpers (on-ended, frame-step)                | `features/media/playbackHelpers.ts`                                            |
| Timeline scrubbing                                     | `features/media/scrubbing.svelte.ts`                                           |
| Loop mode                                              | `features/media/loopMode.svelte.ts`                                            |
| Timer display                                          | `features/media/timer.svelte.ts`                                               |
| Clips                                                  | `features/media/clips.svelte.ts`                                               |
| Media bar / clip controls                              | `features/media/MediaBar.svelte`                                               |
| Slideshow                                              | `features/media/slideshow.svelte.ts`                                           |
| Corruption detection                                   | `features/media/corruption.svelte.ts`                                          |
| FFmpeg helpers (install, ffprobe, props)               | `features/media/ffmpeg.ts`                                                     |
| CD color per file                                      | `features/media/cdColor.ts`                                                    |
| Tauri invoke wrappers                                  | `features/media/api.ts`                                                        |
| Markers / timeline helpers                             | `features/markers/*`                                                           |
| Timeline                                               | `components/TimelineMarkers.svelte`, `markers/timeline.ts`                     |
| PDF rendering                                          | `features/viewer/pdf.svelte.ts`                                                |
| Drawing / markup                                       | `features/markup/markup.svelte.ts`                                             |
| Markup actions                                         | `features/markup/markupActions.ts`                                             |
| Theme / typography                                     | `features/theme/theme.svelte.ts`                                               |
| Interface scale, density, reduced motion, transparency | `features/theme/appearance.svelte.ts`                                          |
| Accessibility                                          | `features/menus/accessibility.svelte.ts`                                       |
| Audio effects engine                                   | `features/effects/effects-engine.ts`                                           |
| Equalizer                                              | `features/equalizer/*`                                                         |
| Visualizer windows                                     | `features/visualizer/*`                                                        |
| File open / delete / navigation                        | `features/file-actions/*`                                                      |
| Clipboard paste intake                                 | `features/file-actions/paste.ts`                                               |
| Navigation / sort / folder watcher                     | `features/navigation/*`                                                        |
| Library view                                           | `features/library/*`                                                           |
| Library section grouping                               | `features/library/sections.ts`                                                 |
| Window controls                                        | `features/menus/windowControls.ts`                                             |
| Context menu state                                     | `features/menus/contextMenu.svelte.ts`                                         |
| Menu visibility state                                  | `features/menus/menuVisibility.svelte.ts`                                      |
| Global mouse handler                                   | `features/actions/globalMouseHandler.ts`                                       |
| Context actions                                        | `features/actions/*`                                                           |
| Properties actions                                     | `features/actions/propertiesActions.ts`                                        |
| System settings                                        | `features/system/SystemSettings.svelte`                                        |
| Debug settings / diagnostics                           | `features/debug/DebugSettings.svelte`, `features/debug/debugInfo.ts`           |
| Debug overlay                                          | `features/debug/DebugOverlay.svelte`, `features/debug/debugPrefs.svelte.ts`    |

### Services and shared

| Concern                                   | Module                                       |
| ----------------------------------------- | -------------------------------------------- |
| Filesystem scans / folder cache           | `services/files.ts`                          |
| localStorage preferences                  | `services/storage.ts`                        |
| SQLite frontend wrappers / migration      | `services/database.ts`                       |
| Shared in-memory thumbnail cache          | `services/thumbnailCache.ts`                 |
| Thumbnail generation indicator            | `components/ThumbnailGenToast.svelte`        |
| Clipboard                                 | `services/clipboard.ts`                      |
| Filename tooltip                          | `services/filenameTooltip.ts`                |
| Session state                             | `services/session.ts`                        |
| Initialization (drag-drop, paste, resume) | `services/init.ts`                           |
| Toasts                                    | `components/toast.svelte.ts`                 |
| Constants                                 | `shared/constants.ts`                        |
| Shared types                              | `shared/types.ts`                            |
| Keybinds                                  | `features/keybinds/*` + `shared/keybinds.ts` |
| Media-kind detection                      | `shared/mediaKind.ts`                        |
| File metadata formatting                  | `shared/fileMeta.ts`                         |
| Privacy utilities                         | `shared/privacy.ts`                          |
| Derived prop objects                      | `shared/pageProps.ts`                        |

### Rust backend

| Concern                            | Module                                                |
| ---------------------------------- | ----------------------------------------------------- |
| Database persistence (SQLite)      | `database/` (Rust), `services/database.ts` (frontend) |
| Collection directory operations    | `commands/collections.rs`                             |
| Sidecar binary execution (SongRec) | `commands/external_apps.rs`                           |
| Window state persistence           | `state::window`                                       |
| Thumbnail generation, cache, dedup | `commands/thumbnail.rs`                               |
| Display cache / cover art          | `commands/display.rs`                                 |
| File operations / batch stat       | `commands/file_ops.rs`                                |
| Media conversion                   | `commands/conversion.rs`                              |
| Editing / export / backups         | `commands/editing.rs`                                 |
| Clips                              | `commands/clips.rs`                                   |
| Integrity repair                   | `commands/integrity.rs`                               |
| Clipboard                          | `commands/clipboard.rs`                               |
| PDF markup application             | `commands/annotations.rs`                             |
| DB commands / maintenance          | `commands/database.rs`                                |
| System, runtime info, restart      | `commands/system.rs`, `state/system.rs`               |
| Tauri setup / command registration | `lib.rs`                                              |

## State model

- **Shared/application state:** singleton feature exports (`export const x = createX()`).
- **Feature-local state:** owning feature module; factories when multiple instances are needed.
- **Page/view state:** `+page.svelte` owns media/view state, dialog flags, and page-level DOM refs. This is legitimate; do not migrate it into feature modules unless the state is shared or domain-owned.
- **Component-local presentation state:** the component that renders it.
- **DOM references:** the component that binds the element.
- **Composition and event wiring:** `+page.svelte` and `Shell.svelte`; keep domain rules out of them.
- **Stateless feature factories:** allowed. `media.svelte.ts` receives state through callbacks rather than owning it.

## Communication

- Feature modules may import `shared/`, `services/`, and other feature modules when ownership is clear.
- Leaf/presentational components receive props and emit callbacks.
- Orchestration components (`Shell.svelte`, `Dialog.svelte`, `SettingsDialog.svelte`) may import feature stores directly; they are composition points, not leaf components.
- Circular imports indicate a boundary problem.
- `+page.svelte` imports features. Features never import `+page.svelte`.
- Prefer the existing feature store/service over introducing a new abstraction.

## Persistence and runtime data

**SQLite (primary per-file store)** — `src-tauri/src/database/` + `services/database.ts`.

- DB: `%APPDATA%/com.vyu.desktop/vyu.db`.
- WAL mode, single `Mutex<Connection>`, migrations in `database/migrations.rs`.
- Stores timestamps, clip boundaries, resume positions, EQ settings, CD color, and related metadata.
- Frontend access goes through `services/database.ts`.

**localStorage (app settings + fallback)** — `services/storage.ts`.

- App-wide keys: `vyu-{name}`. System preferences use `vyu-system-*` (window behavior, power behavior, external app paths, last file). Keybinds use `vyu-keybinds` (versioned per-action bindings). The debug overlay toggle uses `vyu-debug-overlay`.
- Legacy/fallback per-file keys: `vyu-ts-{path}`, `vyu-clips-{path}`, `vyu-resume-{path}`, `vyu-eq-{path}`, `vyu-cd-color-{path}`.
- SQLite is primary after migration (`migrateFromLocalStorage`). User updates to resume position, EQ settings, and CD color are still dual-written to localStorage as fallback. Timestamps and clips use SQLite; their localStorage values are read only when the DB row is missing or the query fails.
- Do not add new per-file localStorage keys; use SQLite.

**Other runtime paths**

- Edit backups: `%APPDATA%/com.vyu.desktop/backups` (opt-in via File Backups).
- Window state: app config dir / `window-state.json`.
- System startup config: app config dir / `system.json` (GPU, single instance, thumbnail cache limit). This file is read before the webview exists; do not move these values to localStorage without a replacement pre-webview source.
- Thumbnail cache: `%LOCALAPPDATA%/com.vyu.desktop/thumbnails/` (configurable soft limit, default 500 MB).
- Display cache: `%LOCALAPPDATA%/com.vyu.desktop/displays/` (2 GB soft limit).
- Cover-art cache: `%LOCALAPPDATA%/com.vyu.desktop/cover_art/`.
- Temp: `%TEMP%/Vyu-temp/` with unique hash-based paths per operation.
- Launch at login: `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, value `Vyu` (release builds only).
- Explorer context menu: `HKCU\Software\Classes\SystemFileAssociations\{image,video,audio,document,.pdf}\shell\Vyu`.

## File watching and lifecycle

- `watchImmediate()` with a 300 ms debounce.
- Events within 1 second of starting a watch are ignored (`folderWatcher.svelte.ts`). Do not rely on the watcher for immediate post-write state updates.
- On change: rescan, re-sort, and adjust the current index. If the current file disappeared, load the nearest remaining file or close the viewer.
- `media.displayFile` uses a load generation counter to ignore stale async results.
- `onBeforeSwitch` resets editing/markup state and saves the current position.
- Temp directories/files are unique per operation. Clean up temp artifacts after failures where practical.

## Mirrored constants

Keep these synchronized:

- `IMAGE_EXTS` ↔ `IMAGE_EXTS_RUST`, **except** `svg` is intentionally frontend-only and must stay out of the Rust list.
- `VIDEO_EXTS` ↔ `VIDEO_EXTS_RUST`.
- `AUDIO_EXTS` ↔ `AUDIO_EXTS_RUST`.
- `DOCUMENT_EXTS` ↔ `DOCUMENT_EXTS_RUST`.
- `BROWSER_UNSUPPORTED_IMAGE_EXTS` ↔ `BROWSER_UNSUPPORTED_IMAGE_EXTS_RUST`.
- `REMUX_VIDEO_EXTS` ↔ `REMUX_VIDEO_EXTS_RUST`.

Rust-only lists do not need TypeScript mirrors: `FFMPEG_IMAGE_EXTS_RUST`, `RAW_IMAGE_EXTS_RUST`, `BROWSER_UNSUPPORTED_VIDEO_EXTS_RUST`.

## Known constraints

| Constraint                                                            | Reason                                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Library reactive caches use `$state<Record>`                          | Svelte proxy tracking depends on property access.                                   |
| `services/thumbnailCache.ts` uses a non-reactive `Map`                | It is an in-memory batching/cache layer, not UI state.                              |
| `pdfjs-dist` remains dynamic                                          | Keeps startup bundle smaller.                                                       |
| Sort-related stat uses one batch IPC call                             | Eliminates per-call IPC overhead.                                                   |
| Batch stat processes paths in chunks of 8                             | Limits work per blocking task; overall concurrency is not capped at 8.              |
| Thumbnail cache evicted at a configurable soft limit (500 MB default) | Prevents unbounded disk usage while letting users trade cache size for speed.       |
| Display cache evicted at 2 GB soft limit                              | Prevents unbounded disk usage.                                                      |
| Temp paths are unique per operation                                   | Prevents concurrent-operation conflicts.                                            |
| Cross-volume rename uses copy+delete fallback                         | Required for `ERROR_NOT_SAME_DEVICE` (error 17).                                    |
| JPEG scale-down via `jpeg-decoder`, not `image`                       | `image` uses `zune-jpeg`, which lacks IDCT scaling.                                 |
| Semaphores: 16 native image, 2 video/FFmpeg/RAW, 2 audio              | Keeps native image work from queueing behind FFmpeg.                                |
| Thumbnail eviction counter is atomic and best-effort                  | Avoids full directory scans on the hot path; `get_thumbnail_cache_size` resyncs it. |
| Inflight dedup keyed by `{hash}_{size}` (no mtime)                    | Allows metadata stat inside `spawn_blocking`.                                       |
| FFmpeg 9.0.1 Essentials is pinned; its download is SHA-256 verified   | Reproducible provisioning.                                                          |
| Webview CSP restricts `connect-src` to `self`                         | Prevents frontend telemetry/network access.                                         |
| Update checks run in the Rust backend only                            | CSP stays locked down; the request is user-initiated and never automatic.           |
| Keybind conflicts are scoped to viewer/library/PDF                    | Arrow keys stay natural in each view; global actions conflict with every context.   |
| Escape, Backspace, and plain Delete are reserved                      | Escape closes, and Backspace/Delete clear a binding while recording.                |
| `system.json` is read before the webview is created                   | GPU args and single-instance registration cannot change at runtime.                 |
| `--safe-mode` forces GPU acceleration on                              | Recovery path if a disabled-GPU startup renders incorrectly.                        |
| Keep-awake uses a dedicated thread                                    | `SetThreadExecutionState` is per-thread and would expire on a command thread.       |
| `vacuum_database` runs in `spawn_blocking`                            | `VACUUM` rewrites the DB and must not block the UI/command thread.                  |
| Diagnostics omit the current media path                               | Reports stay safe to share; explicit file-metadata copy includes the path.          |
| Safe-mode restart reuses `--restart-delay`                            | The single-instance release must finish before the new process starts.              |
