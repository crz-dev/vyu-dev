# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-10

## Last change
Wired the 4 erase submenu buttons (Select, Remove, Hide, Clear all) in `MarkupMenu.svelte` — no longer placeholders. Added erase states (`selectActive`, `removeActive`, `strokesHidden`), unified hit-testing (`findStrokeAt`), multi-select (`selectedIndices`, `selectShapes`, `moveSelectedStrokesBy`), and selection-box support (`findStrokesInRect`) to `markup.svelte.ts`. Rebuilt interaction in `DrawOverlay.svelte`: select mode now supports click-to-select, drag-to-move (multi-selection), and marquee selection box; transform handles (resize/rotate/delete) work in select mode; remove mode acts as an eraser brush; hide toggles all rendering off/on. Added pan guard in `ViewerArea.svelte` for select/remove modes.

## Status
- Type check: passing
- Formatter: untested
- Erase submenu: working (Select, Remove, Hide, Clear all)
- Select multi-drag: working
- Selection box: working
- Remove (eraser): working
- Hide toggle: working
- Clear all confirm: working

## Next
Text word wrapping / multi-line support.

## Bugs found this session
- None.

## Current commit
feat: implement erase submenu with select, remove, hide, and clear all

## Architecture update
- None.
