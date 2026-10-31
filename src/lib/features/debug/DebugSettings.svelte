<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { save } from "@tauri-apps/plugin-dialog";
  import { writeTextFile } from "@tauri-apps/plugin-fs";
  import { showToast } from "$lib/components/toast.svelte";
  import SettingsGroupIcon from "$lib/components/SettingsGroupIcon.svelte";
  import { copyTextToClipboard } from "$lib/services/clipboard";
  import { debugPrefs } from "$lib/features/debug/debugPrefs.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import {
    collectDebugInfo,
    diagnosticsJson,
    fileMetadataJson,
    formatBytes,
  } from "$lib/features/debug/debugInfo";
  import { invokeVacuumDatabase } from "$lib/features/debug/api";
  import type {
    DebugFileInfo,
    DebugInfo,
  } from "$lib/features/debug/debugTypes";
  import {
    invokeOpenDevTools,
    invokeRestartAppMode,
  } from "$lib/features/system/api";

  let {
    flash = false,
    fileInfo = null,
  }: {
    flash?: boolean;
    fileInfo?: DebugFileInfo | null;
  } = $props();

  let info = $state<DebugInfo | null>(null);
  let loading = $state(true);
  let refreshing = $state(false);
  let compacting = $state(false);
  let error = $state("");
  let detailsOpen = $state(false);

  onMount(() => {
    void load();
  });

  async function load(refresh = false) {
    if (refresh) refreshing = true;
    else loading = true;
    try {
      info = await collectDebugInfo(fileInfo);
      error = "";
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
      refreshing = false;
    }
  }

  function shortPath(path: string): string {
    if (!path) return "—";
    const parts = path.replace(/\//g, "\\").split("\\").filter(Boolean);
    return parts.length <= 2 ? path : parts.slice(-2).join("\\");
  }

  function platformLabel(): string {
    if (!info) return "Loading…";
    return `${info.runtime.os} · ${info.runtime.arch} · ${info.platform}`;
  }

  function gpuLabel(): string {
    if (!info) return "Loading…";
    if (!info.gpu.available) return "Unavailable";
    return `${info.gpu.vendor} · ${info.gpu.renderer}`;
  }

  function encoderLabel(): string {
    if (!info) return "Loading…";
    return info.ffmpeg.hardwareEncoders.length > 0
      ? info.ffmpeg.hardwareEncoders.join(", ")
      : "Software only";
  }

  function databaseLabel(): string {
    if (!info) return "Loading…";
    return `${formatBytes(info.database.sizeBytes + info.database.walBytes)} · ${info.database.metadataRows} files`;
  }

  async function copyDiagnostics() {
    if (!info) await load();
    if (!info) {
      showToast({ message: "Diagnostics unavailable", color: "red" });
      return;
    }
    try {
      await copyTextToClipboard(diagnosticsJson(info));
      showToast({ message: "Diagnostics copied", color: "green" });
    } catch {
      showToast({ message: "Failed to copy diagnostics", color: "red" });
    }
  }

  async function exportDiagnostics() {
    if (!info) await load();
    if (!info) {
      showToast({ message: "Diagnostics unavailable", color: "red" });
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = await save({
      defaultPath: `vyu-diagnostics-${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await writeTextFile(path, diagnosticsJson(info));
      showToast({ message: "Diagnostics exported", color: "green" });
    } catch {
      showToast({ message: "Failed to export diagnostics", color: "red" });
    }
  }

  async function copyFileMetadata() {
    if (!fileInfo?.filePath) {
      showToast({ message: "No file is open", color: "yellow" });
      return;
    }
    try {
      await copyTextToClipboard(fileMetadataJson(fileInfo));
      showToast({ message: "File metadata copied", color: "green" });
    } catch {
      showToast({ message: "Failed to copy file metadata", color: "red" });
    }
  }

  async function compactDatabase() {
    if (compacting) return;
    compacting = true;
    try {
      const freed = await invokeVacuumDatabase();
      await load(true);
      showToast({
        message:
          freed > 0
            ? `Database compacted · freed ${formatBytes(freed)}`
            : "Database already compact",
        color: freed > 0 ? "green" : "yellow",
      });
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    } finally {
      compacting = false;
    }
  }

  async function restartMode() {
    const safeMode = !info?.runtime.safeMode;
    try {
      await invokeRestartAppMode(safeMode);
    } catch {
      // The process exits before the IPC response arrives.
    }
  }
</script>

<div id="settings-section-debug" class="settings-section" class:flash>
  <p class="settings-section-header">
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      ><path d="M12 2L2 7l10 5 10-5-10-5z" /><path d="M2 17l10 5 10-5" /><path
        d="M2 12l10 5 10-5"
      /></svg
    >
    Debug
  </p>

  {#if error}
    <div class="settings-row keybind-empty-row">
      <span class="settings-hint" style="color: var(--red)">{error}</span>
    </div>
  {/if}

  <p class="settings-group-label">
    <span class="settings-group-icon">
      <SettingsGroupIcon name="cpu" />
    </span>
    Runtime
  </p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-text">
        <span class="settings-label">Vyu</span>
      </div>
      <span class="settings-hint"
        >{info?.appVersion ?? (loading ? "Loading…" : "Unavailable")} · Tauri
        {info?.tauriVersion ?? "—"}</span
      >
    </div>
    <div class="settings-row">
      <div class="settings-label-text">
        <span class="settings-label">GPU</span>
      </div>
      <span class="settings-hint" title={gpuLabel()}>{gpuLabel()}</span>
    </div>
    <div class="settings-row">
      <div class="settings-label-text">
        <span class="settings-label">FFmpeg</span>
      </div>
      <span class="settings-hint"
        >{info?.ffmpeg.ffmpegVersion ?? "—"} · {encoderLabel()}</span
      >
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Runtime Details</span>
          <span class="settings-hint"
            >WebView2, system, safety and maintenance</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          onclick={() => (detailsOpen = !detailsOpen)}
        >
          {detailsOpen ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  </div>

  {#if detailsOpen}
    <div
      class="settings-group-stack"
      transition:slide={{ duration: appearance.reducedMotion ? 0 : 160 }}
    >
      <p class="settings-group-label">
        <span class="settings-group-icon">
          <SettingsGroupIcon name="info" />
        </span>
        Details
      </p>
      <div class="settings-card has-child">
        <div class="settings-row">
          <div class="settings-label-text">
            <span class="settings-label">WebView2</span>
          </div>
          <span class="settings-hint">{info?.webview2Version ?? "—"}</span>
        </div>
        <div class="settings-row">
          <div class="settings-label-text">
            <span class="settings-label">System</span>
          </div>
          <span class="settings-hint">{platformLabel()}</span>
        </div>
        <div class="settings-row">
          <div class="settings-label-text">
            <span class="settings-label">Acceleration</span>
          </div>
          <span class="settings-hint"
            >{info
              ? info.systemConfig.hardwareAcceleration
                ? "Enabled"
                : "Disabled"
              : "—"}</span
          >
        </div>
        <div class="settings-row">
          <div class="settings-label-text">
            <span class="settings-label">FFmpeg Path</span>
          </div>
          <span class="settings-hint" title={info?.ffmpeg.ffmpegPath ?? ""}
            >{shortPath(info?.ffmpeg.ffmpegPath ?? "")}</span
          >
        </div>
        <div class="settings-row">
          <div class="settings-label-text">
            <span class="settings-label">Safe Mode</span>
          </div>
          <span class="settings-hint"
            >{info ? (info.runtime.safeMode ? "On" : "Off") : "—"}</span
          >
        </div>
        <div class="settings-row">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label">Database</span>
              <span class="settings-hint">{databaseLabel()}</span>
            </div>
          </div>
          <div class="settings-control">
            <button
              class="settings-action-btn"
              onclick={compactDatabase}
              disabled={compacting || loading}
              >{compacting ? "Compacting…" : "Compact"}</button
            >
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label">Open Webview DevTools</span>
              <span class="settings-hint">Inspect the app window</span>
            </div>
          </div>
          <div class="settings-control">
            <button
              class="settings-action-btn"
              onclick={() => void invokeOpenDevTools()}>Open</button
            >
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label">Debug Overlay</span>
              <span class="settings-hint"
                >FPS, heap, media state and viewport</span
              >
            </div>
          </div>
          <div class="settings-control">
            <label class="toggle-row">
              <input
                type="checkbox"
                checked={debugPrefs.overlayOpen}
                onchange={(e) =>
                  debugPrefs.setOverlayOpen(e.currentTarget.checked)}
              />
              <span class="toggle-track" class:on={debugPrefs.overlayOpen}
                ><span class="toggle-thumb"></span></span
              >
            </label>
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label">Refresh</span>
              <span class="settings-hint"
                >Reload runtime and graphics details</span
              >
            </div>
          </div>
          <div class="settings-control">
            <button
              class="settings-action-btn"
              onclick={() => load(true)}
              disabled={refreshing}
              >{refreshing ? "Refreshing…" : "Refresh"}</button
            >
          </div>
        </div>
        <div class="settings-row">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label">Restart Mode</span>
              <span class="settings-hint"
                >{info?.runtime.safeMode
                  ? "Relaunch without --safe-mode"
                  : "Relaunch with --safe-mode"}</span
              >
            </div>
          </div>
          <div class="settings-control">
            <button class="settings-action-btn" onclick={restartMode}
              >{info?.runtime.safeMode
                ? "Restart Normally"
                : "Restart in Safe Mode"}</button
            >
          </div>
        </div>
      </div>
    </div>
  {/if}

  <p class="settings-group-label">
    <span class="settings-group-icon">
      <SettingsGroupIcon name="file" />
    </span>
    Diagnostics
  </p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Copy Diagnostics</span>
          <span class="settings-hint"
            >App, graphics, FFmpeg, database, caches and keybinds</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button class="settings-action-btn" onclick={copyDiagnostics}
          >Copy</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Export Diagnostics</span>
          <span class="settings-hint">Save the same report as JSON</span>
        </div>
      </div>
      <div class="settings-control">
        <button class="settings-action-btn" onclick={exportDiagnostics}
          >Export</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Current File Metadata</span>
          <span class="settings-hint"
            >{fileInfo?.fileName || "No file open"}</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          onclick={copyFileMetadata}
          disabled={!fileInfo?.filePath}>Copy</button
        >
      </div>
    </div>
  </div>
</div>
