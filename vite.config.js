// @ts-check
/// <reference types="vite/client" />
import { defineConfig } from "vite";
import { sveltekit } from "@sveltejs/kit/vite";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [sveltekit()],

  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

  // 1. Prevent Vite from obscuring Rust errors
  clearScreen: false,
  // 2. target modern Chrome (WebView2) — skip unnecessary transpilation
  build: {
    target: "chrome120",
    rollupOptions: {
      output: {
        manualChunks: /** @param {string} id */ (id) => {
          if (id.includes("pdfjs-dist")) return "pdfjs";
        },
      },
    },
  },
  // 3. tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 4. tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
