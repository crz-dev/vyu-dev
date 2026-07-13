# Vyu — Agent Notes

Tauri 2 + Svelte 5 (runes) + TypeScript + pnpm. Windows desktop media viewer. Replaces Windows Photos. Private by architecture — no telemetry, no internet, files never leave the device.

See `ARCHITECTURE.md` before creating modules, moving state, changing ownership boundaries, or introducing new storage patterns.

## Commands

| Task       | Command                   |
| ---------- | ------------------------- |
| Dev        | `pnpm tauri dev`          |
| Build      | `pnpm tauri build`        |
| Type check | `pnpm check`              |
| Format     | `pnpm prettier --write .` |

**Prereqs:** Rust toolchain. FFmpeg is bundled — gyan.dev "essentials" build ships with the installer.

## Hard rules

- **State goes in `src/lib/features/*/` only.** `src/routes/+page.svelte` is a layout shell — no state, no handlers, no business logic.
- **New top-level dependencies (npm or cargo) require an explicit reason before adding.**
- **SvelteKit routes stay as-is.** Intentionally a single-page app. Do not add routes.
- **FFmpeg is bundled.** gyan.dev "essentials" build ships with the installer. Backend resolves from app resources, falling back to PATH in dev mode.
- **Top-level toolbar icons stay fixed.** Shell bar design is locked.
- **Constants must stay in sync.** `IMAGE_EXTS`, `VIDEO_EXTS`, `AUDIO_EXTS`, `DOCUMENT_EXTS` in `src/lib/shared/constants.ts` must match `*_RUST` constants in `src-tauri/src/constants.rs`.

## Modification principles

Before creating code:

1. Find the existing owner in `ARCHITECTURE.md`.
2. Extend existing modules before creating new modules.
3. Reuse existing services before introducing new services.
4. Prefer localized changes over broad refactors.
5. Preserve architecture unless explicitly instructed otherwise.

Do not:

- Reorganize files without a clear reason.
- Rename modules as part of unrelated work.
- Introduce abstractions before duplication exists.
- Replace existing patterns with new patterns unless requested.

## New modules

Create a new module only when:

- No existing module owns the concern.
- The responsibility is clearly distinct.
- Extending an existing module would reduce cohesion.

## Svelte / TypeScript conventions

- **Reusable UI components** live in `src/lib/components/`, not in `shared/`.
- Svelte 5 runes only — `$state`, `$derived`, `$effect`. No legacy `let`/`$:` reactivity.
- `let` for `$state` declarations.
- TypeScript strict mode.
- No SSR — `+layout.ts` exports `ssr = false`.
- `localStorage` keys use `vyu-` prefix. Per-file: `vyu-{kind}-{path}`. App-wide: `vyu-{name}`.
- All storage reads and writes go through `services/storage.ts`.
- `pdfjs-dist` is dynamically imported — only loads when a PDF opens.
- Vite port 1420, `strictPort: true`.
- Window decorations disabled — app draws its own title bar.

## Cache paths

| Cache type | Path                                   |
| ---------- | -------------------------------------- |
| Thumbnails | `%LOCALAPPDATA%/vyu/cache/thumbnails/` |
| Display    | `%LOCALAPPDATA%/vyu/cache/displays/`   |
| Temp       | `%TEMP%/Vyu-temp/{unique-hash}/`       |

Temp dirs must be unique per operation. Concurrent operations must never share a temp dir.

## Code style

- Early returns over nested if/else.
- Small simple comments explaining what that part is. **Only if necessary.**
- No JSDoc on private helpers.
- Comments are terse: `// Section label` or `// Brief rationale`. No multi-sentence explanations. No inline comments on obvious operations.
- Avoid redundant guards already covered by earlier checks.
- Named functions over anonymous handlers unless closure state is required.
- `console.error` only for caught-and-swallowed failures.
- No logging on the happy path.
- User-facing copy is concise and neutral.

## Backend (Rust)

Tauri commands live in `src-tauri/src/commands/`, one file per domain.

Shared code:

- `util.rs`
- `types.rs`
- `constants.rs`
- `state/` — window state persistence

Key constraints:

- Cross-volume file moves must use copy+delete fallback on `ERROR_NOT_SAME_DEVICE`.
- Concurrent operations writing temp files must use unique hash-based subdirectories.
- `stat()` calls under sort operations are capped at 8 concurrent workers.

## Completion criteria

Before finishing:

- Ensure changes follow existing ownership boundaries.
- Ensure constants remain synchronized between TypeScript and Rust when modified.
- Preserve behavior outside the requested scope.
- Do not introduce new top-level dependencies without justification.

## Agent behavior

- Keep responses concise.
- Surface important decisions, blockers, or risks.
- When a required design decision is unclear, ask one focused question with concrete options.
- Do not guess architectural intent.
- Do not re-read files unnecessarily.
- Do not restate context already in scope.
