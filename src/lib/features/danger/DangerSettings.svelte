<script lang="ts">
  import { onDestroy } from "svelte";
  import { fade, slide } from "svelte/transition";
  import { showToast } from "$lib/components/toast.svelte";
  import SettingsGroup from "$lib/components/SettingsGroup.svelte";
  import SettingsRow from "$lib/components/SettingsRow.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import {
    invokeClearAllMarkers,
    invokeDeleteBundledFfmpeg,
    invokeFactoryResetDatabase,
    invokeRunUninstaller,
    type MarkerClearMode,
  } from "$lib/features/danger/api";
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
  import { locale } from "$lib/features/i18n/locale.svelte";

  type ActionId =
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
    clearTimestamps,
    clearClips,
    clipDeleteOriginal = false,
    toggleClipDeleteOriginal = () => {},
  }: {
    flash?: boolean;
    clearTimestamps: () => void;
    clearClips: () => void;
    clipDeleteOriginal?: boolean;
    toggleClipDeleteOriginal?: () => void;
  } = $props();

  const t = locale.t;
  const tp = locale.tp;

  let busy = $state<ActionId | null>(null);
  let pending = $state<ActionId | null>(null);
  let typed = $state("");
  let acknowledged = $state(false);
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
    if (pending === id && CRITICAL_WORDS[id]) return true;
    return false;
  }

  function buttonLabel(id: ActionId, label: string): string {
    return pending === id && !CRITICAL_WORDS[id]
      ? t("settings.danger.button.confirm")
      : label;
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
        ? t("settings.danger.noun.timestamps")
        : mode === "clips"
          ? t("settings.danger.noun.clips")
          : t("settings.danger.noun.markers");
    showToast({
      message:
        count > 0
          ? tp("settings.danger.toast.cleared", count, { noun })
          : t("settings.danger.toast.none", { noun }),
      color: count > 0 ? "green" : "yellow",
    });
  }

  async function clearBackups() {
    const freed = await invokeClearBackups(editing.backupDir || undefined);
    editing.clearBackupState();
    showToast({
      message:
        freed > 0
          ? t("settings.danger.toast.backupsCleared")
          : t("settings.danger.toast.backupsNone"),
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
      message: t("settings.danger.toast.ffmpegDeleted"),
      color: "green",
    });
  }

  async function uninstall() {
    const result = await invokeRunUninstaller();
    if (!result.started) {
      showToast({
        message: t("settings.danger.toast.uninstallOpened"),
        color: "blue",
      });
    }
  }

  function fixRisk(id: RiskId) {
    if (id === "backups") {
      editing.setBackupMode("ask");
      showToast({
        message: t("settings.danger.toast.backupsEnabled"),
        color: "green",
      });
    } else if (id === "conversion") {
      conversionPrefs.setDeleteOriginal(false);
      showToast({
        message: t("settings.danger.toast.conversionKept"),
        color: "green",
      });
    } else if (clipDeleteOriginal) {
      toggleClipDeleteOriginal();
      showToast({
        message: t("settings.danger.toast.clipsKept"),
        color: "green",
      });
    }
  }

  async function execute(id: ActionId) {
    if (busy) return;
    busy = id;
    try {
      switch (id) {
        case "markers":
          await clearMarkers("all");
          break;
        case "backups":
          await clearBackups();
          break;
        case "clean-temp":
          await invokeCleanupTempFolder();
          showToast({
            message: t("settings.danger.toast.tempCleaned"),
            color: "green",
          });
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
    <div
      class="danger-confirm"
      transition:slide={{ duration: appearance.reducedMotion ? 0 : 160 }}
    >
      <span class="danger-confirm-label"
        >{t("settings.danger.confirm.type.prefix")}
        <strong>{CRITICAL_WORDS[id]}</strong>
        {t("settings.danger.confirm.type.suffix")}</span
      >
      <div class="danger-confirm-controls">
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
          onclick={confirmTyped}>{t("settings.danger.confirm.confirm")}</button
        >
        <button class="settings-action-btn" onclick={resetPending}
          >{t("settings.danger.confirm.cancel")}</button
        >
      </div>
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
    {t("settings.sections.danger")}
  </p>
  {#if !acknowledged}
    <div class="danger-warning">
      <svg
        width="34"
        height="34"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="1.8"
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
      <p class="danger-warning-title">
        {t("settings.danger.warning.title")}
      </p>
      <p class="danger-warning-text">
        {t("settings.danger.warning.text")}
      </p>
      <button
        class="settings-action-btn red"
        onclick={() => (acknowledged = true)}
      >
        {t("settings.danger.warning.acknowledge")}
      </button>
    </div>
  {:else}
    <div
      class="danger-content"
      transition:fade={{ duration: appearance.reducedMotion ? 0 : 180 }}
    >
      {#if hasActiveRisks}
        <SettingsGroup label={t("settings.danger.group.risks")} icon="danger">
          <SettingsRow
            label={t("settings.danger.risk.backups.label")}
            hint={t("settings.danger.risk.backups.hint")}
            open={editing.backupMode === "off"}
          >
            {#snippet control()}
              <button
                class="settings-action-btn"
                onclick={() => fixRisk("backups")}
                >{t("settings.danger.risk.backups.action")}</button
              >
            {/snippet}
          </SettingsRow>

          <SettingsRow
            label={t("settings.danger.risk.conversion.label")}
            hint={t("settings.danger.risk.conversion.hint")}
            open={conversionPrefs.deleteOriginal}
          >
            {#snippet control()}
              <button
                class="settings-action-btn"
                onclick={() => fixRisk("conversion")}
                >{t("settings.danger.risk.conversion.action")}</button
              >
            {/snippet}
          </SettingsRow>

          <SettingsRow
            label={t("settings.danger.risk.clips.label")}
            hint={t("settings.danger.risk.clips.hint")}
            open={clipDeleteOriginal}
          >
            {#snippet control()}
              <button
                class="settings-action-btn"
                onclick={() => fixRisk("clips")}
                >{t("settings.danger.risk.clips.action")}</button
              >
            {/snippet}
          </SettingsRow>
        </SettingsGroup>
      {/if}

      <SettingsGroup label={t("settings.danger.group.data")} icon="archive">
        <SettingsRow
          label={t("settings.danger.clearMarkers.label")}
          hint={t("settings.danger.clearMarkers.hint")}
        >
          {#snippet control()}
            <button
              class="settings-action-btn red"
              disabled={actionDisabled("markers")}
              onclick={() => requestAction("markers")}
              >{buttonLabel(
                "markers",
                t("settings.danger.button.clear"),
              )}</button
            >
          {/snippet}
        </SettingsRow>

        <SettingsRow
          label={t("settings.danger.clearBackups.label")}
          hint={t("settings.danger.clearBackups.hint")}
        >
          {#snippet control()}
            <button
              class="settings-action-btn red"
              disabled={actionDisabled("backups")}
              onclick={() => requestAction("backups")}
              >{buttonLabel(
                "backups",
                t("settings.danger.button.clear"),
              )}</button
            >
          {/snippet}
        </SettingsRow>

        <SettingsRow
          label={t("settings.danger.clearTemp.label")}
          hint={t("settings.danger.clearTemp.hint")}
        >
          {#snippet control()}
            <button
              class="settings-action-btn red"
              disabled={actionDisabled("clean-temp")}
              onclick={() => requestAction("clean-temp")}
              >{buttonLabel(
                "clean-temp",
                t("settings.danger.button.clear"),
              )}</button
            >
          {/snippet}
        </SettingsRow>

        <SettingsRow
          label={t("settings.danger.resetSettings.label")}
          hint={t("settings.danger.resetSettings.hint")}
        >
          {#snippet control()}
            <button
              class="settings-action-btn red"
              disabled={actionDisabled("reset-settings")}
              onclick={() => requestAction("reset-settings")}
              >{buttonLabel(
                "reset-settings",
                t("settings.danger.button.reset"),
              )}</button
            >
          {/snippet}
        </SettingsRow>
        {@render typedConfirm("reset-settings")}

        <SettingsRow
          label={t("settings.danger.factoryReset.label")}
          hint={t("settings.danger.factoryReset.hint")}
        >
          {#snippet control()}
            <button
              class="settings-action-btn red"
              disabled={actionDisabled("factory-reset")}
              onclick={() => requestAction("factory-reset")}
              >{buttonLabel(
                "factory-reset",
                t("settings.danger.button.reset"),
              )}</button
            >
          {/snippet}
        </SettingsRow>
        {@render typedConfirm("factory-reset")}
      </SettingsGroup>

      <SettingsGroup
        label={t("settings.danger.group.installation")}
        icon="trash"
      >
        <SettingsRow
          label={t("settings.danger.deleteFfmpeg.label")}
          hint={t("settings.danger.deleteFfmpeg.hint")}
        >
          {#snippet control()}
            <button
              class="settings-action-btn red"
              disabled={actionDisabled("delete-ffmpeg")}
              onclick={() => requestAction("delete-ffmpeg")}
              >{t("settings.danger.button.delete")}</button
            >
          {/snippet}
        </SettingsRow>
        {@render typedConfirm("delete-ffmpeg")}

        <SettingsRow
          label={t("settings.danger.uninstall.label")}
          hint={t("settings.danger.uninstall.hint")}
        >
          {#snippet control()}
            <button
              class="settings-action-btn red"
              disabled={actionDisabled("uninstall")}
              onclick={() => requestAction("uninstall")}
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
                ><circle cx="12" cy="12" r="10" /><path
                  d="M16 16s-1.5-2-4-2-4 2-4 2"
                /><line x1="9" y1="9" x2="9.01" y2="9" /><line
                  x1="15"
                  y1="9"
                  x2="15.01"
                  y2="9"
                /></svg
              >
              {buttonLabel("uninstall", t("settings.danger.button.uninstall"))}
            </button>
          {/snippet}
        </SettingsRow>
        {@render typedConfirm("uninstall")}
      </SettingsGroup>
    </div>
  {/if}
</div>
