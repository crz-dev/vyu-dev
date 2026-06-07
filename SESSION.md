# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-06

## Last change
Reduced +page.svelte from 1230 to 989 lines (under 1000 target met). Extracted: ensureFfprobe into ffmpegHelpers.ts, isAnyOpen/closeAll into menuVisibility.svelte.ts, onMediaEnded and frameStep into playbackHelpers.ts, entire children snippet (~205 lines) into ViewerArea.svelte component. Removed dead code including unused imports (ALL_EXTS, AUDIO_EXTS, createPlaybackActions, invoke, convertFileSrc, SortMode), unused variables (cycleLoopMode, performApply, performExport, updateTimestampTitle, getTimestampById, setABLoop, updateTooltipDuringDrag). TypeScript strict, 0 errors.

## Status
- +page.svelte — working (989 lines, under 1000)
- ViewerArea.svelte — working
- playbackHelpers — working
- menuVisibility (isAnyOpen/closeAll) — working
- ffmpegHelpers (createEnsureFfprobe) — working

## Next
Extract createNavigation config into a navigationHelpers factory (largest remaining inline config block, ~55 lines). Requires careful handling of SetMediaStateSetters interface mapping.

## Bugs found this session
- None

## Current commit
refactor: extract page content into ViewerArea and playback helpers

## Architecture update
_Only if a genuinely new module/concern was added this session that has no existing row in ARCHITECTURE.md —
add the minimum rows needed to the module ownership table. Do not rewrite, reformat, or touch anything else._
- None needed — playbackHelpers are part of existing playback concern, ViewerArea is a view layout container
