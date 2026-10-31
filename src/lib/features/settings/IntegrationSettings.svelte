<script lang="ts">
  import { onMount } from "svelte";
  import { open } from "@tauri-apps/plugin-dialog";
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { showToast } from "$lib/components/toast.svelte";
  import { systemPrefs } from "$lib/features/system/systemPrefs.svelte";
  import {
    invokeGetExplorerContextMenu,
    invokeGetStartOnLogin,
    invokeGetSystemConfig,
    invokeOpenDefaultAppsSettings,
    invokeSetExplorerContextMenu,
    invokeSetLaunchMinimized,
    invokeSetStartOnLogin,
    type LoginStartState,
  } from "$lib/features/system/api";
  import type { ExternalAppKind, StartupView } from "$lib/services/storage";

  let { flash = false }: { flash?: boolean } = $props();

  let loading = $state(true);
  let launchMinimized = $state(false);
  let startOnLogin = $state<LoginStartState>({
    supported: false,
    enabled: false,
  });
  let contextMenu = $state(false);

  const externalAppKinds: ExternalAppKind[] = ["vlc", "spotify", "paint"];
  const externalAppNames: Record<ExternalAppKind, string> = {
    vlc: "VLC",
    spotify: "Spotify",
    paint: "Paint",
  };

  const startupOptions: { value: StartupView; label: string }[] = [
    { value: "last-file", label: "Last File" },
    { value: "library", label: "Library" },
    { value: "empty", label: "Empty" },
  ];

  onMount(() => {
    void load();
  });

  async function load() {
    const [config, login, menu] = await Promise.allSettled([
      invokeGetSystemConfig(),
      invokeGetStartOnLogin(),
      invokeGetExplorerContextMenu(),
    ]);
    if (config.status === "fulfilled") {
      launchMinimized = config.value.launchMinimized;
    }
    startOnLogin =
      login.status === "fulfilled"
        ? login.value
        : { supported: false, enabled: false };
    if (menu.status === "fulfilled") contextMenu = menu.value;
    loading = false;
  }

  function shortPath(path: string): string {
    const parts = path.replace(/\//g, "\\").split("\\").filter(Boolean);
    return parts.slice(-2).join("\\");
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

  async function handleLaunchMinimized(enabled: boolean) {
    try {
      await invokeSetLaunchMinimized(enabled);
      launchMinimized = enabled;
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
</script>

<div id="settings-section-integration" class="settings-section" class:flash>
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
        d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
      /><path
        d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
      /></svg
    >
    Integration
  </p>

  <SettingsGroup label="Startup" icon="power">
    <SettingsRow
      label="Launch at Windows Login"
      hint={startOnLogin.supported
        ? "Start Vyu when you sign in"
        : "Available in installed builds"}
    >
      {#snippet control()}
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
      {/snippet}
    </SettingsRow>

    <SettingsRow
      label="Launch Minimized"
      hint="Start Vyu minimized to the taskbar · applies next launch"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={launchMinimized}
            disabled={loading}
            onchange={(e) => handleLaunchMinimized(e.currentTarget.checked)}
          />
          <span class="toggle-track" class:on={launchMinimized}
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

  <SettingsGroup label="Windows & Apps" icon="windows">
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

    <SettingsRow
      label="External Apps"
      hint="Leave empty to auto-detect installed apps"
    >
      {#snippet control()}
        {#if systemPrefs.externalApps.vlc || systemPrefs.externalApps.spotify || systemPrefs.externalApps.paint}
          <button
            class="settings-action-btn"
            onclick={() => systemPrefs.clearExternalApps()}>Reset All</button
          >
        {/if}
      {/snippet}
    </SettingsRow>

    {#each externalAppKinds as kind}
      <SettingsRow
        label={externalAppNames[kind]}
        hint={systemPrefs.externalApps[kind]
          ? shortPath(systemPrefs.externalApps[kind])
          : "Auto-detect"}
        subrow
      >
        {#snippet control()}
          <div class="settings-control-inline">
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
        {/snippet}
      </SettingsRow>
    {/each}
  </SettingsGroup>

  <SettingsGroup label="Behavior" icon="mouse">
    <SettingsRow
      label="Confirm Close While Playing"
      hint="Ask before closing during active playback"
    >
      {#snippet control()}
        <label class="toggle-row">
          <input
            type="checkbox"
            checked={systemPrefs.confirmCloseWhilePlaying}
            onchange={(e) =>
              systemPrefs.setConfirmCloseWhilePlaying(e.currentTarget.checked)}
          />
          <span
            class="toggle-track"
            class:on={systemPrefs.confirmCloseWhilePlaying}
            ><span class="toggle-thumb"></span></span
          >
        </label>
      {/snippet}
    </SettingsRow>
  </SettingsGroup>
</div>
