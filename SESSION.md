# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-09

## Last change
Reordered markup shapes menu to: Rounded toggle | Square, Circle, Triangle | Line, Arrow, Bidirectional | Freeform toggle. Added `data-tooltip` to all shape and line buttons. Fixed tooltip visibility in `.menu-open` context (`tooltips.css` override). Fixed tooltip snapping by setting `top` on the base rule.

## Status
- Type check: clean (0 errors, 0 warnings)
- Formatter: untested
- Rust build: untested

## Next
Pick up the next open issue or feature request.

## Bugs found this session
- Tooltips didn't appear inside the markup menu because `.menu-open [data-tooltip]::after { opacity: 0 !important; }` suppressed them globally. Fixed by adding `.menu-open .edit-menu [data-tooltip]:hover::after` override.
- Tooltips appeared at the wrong position (on top of the button) because no `top` was set on the `::after` pseudo-element. Fixed by adding `top: calc(100% + 6px)` to the override base rule.
- Tooltips flickered/jumped on hover because `top` was only set on `:hover::after`, causing a position snap when the property was applied. Fixed by moving `top` to the base rule (always present) so only `opacity` transitions.

## Current commit
fix: reorder markup shapes menu and add tooltips with proper positioning

## Architecture update
- None.
