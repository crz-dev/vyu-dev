# Session state

_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-13

## Last change

Audit-driven fixes across 11 files: restored thumbnail cache reactivity (reverted Map to $state<Record>), added stat() concurrency cap (8 workers) for sort operations, fixed temp dir race in browser conversion (unique hash-based subdir), added cross-volume rename fallback (copy+delete), moved dynamic imports to static in init.ts, deduplicated key conditionals in keybinds.ts, enabled type checking in vite.config.js with JSDoc annotation.

Files: `conversion.rs`, `file_ops.rs`, `library.svelte.ts`, `files.ts`, `keybinds.ts`, `init.ts`, `vite.config.js`, plus prettier reformatted `LibraryView.svelte`, `MediaBar.svelte`, `AppMenu.svelte`, `playback.svelte.ts`, `tools.ts`

## Status

- Thumbnail loading: working (reverted $state<Record> — Map broke proxy reactivity)
- stat() concurrency: fixed (8-worker limit in sortFileList)
- Temp dir race in conversion.rs: fixed (unique hash-based subdir)
- Cross-volume rename: fixed (copy+delete fallback on ERROR_NOT_SAME_DEVICE)
- Static imports in init.ts: fixed
- Keybind deduplication: fixed (merged if/else branches into else-if chain)
- vite.config.js type checking: fixed (ts-check + JSDoc param annotation)
- Type check: passing (0 errors, 0 warnings)

## Next

Extract state and prop bundles from +page.svelte into feature modules to eliminate the 1123-line god component.

## Bugs found this session

- Library thumbnail cache changed from `$state<Record>` to `Map` broke all thumbnail loading — LibraryView uses `cache[path]` bracket access which `$state` tracks via proxy, `Map.set()` is opaque and not reactive
- `vite.config.js` `// @ts-nocheck` → `// @ts-check` flagged missing type on `manualChunks` `id` parameter
- `convert_for_browser()` used shared `Vyu-temp/browser/` dir; concurrent ops could delete each other's temp files
- `rename_file()` failed silently across mount points with no fallback for `ERROR_NOT_SAME_DEVICE`

## Current commit

fix: thumbnail cache, stat concurrency, cross-device rename

## Architecture update

None.
