# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-08

## Last change
Added transform handles on placed shapes. `PlacedShape` interface updated: `size` → `width`/`height`, added `rotation` (radians), `rounded` → `cornerRadius`. Selection state (`selectedIndex`) with auto-select on place. Four resize handles (left/right/top/bottom), corner-radius handle (squares only), rotation handle above top-center. All handles draggable via canvas pointer events; opposite edge stays fixed during resize. `drawTransformHandles` renders dashed bounding box + colored handles. `renderShape` in tools.ts supports rotation and ellipse. Rounded-corner toggle in MarkupMenu affects selected square.

## Status
- Type check: clean (0 errors, 0 warnings)
- Formatter: untested
- Rust build: untested

## Next
Pick up the next open issue or feature request.

## Bugs found this session
- Transforms added don't work on shapes, adding shapes takes priority. Fixed: hit-test raw pixel coordinates used `overlayRect.left` (container-offset) instead of canvas-relative position, causing coordinate mismatch. Switched to `p.x * overlayRect.width`.

## Current commit
feat: transform handles on placed shapes - resize, rotate, corner-radius

## Architecture update
- None.
