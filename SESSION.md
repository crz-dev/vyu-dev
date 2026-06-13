# Session state

_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-12

## Last change

Fixed library reactivity (thumbnails not appearing on first open) and performance (serial queue → 4 concurrent loads). Root cause: `$state(Map)` `.set()` loses subscriptions for keys not previously read — replaced with `$state(Record)` object. Added center-outward `rebuildQueue()` driven by `currentIndex` so relevant thumbnails load first. Removed `observed` Set that was recreated on every intersection entry (GC churn). Replaced O(n) `fileList.indexOf(path) === currentIndex` in `{#each}` with O(1) `activePaths` derived Set.

Files: `library.svelte.ts`, `LibraryView.svelte`

## Status

- Library thumbnail loading: concurrent (4 in-flight), center-outward priority (working)
- Library thumbnail reactivity on first open: `$state` Record triggers re-render on property assignment (fixed)
- Library queue: cleared on close, rebuilt on fileList/currentIndex change (working)
- Active cell detection: O(1) via derived Set (fixed)
- Observer: created once, no Set recreation per entry (fixed)
- Type check: passing

## Next

Visual polish: frosted glass overlay, open/close animation, scroll-to-current-file, media-type icons on cells.

## Bugs found this session

- `$state(Map).set()` does not trigger reactivity for keys that returned `undefined` on first `.get()` read — switched to `$state(Record)` with direct property assignment.
- IntersectionObserver `observed` Set recreated on every visible entry — removed; `requestThumbnail` handles dedup internally.
- Queue processor only allowed 1 concurrent thumbnail load (`inFlight >= 1`) — bumped to `MAX_CONCURRENT = 4`.
- No center-outward priority — thumbnails loaded in FIFO insertion order, ignoring `currentIndex`.

## Current commit

fix: reactive thumbnail cache and concurrent loading in library

## Architecture update

None.
