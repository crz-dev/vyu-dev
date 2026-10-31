<script lang="ts">
  import { onDestroy } from "svelte";
  import { showToast } from "$lib/components/toast.svelte";
  import {
    invokeClearAllMarkers,
    invokeDeleteBundledFfmpeg,
    invokeFactoryResetDatabase,
    invokeRunUninstaller,
    type MarkerClearMode,
  } from "$lib/features/danger/api";
  import type { DebugFileInfo } from "$lib/features/debug/debugTypes";
  import { editing } from "$lib/features/editing/editing.svelte";
  import {
    invokeClearBackups,
    invokeCleanupTempFolder,
  } from "$lib/features/media/api";
  import { conversionPrefs } from "$lib/features/media/conversionPrefs.svelte";
  import {
    invokeClearAllCaches,
    invokeResetSystemIntegrations,
  } from "$lib/features/system/api";

  type ActionId =
    | "reset-view"
    | "timestamps"
    | "clips"
    | "markers"
    | "backups"
    | "clean-temp"
    | "reset-settings"
    | "factory-reset"
    | "delete-ffmpeg"
    | "uninstall";

  type RiskId = "backups" | "conversion" | "clips";

  const CRITICAL_WORDS: Partial<Record<ActionId, string>> = {
    "reset-settings": "RESET",
    "factory-reset": "FACTORY",
    "delete-ffmpeg": "DELETE",
    uninstall: "UNINSTALL",
  };

  let {
    flash = false,
    fileInfo = null,
    resetView,
    clearTimestamps,
    clearClips,
    clipDeleteOriginal = false,
    toggleClipDeleteOriginal = () => {},
  }: {
    flash?: boolean;
    fileInfo?: DebugFileInfo | null;
    resetView: () => void;
    clearTimestamps: () => void;
    clearClips: () => void;
    clipDeleteOriginal?: boolean;
    toggleClipDeleteOriginal?: () => void;
  } = $props();

  let busy = $state<ActionId | null>(null);
  let pending = $state<ActionId | null>(null);
  let typed = $state("");
  let timer: ReturnType<typeof setTimeout> | null = null;

  const hasActiveRisks = $derived(
    editing.backupMode === "off" ||
      conversionPrefs.deleteOriginal ||
      clipDeleteOriginal,
  );

  onDestroy(clearPendingTimer);

  function clearPendingTimer() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function resetPending() {
    clearPendingTimer();
    pending = null;
    typed = "";
  }

  function startPending(id: ActionId) {
    if (busy) return;
    clearPendingTimer();
    pending = id;
    typed = "";
    if (!CRITICAL_WORDS[id]) {
      timer = setTimeout(() => {
        pending = null;
        typed = "";
        timer = null;
      }, 5000);
    }
  }

  function requestAction(id: ActionId) {
    if (busy) return;
    if (pending === id && !CRITICAL_WORDS[id]) {
      resetPending();
      void execute(id);
      return;
    }
    startPending(id);
  }

  function typedMatches(id: ActionId): boolean {
    const word = CRITICAL_WORDS[id];
    return !!word && typed.trim().toUpperCase() === word;
  }

  function confirmTyped() {
    if (!pending || busy || !typedMatches(pending)) return;
    const id = pending;
    resetPending();
    void execute(id);
  }

  function actionDisabled(id: ActionId): boolean {
    if (busy) return true;
    if (id === "reset-view") return !fileInfo?.filePath;
    if (pending === id && CRITICAL_WORDS[id]) return true;
    return false;
  }

  function buttonLabel(id: ActionId, label: string): string {
    return pending === id && !CRITICAL_WORDS[id] ? "Confirm?" : label;
  }

  function clearLocalPrefs() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith("vyu-")) localStorage.removeItem(key);
    }
  }

  function clearLegacyMarkerKeys(mode: MarkerClearMode) {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (
        (mode !== "clips" && key.startsWith("vyu-ts-")) ||
        (mode !== "timestamps" && key.startsWith("vyu-clips-"))
      ) {
        localStorage.removeItem(key);
      }
    }
  }

  async function clearMarkers(mode: MarkerClearMode) {
    const count = await invokeClearAllMarkers(mode);
    clearLegacyMarkerKeys(mode);
    if (mode !== "clips") clearTimestamps();
    if (mode !== "timestamps") clearClips();
    const noun =
      mode === "timestamps"
        ? "timestamps"
        : mode === "clips"
          ? "clip boundaries"
          : "markers";
    showToast({
      message:
        count > 0
          ? `Cleared ${noun} from ${count} file${count === 1 ? "" : "s"}`
          : `No ${noun} to clear`,
      color: count > 0 ? "green" : "yellow",
    });
  }

  async function clearBackups() {
    const freed = await invokeClearBackups(editing.backupDir || undefined);
    editing.clearBackupState();
    showToast({
      message: freed > 0 ? "File backups cleared" : "No file backups to clear",
      color: freed > 0 ? "green" : "yellow",
    });
  }

  async function resetAllSettings() {
    try {
      await invokeResetSystemIntegrations();
    } catch {
      // System integration reset is best-effort; local preferences still clear.
    }
    clearLocalPrefs();
    window.location.reload();
  }

  async function factoryReset() {
    await invokeFactoryResetDatabase();
    clearTimestamps();
    clearClips();
    await invokeClearAllCaches();
    await invokeClearBackups(editing.backupDir || undefined);
    editing.clearBackupState();
    await invokeCleanupTempFolder();
    try {
      await invokeResetSystemIntegrations();
    } catch {
      // System integration reset is best-effort; local preferences still clear.
    }
    clearLocalPrefs();
    window.location.reload();
  }

  async function deleteFfmpeg() {
    await invokeDeleteBundledFfmpeg();
    showToast({
      message: "Bundled FFmpeg deleted · restart required",
      color: "green",
    });
  }

  async function uninstall() {
    const result = await invokeRunUninstaller();
    if (!result.started) {
      showToast({ message: "Opened Windows Apps settings", color: "blue" });
    }
  }

  function fixRisk(id: RiskId) {
    if (id === "backups") {
      editing.setBackupMode("ask");
      showToast({ message: "File backups enabled", color: "green" });
    } else if (id === "conversion") {
      conversionPrefs.setDeleteOriginal(false);
      showToast({
        message: "Original files will be kept after conversion",
        color: "green",
      });
    } else if (clipDeleteOriginal) {
      toggleClipDeleteOriginal();
      showToast({
        message: "Original files will be kept after clip export",
        color: "green",
      });
    }
  }

  async function execute(id: ActionId) {
    if (busy) return;
    busy = id;
    try {
      switch (id) {
        case "reset-view":
          resetView();
          showToast({ message: "View reset", color: "green" });
          break;
        case "timestamps":
          await clearMarkers("timestamps");
          break;
        case "clips":
          await clearMarkers("clips");
          break;
        case "markers":
          await clearMarkers("all");
          break;
        case "backups":
          await clearBackups();
          break;
        case "clean-temp":
          await invokeCleanupTempFolder();
          showToast({ message: "Temporary files cleaned", color: "green" });
          break;
        case "reset-settings":
          await resetAllSettings();
          break;
        case "factory-reset":
          await factoryReset();
          break;
        case "delete-ffmpeg":
          await deleteFfmpeg();
          break;
        case "uninstall":
          await uninstall();
          break;
      }
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    } finally {
      busy = null;
    }
  }
