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

| Concern                                  | Module                                               |
| ---------------------------------------- | ---------------------------------------------------- |
| Open/close, navigate, display state      | `features/media/media.svelte.ts`                     |
| Zoom, pan, fit, fullscreen               | `features/viewer/viewer.svelte.ts`                   |
| Image/video/PDF views                    | `features/viewer/*`                                  |
| Rotation, flip, brightness, crop, export | `features/editing/editing.svelte.ts`                 |
| Playback                                 | `features/media/playback.svelte.ts`                  |
| Clips                                    | `features/media/clips.svelte.ts`                     |
| Slideshow                                | `features/media/slideshow.svelte.ts`                 |
| Markers                                  | `features/markers/*`                                 |
| PDF rendering                            | `features/pdf/pdf.svelte.ts`                         |
| Drawing / markup                         | `features/markup/markup.svelte.ts`                   |
| Theme                                    | `features/theme/theme.svelte.ts`                     |
| Typography                               | `features/font/font.svelte.ts`                       |
| Filesystem scans / folder cache          | `services/files.ts`                                  |
| Storage                                  | `services/storage.ts`                                |
| Clipboard                                | `services/clipboard.ts`                              |
| Session state                            | `services/session.ts`                                |
| Tauri wrappers / FFmpeg orchestration    | `features/media/tools.ts`, `ffmpeg.ts`, `sources.ts` |
| Constants                                | `shared/constants.ts`                                |
| Shared types                             | `shared/types.ts`                                    |
| Keybinds                                 | `shared/keybinds.ts`                                 |
| Library view                             | `features/library/*`                                 |
| Toasts                                   | `features/toast/*`                                   |
| Media-kind detection                     | `shared/media-kind.ts`                               |
| Shared UI primitives                     | `shared/*.svelte`                                    |
| Dialogs                                  | `features/dialogs/*`                                 |
| Dialog/menu state                        | `features/stores/*`                                  |
| Context actions                          | `features/actions/*`                                 |
| Edit/export orchestration                | `features/edit-dialogs/*`                            |
| Window state persistence                 | `window_state.rs`                                    |
| File metadata formatting                 | `shared/file-meta.ts`                                |
| Menus                                    | `features/menus/*`                                   |
| Timeline                                 | `features/timeline/*`                                |
| Navigation                               | `features/navigation/*`                              |

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

- `localStorage` keys use the `vyu-` prefix.
- Per-file keys: `vyu-{kind}-{path}`.
- App-wide keys: `vyu-{name}`.
- All storage access goes through `services/storage.ts`.
- Storage cleanup is centralized.

## File watching

Use `watchImmediate()` with a 300ms debounce.

On change:

1. Rescan.
2. Re-sort.
3. Adjust current index if files moved or disappeared.

## Known constraints

These decisions are intentional and should not be changed without discussion.

| Constraint                                             | Reason                                            |
| ------------------------------------------------------ | ------------------------------------------------- |
| Thumbnail cache uses `$state<Record>` instead of `Map` | Svelte proxy tracking depends on property access. |
| `pdfjs-dist` remains dynamic                           | Keeps startup bundle smaller.                     |
| Sort-related `stat()` calls capped at 8 workers        | Prevents filesystem contention.                   |
| Temp dirs use hash-based subdirectories                | Prevents concurrent-operation conflicts.          |
| Cross-volume rename uses copy+delete fallback          | Required for `ERROR_NOT_SAME_DEVICE`.             |
