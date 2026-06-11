# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-11

## Last change
Wired Stage buttons (Mono, Stereo, Surround, 8D) to Web Audio API spatial processing. Added `setStage()`/`getStageMode()` to `equalizer-engine.ts` with node graphs for each mode: mono (channel summing), stereo (pass-through), surround (crossfeed with delay+lowpass), 8D (StereoPannerNode + sine LFO at 1/8 Hz, ~8s cycle). Stage persists until toggled off or song changes. Added `filePath` prop to EffectsMenu to reset UI state on file skip.

## Status
- EffectsMenu icons: working
- Filter/Stage radio behavior: working
- Tune sliders: working (now actually modulates audio)
- Pitch effect: working (playbackRate adjustment)
- Reverb effect: working (ConvolverNode with generated IR, dry/wet mix)
- Chorus effect: working (DelayNode + LFO modulation, dry/wet mix)
- Distortion effect: working (WaveShaperNode with sigmoid curve)
- Stage Mono: working (ChannelSplitter → sum at 0.5 gain → ChannelMerger)
- Stage Stereo: working (pass-through, no processing)
- Stage Surround: working (crossfeed with 0.4ms delay + 3kHz lowpass + 0.3 gain)
- Stage 8D: working (StereoPannerNode + sine LFO at 1/8 Hz, ~8s cycle)
- Stage reset on file skip: working (syncs from engine on filePath change)
- Type check: passing

## Next
None.

## Bugs found this session
- None.

## Current commit
feat: wire stage menu buttons to Web Audio API spatial processing

## Architecture update
- `equalizer-engine.ts` — added stage audio processing at end of chain (analyser → stage → destination). `setStage(mode)` builds/tears down spatial AudioNode graphs. Stage resets on song change via chain rebuild.
