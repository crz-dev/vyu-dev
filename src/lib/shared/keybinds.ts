// Configurable keybind dispatcher
import { keybindStore } from "$lib/features/keybinds/keybindStore.svelte";
import type { KeybindContext } from "$lib/features/keybinds/keybindTypes";
import { isTypingTarget } from "$lib/features/keybinds/keybindUtils";

export interface KeybindActions {
  getContext: () => Exclude<KeybindContext, "global">;
  areDialogsOpen: () => boolean;
  closeDialogs: () => void;
  isFullscreen: () => boolean;
  exitFullscreen: () => void;
  actions: Record<string, () => void>;
  holdActions?: Record<string, { start: () => void; end: () => void }>;
}

const SCROLL_KEYS = new Set([
  " ",
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
]);

export function createKeybindHandler(deps: KeybindActions) {
  let heldActionId: string | null = null;

  function releaseHolds() {
    if (!heldActionId) return;
    deps.holdActions?.[heldActionId]?.end();
    heldActionId = null;
  }

  function handleKeydown(e: KeyboardEvent) {
    if (keybindStore.isRecording) return;
    if (e.defaultPrevented) return;
    if (isTypingTarget(e.target)) return;

    if (keybindStore.cheatSheetOpen) {
      if (e.key === "Escape") {
        e.preventDefault();
        keybindStore.closeCheatSheet();
        return;
      }
      if (keybindStore.matches("show-shortcuts", e)) {
        e.preventDefault();
        if (!e.repeat) keybindStore.toggleCheatSheet();
      }
      return;
    }

    if (deps.areDialogsOpen()) {
      if (e.key === "Escape") {
        e.preventDefault();
        deps.closeDialogs();
        return;
      }
      if (keybindStore.matches("toggle-library", e)) {
        e.preventDefault();
        if (!e.repeat) deps.actions["toggle-library"]?.();
      }
      return;
    }

    const context = deps.getContext();
    const contexts: KeybindContext[] =
      context === "viewer" ? ["global", "viewer"] : ["global"];
    const action = keybindStore.actionForEvent(e, contexts);

    if (action) {
      if (e.repeat && !action.allowRepeat) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      if (action.behavior === "hold") {
        const hold = deps.holdActions?.[action.id];
        if (hold) {
          releaseHolds();
          hold.start();
          heldActionId = action.id;
        }
        return;
      }
      deps.actions[action.id]?.();
      return;
    }

    if (e.key === "Escape" && deps.isFullscreen()) {
      e.preventDefault();
      deps.exitFullscreen();
      return;
    }

    if (context === "viewer" && SCROLL_KEYS.has(e.key)) {
      e.preventDefault();
    }
  }

  function handleKeyup(_e: KeyboardEvent) {
    // Hold actions end on any key release. This also covers releasing a
    // modifier before the primary key, which would otherwise leave compare
    // stuck on.
    releaseHolds();
  }

  return { handleKeydown, handleKeyup, releaseHolds };
}
