# Vyu — Agent Notes

Windows desktop media viewer. Tauri 2 + Rust backend, Svelte 5 runes + TypeScript strict frontend, pnpm. Local-first: no telemetry, no accounts; media processing stays local. Optional Song ID uses the bundled SongRec sidecar and needs a connection.

## Read first

- `ARCHITECTURE.md` — ownership, data flow, persistence, and non-obvious constraints. Read the relevant section, not the whole file.
- `README.md` — setup, commands, and project overview. If it conflicts with `ARCHITECTURE.md` or the code on implementation details, the code/architecture wins.
- `CONTRIBUTING.md` — contribution and licensing policy; code PRs are not currently accepted.

## Before editing

- Inspect the relevant implementation and existing pattern before changing behavior.
- Trace callers and data flow when a change crosses modules or the frontend/backend boundary.
- Treat documentation as guidance; verify claims against code. Resolve uncertainty by inspection, not assumption.

## Commands

| Task            | Command                                            |
| --------------- | -------------------------------------------------- |
| Install         | `pnpm install`                                     |
| Dev             | `pnpm tauri dev`                                   |
| Full build      | `pnpm tauri build`                                 |
| Frontend check  | `pnpm check`                                       |
| Frontend build  | `pnpm build`                                       |
| Rust check      | `cargo check --manifest-path src-tauri/Cargo.toml` |
| Rust tests      | `cargo test --manifest-path src-tauri/Cargo.toml`  |
| Format (writes) | `pnpm format`                                      |
| Format check    | `pnpm prettier --check <paths>`                    |
| Repair FFmpeg   | `pnpm ffmpeg:ensure`                               |

### Validation

- Use the narrowest check that covers the change.
- Svelte/TS change: run `pnpm check` (required).
- Rust change: run `cargo check --manifest-path src-tauri/Cargo.toml` (required).
- Rust logic in `util.rs`, `types.rs`, or `editing.rs`: run `cargo test --manifest-path src-tauri/Cargo.toml`; those modules have unit tests.
- Imports/build config/bundle change: run `pnpm build`.
- Release verification: `pnpm tauri build`; do not run it for routine edits.
- There is no frontend test runner. Do not claim frontend tests exist.
- `pnpm format` runs `prettier --write .` and modifies files. Prefer checking changed paths with `pnpm prettier --check <paths>`.
- `cargo fmt --check` is not currently clean; do not use it as a gate without a separate cleanup.
- Report commands actually run and important checks skipped.

## State and ownership

- **Shared/application state** → singleton feature module (`export const x = createX()`).
- **Feature-local state** → the owning feature module; factories for multiple instances.
- **Page/view state** → `src/routes/+page.svelte`. It is the composition root and legitimately owns media/view state, dialog flags, and wiring.
- **Component-local presentation state** → the component that renders it.
- **DOM references** → the component that binds the element; page-owned refs stay in `+page.svelte`.
- **Event wiring** → `+page.svelte` / `components/Shell.svelte`; keep domain rules in feature modules.
- Do not migrate page/view state into feature modules unless it is shared or domain-owned.
- Leaf components receive props and emit callbacks. Orchestration components (`Shell`, `Dialog`, `SettingsDialog`) may import feature stores directly.
- Find the owner in `ARCHITECTURE.md` first. Extend the existing module before creating one.

New module only when: no existing owner, clearly distinct responsibility, and extending the current module would reduce cohesion. Do not reorganize, rename, or abstract unrelated code.

## Implementation conventions

- Svelte 5 runes only: `$state`, `$derived`, `$effect`. `let` for `$state`; no legacy `let`/`$:` reactivity.
- TypeScript strict mode. Reusable UI components live in `src/lib/components/`, not `shared/`.
- Preserve the single-page navigation model. Add a route only when a requested feature genuinely requires one and no existing view/menu/dialog path fits.
- New top-level npm/cargo dependencies require a concrete reason.
- Keep the main toolbar's icon set and visual design unchanged unless explicitly requested; unrelated toolbar behavior changes are allowed.
- `pdfjs-dist` stays dynamically imported; only load it when a PDF opens.
- Vite port 1420 with `strictPort: true`; window decorations stay off (custom title bar).
- Prefer early returns, named functions, and terse comments only where needed.
- Do not log expected control flow or successful operations. Report failures once at the handling boundary; do not log and rethrow.
- User-facing copy is concise and neutral. Preserve behavior outside the requested scope; do not refactor unrelated code.
- Reuse existing services/patterns before introducing abstractions.

### Constants synchronization

Keep mirrored lists in `src/lib/shared/constants.ts` and `src-tauri/src/constants.rs` in sync:

- `IMAGE_EXTS` ↔ `IMAGE_EXTS_RUST`, **except** `svg` is intentionally frontend-only.
- `VIDEO_EXTS`, `AUDIO_EXTS`, `DOCUMENT_EXTS` mirror their `*_RUST` counterparts.
- `BROWSER_UNSUPPORTED_IMAGE_EXTS` and `REMUX_VIDEO_EXTS` mirror their Rust counterparts.

Rust-only lists (`FFMPEG_IMAGE_EXTS_RUST`, `RAW_IMAGE_EXTS_RUST`, `BROWSER_UNSUPPORTED_VIDEO_EXTS_RUST`) do not need TypeScript mirrors.

### Backend

- Tauri commands live in `src-tauri/src/commands/`, one file per domain.
- Cross-volume moves use copy+delete fallback on `ERROR_NOT_SAME_DEVICE` (error 17).
- Concurrent temp files/directories must use unique hash-based paths.
- Sort-related `stat()` work is batched; do not add per-file IPC loops.
- FFmpeg is pinned (9.0.1 Essentials), hash-verified, and resolved from app resources with a PATH fallback in dev. `src-tauri/resources/` is generated; do not edit it.

## Persistence and files

- App preferences/localStorage: `services/storage.ts`. Per-file SQLite data: `services/database.ts`. Do not call DB commands directly from components.
- SQLite is primary for timestamps, clips, resume points, EQ, and CD color. localStorage is for app-wide settings and legacy/fallback per-file values. Do not add new per-file localStorage keys.
- Legacy per-file prefixes and exact paths are documented in `ARCHITECTURE.md`.
- Edit backups are opt-in via the File Backups setting.

## Generated files and destructive operations

- Do not edit generated output: `.svelte-kit/`, `build/`, `src-tauri/target/`, `src-tauri/gen/`, `src-tauri/resources/*.exe`.
- `src-tauri/binaries/songrec-*.exe` is a tracked sidecar; treat it as a binary asset.
- Prefer recycle-bin behavior (`trash_file`) for user media. Use permanent deletion only when explicitly requested.
- Never use real user media as test fixtures; use temporary paths.

## Completion and communication

Before finishing:

- Run the checks appropriate to the changed layer.
- Inspect the final diff for unintended edits and unrelated formatting.
- Report checks actually run, their results, and important checks not run.
- Separate confirmed behavior from assumptions or unverified risks.
- Surface important decisions, blockers, and unresolved problems.
- Ask one focused question with concrete options only when a consequential requirement is genuinely ambiguous.

Keep responses concise. Do not narrate routine exploration, enumerate every file inspected, or produce textbook/exhaustive summaries unless asked. Explain meaningful decisions or tradeoffs, validation, and remaining limitations.

Default completion response:

1. What changed.
2. Important implementation details, if necessary.
3. Validation results.
4. Remaining limitations or unverified behavior.

Plans and progress updates should be proportional to task complexity. Do not hide important problems to keep a response short.
