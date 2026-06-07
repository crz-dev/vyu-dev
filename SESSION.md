# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-06

## Last change
Formatted entire codebase with prettier. All files reformatted per project config. No logic changes.

## Status
- +page.svelte — working (989 lines, under 1000)
- ViewerArea.svelte — working
- playbackHelpers — working
- menuVisibility (isAnyOpen/closeAll) — working
- ffmpegHelpers (createEnsureFfprobe) — working
- All other modules — working

## Next
Extract createNavigation config into a navigationHelpers factory (largest remaining inline config block, ~55 lines).

## Bugs found this session
- None

## Current commit
style: format entire codebase with prettier

## Architecture update
_Only if a genuinely new module/concern was added this session that has no existing row in ARCHITECTURE.md —
add the minimum rows needed to the module ownership table. Do not rewrite, reformat, or touch anything else._
- None — formatting only
