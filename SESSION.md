# Session state

_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-10

## Last change

Wired EqualizerMenu UI to a real Web Audio API 10-band peaking EQ via shared audio engine. Sliders now update BiquadFilterNode gain in real-time, bypass toggles filter engagement, presets apply band values, output gain controls post-EQ volume. Added per-file persistence to localStorage (`vyu-eq-${filePath}`) with stale entry cleanup. CdVisual (vinyl) and AudioModernLayout (cassette) both connect the `<audio>` element through the engine. Video element also connects when playing video files.

## Status

- EqualizerMenu: working (all sliders, presets, bypass, gain, reset affect actual audio)
- Per-file persistence: working (save on every change, load on file switch)
- Video EQ: working (video audio routes through same filter chain)
- CdVisual bass animation: working (reads analyser post-EQ from shared engine)
- Type check: passing

## Next

Text word wrapping / multi-line support.

## Bugs found this session

- None.

## Current commit

feat: wire equalizer menu to Web Audio API filter chain with per-file persistence

## Architecture update

- `src/lib/features/equalizer/equalizer-engine.ts` — lazy AudioContext singleton managing 10-band peaking BiquadFilterNode chain → GainNode → AnalyserNode → destination. Idempotent `connectMediaElement()` for HTMLMediaElement.
- `src/lib/features/equalizer/equalizer-store.svelte.ts` — Svelte 5 runes reactive wrapper with $state for bands, bypass, outputGain, activePreset; auto-saves to localStorage.
- `src/lib/features/equalizer/band-config.ts` — band frequencies (30–16000 Hz), derived Q values, format helpers.
