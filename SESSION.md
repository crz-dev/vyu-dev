# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-10

## Last change
Added video-specific equalizer presets (Dialogue, Movie, Cinema, Action, Night Mode, Surround) that only appear for video files; audio presets unchanged. Changed video context menu from Edit/Markup to Edit/Equalizer. `EqualizerMenu.svelte` split presets into `audioPresets`/`videoPresets` keyed on new `isVideo` prop. `Dialog.svelte` video `{:else}` branch markup button replaced with equalizer button. `Shell.svelte` passes `isVideo` through.

## Status
- EqualizerMenu: working (correct presets per media type)
- Video context menu: working (Edit/Equalizer instead of Edit/Markup)
- Audio presets: untouched, still working
- Type check: passing

## Next
Preset gain values may need tuning — confirm with real audio testing.

## Bugs found this session
- None.

## Current commit
feat: add video equalizer presets and context menu edit/equalizer

## Architecture update
- None.
