// Fails when the tracked SongRec sidecar placeholder has been replaced with a
// real binary. The real SongRec binary is supplied at build time and must never
// be committed; see README.md.
import { existsSync, statSync } from "node:fs";

const PLACEHOLDER = "src-tauri/binaries/songrec-x86_64-pc-windows-msvc.exe";
const MAX_PLACEHOLDER_BYTES = 1024;

if (!existsSync(PLACEHOLDER)) {
  console.error(`Missing sidecar placeholder: ${PLACEHOLDER}`);
  process.exit(1);
}

const { size } = statSync(PLACEHOLDER);
if (size > MAX_PLACEHOLDER_BYTES) {
  console.error(
    `Sidecar placeholder is ${size} bytes (limit ${MAX_PLACEHOLDER_BYTES}).\n` +
      "The real SongRec binary is supplied at build time, not committed.",
  );
  process.exit(1);
}

console.log(`Sidecar placeholder ok (${size} bytes).`);