</script>

{#snippet typedConfirm(id: ActionId)}
  {#if pending === id}
    <div class="danger-confirm">
      <span class="danger-confirm-label"
        >Type <strong>{CRITICAL_WORDS[id]}</strong> to confirm</span
      >
      <input
        class="danger-confirm-input"
        bind:value={typed}
        placeholder={CRITICAL_WORDS[id]}
        autocomplete="off"
        spellcheck="false"
        onkeydown={(e) => {
          if (e.key === "Enter") confirmTyped();
        }}
      />
      <button
        class="settings-action-btn red"
        disabled={busy !== null || !typedMatches(id)}
        onclick={confirmTyped}>Confirm</button
      >
      <button class="settings-action-btn" onclick={resetPending}>Cancel</button>
    </div>
  {/if}
{/snippet}

<div id="settings-section-danger-zone" class="settings-section" class:flash>
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
      ><path
        d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      /><line x1="12" y1="9" x2="12" y2="13" /><line
        x1="12"
        y1="17"
        x2="12.01"
        y2="17"
      /></svg
    >
    Danger Zone
  </p>
  <p class="settings-hint danger-intro">
    Irreversible actions. Media files on disk are never deleted here.
  </p>

  <p class="settings-group-label">Active Risks</p>
  <div class="settings-card has-child">
    {#if editing.backupMode === "off"}
      <div class="settings-row">
        <div class="settings-label-col">
          <svg
            class="settings-row-icon danger-risk-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path
              d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            /><line x1="12" y1="9" x2="12" y2="13" /><line
              x1="12"
              y1="17"
              x2="12.01"
              y2="17"
            /></svg
          >
          <div class="settings-label-text">
            <span class="settings-label">File backups are off</span>
            <span class="settings-hint"
              >Edits may be applied without a saved original</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button class="settings-action-btn" onclick={() => fixRisk("backups")}
            >Enable</button
          >
        </div>
      </div>
    {/if}
    {#if conversionPrefs.deleteOriginal}
      <div class="settings-row">
        <div class="settings-label-col">
          <svg
            class="settings-row-icon danger-risk-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path
              d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            /><line x1="12" y1="9" x2="12" y2="13" /><line
              x1="12"
              y1="17"
              x2="12.01"
              y2="17"
            /></svg
          >
          <div class="settings-label-text">
            <span class="settings-label">Delete original after conversion</span>
            <span class="settings-hint"
              >Converting permanently removes the source file</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button
            class="settings-action-btn"
            onclick={() => fixRisk("conversion")}>Disable</button
          >
        </div>
      </div>
    {/if}
    {#if clipDeleteOriginal}
      <div class="settings-row">
        <div class="settings-label-col">
          <svg
            class="settings-row-icon danger-risk-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><path
              d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            /><line x1="12" y1="9" x2="12" y2="13" /><line
              x1="12"
              y1="17"
              x2="12.01"
              y2="17"
            /></svg
          >
          <div class="settings-label-text">
            <span class="settings-label">Delete original after clip export</span
            >
            <span class="settings-hint"
              >Clip export permanently removes the source file</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button class="settings-action-btn" onclick={() => fixRisk("clips")}
            >Disable</button
          >
        </div>
      </div>
    {/if}
    {#if !hasActiveRisks}
      <div class="settings-row danger-risk-safe">
        <div class="settings-label-col">
          <svg
            class="settings-row-icon"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"><path d="M20 6L9 17l-5-5" /></svg
          >
          <div class="settings-label-text">
            <span class="settings-label">No high-risk settings enabled</span>
            <span class="settings-hint"
              >Backups and originals are preserved</span
            >
          </div>
        </div>
      </div>
    {/if}
  </div>

  <p class="settings-group-label">Current View</p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polyline points="23 4 23 10 17 10" /><path
            d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Reset View</span>
          <span class="settings-hint"
            >Clear zoom, pan, rotation, crop and color adjustments</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("reset-view")}
          onclick={() => requestAction("reset-view")}
          >{buttonLabel("reset-view", "Reset")}</button
        >
      </div>
    </div>
  </div>

  <p class="settings-group-label">All Files</p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><circle cx="12" cy="12" r="10" /><line
            x1="15"
            y1="9"
            x2="9"
            y2="15"
          /><line x1="9" y1="9" x2="15" y2="15" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Clear Timestamps</span>
          <span class="settings-hint">Every file in the database</span>
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("timestamps")}
          onclick={() => requestAction("timestamps")}
          >{buttonLabel("timestamps", "Clear")}</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line
            x1="20"
            y1="4"
            x2="8.12"
            y2="15.88"
          /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line
            x1="8.12"
            y1="8.12"
            x2="12"
            y2="12"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Clear Clip Boundaries</span>
          <span class="settings-hint">Every file in the database</span>
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("clips")}
          onclick={() => requestAction("clips")}
          >{buttonLabel("clips", "Clear")}</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path
            d="M10 11v6"
          /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Clear All Markers</span>
          <span class="settings-hint"
            >Remove timestamps and clip boundaries everywhere</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("markers")}
          onclick={() => requestAction("markers")}
          >{buttonLabel("markers", "Clear All")}</button
        >
      </div>
    </div>
  </div>

  <p class="settings-group-label">App Data</p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path
            d="M10 11v6"
          /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Clear File Backups</span>
          <span class="settings-hint">Delete saved original copies</span>
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("backups")}
          onclick={() => requestAction("backups")}
          >{buttonLabel("backups", "Clear")}</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path
            d="M10 11v6"
          /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Clear Temp Files</span>
          <span class="settings-hint">Remove temporary processing files</span>
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          disabled={busy !== null}
          onclick={() => void execute("clean-temp")}>Clean</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polyline points="23 4 23 10 17 10" /><path
            d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Reset All Settings</span>
          <span class="settings-hint"
            >Clear preferences and reset OS integration</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("reset-settings")}
          onclick={() => requestAction("reset-settings")}>Reset</button
        >
      </div>
    </div>
    {@render typedConfirm("reset-settings")}
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><path
            d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m1 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6"
          /><path d="M10 11v6M14 11v6" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Factory Reset</span>
          <span class="settings-hint"
            >Clear settings, file history, caches, backups and temp files</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("factory-reset")}
          onclick={() => requestAction("factory-reset")}
          >Reset Everything</button
        >
      </div>
    </div>
    {@render typedConfirm("factory-reset")}
  </div>

  <p class="settings-group-label">Installation</p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path
            d="M10 11v6"
          /><path d="M14 11v6" /><path d="M9 6V4h6v2" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Delete FFmpeg</span>
          <span class="settings-hint"
            >Remove bundled binaries; restart and reinstall to restore</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("delete-ffmpeg")}
          onclick={() => requestAction("delete-ffmpeg")}>Delete</button
        >
      </div>
    </div>
    {@render typedConfirm("delete-ffmpeg")}
    <div class="settings-row">
      <div class="settings-label-col">
        <svg
          class="settings-row-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
            points="7 10 12 15 17 10"
          /><line x1="12" y1="15" x2="12" y2="3" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Uninstall</span>
          <span class="settings-hint"
            >Run the Windows uninstaller or open Apps settings</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn red"
          disabled={actionDisabled("uninstall")}
          onclick={() => requestAction("uninstall")}>Run Uninstaller</button
        >
      </div>
    </div>
    {@render typedConfirm("uninstall")}
  </div>
</div>
