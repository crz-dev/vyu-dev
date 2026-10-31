// Keybind state and persistence
import {
  KEYBIND_ACTIONS,
  KEYBIND_ACTIONS_BY_ID,
  defaultBindings,
} from "$lib/features/keybinds/keybindDefinitions";
import type {
  KeybindAction,
  KeybindBinding,
  KeybindBindings,
  KeybindContext,
} from "$lib/features/keybinds/keybindTypes";
import {
  bindingFromEvent,
  conflictsFor,
  eventMatchesBinding,
  formatBinding,
  isReservedEvent,
  sameBinding,
  sanitizeBindings,
} from "$lib/features/keybinds/keybindUtils";
import { loadKeybinds, saveKeybinds } from "$lib/services/storage";

export type RecordResult =
  | "bound"
  | "cleared"
  | "cancelled"
  | "conflict"
  | "reserved"
  | "ignored";

function createKeybindStore() {
  const saved = typeof localStorage !== "undefined" ? loadKeybinds() : null;
  let bindings = $state<KeybindBindings>(
    sanitizeBindings(saved, KEYBIND_ACTIONS),
  );
  let recordingActionId = $state<string | null>(null);
  let recordingError = $state("");
  let cheatSheetOpen = $state(false);

  function persist() {
    saveKeybinds({ version: 1, bindings });
  }

  function bindingFor(id: string): KeybindBinding | null {
    return bindings[id] ?? null;
  }

  function label(id: string): string {
    return formatBinding(bindingFor(id));
  }

  function actionFor(id: string): KeybindAction | undefined {
    return KEYBIND_ACTIONS_BY_ID.get(id);
  }

  function isCustom(id: string): boolean {
    const action = actionFor(id);
    if (!action) return false;
    return !sameBinding(bindingFor(id), action.defaultBinding);
  }

  function isUnbound(id: string): boolean {
    return bindingFor(id) === null;
  }

  function beginRecording(id: string) {
    if (!actionFor(id)) return;
    recordingActionId = id;
    recordingError = "";
  }

  function cancelRecording() {
    recordingActionId = null;
    recordingError = "";
  }

  function recordEvent(e: KeyboardEvent): RecordResult {
    const id = recordingActionId;
    if (!id) return "ignored";
    const action = actionFor(id);
    if (!action) {
      cancelRecording();
      return "ignored";
    }

    if (e.key === "Escape") {
      cancelRecording();
      return "cancelled";
    }

    if (e.key === "Backspace" || e.key === "Delete") {
      if (!e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
        bindings = { ...bindings, [id]: null };
        persist();
        recordingActionId = null;
        recordingError = "";
        return "cleared";
      }
    }

    const binding = bindingFromEvent(e);
    if (!binding) {
      if (!isReservedEvent(e)) {
        // Modifier-only or dead keys: keep waiting for a real key.
        return "ignored";
      }
      recordingError = "That key is reserved.";
      return "reserved";
    }

    const conflict = conflictsFor(action, binding, KEYBIND_ACTIONS, bindings);
    if (conflict.length > 0) {
      recordingError = `Already used by ${conflict[0].label}.`;
      return "conflict";
    }

    bindings = { ...bindings, [id]: binding };
    persist();
    recordingActionId = null;
    recordingError = "";
    return "bound";
  }

  function resetAction(id: string): string | null {
    const action = actionFor(id);
    if (!action) return "Unknown action.";
    const fallback = action.defaultBinding;
    if (!fallback) {
      bindings = { ...bindings, [id]: null };
      persist();
      return null;
    }
    const conflict = conflictsFor(action, fallback, KEYBIND_ACTIONS, bindings);
    if (conflict.length > 0) {
      return `Default is already used by ${conflict[0].label}. Reset all instead.`;
    }
    bindings = { ...bindings, [id]: fallback };
    persist();
    return null;
  }

  function resetAll() {
    bindings = defaultBindings();
    recordingActionId = null;
    recordingError = "";
    persist();
  }

  function actionForEvent(
    e: KeyboardEvent,
    contexts: KeybindContext[],
  ): KeybindAction | null {
    const binding = bindingFromEvent(e);
    if (!binding) return null;
    for (const action of KEYBIND_ACTIONS) {
      if (!contexts.includes(action.context)) continue;
      if (eventMatchesBinding(e, bindings[action.id] ?? null)) {
        return action;
      }
    }
    return null;
  }

  function matches(id: string, e: KeyboardEvent): boolean {
    return eventMatchesBinding(e, bindingFor(id));
  }

  function toggleCheatSheet() {
    cheatSheetOpen = !cheatSheetOpen;
  }

  function closeCheatSheet() {
    cheatSheetOpen = false;
  }

  function exportConfig() {
    return { version: 1, bindings: { ...bindings } };
  }

  return {
    get actions() {
      return KEYBIND_ACTIONS;
    },
    get bindings() {
      return bindings;
    },
    get recordingActionId() {
      return recordingActionId;
    },
    get recordingError() {
      return recordingError;
    },
    get isRecording() {
      return recordingActionId !== null;
    },
    get cheatSheetOpen() {
      return cheatSheetOpen;
    },
    get unboundIds() {
      return KEYBIND_ACTIONS.filter((action) => !bindings[action.id]).map(
        (action) => action.id,
      );
    },
    bindingFor,
    label,
    actionFor,
    isCustom,
    isUnbound,
    beginRecording,
    cancelRecording,
    recordEvent,
    resetAction,
    resetAll,
    actionForEvent,
    matches,
    toggleCheatSheet,
    closeCheatSheet,
    exportConfig,
  };
}

export const keybindStore = createKeybindStore();
