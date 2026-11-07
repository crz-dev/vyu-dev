<script lang="ts">
  import { tick } from "svelte";
  import { slide } from "svelte/transition";
  import ProfileIcon from "./ProfileIcon.svelte";
  import { profiles } from "./profiles.svelte";
  import { importProfileFile } from "./profileTransfer";
  import { showToast } from "$lib/components/toast.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";
  import {
    PROFILE_COLORS,
    PROFILE_ICONS,
    type ProfileRecord,
  } from "$lib/services/storage";
  import { locale } from "$lib/features/i18n/locale.svelte";

  let { anchor, onclose }: { anchor: HTMLElement | null; onclose: () => void } =
    $props();

  const t = locale.t;

  let rootEl = $state<HTMLDivElement | null>(null);
  let position = $state("left:-9999px;bottom:0;");
  let expandedId = $state<string | null>(null);
  let renameValue = $state("");
  let renameInput = $state<HTMLInputElement | null>(null);
  let creating = $state(false);
  let newName = $state("");
  let newNameInput = $state<HTMLInputElement | null>(null);
  let error = $state("");
  let busy = $state(false);

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function profileColorVars(profile: ProfileRecord): string {
    const hex = profile.color.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `--profile-color:${profile.color};--profile-highlight:rgba(${
      Number.isNaN(r) ? 168 : r
    }, ${Number.isNaN(g) ? 85 : g}, ${Number.isNaN(b) ? 247 : b}, 0.14);`;
  }

  function place() {
    const rect = anchor?.getBoundingClientRect();
    const width = 252;
    const margin = 10;
    const left = Math.min(
      window.innerWidth - width - margin,
      Math.max(margin, rect?.left ?? margin),
    );
    const bottom = Math.max(
      margin,
      window.innerHeight - (rect?.top ?? window.innerHeight) + 8,
    );
    position = `left:${Math.round(left)}px;bottom:${Math.round(bottom)}px;width:${width}px;`;
  }

  $effect(() => {
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  });

  $effect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootEl?.contains(target) || anchor?.contains(target)) return;
      onclose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onclose();
    };

    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  });

  async function choose(id: string) {
    if (busy || profiles.switching) return;
    if (id === profiles.activeId) {
      onclose();
      return;
    }
    busy = true;
    error = "";
    await profiles.select(id);
    busy = false;
  }

  function toggleEditor(profile: ProfileRecord) {
    error = "";
    creating = false;
    if (expandedId === profile.id) {
      expandedId = null;
      return;
    }
    expandedId = profile.id;
    renameValue = profile.name;
    void tick().then(() => renameInput?.select());
  }

  function saveName(id: string) {
    const message = profiles.rename(id, renameValue);
    if (message) {
      error = message;
      return;
    }
    error = "";
    expandedId = null;
  }

  function startCreating() {
    error = "";
    expandedId = null;
    creating = true;
    void tick().then(() => newNameInput?.focus());
  }

  function addProfile() {
    const message = profiles.create(newName);
    if (message) {
      error = message;
      return;
    }
    error = "";
    newName = "";
  }

  async function removeProfile(profile: ProfileRecord) {
    if (busy) return;
    busy = true;
    error = "";
    const message = await profiles.remove(profile.id);
    busy = false;
    if (message) error = message;
  }

  async function importIntoProfile(profile: ProfileRecord) {
    if (busy) return;
    busy = true;
    error = "";
    try {
      const file = await importProfileFile();
      if (!file) return;
      if (profile.id === profiles.activeId) {
        showToast({
          message: t("settings.profiles.toast.imported"),
          color: "green",
        });
      }
      profiles.importInto(profile.id, file.settings);
      expandedId = null;
    } catch (e) {
      error =
        e instanceof Error
          ? e.message
          : t("settings.profiles.toast.importFailed");
    } finally {
      busy = false;
    }
  }
</script>

<div
  class="profile-menu"
  style={position}
  bind:this={rootEl}
  use:portal
  role="menu"
  aria-label={t("settings.profiles.menu.aria")}
