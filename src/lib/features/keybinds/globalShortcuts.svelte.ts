import {
  isRegistered,
  register,
  unregister,
  unregisterAll,
} from "@tauri-apps/plugin-global-shortcut";
import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
import {
  bindingToAccelerator,
  hasGlobalModifier,
} from "$lib/features/keybinds/keybindUtils";
import { locale } from "$lib/features/i18n/locale.svelte";

type GlobalHandlers = Record<string, () => void>;

function createGlobalShortcuts() {
  let handlers: GlobalHandlers = {};
  let errors = $state<Record<string, string>>({});
  let started = false;
  let syncing = false;
  let pending = false;

  function configure(next: GlobalHandlers) {
    handlers = next;
  }

  async function sync() {
    if (!started) return;
    if (syncing) {
      pending = true;
      return;
    }
    syncing = true;
    try {
      await unregisterAll();
      const nextErrors: Record<string, string> = {};

      for (const [id, handler] of Object.entries(handlers)) {
        const action = keybindStore.actionFor(id);
        if (!action || action.context !== "system") continue;
        const binding = keybindStore.bindingFor(id);
        if (!binding) continue;
        if (!hasGlobalModifier(binding)) {
          nextErrors[id] = locale.t("settings.keybinds.error.globalModifier");
          continue;
        }
        const accelerator = bindingToAccelerator(binding);
        if (!accelerator) {
          nextErrors[id] = locale.t("settings.keybinds.error.globalInvalid");
          continue;
        }
        try {
          await register(accelerator, (event) => {
            if (event.state === "Pressed") handler();
          });
          if (!(await isRegistered(accelerator))) {
            await unregister(accelerator).catch(() => {});
            nextErrors[id] = locale.t(
              "settings.keybinds.error.globalConflict",
              { binding: keybindStore.label(id) },
            );
          }
        } catch (e) {
          nextErrors[id] = locale.t("settings.keybinds.error.globalConflict", {
            binding: keybindStore.label(id),
          });
          console.error(
            `Failed to register global shortcut ${accelerator}:`,
            e,
          );
        }
      }

      errors = nextErrors;
    } catch (e) {
      console.error("Failed to sync global shortcuts:", e);
    } finally {
      syncing = false;
      if (pending) {
        pending = false;
        void sync();
      }
    }
  }

  function start() {
    if (started) return;
    started = true;
    void sync();
  }

  function stop() {
    if (!started) return;
    started = false;
    errors = {};
    void unregisterAll().catch((e) => {
      console.error("Failed to unregister global shortcuts:", e);
    });
  }

  return {
    get errors() {
      return errors;
    },
    configure,
    start,
    stop,
    sync,
  };
}

export const globalShortcuts = createGlobalShortcuts();
