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
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { flash = false }: { flash?: boolean } = $props();

  const t = locale.t;

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

  const startupOptions: { value: StartupView; labelKey: string }[] = [
    { value: "last-file", labelKey: "settings.system.startupView.lastFile" },
    { value: "library", labelKey: "settings.system.startupView.library" },
    { value: "empty", labelKey: "settings.system.startupView.empty" },
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
        message: t("settings.system.toast.loadFailed"),
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
    if (!powerStatus.onBattery) return t("settings.system.power.pluggedIn");
    const charge = powerStatus.charging
      ? ` · ${t("settings.system.power.charging")}`
      : "";
    return `${t("settings.system.power.onBattery")}${charge}${powerStatus.percent ? ` · ${powerStatus.percent}%` : ""}`;
  }

  function updateHint(): string {
    if (updateResult) {
      return updateResult.latestVersion
        ? `${updateResult.message} (${updateResult.latestVersion})`
        : updateResult.message;
    }
    return appVersion
      ? t("settings.system.version.value", { version: appVersion })
      : t("settings.system.version.current");
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
          message: t("settings.system.toast.cacheLimit", {
            size: formatLimit(mb),
            freed: formatBytes(freed),
          }),
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
            ? t("settings.system.toast.cacheCleared", {
                size: formatBytes(freed),
              })
            : t("settings.system.toast.cacheEmpty"),
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
      showToast({
        message: t("settings.system.toast.releaseFailed", { error: String(e) }),
        color: "red",
      });
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
    {t("settings.sections.system")}
  </p>

  <SettingsGroup label={t("settings.system.group.general")} icon="window">
    <SettingsRow
      label={t("settings.system.alwaysOnTop.label")}
      hint={t("settings.system.alwaysOnTop.hint")}
    >
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
      label={t("settings.system.singleInstance.label")}
      hint={t("settings.system.singleInstance.hint")}
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
            <span class="settings-label"
              >{t("settings.system.restart.label")}</span
            >
            <span class="settings-hint"
              >{t("settings.system.restart.singleInstance")}</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button class="settings-action-btn yellow" onclick={handleRestart}
            >{t("settings.system.restart.button")}</button
          >
        </div>
      </div>
    {/if}

    <SettingsRow
      label={t("settings.system.keepAwake.label")}
      hint={t("settings.system.keepAwake.hint")}
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
      label={t("settings.system.pauseUnfocused.label")}
      hint={t("settings.system.pauseUnfocused.hint")}
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
      label={t("settings.system.startupView.label")}
      hint={t("settings.system.startupView.hint")}
    >
      {#snippet control()}
        <div class="pill-group pill-group-3">
          {#each startupOptions as option}
            <button
              class="pill-btn"
              class:active={systemPrefs.startupView === option.value}
              onclick={() => systemPrefs.setStartupView(option.value)}
              >{t(option.labelKey)}</button
            >
          {/each}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.system.defaultMediaApp.label")}
      hint={t("settings.system.defaultMediaApp.hint")}
    >
      {#snippet control()}
        <button class="settings-action-btn" onclick={handleOpenDefaultApps}
          >{t("settings.system.defaultMediaApp.open")}</button
        >
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.system.contextMenu.label")}
      hint={t("settings.system.contextMenu.hint")}
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

  <SettingsGroup label={t("settings.system.group.performance")} icon="cpu">
    <SettingsRow
      label={t("settings.system.hardwareAcceleration.label")}
      hint={t("settings.system.hardwareAcceleration.hint")}
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
            <span class="settings-label"
              >{t("settings.system.restart.label")}</span
            >
            <span class="settings-hint"
              >{t("settings.system.restart.acceleration")}</span
            >
          </div>
        </div>
        <div class="settings-control">
          <button class="settings-action-btn yellow" onclick={handleRestart}
            >{t("settings.system.restart.button")}</button
          >
        </div>
      </div>
    {/if}

    <SettingsRow
      label={t("settings.system.batterySaver.label")}
      hint={t("settings.system.batterySaver.hint") +
        (powerHint() ? ` · ${powerHint()}` : "")}
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
      label={t("settings.system.thumbnailLimit.label")}
      hint={t("settings.system.thumbnailLimit.hint")}
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
            aria-label={t("settings.system.thumbnailLimit.aria")}
          />
          <span class="settings-slider-value"
            >{formatLimit(cacheLimitPreview)}</span
          >
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.system.cache.label")}
      hint={cacheStats
        ? `${formatBytes(cacheStats.total)} · ${t("settings.system.cache.hint")}`
        : t("settings.system.cache.calculating")}
    >
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn"
            onclick={() => handleOpenFolder("cache")}
            >{t("settings.system.cache.open")}</button
          >
          <button
            class="settings-action-btn yellow"
            onclick={handleClearCaches}
            disabled={clearingCache}
          >
            {clearingCache
              ? t("settings.system.cache.clearing")
              : clearCacheConfirming
                ? t("settings.system.cache.confirm")
                : t("settings.system.cache.clear")}
          </button>
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.system.appData.label")}
      hint={t("settings.system.appData.hint")}
    >
      {#snippet control()}
        <button
          class="settings-action-btn"
          onclick={() => handleOpenFolder("data")}
          >{t("settings.system.cache.open")}</button
        >
      {/snippet}
    </SettingsRow>
  </SettingsGroup>

  <SettingsGroup label={t("settings.system.group.updates")} icon="refresh">
    <SettingsRow label={t("settings.system.version.label")} hint={updateHint()}>
      {#snippet control()}
        <div class="settings-control-inline">
          <button
            class="settings-action-btn"
            onclick={handleCheckUpdates}
            disabled={checkingUpdates}
            >{checkingUpdates
              ? t("settings.system.version.checking")
              : t("settings.system.version.check")}</button
          >
          {#if updateResult?.status === "update" && updateResult.releaseUrl}
            <button class="settings-action-btn blue" onclick={handleOpenRelease}
              >{t("settings.system.cache.open")}</button
            >
          {/if}
        </div>
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label={t("settings.system.checkUpdates.label")}
      hint={t("settings.system.checkUpdates.hint")}
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
