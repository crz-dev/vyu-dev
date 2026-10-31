<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { getVersion } from "@tauri-apps/api/app";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import { powerStatus } from "$lib/features/system/powerStatus.svelte";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
  import {
    invokeCheckForUpdates,
    invokeClearAllCaches,
    invokeGetCacheStats,
    invokeGetExplorerContextMenu,
    invokeGetSystemConfig,
    invokeGetSystemRestartStatus,
    invokeOpenAppFolder,
    invokeOpenDefaultAppsSettings,
    invokeRestartApp,
    invokeSetExplorerContextMenu,
    invokeSetHardwareAcceleration,
    invokeSetSingleInstance,
    invokeSetThumbnailCacheLimit,
    type CacheStats,
    type SystemConfig,
    type UpdateCheckResult,
  } from "$lib/features/system/api";
  import { showToast } from "$lib/components/toast.svelte";
  import type { StartupView } from "$lib/services/storage";

  let { flash = false }: { flash?: boolean } = $props();

  let loading = $state(true);
  let contextMenu = $state(false);
  let config = $state<SystemConfig>({
    hardwareAcceleration: true,
    singleInstance: true,
    thumbnailCacheLimitMb: 500,
    launchMinimized: false,
    clearCacheOnExit: false,
  });
  let startupConfig = $state<{
    hardwareAcceleration: boolean;
    singleInstance: boolean;
  }>({ hardwareAcceleration: true, singleInstance: true });
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

  const startupOptions: { value: StartupView; label: string }[] = [
    { value: "last-file", label: "Last File" },
    { value: "library", label: "Library" },
    { value: "empty", label: "Empty" },
  ];

  async function load() {
    const [cfg, restart, stats, menu] = await Promise.allSettled([
      invokeGetSystemConfig(),
      invokeGetSystemRestartStatus(),
      invokeGetCacheStats(),
      invokeGetExplorerContextMenu(),
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
    if (stats.status === "fulfilled") cacheStats = stats.value;
    if (menu.status === "fulfilled") contextMenu = menu.value;
    try {
      appVersion = await getVersion();
    } catch {
      // Version display is optional; the rest of the panel still works.
    }
    if (cfg.status === "rejected") {
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

  async function handleContextMenu(enabled: boolean) {
    try {
      await invokeSetExplorerContextMenu(enabled);
      contextMenu = enabled;
    } catch (e) {
      showToast({ message: String(e), color: "red" });
    }
  }

  async function handleOpenDefaultApps() {
    try {
      await invokeOpenDefaultAppsSettings();
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

  <SettingsGroup label="Window & Startup" icon="window">
    <SettingsRow label="Always on Top" hint="Keep Vyu above other windows">
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Single Instance"
      hint="Reuse the current window when opening files"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

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

    <SettingsRow
      label="Keep Screen Awake"
      hint="Video keeps the display on; audio prevents sleep"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Pause When Unfocused"
      hint="Pause playback when Vyu loses focus"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Hardware Acceleration"
      hint="Use WebView2 GPU rendering · requires restart"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

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

    <SettingsRow
      label="Battery Saver Thumbnails"
      hint="Pause thumbnail generation on battery{powerHint()
        ? ` · ${powerHint()}`
        : ''}"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Startup View"
      hint="What Vyu shows when it starts without a file"
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          {#each startupOptions as option}
            <button
              class="pill-btn"
              class:active={systemPrefs.startupView === option.value}
              onclick={() => systemPrefs.setStartupView(option.value)}
              >{option.label}</button
            >
          {/each}
        </div>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Windows" icon="windows">
    <SettingsRow
      label="Default Media App"
      hint="Choose Vyu in Windows Default Apps"
    >
      {#snippet control()}
        <button class="settings-action-btn" onclick={handleOpenDefaultApps}
          >Open</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Explorer Context Menu"
      hint="Adds “Open with Vyu” to the classic right-click menu"
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Storage" icon="database">
    <SettingsRow
      label="Thumbnail Limit"
      hint="Oldest thumbnails are removed above this size"
    >
      {#snippet control()}
        <div class="settings-slider-control">
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Cache"
      hint={cacheStats
        ? `${formatBytes(cacheStats.total)} · thumbnails, previews and cover art`
        : "Calculating…"}
    >
      {#snippet control()}
        <div class="settings-control-inline">
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
      {/snippet}
    </SettingsRow>

    <SettingsRow label="App Data" hint="Database and configuration">
      {#snippet control()}
        <button
          class="settings-action-btn"
          onclick={() => handleOpenFolder("data")}>Open</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label="Updates" icon="refresh">
    <SettingsRow label="Version" hint={updateHint()}>
      {#snippet control()}
        <div class="settings-control-inline">
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Check for Updates on Launch"
      hint="Look for a newer release in the background · applies next launch"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.checkUpdatesOnLaunch}
            onchange={(e) =>
              systemPrefs.setCheckUpdatesOnLaunch(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={systemPrefs.checkUpdatesOnLaunch}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
