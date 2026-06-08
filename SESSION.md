# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-07

## Last change
Extracted `run_ffmpeg` polling-loop helper (replaces 5 duplicated loops), `MediaKind` struct (replaces 3 boolean chains), `thumbnail_via_image_crate`/`thumbnail_via_ffmpeg` helpers (split monolithic `get_thumbnail` body). Named thumbnail magic numbers. Capped `sessionEdits` at 100 entries. Typed `onRenamed` in Shell.svelte. Removed empty `features/ui/` directory.

## Status
- Rust backend: `run_ffmpeg`, `MediaKind`, thumbnail helpers extracted — working
- `editing.svelte.ts`: `sessionEdits` LRU cap added — working
- `Shell.svelte`: `onRenamed` type tightened — working

## Next
Pick up the next open issue or feature request.

## Bugs found this session
- `navigation.svelte.ts` lines 77–78: `markup.cleanup()` called twice consecutively
- `lib.rs` `hash_path` line 344: uses non-deterministic `DefaultHasher` but still called by `convert_audio_to_waveform_video`; prefer `hash_path_xxh3`

## Current commit
refactor: extract run_ffmpeg helper, MediaKind struct, cap sessionEdits

## Architecture update
None — no new modules added.
