# Vyu — Agent Instructions

Windows-only local media viewer: Tauri 2 + Rust backend, Svelte 5 runes + strict TypeScript frontend, pnpm. Local-first: no telemetry or accounts. Network access is limited to user-opened media links, Song ID, and an opt-in update check. Frontend paths are relative to `src/lib/`; Rust paths to `src-tauri/src/` unless prefixed.

## Before editing

- Read the relevant `ARCHITECTURE.md` section; `README.md` covers setup and `CONTRIBUTING.md` covers licensing (code PRs are not accepted).
- Find the existing owner, read its implementation, and trace callers. Changes often cross `+page.svelte` → feature module → service → Tauri command.
- Prefer the smallest change that follows existing patterns. Do not refactor, rename, or reformat unrelated code.
- Code is authoritative; if a change makes documentation wrong, update the relevant section.

## Commands and verification

| Task              | Command                                            | Run when                          |
| ----------------- | -------------------------------------------------- | --------------------------------- |
| Install           | `pnpm install`                                     | first setup                       |
| Run the app       | `pnpm tauri dev`                                   | manual UI/runtime checks          |
| Frontend-only dev | `pnpm dev`                                         | UI preview without Tauri IPC      |
| Frontend check    | `pnpm check`                                       | Svelte/TS changes (required)      |
| i18n check        | `pnpm check:i18n`                                  | messages or `t()` calls change    |
| Sidecar check     | `pnpm check:sidecar`                               | sidecar or binary changes         |
| Rust check        | `cargo check --manifest-path src-tauri/Cargo.toml` | Rust changes                      |
| Rust tests        | `cargo test --manifest-path src-tauri/Cargo.toml`  | testable Rust logic changes       |
| Frontend build    | `pnpm build`                                       | imports, build config, or bundle  |
| Desktop build     | `pnpm tauri build`                                 | release/package verification only |
| Format check      | `pnpm prettier --check <paths>`                    | changed files                     |
| Repair FFmpeg     | `pnpm ffmpeg:ensure`                               | FFmpeg missing or corrupt         |

- Use the narrowest check that can catch the problem; do not run `pnpm build` or `pnpm tauri build` for routine edits.
- Tests live beside the code in `util.rs`, `types.rs`, `state/`, and command modules. Add focused Rust tests for testable fixes; for UI-only fixes, state the manual reproduction.
- No frontend test runner exists.
- `pnpm format` writes the whole repo; avoid it. `cargo fmt --check` is not clean.
- Report commands run and important checks skipped.

## Implementation conventions

- Svelte 5 runes only: `$state`, `$derived`, `$effect`. Use `let` for `$state`; no legacy `let`/`$:` reactivity. Derive values with `$derived`; reserve `$effect` for side effects.
- Keep the single-page model. Add a route only when no existing view, menu, or dialog path fits.
- Frontend IPC goes through the owning wrapper (`features/*/api.ts`, `services/database.ts`, `services/files.ts`). Components never call `invoke()` directly.
- New Tauri command: implement in `src-tauri/src/commands/<domain>.rs`, register it in `lib.rs`, expose it through a typed wrapper, and add any required plugin permission to `src-tauri/capabilities/default.json`.
- Most styling is global CSS in `src/lib/styles/`; use existing CSS variables and `data-theme`/`data-*` attributes. Use component-scoped styles only for self-contained components. Reusable UI components live in `src/lib/components/`, not `shared/`.
- User-facing text uses `locale.t()` / `locale.tp()` with keys in `messages/<namespace>/<locale>.json`; add each key to `en.json` and every locale in the same change, and never hardcode English or use English sentences as keys. See `src/lib/features/i18n/README.md`.
- When adding or removing a media extension, update both `src/lib/shared/constants.ts` and `src-tauri/src/constants.rs`. The mirrored lists and the `svg` exception are documented in `ARCHITECTURE.md`.
- Keep `pdfjs-dist` and `hls.js` as lazy imports. Do not add startup imports for them.
- Add a dependency or abstraction only when existing code cannot solve the problem.
- Log failures once at the handling boundary; do not log expected control flow or successes.
- Keep the main toolbar's icon set and visual design unchanged unless explicitly requested.
- If a behavior has multiple entry points (menu, keybind, context menu, settings), update all applicable surfaces or state why not.

## State and ownership

- Shared/application state → singleton feature export (`export const x = createX()`).
- Feature-local state → the owning feature module; use a factory when multiple instances are needed.
- Page/view state, dialog flags, and page-level DOM refs → `src/routes/+page.svelte`. This is intentional; do not migrate it unless it becomes shared or domain-owned.
- Component-local presentation state and DOM refs → the component that renders or binds them.
- Leaf components receive props and callbacks. Orchestration components (`Shell.svelte`, `Dialog.svelte`, `SettingsDialog.svelte`) may import feature stores directly.
- `+page.svelte` imports features; features never import `+page.svelte`. Circular imports indicate a boundary problem.
- Create a module only when no existing owner fits, the responsibility is distinct, and extending the current module would reduce cohesion.

## Persistence

- Use `services/storage.ts` for app settings and `services/database.ts` for per-file metadata.
- Per-file metadata is SQLite-backed; add new per-file fields there with a migration, never as new localStorage keys.
- Preserve the existing localStorage fallback and dual-write for resume points, EQ, and CD color when changing those paths.

## Data safety

- Never use real user media as a test fixture. Use synthetic files or copies under `%TEMP%`.
- `pnpm tauri dev` uses the real app data under `%APPDATA%` and `%LOCALAPPDATA%`. Back up `%APPDATA%/com.vyu.desktop` and `%LOCALAPPDATA%/com.vyu.desktop` before testing Danger Zone, factory reset, cache clearing, uninstall, or backup deletion.
- Prefer `trash_file` (recycle bin) for user media. Use permanent deletion only when explicitly requested.
- Do not edit generated output: `.svelte-kit/`, `build/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/resources/*.exe`.
- `src-tauri/binaries/songrec-*.exe` is a tracked placeholder. The real SongRec binary may be placed locally for a build but must never be committed; `pnpm check:sidecar` enforces the placeholder.
- Do not add telemetry, accounts, or background network calls; keep the local-first CSP boundary.
- Treat uncommitted changes as user work; never discard them.

## Finishing

- Review `git diff` (including untracked files) for unrelated edits, generated output, and formatting noise.
- Run the checks for every changed layer; do not claim tests that do not exist.
- Report what changed, validation results, and skipped checks. Separate verified behavior from assumptions or unverified risks.
- If ownership, persistence, or an invariant changed, update the relevant section of `ARCHITECTURE.md` instead of appending new prose.
- Keep the final response concise: change summary, notable implementation choices, validation, and remaining limitations.
