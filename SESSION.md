# Session state
_Overwrite this file completely at end of every session. Never append._
Updated: 2026-06-07

## Last change
Two-session batch: 16 improvements across the codebase.

Security:
- Enabled CSP (was null) with permissive-but-scoped policy
- Narrowed asset protocol scope from `["**"]` to `$APPCACHE/$APPDATA/$TEMP/$HOME`
- Narrowed fs:scope from `["**"]` to same directories

Build/performance:
- Added Rust release profile with LTO=thin, codegen-units=1, strip=symbols
- Added Vite build.target chrome120 (skip transpilation for WebView2)
- Added manualChunks rule so pdfjs-dist (~4 MB) loads lazily as separate chunk
- Upgraded windows crate 0.58→0.61 (fixed RegOpenKeyExW/RegSetValueExW API)
- Removed unused `__APP_VERSION__` define and import chain from vite.config.js

Reliability:
- Fixed fix_media replace-mode data-loss: rename original to backup first, then put fixed file in place
- Patched browser temp file leak: clean stale files in Vyu-temp/browser/ before each new conversion
- Extracted shared getProgressBar() helper in markers.svelte.ts, replaced 4 identical fragile querySelector patterns
- Extracted loadImageAsElement()/saveCanvasToFile() helpers in tools.ts, removing 3 copies of duplicated canvas pipeline
- Removed dead code: check_media_integrity command (registered but never invoked from frontend), MediaIntegrity struct
- Extracted shared ffmpeg_command() helper in util.rs, replaced 15+ raw usages across 7 command files

Config/infra:
- Added .prettierignore, explicit prettier devDependency, format npm script
- Added type exports (ViewerStore, MarkupStore, etc.) to 12 feature modules
- Replaced all `any` types and 40+ inline template casts in ViewerArea.svelte with proper typed imports

## Status
- Type check: clean (0 errors, 0 warnings)
- Rust build: clean (dev profile)
- Formatter: clean
- Security: CSP enabled, scopes narrowed

## Next
Pick up the next open issue or feature request.

## Bugs found this session
- None.

## Current commit
chore: security hardening, build optimization, and code cleanup

## Architecture update
- `src-tauri/src/util.rs`: added `ffmpeg_command()` helper, used by all command files
- Type exports added to 12 feature modules for component type safety
