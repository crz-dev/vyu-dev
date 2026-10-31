// Keybind normalization, formatting, and conflict helpers
import type {
  KeybindAction,
  KeybindBinding,
  KeybindBindings,
  KeybindContext,
} from "$lib/features/keybinds/keybindTypes";

const MODIFIER_KEYS = new Set([
  "Control",
  "Shift",
  "Alt",
  "Meta",
  "OS",
  "AltGraph",
  "CapsLock",
]);

const ARROW_LABELS: Record<string, string> = {
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

const KEY_LABELS: Record<string, string> = {
  " ": "Space",
  Escape: "Esc",
  Enter: "Enter",
  Backspace: "Backspace",
  Delete: "Delete",
  Tab: "Tab",
  Home: "Home",
  End: "End",
  PageUp: "PgUp",
  PageDown: "PgDn",
  Insert: "Insert",
  ...ARROW_LABELS,
};

export function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el || typeof el.closest !== "function") return false;
  return (
    el.closest("input, textarea, select, [contenteditable='true']") !== null ||
    el.isContentEditable
  );
}

export function normalizeKey(value: string): string {
  if (/^[A-Za-z]$/.test(value)) return value.toLowerCase();
  return value;
}

export function normalizeBinding(binding: KeybindBinding): KeybindBinding {
  const key = normalizeKey(binding.key);
  let shift = !!binding.shift;
  if (key.length === 1 && shift && !/[a-z0-9]/i.test(key)) {
    shift = false;
  }
  return {
    key,
    ctrl: !!binding.ctrl,
    alt: !!binding.alt,
    shift,
    meta: !!binding.meta,
  };
}

export function isBinding(value: unknown): value is KeybindBinding {
  if (!value || typeof value !== "object") return false;
  const b = value as Record<string, unknown>;
  return (
    typeof b.key === "string" &&
    b.key.length > 0 &&
    typeof b.ctrl === "boolean" &&
    typeof b.alt === "boolean" &&
    typeof b.shift === "boolean" &&
    typeof b.meta === "boolean"
  );
}

export function bindingFromEvent(e: KeyboardEvent): KeybindBinding | null {
  if (MODIFIER_KEYS.has(e.key)) return null;
  if (e.key === "Dead" || e.key === "Unidentified") return null;

  let key = normalizeKey(e.key);
  let shift = e.shiftKey;

  // Shifted symbols already carry their meaning in e.key. Avoid showing
  // "Shift + ?" and store "?" instead.
  if (key.length === 1 && shift && !/[a-z0-9]/i.test(key)) {
    shift = false;
  }

  const binding: KeybindBinding = {
    key,
    ctrl: e.ctrlKey,
    alt: e.altKey,
    shift,
    meta: e.metaKey,
  };

  return isReservedBinding(binding) ? null : binding;
}

export function isReservedBinding(binding: KeybindBinding): boolean {
  if (binding.meta) return true;
  if (binding.key === "Escape" || binding.key === "Backspace") return true;
  if (
    binding.key === "Delete" &&
    !binding.ctrl &&
    !binding.alt &&
    !binding.shift
  ) {
    return true;
  }
  if (binding.alt && (binding.key === "F4" || binding.key === "Tab")) {
    return true;
  }
  if (binding.key === "F5" || binding.key === "F12") return true;
  if (binding.ctrl && (binding.key === "r" || binding.key === "p")) return true;
  if (binding.ctrl && binding.alt && binding.key === "Delete") return true;
  if (binding.ctrl && binding.shift && ["i", "j"].includes(binding.key)) {
    return true;
  }
  return false;
}

export function isReservedEvent(e: KeyboardEvent): boolean {
  if (MODIFIER_KEYS.has(e.key)) return false;
  const binding = bindingFromEvent(e);
  if (binding) return false;
  // Escape, Backspace, plain Delete, and OS combinations are reserved.
  return !["Dead", "Unidentified"].includes(e.key);
}

export function formatKey(value: string): string {
  return (
    KEY_LABELS[value] ?? (/^[a-z]$/i.test(value) ? value.toUpperCase() : value)
  );
}

export function formatBinding(binding: KeybindBinding | null): string {
  if (!binding) return "";
  const parts: string[] = [];
  if (binding.ctrl) parts.push("Ctrl");
  if (binding.alt) parts.push("Alt");
  if (binding.shift) parts.push("Shift");
  if (binding.meta) parts.push("Meta");
  parts.push(formatKey(binding.key));
  return parts.join(" + ");
}

export function sameBinding(
  a: KeybindBinding | null,
  b: KeybindBinding | null,
): boolean {
  if (!a || !b) return a === b;
  return (
    a.key === b.key &&
    a.ctrl === b.ctrl &&
    a.alt === b.alt &&
    a.shift === b.shift &&
    a.meta === b.meta
  );
}

export function eventMatchesBinding(
  e: KeyboardEvent,
  binding: KeybindBinding | null,
): boolean {
  if (!binding) return false;
  const eventBinding = bindingFromEvent(e);
  return !!eventBinding && sameBinding(eventBinding, binding);
}

export function scopesFor(action: KeybindAction): KeybindContext[] {
  if (action.context === "global") {
    return ["global", "viewer", "library", "pdf"];
  }
  return [action.context, "global"];
}

export function conflictsFor(
  action: KeybindAction,
  binding: KeybindBinding,
  actions: readonly KeybindAction[],
  bindings: KeybindBindings,
): KeybindAction[] {
  const scopes = scopesFor(action);
  return actions.filter((candidate) => {
    if (candidate.id === action.id || !scopes.includes(candidate.context)) {
      return false;
    }
    return sameBinding(bindings[candidate.id] ?? null, binding);
  });
}

export function sanitizeBindings(
  saved: unknown,
  actions: readonly KeybindAction[],
): KeybindBindings {
  const savedBindings =
    saved && typeof saved === "object" && "bindings" in saved
      ? (saved as { bindings?: unknown }).bindings
      : null;
  const savedMap =
    savedBindings && typeof savedBindings === "object"
      ? (savedBindings as Record<string, unknown>)
      : null;

  const result: KeybindBindings = {};

  for (const action of actions) {
    let candidate = action.defaultBinding;

    if (savedMap && Object.prototype.hasOwnProperty.call(savedMap, action.id)) {
      const value = savedMap[action.id];
      if (value === null) {
        candidate = null;
      } else if (isBinding(value)) {
        const normalized = normalizeBinding(value);
        if (!isReservedBinding(normalized)) candidate = normalized;
      }
    }

    if (candidate) {
      const conflict = conflictsFor(action, candidate, actions, result);
      if (conflict.length > 0) {
        const fallback = action.defaultBinding;
        candidate =
          fallback &&
          conflictsFor(action, fallback, actions, result).length === 0
            ? fallback
            : null;
      }
    }

    result[action.id] = candidate;
  }

  return result;
}
