// Theme state
import {
  loadDarkVariant,
  loadTheme,
  saveDarkVariant,
  saveTheme,
  type DarkVariant,
} from "$lib/services/storage";
import { appearance } from "./appearance.svelte";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export interface TransitionState {
  id: number;
  active: boolean;
  phase: "idle" | "expanding" | "fading";
  originX: number;
  originY: number;
  targetBg: string;
}

function getThemeBg(t: ResolvedTheme): string {
  return t === "light" ? "#c0c0c0" : "#000000";
}

function createTheme() {
  const saved = loadTheme();

  // Media query — resolved once, never changes
  const mq =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  function resolveEffective(mode: ThemeMode): ResolvedTheme {
    if (mode === "system") {
      return mq?.matches ? "dark" : "light";
    }
    return mode;
  }

  function applyTheme(t: ResolvedTheme) {
    const root = document.documentElement;
    root.setAttribute("data-theme", t);
    root.setAttribute(
      "data-dark-variant",
      t === "dark" ? darkVariant : "standard",
    );
  }

  const initialResolved = resolveEffective(saved);
  let mode = $state<ThemeMode>(saved);
  let resolved = $state<ResolvedTheme>(initialResolved);
  let darkVariant = $state<DarkVariant>(loadDarkVariant());
  let transitionSeq = 0;
  let transition = $state<TransitionState>({
    id: 0,
    active: false,
    phase: "idle",
    originX: 50,
    originY: 50,
    targetBg: "",
  });

  if (typeof document !== "undefined") {
    applyTheme(initialResolved);
  }

  function cancelTransition() {
    if (!transition.active) return;
    transitionSeq += 1;
    transition = {
      id: transitionSeq,
      active: false,
      phase: "idle",
      originX: 0,
      originY: 0,
      targetBg: "",
    };
  }

  // Listen for OS theme changes (only matters when mode === "system")
  if (mq) {
    mq.addEventListener("change", (e: MediaQueryListEvent) => {
      if (mode === "system") {
        resolved = e.matches ? "dark" : "light";
        cancelTransition();
        applyTheme(resolved);
      }
    });
  }

  function setTheme(
    newMode: ThemeMode,
    clickOrigin?: { x: number; y: number },
  ) {
    const oldResolved = resolved;
    mode = newMode;
    resolved = resolveEffective(newMode);
    saveTheme(newMode);

    if (oldResolved !== resolved) {
      if (clickOrigin && !appearance.reducedMotion) {
        // Animated transition from the clicked element
        transitionSeq += 1;
        transition = {
          id: transitionSeq,
          active: true,
          phase: "expanding",
          originX: clickOrigin.x,
          originY: clickOrigin.y,
          targetBg: getThemeBg(resolved),
        };
      } else {
        // Instant switch (startup restore, system change, reduced motion)
        cancelTransition();
        applyTheme(resolved);
      }
    }
  }

  function setDarkVariant(variant: DarkVariant) {
    darkVariant = variant;
    saveDarkVariant(variant);
    applyTheme(resolved);
  }

  // Called by layout when expand animation completes
  function onExpandComplete(id: number) {
    if (!transition.active || transition.id !== id) return;
    applyTheme(resolved);
    transition = {
      ...transition,
      phase: "fading",
    };
  }

  // Called by layout when fade animation completes
  function onTransitionComplete(id: number) {
    if (transition.id !== id) return;
    transition = {
      id,
      active: false,
      phase: "idle",
      originX: 0,
      originY: 0,
      targetBg: "",
    };
  }

  return {
    get mode() {
      return mode;
    },
    get resolved() {
      return resolved;
    },
    get darkVariant() {
      return darkVariant;
    },
    get transition() {
      return transition;
    },
    setTheme,
    setDarkVariant,
    onExpandComplete,
    onTransitionComplete,
  };
}

export const theme = createTheme();
