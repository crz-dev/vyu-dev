import { confirm } from "@tauri-apps/plugin-dialog";
import { showToast } from "$lib/components/toast.svelte";
import {
  PROFILE_COLORS,
  collectAccessibilitySettings,
  collectLibrarySettings,
  collectProfileSettings,
  loadProfileRegistry,
  replaceProfileSettings,
  saveProfileRegistry,
  type ProfileIcon,
  type ProfileRecord,
  type ProfileRegistry,
} from "$lib/services/storage";

const NAME_MAX = 32;

function createProfileId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `profile-${crypto.randomUUID()}`;
  }
  return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createProfiles() {
  let registry = $state<ProfileRegistry>(loadProfileRegistry());
  let switching = $state(false);

  function persist(): boolean {
    if (saveProfileRegistry(registry)) return true;
    showToast({ message: "Could not save profiles", color: "red" });
    return false;
  }

  function activeRecord(): ProfileRecord {
    return (
      registry.profiles.find((profile) => profile.id === registry.activeId) ??
      registry.profiles[0]
    );
  }

  function validateName(name: string, exceptId?: string): string | null {
    const trimmed = name.trim();
    if (!trimmed) return "Enter a profile name";
    if (trimmed.length > NAME_MAX) return `Use ${NAME_MAX} characters or fewer`;
    const duplicate = registry.profiles.some(
      (profile) =>
        profile.id !== exceptId &&
        profile.name.toLowerCase() === trimmed.toLowerCase(),
    );
    return duplicate ? "That profile name is already used" : null;
  }

  function reloadNow(): void {
    switching = true;
    window.location.reload();
  }

  async function select(
    id: string,
    options: { skipConfirm?: boolean } = {},
  ): Promise<void> {
    if (switching || id === registry.activeId) return;
    const target = registry.profiles.find((profile) => profile.id === id);
    if (!target) return;

    if (!options.skipConfirm && registry.preferences.confirmSwitch) {
      const ok = await confirm(`Switch to "${target.name}"?`, {
        title: "Switch Profile",
        kind: "info",
      });
      if (!ok) return;
    }

    const current = activeRecord();
    current.settings = collectProfileSettings(
      registry.preferences.libraryIsolation,
      registry.preferences.universalAccessibility,
    );
    current.updatedAt = Date.now();

    registry.activeId = target.id;
    target.updatedAt = Date.now();
    if (!persist()) {
      registry.activeId = current.id;
      return;
    }

    replaceProfileSettings(
      target.settings,
      registry.preferences.libraryIsolation,
      registry.preferences.universalAccessibility,
    );
    reloadNow();
  }

  function create(name: string): string | null {
    const error = validateName(name);
    if (error) return error;

    const now = Date.now();
    const profile: ProfileRecord = {
      id: createProfileId(),
      name: name.trim(),
      color: PROFILE_COLORS[registry.profiles.length % PROFILE_COLORS.length],
      icon: "user",
      createdAt: now,
      updatedAt: now,
      settings: {},
    };

    registry.profiles.push(profile);
    if (!persist()) {
      registry.profiles.pop();
      return "Could not create profile";
    }

    void select(profile.id, { skipConfirm: true });
    return null;
  }

  function rename(id: string, name: string): string | null {
    const profile = registry.profiles.find((item) => item.id === id);
    if (!profile) return "Profile not found";
    const error = validateName(name, id);
    if (error) return error;

    profile.name = name.trim();
    profile.updatedAt = Date.now();
    return persist() ? null : "Could not save profile";
  }

  async function remove(id: string): Promise<string | null> {
    if (registry.profiles.length <= 1) return "Keep at least one profile";
    const profile = registry.profiles.find((item) => item.id === id);
    if (!profile) return "Profile not found";

    const ok = await confirm(`Delete "${profile.name}"?`, {
      title: "Delete Profile",
      kind: "warning",
    });
    if (!ok) return null;

    const wasActive = registry.activeId === id;
    registry.profiles = registry.profiles.filter((item) => item.id !== id);
    if (registry.preferences.startupProfileId === id) {
      registry.preferences.startupProfileId = null;
    }

    if (!wasActive) {
      if (!persist()) return "Could not save profiles";
      showToast({ message: `Deleted "${profile.name}"`, color: "green" });
      return null;
    }

    const fallback =
      registry.profiles.find((item) => item.id === "default") ??
      registry.profiles[0];
    registry.activeId = fallback.id;
    if (!persist()) return "Could not save profiles";

    replaceProfileSettings(
      fallback.settings,
      registry.preferences.libraryIsolation,
      registry.preferences.universalAccessibility,
    );
    reloadNow();
    return null;
  }

  function setColor(id: string, color: string): void {
    const profile = registry.profiles.find((item) => item.id === id);
    if (
      !profile ||
      !PROFILE_COLORS.includes(color as (typeof PROFILE_COLORS)[number])
    ) {
      return;
    }
    profile.color = color;
    profile.updatedAt = Date.now();
    persist();
  }

  function setIcon(id: string, icon: ProfileIcon): void {
    const profile = registry.profiles.find((item) => item.id === id);
    if (!profile) return;
    profile.icon = icon;
    profile.updatedAt = Date.now();
    persist();
  }

  function setLibraryIsolation(enabled: boolean): void {
    if (enabled === registry.preferences.libraryIsolation) return;

    if (enabled) {
      const current = activeRecord();
      const sharedLibrary = collectLibrarySettings();
      current.settings = {
        ...collectProfileSettings(
          false,
          registry.preferences.universalAccessibility,
        ),
        ...sharedLibrary,
      };
      for (const profile of registry.profiles) {
        if (profile.id === current.id) continue;
        profile.settings = { ...profile.settings, ...sharedLibrary };
      }
    }

    registry.preferences.libraryIsolation = enabled;
    persist();
  }

  function setUniversalAccessibility(enabled: boolean): void {
    if (enabled === registry.preferences.universalAccessibility) return;

    const current = activeRecord();
    const sharedAccessibility = collectAccessibilitySettings();
    current.settings = {
      ...collectProfileSettings(
        registry.preferences.libraryIsolation,
        registry.preferences.universalAccessibility,
      ),
      ...sharedAccessibility,
    };
    for (const profile of registry.profiles) {
      if (profile.id === current.id) continue;
      profile.settings = { ...profile.settings, ...sharedAccessibility };
    }

    registry.preferences.universalAccessibility = enabled;
    persist();
  }

  function setRememberLast(enabled: boolean): void {
    registry.preferences.rememberLast = enabled;
    if (enabled) return;
    const startup = registry.profiles.find(
      (profile) => profile.id === registry.preferences.startupProfileId,
    );
    if (!startup) {
      registry.preferences.startupProfileId = registry.activeId;
    }
    persist();
  }

  function setStartupProfile(id: string): void {
    if (!registry.profiles.some((profile) => profile.id === id)) return;
    registry.preferences.startupProfileId = id;
    persist();
  }

  function setConfirmSwitch(enabled: boolean): void {
    registry.preferences.confirmSwitch = enabled;
    persist();
  }

  function snapshotForActive(): Record<string, string> {
    return collectProfileSettings(
      registry.preferences.libraryIsolation,
      registry.preferences.universalAccessibility,
    );
  }

  function importInto(id: string, settings: Record<string, string>): void {
    if (id === registry.activeId) {
      replaceProfileSettings(
        settings,
        registry.preferences.libraryIsolation,
        registry.preferences.universalAccessibility,
      );
      switching = true;
      window.setTimeout(() => window.location.reload(), 400);
      return;
    }

    const profile = registry.profiles.find((item) => item.id === id);
    if (!profile) {
      showToast({ message: "Profile not found", color: "red" });
      return;
    }
    profile.settings = { ...settings };
    profile.updatedAt = Date.now();
    if (persist()) {
      showToast({ message: `Imported into "${profile.name}"`, color: "green" });
    }
  }

  return {
    get list() {
      return registry.profiles;
    },
    get activeId() {
      return registry.activeId;
    },
    get active() {
      return activeRecord();
    },
    get preferences() {
      return registry.preferences;
    },
    get switching() {
      return switching;
    },
    select,
    create,
    rename,
    remove,
    setColor,
    setIcon,
    setLibraryIsolation,
    setUniversalAccessibility,
    setRememberLast,
    setStartupProfile,
    setConfirmSwitch,
    snapshotForActive,
    importInto,
  };
}

export const profiles = createProfiles();
