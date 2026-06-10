# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-09

## Last change
Improved the edit/markup action submenu (Undo/Reset | Export/Apply) on both EditMenu and MarkupMenu. Three changes: (1) Reset button now requires a two-click confirmation — first click shows "Confirm" with a `?` icon and a red pulse highlight, second click executes reset; state auto-reverts after 3s. (2) Swapped Reset above Undo in the left action bar. (3) Fixed the exit animation — action bars now slide sideways out when edits are undone (CSS transition via `.has-edits` class), but fade upward when the entire menu closes (`out:fly={{ y: -26 }}`), matching the main menu's exit.

Files changed: `EditMenu.svelte`, `MarkupMenu.svelte`, `components.css`.

## Status
- Type check: clean
- Formatter: untested
- Rust build: untested

## Next
Text word wrapping / multi-line support.

## Bugs found this session
- None.

## Current commit
feat: add reset confirm, swap undo/reset, fix action bar exit animation

## Architecture update
- None.
