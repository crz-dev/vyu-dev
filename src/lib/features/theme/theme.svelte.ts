// Theme state
import { loadTheme, saveTheme } from "$lib/services/storage";

export type ThemeMode = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export interface TransitionState {
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
    document.documentElement.setAttribute("data-theme", t);
  }

  const initialResolved = resolveEffective(saved);
  let mode = $state<ThemeMode>(saved);
  let resolved = $state<ResolvedTheme>(initialResolved);
  let transition = $state<TransitionState>({
    active: false,
    phase: "idle",
    originX: 50,
    originY: 50,
    targetBg: "",
  });

  if (typeof document !== "undefined") {
    applyTheme(initialResolved);
  }

  // Listen for OS theme changes (only matters when mode === "system")
  if (mq) {
    mq.addEventListener("change", (e: MediaQueryListEvent) => {
      if (mode === "system") {
        resolved = e.matches ? "dark" : "light";
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
      if (clickOrigin) {
        // Animated transition from the clicked element
        transition = {
          active: true,
          phase: "expanding",
          originX: clickOrigin.x,
          originY: clickOrigin.y,
          targetBg: getThemeBg(resolved),
        };
      } else {
        // Instant switch (startup restore, system change)
        applyTheme(resolved);
      }
    }
  }

  // Called by layout when expand animation completes
  function onExpandComplete() {
    applyTheme(resolved);
    transition = {
      ...transition,
      phase: "fading",
    };
  }

  // Called by layout when fade animation completes
  function onTransitionComplete() {
    transition = {
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
    get transition() {
      return transition;
    },
    setTheme,
    onExpandComplete,
    onTransitionComplete,
  };
}

export const theme = createTheme();
