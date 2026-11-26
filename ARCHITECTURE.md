# Architecture

Technical map for coding agents. Read the section relevant to the change; operational rules and verification commands are in `AGENTS.md`; setup is in `README.md`.

## System shape

- **Frontend** (`src/`): SvelteKit static SPA (`ssr = false`), Svelte 5 runes, TypeScript strict. `+page.svelte` is the only application route; `+layout.svelte` and `+error.svelte` are scaffolding.
- **Backend** (`src-tauri/src/`): Tauri 2 + Rust, Windows-only. `lib.rs` handles startup, plugins, command registration, and window lifecycle. `commands/` is IPC by domain; `database/` is SQLite; `state/` holds window and system config; `util.rs`, `types.rs`, and `constants.rs` are shared.
- **IPC**: typed wrappers in `src/lib/features/*/api.ts` and `src/lib/services/{database,files}.ts` centralize `invoke` calls.
- **Network**: local-first. The CSP allows `http(s)` in `media-src` and `connect-src` so user-opened media, HLS segments, and remote links can load. Song ID uses the SongRec sidecar; the update check is opt-in and backend-only (`commands/system.rs`). External app and browser launches are user actions.

## Data flow

```text
+page.svelte  (composition root: page/view state, refs, feature instances, wiring)
  ├─ feature modules (domain logic and state)
  │    ├─ services (files, database, storage, clipboard, init)
  │    └─ api wrappers → Tauri commands → Rust helpers / FFmpeg / Windows APIs
  └─ Shell.svelte and feature components (orchestration, props, callbacks)
```

- `+page.svelte` creates factories, owns page/view state and DOM refs, and wires callbacks and derived props. It is not a stateless shell.
- `features/media/media.svelte.ts` is a factory: it receives page-held state through callbacks instead of owning it.
- Commands generally return `Result<T, String>`. Long-running work emits `conversion-progress` and `edit-apply-progress`.
- Async loads use generation counters to discard stale results (`media.svelte.ts`, `folderWatcher.svelte.ts`). Follow that pattern for new async loaders.

## Where changes go

Frontend paths are relative to `src/lib/`; Rust paths are relative to `src-tauri/src/`.

- **Open, navigate, library:** `features/file-actions/*`, `features/navigation/*`, `features/library/*`, `commands/{file_ops,collections}.rs`.
- **Properties and clipboard:** `features/actions/propertiesActions.ts`, `features/dialogs/LibraryPropertiesDialog.svelte`, `shared/fileMeta.ts`, `services/clipboard.ts`, `commands/{clipboard,external_apps}.rs`.
- **Media loading and playback:** `features/media/media.svelte.ts`, `features/media/playback*`, `features/media/{queue,slideshow,sleepTimer,backgroundAudio}.svelte.ts`, `features/media/tracks.svelte.ts`, `features/media/{MediaBar,PlaybackControls}.svelte`, `components/NowPlayingPill.svelte`, `commands/{tracks,conversion}.rs`.
- **Playlists and queue files:** `features/playlists/*` (m3u/m3u8/pls parse and save), `features/media/queue.svelte.ts` (restore and persist), `commands/file_ops.rs` (atomic playlist writes).
- **Viewer, zoom, PDF, PiP:** `features/viewer/*`, `services/imagePreload.ts`, `commands/display.rs`.
- **Editing, markup, export:** `features/editing/*`, `features/markup/*`, `commands/{editing,annotations}.rs`.
- **Share, convert, save-as:** `features/dialogs/Dialog.svelte`, `features/media/conversionPrefs.svelte.ts`, `commands/{conversion,external_apps}.rs`.
- **Repair and integrity:** `features/media/corruption.svelte.ts`, `commands/integrity.rs`.
- **Clips, markers, timeline:** `features/media/clips.svelte.ts`, `features/markers/*`, `components/TimelineMarkers.svelte`, `features/media/timelinePreview.ts`, `commands/clips.rs`.
- **Audio effects, EQ, visualizers, CD color:** `features/{effects,equalizer,visualizer}/*`, `features/media/cdColor.ts`.
- **Settings UI:** `features/dialogs/SettingsDialog.svelte`, `features/settings/*`, plus the store owned by the setting.
- **Menus, context actions, window controls:** `components/Shell.svelte`, `features/menus/*`, `features/actions/*`.
- **System, OS integration, diagnostics, danger:** `features/{system,debug,danger}/*`, `commands/{system,database}.rs`.
- **Persistence:** `services/storage.ts`, `services/database.ts`, `src-tauri/src/database/*`.
- **Thumbnails, display cache, cover art:** `commands/{thumbnail,display}.rs`, `services/thumbnailCache.svelte.ts`.
- **i18n:** `features/i18n/*`, `features/i18n/messages/<namespace>/<locale>.json`.
- **Keybinds:** `features/keybinds/*`, `shared/keybinds.ts`; labels and descriptions in `keybindDefinitions.ts` are i18n keys.
- **Profiles and settings transfer:** `features/profiles/*`, `services/storage.ts`.
- **Theme, appearance, accessibility:** `features/{theme,accessibility}/*`, `features/menus/accessibility.svelte.ts`, `styles/*`.
- **Add/remove a media format:** `shared/constants.ts`, `src-tauri/src/constants.rs`, `shared/mediaKind.ts`, `commands/{thumbnail,display,conversion}.rs`, and file associations in `src-tauri/tauri.conf.json`.
- **App shell, dialogs, shared UI:** `components/*`, `features/dialogs/*`, `shared/pageProps.ts`.
- **Slider click animation:** `services/sliderAnimation.ts` installs the delegated pointer behavior for native and custom sliders; slider transition styles live in `styles/components.css` and `styles/pip.css`.

