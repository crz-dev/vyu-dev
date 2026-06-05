# Architecture

## Two halves

| Layer                     | Location               | Role                                                         |
| ------------------------- | ---------------------- | ------------------------------------------------------------ |
| Frontend (Svelte 5 runes) | `src/`                 | UI, state machines, viewer logic                             |
| Backend (Rust)            | `src-tauri/src/lib.rs` | Tauri commands: fs, FFmpeg, thumbnails, clipboard, integrity |

The frontend is a single-page app — SvelteKit with `adapter-static` and `fallback: "index.html"`, no SSR. There are no routes; everything lives in `src/routes/+page.svelte` and `src/lib/`.

## Frontend layout

```
src/
├── routes/
│   ├── +page.svelte        # Layout shell — template + binding sites only
│   ├── +layout.ts          # ssr = false
│   └── init.ts             # onMount wiring: drag-drop, paste, keybinds, cleanup
└── lib/
    ├── features/           # State + UI for each concern
    ├── services/           # Tauri wrappers, localStorage, filesystem scans
    ├── shared/             # Constants, types, helpers, primitives (Tooltip, Shell)
    └── styles/             # CSS — variables, layout, components, overlays
```

## Module ownership

When you need to add a feature, find the closest existing module first. Only create a new file when the concern is genuinely new.

| Concern                                             | Module                                                                             |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Open/close file, navigate, display state            | `features/media/media.svelte.ts`                                                   |
| Zoom, pan, fit, fullscreen                          | `features/viewer/viewer.svelte.ts`                                                 |
| Rotation, flip, brightness, crop, export            | `features/editing/editing.svelte.ts`                                               |
| Video play/pause, volume, speed, drag-scrub         | `features/media/playback.svelte.ts`                                                |
| Clip boundaries, in/out points, jobs                | `features/media/clips.svelte.ts`                                                   |
| Slideshow timer, order, transitions                 | `features/media/slideshow.svelte.ts`                                               |
| Markers, timestamps, AB loop, resume                | `features/markers/*` (split from +page during refactor)                            |
| PDF rendering                                       | `features/pdf/pdf.svelte.ts`                                                       |
| Drawing / markup strokes                            | `features/markup/markup.svelte.ts`                                                 |
| Theme                                               | `features/theme/theme.svelte.ts`                                                   |
| Font / typography                                   | `features/font/font.svelte.ts`                                                     |
| File-system scans, folder cache                     | `services/files.ts`                                                                |
| localStorage read/write                             | `services/storage.ts`                                                              |
| Clipboard copy/paste                                | `services/clipboard.ts`                                                            |
| Window/dialog ephemera (tooltips, context menu pos) | `services/session.ts`                                                              |
| Tauri invoke wrappers, FFmpeg orchestration         | `features/media/tools.ts`, `features/media/ffmpeg.ts`, `features/media/sources.ts` |
| Extension lists, loop modes, time constants         | `shared/constants.ts`                                                              |
| Domain types (`VideoMarker`, `ClipBoundary`, …)     | `shared/types.ts`                                                                  |
| Keybinds dispatch                                   | `shared/keybinds.ts`                                                               |
| Toast helpers                                       | `shared/toast.ts`                                                                  |
| Media-kind detection (video/audio/pdf/image)        | `shared/media-kind.ts`                                                             |
| Generic primitives (Shell, Tooltip, Marquee)        | `shared/*.svelte`                                                                  |
| Dialogs (settings, about, help, feedback, …)        | `features/dialogs/*`                                                               |
| Menus (edit, process, slideshow, …)                 | `features/menus/*`                                                                 |
| Timeline (markers, scrubber)                        | `features/timeline/*`                                                              |
| Navigation (thumbnail bar, sort menu)               | `features/navigation/*`                                                            |

## State pattern

State lives in a runes module. The module exports a singleton (`export const x = createX()`) for app-scoped or current-file state, or a factory (`createX()`) when multiple instances are needed.

`+page.svelte` reads from these modules and binds DOM refs into them. It should not own state, business logic, or feature handlers. If you find yourself adding a `$state` or a handler to `+page.svelte`, push it into the relevant feature module instead.

## Data flow

User action (DOM event) → handler in a feature module → Tauri invoke (if it touches disk or FFmpeg) → state update in a runes module → `$derived` recomputes → template re-renders.

The video/audio elements are the exception: they live in `+page.svelte`'s template (they're DOM), but their state (current time, duration, playing) is mirrored into the relevant module via the `mediaElRef` callback or a `bind:this` setter.

## Storage

All user state is in `localStorage` with a `vyu-` prefix. Per-file state uses `vyu-{kind}-{path}` keys; app-wide prefs use plain `vyu-{name}` keys. `cleanupStaleStorageEntries()` caps each per-file group at 500 entries on startup. See `services/storage.ts` for the full key map.

## File watching

`watchImmediate()` from `@tauri-apps/plugin-fs` notifies on folder changes with a 300ms debounce; on fire, the file list is rescanned, sorted, and the current index is adjusted if the open file moved or was deleted.

## See also

- `AGENTS.md` — conventions, commands, style rules
- `README.md` — user-facing feature list, tech stack rationale
