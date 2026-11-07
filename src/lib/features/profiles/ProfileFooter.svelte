<script lang="ts">
  import ProfileIcon from "./ProfileIcon.svelte";
  import ProfileMenu from "./ProfileMenu.svelte";
  import { profiles } from "./profiles.svelte";
  import { exportProfileFile, importProfileFile } from "./profileTransfer";
  import { showToast } from "$lib/components/toast.svelte";
  import { locale } from "$lib/features/i18n/locale.svelte";

  const t = locale.t;

  let triggerEl = $state<HTMLButtonElement | null>(null);
  let menuOpen = $state(false);
  let busy = $state(false);

  function closeMenu() {
    menuOpen = false;
  }

  async function handleImport() {
    if (busy || profiles.switching) return;
    closeMenu();
    busy = true;
    try {
      const file = await importProfileFile();
      if (!file) return;
      showToast({
        message: t("settings.profiles.toast.imported"),
        color: "green",
      });
      profiles.importInto(profiles.activeId, file.settings);
    } catch (e) {
      showToast({
        message:
          e instanceof Error
            ? e.message
            : t("settings.profiles.toast.importFailed"),
        color: "red",
      });
    } finally {
      busy = false;
    }
  }

  async function handleExport() {
    if (busy || profiles.switching) return;
    closeMenu();
    busy = true;
    try {
      const exported = await exportProfileFile(
        profiles.active,
        profiles.snapshotForActive(),
      );
      if (exported) {
        showToast({
          message: t("settings.profiles.toast.exported"),
          color: "green",
        });
      }
    } catch {
      showToast({
        message: t("settings.profiles.toast.exportFailed"),
        color: "red",
      });
    } finally {
      busy = false;
    }
  }
</script>

<div class="settings-footer-left profile-footer-group">
  <button
    class="settings-action-btn profile-trigger"
    bind:this={triggerEl}
    aria-haspopup="menu"
    aria-expanded={menuOpen}
    disabled={busy || profiles.switching}
    onclick={() => (menuOpen = !menuOpen)}
  >
    <span
      class="profile-avatar"
      style={`--profile-color:${profiles.active.color}`}
    >
      <ProfileIcon icon={profiles.active.icon} size={12} />
    </span>
    <span class="profile-trigger-label">{profiles.active.name}</span>
    <svg
      class="profile-trigger-chevron"
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"><polyline points="18 15 12 9 6 15" /></svg
    >
  </button>
</div>

<div class="settings-footer-left profile-footer-group">
  <button
    class="settings-action-btn"
    disabled={busy || profiles.switching}
    onclick={() => void handleImport()}
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
      ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
        points="7 10 12 15 17 10"
      /><line x1="12" y1="15" x2="12" y2="3" /></svg
    >
    {t("settings.profiles.importSettings")}
  </button>
  <button
    class="settings-action-btn"
    disabled={busy || profiles.switching}
    onclick={() => void handleExport()}
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
      ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
        points="7 10 12 15 17 10"
      /><line x1="12" y1="15" x2="12" y2="3" /></svg
    >
    {t("settings.profiles.exportSettings")}
  </button>
</div>

{#if menuOpen}
  <ProfileMenu anchor={triggerEl} onclose={closeMenu} />
{/if}
