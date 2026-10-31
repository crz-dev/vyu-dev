<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { getVersion } from "@tauri-apps/api/app";
  import { open } from "@tauri-apps/plugin-dialog";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { powerStatus } from "$lib/features/system/powerStatus.svelte";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
  import {
    invokeCheckForUpdates,
    invokeClearAllCaches,
    invokeGetCacheStats,
    invokeGetExplorerContextMenu,
    invokeGetStartOnLogin,
    invokeGetSystemConfig,
    invokeGetSystemRestartStatus,
    invokeOpenAppFolder,
    invokeOpenDefaultAppsSettings,
    invokeRestartApp,
    invokeSetExplorerContextMenu,
    invokeSetHardwareAcceleration,
    invokeSetSingleInstance,
    invokeSetStartOnLogin,
    invokeSetThumbnailCacheLimit,
    type CacheStats,
    type LoginStartState,
    type SystemConfig,
    type UpdateCheckResult,
  } from "$lib/features/system/api";
  import { showToast } from "$lib/components/toast.svelte";
  import type { ExternalAppKind } from "$lib/services/storage";

  let { flash = false }: { flash?: boolean } = $props();

  let loading = $state(true);
  let config = $state<SystemConfig>({
    hardwareAcceleration: true,
    singleInstance: true,
    thumbnailCacheLimitMb: 500,
  });
  let startupConfig = $state<{
    hardwareAcceleration: boolean;
    singleInstance: boolean;
  }>({ hardwareAcceleration: true, singleInstance: true });
  let startOnLogin = $state<LoginStartState>({
    supported: false,
    enabled: false,
  });
  let contextMenu = $state(false);
  let cacheStats = $state<CacheStats | null>(null);
  let cacheLoading = $state(false);
  let clearingCache = $state(false);
  let clearCacheConfirming = $state(false);
  let clearCacheTimeout: ReturnType<typeof setTimeout> | null = null;
  let cacheLimitPreview = $state(500);
  let applyingCacheLimit = $state(false);
  let appVersion = $state("");
  let checkingUpdates = $state(false);
  let updateResult = $state<UpdateCheckResult | null>(null);

  const restartHardware = $derived(
    config.hardwareAcceleration !== startupConfig.hardwareAcceleration,
  );
  const restartSingleInstance = $derived(
    config.singleInstance !== startupConfig.singleInstance,
  );

  onMount(() => {
    void load();
  });

  onDestroy(() => {
    if (clearCacheTimeout) clearTimeout(clearCacheTimeout);
  });

  async function load() {
    const [cfg, restart, login, menu, stats] = await Promise.allSettled([
      invokeGetSystemConfig(),
      invokeGetSystemRestartStatus(),
      invokeGetStartOnLogin(),
      invokeGetExplorerContextMenu(),
      invokeGetCacheStats(),
    ]);
    if (cfg.status === "fulfilled") {
      config = cfg.value;
      cacheLimitPreview = cfg.value.thumbnailCacheLimitMb;
    }
    if (restart.status === "fulfilled") {
      startupConfig = {
        hardwareAcceleration: restart.value.hardwareAcceleration
          ? !config.hardwareAcceleration
          : config.hardwareAcceleration,
        singleInstance: restart.value.singleInstance
          ? !config.singleInstance
          : config.singleInstance,
      };
    } else if (cfg.status === "fulfilled") {
      startupConfig = {
        hardwareAcceleration: cfg.value.hardwareAcceleration,
        singleInstance: cfg.value.singleInstance,
      };
    }
    startOnLogin =
      login.status === "fulfilled"
        ? login.value
        : { supported: false, enabled: false };
    if (menu.status === "fulfilled") contextMenu = menu.value;
    if (stats.status === "fulfilled") cacheStats = stats.value;
    try {
      appVersion = await getVersion();
    } catch {
      // Version display is optional; the rest of the panel still works.
    }
    if (
      cfg.status === "rejected" ||
      login.status === "rejected" ||
      menu.status === "rejected"
    ) {
      showToast({
        message: "Failed to load some system settings",
        color: "red",
      });
    }
    loading = false;
  }

  function formatBytes(bytes: number): string {
    if (!bytes) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024)),
    );
    const value = bytes / 1024 ** index;
    return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
  }

  function formatLimit(mb: number): string {
    return mb >= 1024
      ? `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`
      : `${mb} MB`;
  }

  function shortPath(path: string): string {
    const parts = path.replace(/\//g, "\\").split("\\").filter(Boolean);
    return parts.slice(-2).join("\\");
  }

  function powerHint(): string {
    if (!powerStatus.supported) return "";
    if (!powerStatus.onBattery) return "Plugged in";
    const charge = powerStatus.charging ? " · charging" : "";
    return `On battery${charge}${powerStatus.percent ? ` · ${powerStatus.percent}%` : ""}`;
  }

  function updateHint(): string {
    if (updateResult) {
      return updateResult.latestVersion
        ? `${updateResult.message} (${updateResult.latestVersion})`
        : updateResult.message;
    }
    return appVersion ? `Version ${appVersion}` : "Current version";
  }

  async function handleStartOnLogin(enabled: boolean) {
    if (!startOnLogin.supported || loading) return;
    try {
      await invokeSetStartOnLogin(enabled);
      startOnLogin = { ...startOnLogin, enabled };
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    }
  }

  async function handleContextMenu(enabled: boolean) {
    try {
      await invokeSetExplorerContextMenu(enabled);
      contextMenu = enabled;
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    }
  }

  async function handleHardwareAcceleration(enabled: boolean) {
    try {
      await invokeSetHardwareAcceleration(enabled);
      config = { ...config, hardwareAcceleration: enabled };
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    }
  }

  async function handleSingleInstance(enabled: boolean) {
    try {
      await invokeSetSingleInstance(enabled);
      config = { ...config, singleInstance: enabled };
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    }
  }

  async function handleCacheLimit() {
    const mb = Math.round(cacheLimitPreview);
    if (mb === config.thumbnailCacheLimitMb) return;
    applyingCacheLimit = true;
    try {
      const freed = await invokeSetThumbnailCacheLimit(mb);
      config = { ...config, thumbnailCacheLimitMb: mb };
      cacheStats = await invokeGetCacheStats();
      if (freed > 0) {
        showToast({
          message: `Cache limit set to ${formatLimit(mb)} · freed ${formatBytes(freed)}`,
          color: "green",
        });
      }
    } catch (e) {
      showToast({ message: String(e), color: "red" });
      cacheLimitPreview = config.thumbnailCacheLimitMb;
    } finally {
      applyingCacheLimit = false;
    }
  }

  async function handleOpenFolder(kind: "data" | "cache") {
    try {
      await invokeOpenAppFolder(kind);
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    }
  }

  async function refreshCacheStats() {
    cacheLoading = true;
    try {
      cacheStats = await invokeGetCacheStats();
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    } finally {
      cacheLoading = false;
    }
  }

  function handleClearCaches() {
    if (!clearCacheConfirming) {
      clearCacheConfirming = true;
      if (clearCacheTimeout) clearTimeout(clearCacheTimeout);
      clearCacheTimeout = setTimeout(() => {
        clearCacheConfirming = false;
        clearCacheTimeout = null;
      }, 5000);
      return;
    }
    if (clearCacheTimeout) {
      clearTimeout(clearCacheTimeout);
      clearCacheTimeout = null;
    }
    clearCacheConfirming = false;
    void clearCaches();
  }

  async function clearCaches() {
    clearingCache = true;
    try {
      const freed = await invokeClearAllCaches();
      cacheStats = await invokeGetCacheStats();
      showToast({
        message:
          freed > 0
            ? `Cleared ${formatBytes(freed)}`
            : "Cache is already empty",
        color: freed > 0 ? "green" : "yellow",
      });
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    } finally {
      clearingCache = false;
    }
  }

  async function handleOpenDefaultApps() {
    try {
      await invokeOpenDefaultAppsSettings();
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    }
  }

  async function handleCheckUpdates() {
    checkingUpdates = true;
    try {
      updateResult = await invokeCheckForUpdates();
      if (updateResult.currentVersion) appVersion = updateResult.currentVersion;
    } catch (e) {
      updateResult = {
        status: "error",
        currentVersion: appVersion,
        latestVersion: null,
        releaseUrl: null,
        message: String(e),
      };
    } finally {
      checkingUpdates = false;
    }
  }

  async function handleOpenRelease() {
    const url = updateResult?.releaseUrl;
    if (!url) return;
    try {
      await openUrl(url);
    } catch (e) {
      showToast({ message: `Failed to open release page: ${e}`, color: "red" });
    }
  }

  async function handleRestart() {
    try {
      await invokeRestartApp();
    } catch {
      // The process exits before the IPC response arrives.
    }
  }

  async function handleBrowseApp(kind: ExternalAppKind) {
    try {
      const selected = await open({
        multiple: false,
        directory: false,
        filters: [{ name: "Executable", extensions: ["exe"] }],
      });
      if (!selected || Array.isArray(selected)) return;
      systemPrefs.setExternalApp(kind, selected);
    } catch (e) {
      showToast({ message: `Failed to pick app: ${e}`, color: "red" });
    }
  }

  function handleClearApp(kind: ExternalAppKind) {
    systemPrefs.setExternalApp(kind, "");
  }

  function handleResetExternalApps() {
    systemPrefs.clearExternalApps();
  }

  const externalAppKinds: ExternalAppKind[] = ["vlc", "spotify", "paint"];
  const externalAppNames: Record<ExternalAppKind, string> = {
    vlc: "VLC",
    spotify: "Spotify",
    paint: "Paint",
  };
</script>

<div id="settings-section-system" class="settings-section" class:flash>
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
      ><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
        x1="8"
        y1="21"
        x2="16"
        y2="21"
      /><line x1="12" y1="17" x2="12" y2="21" /></svg
    >
    System
  </p>

  <p class="settings-group-label">Startup &amp; Window</p>
  <div class="settings-card" class:has-child={restartSingleInstance}>
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
          ><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline
            points="10 17 15 12 10 7"
          /><line x1="15" y1="12" x2="3" y2="12" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Launch at Windows Login</span>
          <span class="settings-hint"
            >{startOnLogin.supported
              ? "Start Vyu when you sign in"
              : "Available in installed builds"}</span
          >
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={startOnLogin.enabled}
            disabled={!startOnLogin.supported || loading}
            onchange={(e) => handleStartOnLogin(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={startOnLogin.enabled}
            ><span class="toggle-thumb"></span></span
          >
        </label>
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
          ><path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
          /><polyline points="14 2 14 8 20 8" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Reopen Last File</span>
          <span class="settings-hint"
            >Restore the last opened file on startup</span
          >
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.reopenLastFile}
            onchange={(e) =>
              systemPrefs.setReopenLastFile(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={systemPrefs.reopenLastFile}
            ><span class="toggle-thumb"></span></span
          >
        </label>
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
          ><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><line
            x1="9"
            y1="9"
            x2="15"
            y2="9"
          /><line x1="9" y1="13" x2="15" y2="13" /><line
            x1="9"
            y1="17"
            x2="13"
            y2="17"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Always on Top</span>
          <span class="settings-hint">Keep Vyu above other windows</span>
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.alwaysOnTop}
            onchange={(e) =>
              systemPrefs.setAlwaysOnTop(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={systemPrefs.alwaysOnTop}
            ><span class="toggle-thumb"></span></span
          >
        </label>
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
          ><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
            x1="8"
            y1="21"
            x2="16"
            y2="21"
          /><line x1="12" y1="17" x2="12" y2="21" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Single Instance</span>
          <span class="settings-hint"
            >Reuse the current window when opening files</span
          >
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={config.singleInstance}
            disabled={loading}
            onchange={(e) => handleSingleInstance(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={config.singleInstance}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      </div>
    </div>
    {#if restartSingleInstance}
      <div
        class="settings-row settings-subrow"
        transition:slide={{ duration: appearance.reducedMotion ? 0 : 160 }}
      >
        <div class="settings-label-col">
          <div class="settings-label-text">
            <span class="settings-label">Restart Required</span>
            <span class="settings-hint"
              >Single instance changes on the next launch</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button class="settings-action-btn yellow" onclick={handleRestart}
            >Restart</button
          >
        </div>
      </div>
    {/if}
  </div>

  <p class="settings-group-label">Performance</p>
  <div class="settings-card" class:has-child={restartHardware}>
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
          ><circle cx="12" cy="12" r="4" /><path
            d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Keep Screen Awake</span>
          <span class="settings-hint"
            >Video keeps the display on; audio prevents sleep</span
          >
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.keepAwake}
            onchange={(e) => systemPrefs.setKeepAwake(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={systemPrefs.keepAwake}
            ><span class="toggle-thumb"></span></span
          >
        </label>
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
          ><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path
            d="M13.73 21a2 2 0 01-3.46 0"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Pause When Unfocused</span>
          <span class="settings-hint">Pause playback when Vyu loses focus</span>
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.pauseOnFocusLoss}
            onchange={(e) =>
              systemPrefs.setPauseOnFocusLoss(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={systemPrefs.pauseOnFocusLoss}
            ><span class="toggle-thumb"></span></span
          >
        </label>
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
          ><rect x="4" y="4" width="16" height="16" rx="2" ry="2" /><rect
            x="9"
            y="9"
            width="6"
            height="6"
          /><line x1="9" y1="1" x2="9" y2="4" /><line
            x1="15"
            y1="1"
            x2="15"
            y2="4"
          /><line x1="9" y1="20" x2="9" y2="23" /><line
            x1="15"
            y1="20"
            x2="15"
            y2="23"
          /><line x1="20" y1="9" x2="23" y2="9" /><line
            x1="20"
            y1="14"
            x2="23"
            y2="14"
          /><line x1="1" y1="9" x2="4" y2="9" /><line
            x1="1"
            y1="14"
            x2="4"
            y2="14"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Hardware Acceleration</span>
          <span class="settings-hint"
            >Use WebView2 GPU rendering · requires restart</span
          >
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={config.hardwareAcceleration}
            disabled={loading}
            onchange={(e) =>
              handleHardwareAcceleration(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={config.hardwareAcceleration}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      </div>
    </div>
    {#if restartHardware}
      <div
        class="settings-row settings-subrow"
        transition:slide={{ duration: appearance.reducedMotion ? 0 : 160 }}
      >
        <div class="settings-label-col">
          <div class="settings-label-text">
            <span class="settings-label">Restart Required</span>
            <span class="settings-hint"
              >Acceleration changes on the next launch</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button class="settings-action-btn yellow" onclick={handleRestart}
            >Restart</button
          >
        </div>
      </div>
    {/if}

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
          ><rect x="1" y="6" width="18" height="12" rx="2" ry="2" /><line
            x1="23"
            y1="10"
            x2="23"
            y2="14"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Battery Saver Thumbnails</span>
          <span class="settings-hint"
            >Pause thumbnail generation on battery{powerHint()
              ? ` · ${powerHint()}`
              : ""}</span
          >
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.batterySaverThumbnails}
            onchange={(e) =>
              systemPrefs.setBatterySaverThumbnails(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={systemPrefs.batterySaverThumbnails}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      </div>
    </div>
  </div>

  <p class="settings-group-label">Storage</p>
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
          <span class="settings-label">Cache</span>
          <span class="settings-hint"
            >{cacheStats
              ? `${formatBytes(cacheStats.total)} · thumbnails, previews and cover art`
              : "Calculating…"}</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          onclick={() => handleOpenFolder("cache")}>Open</button
        >
        <button
          class="settings-action-btn yellow"
          onclick={handleClearCaches}
          disabled={clearingCache || cacheLoading}
        >
          {clearingCache
            ? "Clearing…"
            : clearCacheConfirming
              ? "Confirm?"
              : "Clear"}
        </button>
        <button
          class="settings-action-btn"
          onclick={refreshCacheStats}
          disabled={cacheLoading}
          aria-label="Refresh cache size"
        >
          <svg
            width="12"
            height="12"
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
        </button>
      </div>
    </div>

    <div class="settings-row settings-subrow">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Thumbnail Limit</span>
          <span class="settings-hint"
            >Oldest thumbnails are removed above this size</span
          >
        </div>
      </div>
      <div class="settings-control settings-slider-control">
        <input
          type="range"
          min="100"
          max="2000"
          step="100"
          bind:value={cacheLimitPreview}
          onchange={handleCacheLimit}
          disabled={applyingCacheLimit}
          aria-label="Thumbnail cache limit"
        />
        <span class="settings-slider-value"
          >{formatLimit(cacheLimitPreview)}</span
        >
      </div>
    </div>

    <div class="settings-row settings-subrow">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Thumbnails</span>
        </div>
      </div>
      <div class="settings-control">
        <span class="settings-hint"
          >{cacheStats ? formatBytes(cacheStats.thumbnails) : "—"}</span
        >
      </div>
    </div>
    <div class="settings-row settings-subrow">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Display Previews</span>
        </div>
      </div>
      <div class="settings-control">
        <span class="settings-hint"
          >{cacheStats ? formatBytes(cacheStats.displays) : "—"}</span
        >
      </div>
    </div>
    <div class="settings-row settings-subrow">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">Cover Art</span>
        </div>
      </div>
      <div class="settings-control">
        <span class="settings-hint"
          >{cacheStats ? formatBytes(cacheStats.coverArt) : "—"}</span
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
          ><path d="M3 7h18v12a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path
            d="M3 7l2-3h14l2 3"
          /><path d="M9 12h6" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">App Data</span>
          <span class="settings-hint">Database and configuration</span>
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          onclick={() => handleOpenFolder("data")}>Open</button
        >
      </div>
    </div>
  </div>

  <p class="settings-group-label">Windows Integration</p>
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
          ><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
            x1="8"
            y1="21"
            x2="16"
            y2="21"
          /><line x1="12" y1="17" x2="12" y2="21" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Default Media App</span>
          <span class="settings-hint">Choose Vyu in Windows Default Apps</span>
        </div>
      </div>
      <div class="settings-control">
        <button class="settings-action-btn" onclick={handleOpenDefaultApps}
          >Open</button
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
          ><line x1="8" y1="6" x2="21" y2="6" /><line
            x1="8"
            y1="12"
            x2="21"
            y2="12"
          /><line x1="8" y1="18" x2="21" y2="18" /><line
            x1="3"
            y1="6"
            x2="3.01"
            y2="6"
          /><line x1="3" y1="12" x2="3.01" y2="12" /><line
            x1="3"
            y1="18"
            x2="3.01"
            y2="18"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Explorer Context Menu</span>
          <span class="settings-hint"
            >Adds “Open with Vyu” to the classic right-click menu</span
          >
        </div>
      </div>
      <div class="settings-control">
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={contextMenu}
            disabled={loading}
            onchange={(e) => handleContextMenu(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={contextMenu}
            ><span class="toggle-thumb"></span></span
          >
        </label>
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
          ><path
            d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
          /><polyline points="14 2 14 8 20 8" /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">External Apps</span>
          <span class="settings-hint"
            >Leave empty to auto-detect installed apps</span
          >
        </div>
      </div>
      <div class="settings-control">
        {#if systemPrefs.externalApps.vlc || systemPrefs.externalApps.spotify || systemPrefs.externalApps.paint}
          <button class="settings-action-btn" onclick={handleResetExternalApps}
            >Reset All</button
          >
        {/if}
      </div>
    </div>

    {#each externalAppKinds as kind}
      <div class="settings-row settings-subrow">
        <div class="settings-label-col">
          <div class="settings-label-text">
            <span class="settings-label">{externalAppNames[kind]}</span>
            <span class="settings-hint"
              >{systemPrefs.externalApps[kind]
                ? shortPath(systemPrefs.externalApps[kind])
                : "Auto-detect"}</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button
            class="settings-action-btn"
            onclick={() => handleBrowseApp(kind)}>Browse</button
          >
          {#if systemPrefs.externalApps[kind]}
            <button
              class="settings-action-btn"
              onclick={() => handleClearApp(kind)}>Clear</button
            >
          {/if}
        </div>
      </div>
    {/each}
  </div>

  <p class="settings-group-label">Updates</p>
  <div class="settings-card">
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
          ><polyline points="1 4 1 10 7 10" /><path
            d="M3.51 15a9 9 0 102.13-9.36L1 10"
          /></svg
        >
        <div class="settings-label-text">
          <span class="settings-label">Version</span>
          <span class="settings-hint">{updateHint()}</span>
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          onclick={handleCheckUpdates}
          disabled={checkingUpdates}
          >{checkingUpdates ? "Checking…" : "Check"}</button
        >
        {#if updateResult?.status === "update" && updateResult.releaseUrl}
          <button class="settings-action-btn blue" onclick={handleOpenRelease}
            >Open</button
          >
        {/if}
      </div>
    </div>
  </div>
</div>