>
  <div class="profile-menu-header">
    <span class="profile-menu-title">
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle
          cx="9"
          cy="7"
          r="4"
        /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path
          d="M16 3.13a4 4 0 010 7.75"
        /></svg
      >
      {t("settings.profiles.header")}
    </span>
    <span class="profile-menu-count">{profiles.list.length}</span>
  </div>

  <div class="profile-menu-list">
    {#each profiles.list as profile (profile.id)}
      <div
        class="profile-menu-row"
        class:active={profile.id === profiles.activeId}
        style={profileColorVars(profile)}
      >
        <button
          class="profile-menu-row-main"
          role="menuitem"
          aria-current={profile.id === profiles.activeId ? "true" : undefined}
          disabled={busy}
          onclick={() => void choose(profile.id)}
        >
          <span
            class="profile-avatar"
            style={`--profile-color:${profile.color}`}
          >
            <ProfileIcon icon={profile.icon} size={12} />
          </span>
          <span class="profile-menu-name">{profile.name}</span>
        </button>
        <button
          class="profile-menu-more"
          class:active={expandedId === profile.id}
          aria-label={t("settings.profiles.menu.edit", {
            name: profile.name,
          })}
          aria-expanded={expandedId === profile.id}
          onclick={() => toggleEditor(profile)}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            ><circle cx="5" cy="12" r="1" /><circle
              cx="12"
              cy="12"
              r="1"
            /><circle cx="19" cy="12" r="1" /></svg
          >
        </button>
        <span class="profile-menu-status" aria-hidden="true">
          {#if profile.id === profiles.activeId}
            <svg
              class="profile-menu-check"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg
            >
          {:else}
            <span class="profile-menu-dot"></span>
          {/if}
        </span>
      </div>

      {#if expandedId === profile.id}
        <div
          class="profile-menu-editor"
          style={profileColorVars(profile)}
          transition:slide={{ duration: appearance.reducedMotion ? 0 : 140 }}
        >
          <p class="profile-editor-label">
            {t("settings.profiles.menu.name")}
          </p>
          <div class="profile-editor-name">
            <input
              class="profile-menu-input"
              bind:this={renameInput}
              bind:value={renameValue}
              aria-label={t("settings.profiles.menu.name.aria")}
              maxlength="32"
              onkeydown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveName(profile.id);
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  e.stopPropagation();
                  expandedId = null;
                }
              }}
            />
            <button
              class="profile-editor-save"
              onclick={() => saveName(profile.id)}
              >{t("settings.profiles.menu.save")}</button
            >
          </div>

          <p class="profile-editor-label">
            {t("settings.profiles.menu.color")}
          </p>
          <div class="profile-swatches">
            {#each PROFILE_COLORS as color}
              <button
                class="profile-swatch"
                class:active={profile.color === color}
                style={`--swatch-color:${color}`}
                aria-label={t("settings.profiles.menu.color.use", {
                  color,
                })}
                aria-pressed={profile.color === color}
                onclick={() => profiles.setColor(profile.id, color)}
              ></button>
            {/each}
          </div>

          <p class="profile-editor-label">
            {t("settings.profiles.menu.icon")}
          </p>
          <div class="profile-icon-grid">
            {#each PROFILE_ICONS as icon}
              <button
                class="profile-icon-btn"
                class:active={profile.icon === icon}
                aria-label={t("settings.profiles.menu.icon.use", {
                  icon,
                })}
                aria-pressed={profile.icon === icon}
                onclick={() => profiles.setIcon(profile.id, icon)}
              >
                <ProfileIcon {icon} size={13} />
              </button>
            {/each}
          </div>

          <div class="profile-editor-actions">
            <button
              class="profile-editor-btn"
              disabled={busy}
              onclick={() => void importIntoProfile(profile)}
              >{t("settings.profiles.menu.import")}</button
            >
            <button
              class="profile-editor-btn danger"
              disabled={busy || profiles.list.length <= 1}
              onclick={() => void removeProfile(profile)}
              >{t("settings.profiles.menu.delete")}</button
            >
          </div>
        </div>
      {/if}
    {/each}
  </div>

  <div class="profile-menu-footer">
    {#if creating}
      <form
        class="profile-menu-create"
        onsubmit={(e) => {
          e.preventDefault();
          addProfile();
        }}
      >
        <input
          class="profile-menu-input"
          bind:this={newNameInput}
          bind:value={newName}
          placeholder={t("settings.profiles.menu.newPlaceholder")}
          aria-label={t("settings.profiles.menu.newAria")}
          maxlength="32"
          onkeydown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              creating = false;
              newName = "";
              error = "";
            }
          }}
        />
        <button class="profile-editor-save" type="submit">
          {t("settings.profiles.menu.add")}
        </button>
      </form>
    {:else}
      <button class="profile-menu-new" onclick={startCreating}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          ><line x1="12" y1="5" x2="12" y2="19" /><line
            x1="5"
            y1="12"
            x2="19"
            y2="12"
          /></svg
        >
        {t("settings.profiles.menu.new")}
      </button>
    {/if}
    {#if error}
      <p class="profile-menu-error">{error}</p>
    {/if}
  </div>
</div>
