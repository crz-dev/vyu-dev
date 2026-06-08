# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-07

## Last change
Fixed markup state leak in `closeFile()` (`navigation.svelte.ts` line 196) — `markup.cleanup()` was never called when closing a file, so opening a new file after drawing strokes inherited the old annotations. Also removed the duplicate `markup.cleanup()` call on line 78 (harmless no-op). Verified with `pnpm check` — zero errors.

## Status
- Frontend: markup cleanup now fires on both file-switch and file-close paths
- Type check: clean

## Next
Pick up the next open issue or feature request.

## Bugs found this session
- None.

## Current commit
fix: add markup.cleanup() to closeFile(), remove duplicate call

## Architecture update
None.
