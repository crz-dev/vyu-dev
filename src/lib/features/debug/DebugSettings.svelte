<script lang="ts">
  import { onMount } from "svelte";
  import { slide } from "svelte/transition";
  import { save } from "@tauri-apps/plugin-dialog";
  import { showToast } from "$lib/components/toast.svelte";
  import SettingsGroupIcon from "$lib/components/SettingsGroupIcon.svelte";
  import { copyTextToClipboard } from "$lib/services/clipboard";
  import { stringToBase64 } from "$lib/shared/base64";
  import { invokeWriteFileAtomic } from "$lib/features/media/api";
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
  import { locale } from "$lib/features/i18n/locale.svelte";

  let {
    flash = false,
    fileInfo = null,
  }: {
    flash?: boolean;
    fileInfo?: DebugFileInfo | null;
  } = $props();

  const t = locale.t;
  const tp = locale.tp;

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
    if (!path) return t("settings.debug.status.dash");
    const parts = path.replace(/\//g, "\\").split("\\").filter(Boolean);
    return parts.length <= 2 ? path : parts.slice(-2).join("\\");
  }

  function platformLabel(): string {
    if (!info) return t("settings.debug.status.loading");
    return `${info.runtime.os} · ${info.runtime.arch} · ${info.platform}`;
  }

  function gpuLabel(): string {
    if (!info) return t("settings.debug.status.loading");
    if (!info.gpu.available) return t("settings.debug.status.unavailable");
    return `${info.gpu.vendor} · ${info.gpu.renderer}`;
  }

  function encoderLabel(): string {
    if (!info) return t("settings.debug.status.loading");
    return info.ffmpeg.hardwareEncoders.length > 0
      ? info.ffmpeg.hardwareEncoders.join(", ")
      : t("settings.debug.status.softwareOnly");
  }

  function appLabel(): string {
    if (!info) {
      return loading
        ? t("settings.debug.status.loading")
        : t("settings.debug.status.unavailable");
    }
    return `${info.appVersion} · Tauri ${info.tauriVersion}`;
  }

  function ffmpegLabel(): string {
    if (!info) return t("settings.debug.status.dash");
    return `${info.ffmpeg.ffmpegVersion} · ${encoderLabel()}`;
  }

  function accelerationLabel(): string {
    if (!info) return t("settings.debug.status.dash");
    return info.systemConfig.hardwareAcceleration
      ? t("settings.debug.status.enabled")
      : t("settings.debug.status.disabled");
  }

  function safeModeLabel(): string {
    if (!info) return t("settings.debug.status.dash");
    return info.runtime.safeMode
      ? t("settings.debug.status.on")
      : t("settings.debug.status.off");
  }

  function databaseLabel(): string {
    if (!info) return t("settings.debug.status.loading");
    return tp("settings.debug.database.summary", info.database.metadataRows, {
      size: formatBytes(info.database.sizeBytes + info.database.walBytes),
    });
  }

  async function copyDiagnostics() {
    if (!info) await load();
    if (!info) {
      showToast({
        message: t("settings.debug.toast.diagnosticsUnavailable"),
        color: "red",
      });
      return;
    }
    try {
      await copyTextToClipboard(diagnosticsJson(info));
      showToast({
        message: t("settings.debug.toast.diagnosticsCopied"),
        color: "green",
      });
    } catch {
      showToast({
        message: t("settings.debug.toast.diagnosticsCopyFailed"),
        color: "red",
      });
    }
  }

  async function exportDiagnostics() {
    if (!info) await load();
    if (!info) {
      showToast({
        message: t("settings.debug.toast.diagnosticsUnavailable"),
        color: "red",
      });
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = await save({
      defaultPath: `vyu-diagnostics-${stamp}.json`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!path) return;
    try {
      await invokeWriteFileAtomic(path, stringToBase64(diagnosticsJson(info)));
      showToast({
        message: t("settings.debug.toast.diagnosticsExported"),
        color: "green",
      });
    } catch {
      showToast({
        message: t("settings.debug.toast.diagnosticsExportFailed"),
        color: "red",
      });
    }
  }

  async function exportFileMetadata() {
    if (!fileInfo?.filePath) {
      showToast({
        message: t("settings.debug.toast.noFile"),
        color: "yellow",
      });
      return;
    }
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const path = await save({
      defaultPath: `vyu-file-metadata-${stamp}.txt`,
      filters: [{ name: "Text", extensions: ["txt"] }],
    });
    if (!path) return;
    try {
      await invokeWriteFileAtomic(
        path,
        stringToBase64(fileMetadataJson(fileInfo)),
      );
      showToast({
        message: t("settings.debug.toast.metadataExported"),
        color: "green",
      });
    } catch {
      showToast({
        message: t("settings.debug.toast.metadataExportFailed"),
        color: "red",
      });
    }
  }

  async function copyValue(value: string) {
    if (
      !value ||
      value === t("settings.debug.status.dash") ||
      value === t("settings.debug.status.loading")
    ) {
      return;
    }
    try {
      await copyTextToClipboard(value);
      showToast({
        message: t("settings.debug.toast.copied"),
        color: "green",
      });
    } catch {
      showToast({
        message: t("settings.debug.toast.copyFailed"),
        color: "red",
      });
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
            ? t("settings.debug.toast.compacted", {
                size: formatBytes(freed),
              })
            : t("settings.debug.toast.alreadyCompact"),
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
    {t("settings.sections.debug")}
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
    {t("settings.debug.group.runtime")}
  </p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-text">
        <span class="settings-label">{t("settings.debug.row.version")}</span>
      </div>
      <button class="settings-info-value" onclick={() => copyValue(appLabel())}
        >{appLabel()}</button
      >
    </div>
    <div class="settings-row">
      <div class="settings-label-text">
        <span class="settings-label">{t("settings.debug.row.gpu")}</span>
      </div>
      <button class="settings-info-value" onclick={() => copyValue(gpuLabel())}
        >{gpuLabel()}</button
      >
    </div>
    <div class="settings-row">
      <div class="settings-label-text">
        <span class="settings-label">{t("settings.debug.row.ffmpeg")}</span>
      </div>
      <button
        class="settings-info-value"
        onclick={() => copyValue(ffmpegLabel())}>{ffmpegLabel()}</button
      >
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label"
            >{t("settings.debug.row.runtimeDetails")}</span
          >
          <span class="settings-hint"
            >{t("settings.debug.row.runtimeDetails.hint")}</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          onclick={() => (detailsOpen = !detailsOpen)}
        >
          {detailsOpen
            ? t("settings.debug.button.hide")
            : t("settings.debug.button.show")}
        </button>
      </div>
    </div>
    {#if detailsOpen}
      <div
        class="settings-subgroup"
        transition:slide={{ duration: appearance.reducedMotion ? 0 : 160 }}
      >
        <div class="settings-row settings-subrow">
          <div class="settings-label-text">
            <span class="settings-label"
              >{t("settings.debug.row.webview2")}</span
            >
          </div>
          <button
            class="settings-info-value"
            onclick={() =>
              copyValue(
                info?.webview2Version ?? t("settings.debug.status.dash"),
              )}
            >{info?.webview2Version ?? t("settings.debug.status.dash")}</button
          >
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-text">
            <span class="settings-label">{t("settings.debug.row.system")}</span>
          </div>
          <button
            class="settings-info-value"
            onclick={() => copyValue(platformLabel())}>{platformLabel()}</button
          >
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-text">
            <span class="settings-label"
              >{t("settings.debug.row.acceleration")}</span
            >
          </div>
          <button
            class="settings-info-value"
            onclick={() => copyValue(accelerationLabel())}
            >{accelerationLabel()}</button
          >
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-text">
            <span class="settings-label"
              >{t("settings.debug.row.ffmpegPath")}</span
            >
          </div>
          <button
            class="settings-info-value"
            onclick={() => copyValue(info?.ffmpeg.ffmpegPath ?? "")}
            >{shortPath(info?.ffmpeg.ffmpegPath ?? "")}</button
          >
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-text">
            <span class="settings-label"
              >{t("settings.debug.row.safeMode")}</span
            >
          </div>
          <button
            class="settings-info-value"
            onclick={() => copyValue(safeModeLabel())}>{safeModeLabel()}</button
          >
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label"
                >{t("settings.debug.row.database")}</span
              >
              <span class="settings-hint">{databaseLabel()}</span>
            </div>
          </div>
          <div class="settings-control">
            <button
              class="settings-action-btn"
              onclick={compactDatabase}
              disabled={compacting || loading}
              >{compacting
                ? t("settings.debug.button.compacting")
                : t("settings.debug.button.compact")}</button
            >
          </div>
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label"
                >{t("settings.debug.row.devtools")}</span
              >
              <span class="settings-hint"
                >{t("settings.debug.row.devtools.hint")}</span
              >
            </div>
          </div>
          <div class="settings-control">
            <button
              class="settings-action-btn"
              onclick={() => void invokeOpenDevTools()}
              >{t("settings.debug.button.open")}</button
            >
          </div>
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label"
                >{t("settings.debug.row.overlay")}</span
              >
              <span class="settings-hint"
                >{t("settings.debug.row.overlay.hint")}</span
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
        <div class="settings-row settings-subrow">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label"
                >{t("settings.debug.row.refresh")}</span
              >
              <span class="settings-hint"
                >{t("settings.debug.row.refresh.hint")}</span
              >
            </div>
          </div>
          <div class="settings-control">
            <button
              class="settings-action-btn"
              onclick={() => load(true)}
              disabled={refreshing}
              >{refreshing
                ? t("settings.debug.button.refreshing")
                : t("settings.debug.button.refresh")}</button
            >
          </div>
        </div>
        <div class="settings-row settings-subrow">
          <div class="settings-label-col">
            <div class="settings-label-text">
              <span class="settings-label"
                >{t("settings.debug.row.restartMode")}</span
              >
              <span class="settings-hint"
                >{info?.runtime.safeMode
                  ? t("settings.debug.row.restartMode.normal")
                  : t("settings.debug.row.restartMode.safe")}</span
              >
            </div>
          </div>
          <div class="settings-control">
            <button class="settings-action-btn" onclick={restartMode}
              >{info?.runtime.safeMode
                ? t("settings.debug.button.restartNormal")
                : t("settings.debug.button.restartSafe")}</button
            >
          </div>
        </div>
      </div>
    {/if}
  </div>

  <p class="settings-group-label">
    <span class="settings-group-icon">
      <SettingsGroupIcon name="file" />
    </span>
    {t("settings.debug.group.diagnostics")}
  </p>
  <div class="settings-card has-child">
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">{t("settings.debug.row.copy")}</span>
          <span class="settings-hint">{t("settings.debug.row.copy.hint")}</span>
        </div>
      </div>
      <div class="settings-control">
        <button class="settings-action-btn" onclick={copyDiagnostics}
          >{t("settings.debug.button.copy")}</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label">{t("settings.debug.row.export")}</span>
          <span class="settings-hint"
            >{t("settings.debug.row.export.hint")}</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button class="settings-action-btn" onclick={exportDiagnostics}
          >{t("settings.debug.button.export")}</button
        >
      </div>
    </div>
    <div class="settings-row">
      <div class="settings-label-col">
        <div class="settings-label-text">
          <span class="settings-label"
            >{t("settings.debug.row.fileMetadata")}</span
          >
          <span class="settings-hint"
            >{fileInfo?.fileName ||
              t("settings.debug.row.fileMetadata.hint")}</span
          >
        </div>
      </div>
      <div class="settings-control">
        <button
          class="settings-action-btn"
          onclick={exportFileMetadata}
          disabled={!fileInfo?.filePath}
          >{t("settings.debug.button.export")}</button
        >
      </div>
    </div>
  </div>
</div>
