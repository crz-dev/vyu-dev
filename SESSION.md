# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-07

## Last change
Fixed app dropdown menu not opening — `__APP_VERSION__` define was removed from `vite.config.js` in the previous commit but `AppDropdownMenu.svelte`, `AboutDialog.svelte`, and `FeedbackDialog.svelte` still reference it. Without the build-time replacement, `__APP_VERSION__` is undefined at runtime, throwing a ReferenceError when any of these components mount.

Restored the `define` block with `readFileSync`/`package.json` import chain.

## Status
- Type check: clean
- Rust build: untouched
- Formatter: clean
- App dropdown menu: working

## Next
Pick up the next open issue or feature request.

## Bugs found this session
- `__APP_VERSION__` define removed in commit faa654f but still referenced by 3 components — caused ReferenceError on any component mount that renders the version string.

## Current commit
fix: restore __APP_VERSION__ define in vite.config.js

## Architecture update
None.