### Rust command map

`file_ops` (stat, delete/trash, rename/copy, atomic writes, temp cleanup), `editing`/`clips`/`conversion` (FFmpeg output), `thumbnail`/`display` (caches and prepared media), `tracks` (audio, subtitles, chapters), `external_apps` (sidecar, share, open-in, properties), `system` (config, registry, window/PiP, updates, uninstall/restart), `database` (metadata, stats, vacuum, reset), `collections`, `clipboard`, `annotations` (PDF markup), `pdf_redaction` (page flattening), and `integrity` (repair).

## Ownership and layering

- Feature modules own domain logic and feature state. Services own shared infrastructure. Components render and wire UI.
- Feature modules may import `shared/`, `services/`, and other feature modules when ownership is clear; prefer an existing store or service over a new abstraction.
- State placement and module-boundary rules are in `AGENTS.md`.
- `shared/` holds cross-feature constants, types, and helpers. It does not own application state.

## Persistence and runtime data

**SQLite — primary per-file store.** `src-tauri/src/database/` + `services/database.ts`.

- Database lives under the app data directory. WAL mode, a single connection, and versioned migrations in the database module.
- Stores per-file metadata: resume positions, timestamps, clips, EQ, CD color, subtitle position, and last viewed.
- Migrations are additive; never edit an applied migration in place.

**localStorage — app settings and fallback.** `services/storage.ts`.

- App settings use the `vyu-*` namespace; system, window, power, and external-app settings use `vyu-system-*`.
- Legacy per-file fallback keys use `vyu-ts-`, `vyu-clips-`, `vyu-resume-`, `vyu-eq-`, and `vyu-cd-color-`, each suffixed by the file path.
- SQLite is primary after the one-time localStorage migration. Timestamps and clips use SQLite; localStorage is read only when the DB row is absent or the query fails. Resume points, EQ, and CD color are still dual-written when the user changes them.
- `vyu-queue` holds the restored up-next list; it is profile-scoped like other `vyu-*` settings.

**Profiles.** Live `vyu-*` keys are the active profile; inactive profiles are snapshots in a versioned registry. Switching captures the live keys, applies the target snapshot, and reloads the webview. Device/window keys and per-file SQLite metadata stay shared; library and accessibility settings can be scoped per profile.

**Other runtime paths.**

- Edit backups live under the app data directory (opt-in via File Backups).
- Window state is stored in the app config directory.
- System config (`system.json` in the app config directory) holds GPU, single instance, launch, and cache settings. It is read before the webview exists.
- Thumbnail, display, and cover-art caches live under the app cache directory. Thumbnail and display caches are bounded; the thumbnail limit is configurable.
- Temp files live under the system temp directory.
- Launch at login (installed builds only) and the Explorer context menu are registry-backed.

## Media and caches

- Keep mirrored extension lists in sync between `src/lib/shared/constants.ts` and `src-tauri/src/constants.rs`: `IMAGE_EXTS` ↔ `IMAGE_EXTS_RUST` (except `svg`, frontend-only), plus `VIDEO_EXTS`, `AUDIO_EXTS`, `DOCUMENT_EXTS`, `BROWSER_UNSUPPORTED_IMAGE_EXTS`, `BROWSER_UNSUPPORTED_VIDEO_EXTS`, and `REMUX_VIDEO_EXTS`. Rust-only lists need no TypeScript mirror: `FFMPEG_IMAGE_EXTS_RUST` and `RAW_IMAGE_EXTS_RUST`.
- Thumbnail requests go through `services/thumbnailCache.svelte.ts`, the single queue/cache. Do not bypass it from the library or thumbnail bar.
- Prepared audio tracks, extracted WebVTT/ASS, and bitmap subtitle PNG cues use the display cache; active audio-track variants and bitmap cue images are pinned so playback is not interrupted. Thumbnail and display caches evict best-effort at their soft limits.
- Audio-track switching remuxes a cached single-audio rendition because WebView2 cannot reliably select embedded audio tracks. Embedded text subtitles are parsed to a typed cue document; ASS/SSA fonts, colours and outlines are preserved. PGS/VobSub/DVD bitmap subtitles are decoded to cached transparent PNG cues and drawn over the video; there is no burn-in or OCR.
- FFmpeg is pinned and SHA-256-verified. It is resolved at startup from app resources with a PATH fallback in dev; use `util::ffmpeg_command`/`ffprobe_command` rather than hardcoded paths. `src-tauri/resources/` is generated.
- Concurrency is bounded by semaphores with separate image, video/RAW/FFmpeg, audio, and preview lanes. Preview frames skip the library thumbnail queue.
- Stat-based sorting uses one `batch_stat` IPC call; do not add per-file stat loops. Library reactive stats must remain proxy-friendly (`$state<Record>` rather than `Map`).

## Playback, viewer, and window

- `pdfjs-dist` is dynamically imported only when a PDF opens.
- PDF view state lives in `features/viewer/pdf.svelte.ts`: pages render through layout rows so single and dual page views share one scroll/current-page model. Outline entries, internal link rectangles, and AcroForm widgets come from the PDF.js document, not the DOM. Form values are saved with `saveDocument` through `write_pdf_atomic`; encrypted PDFs stay read-only for writes. Redaction replaces affected pages with flattened images and prunes their streams, annotations, and form widgets while leaving forms on untouched pages. Night reading is a canvas filter and persists under `vyu-pdf-night`. PDF reading position reuses the per-file resume slot to store a page number, restores it with a toast, and marks that page in the Index. Page bookmarks use the per-file `pdf_bookmarks` JSON column, storing page, color, and title. Read aloud uses WebView2 speech synthesis on extracted page text.
- HLS uses lazy `hls.js` with workers disabled; WebView2 has no native HLS, and the CSP has no `worker-src blob:`.
- Remote `http(s)` media plays in-stream and is not persisted: no recents, resume, markers, clips, or track inspection.
- The up-next queue stores absolute paths and is restored from `vyu-queue` on launch; every mutation rewrites the stored list.
- `.m3u`/`.m3u8`/`.pls` files open into the queue: relative entries resolve against the playlist folder, unsupported and remote entries are ignored, and opening replaces Up Next. Saved playlists contain absolute paths and reuse `write_file_atomic`.
- Global marker clears update the database and the in-memory timestamp/clip stores.
- Subtitle appearance and saved custom text colors are global `vyu-subtitle-style`/`vyu-subtitle-custom-colors` settings; the dragged subtitle offset is per-file metadata, not localStorage.
- Window state is not written while PiP is active; mini geometry must not replace normal bounds.
- `--safe-mode` forces GPU acceleration on for recovery from a bad disabled-GPU startup.
- Keybind conflicts are scoped to viewer/library/PDF. Escape, Backspace, and plain Delete are reserved (close/clear binding).
- The keep-awake monitor uses a dedicated thread because `SetThreadExecutionState` is per-thread.
- `vacuum_database` runs in `spawn_blocking` because `VACUUM` rewrites the database.
- Diagnostics omit the current media path unless the user explicitly copies file metadata.
- Danger Zone and factory reset clear Vyu data, caches, backups, and installation files; they never delete user media.

## Files and lifecycle

- `watchImmediate()` is debounced, and the initial watch event is ignored. Do not rely on the watcher for immediate post-write updates.
- On external change: rescan, re-sort, keep the current file if present, otherwise load the nearest remaining file or close the viewer.
- `displayFile` uses a load generation counter; `onBeforeSwitch` saves the current position, and `onReset` resets zoom, editing, and markup for the next file.
- Cross-volume renames fall back to copy+delete on `ERROR_NOT_SAME_DEVICE` (error 17).
- Temp files and directories must use unique per-operation paths; clean them up after failures where practical.
