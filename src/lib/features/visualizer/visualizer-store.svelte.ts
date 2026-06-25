// Visualizer state — tracks which floating visualizer windows are active (ephemeral)
export type VisualizerType = "bars" | "spectrum" | "scope" | "particles";

export interface VisualizerStore {
  readonly active: ReadonlySet<VisualizerType>;
  readonly isActive: (name: VisualizerType) => boolean;
  readonly isPinned: (name: VisualizerType) => boolean;
  toggle: (name: VisualizerType) => void;
  close: (name: VisualizerType) => void;
  closeAll: () => void;
  setPinned: (name: VisualizerType, value: boolean) => void;
}

function createVisualizerStore(): VisualizerStore {
  let active = $state(new Set<VisualizerType>());
  const pinned = new Set<VisualizerType>();

  function isActive(name: VisualizerType): boolean {
    return active.has(name);
  }

  function isPinned(name: VisualizerType): boolean {
    return pinned.has(name);
  }

  function toggle(name: VisualizerType) {
    const next = new Set(active);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    active = next;
  }

  function close(name: VisualizerType) {
    if (!active.has(name)) return;
    const next = new Set(active);
    next.delete(name);
    active = next;
  }

  function closeAll() {
    if (active.size === 0) return;
    if (pinned.size === 0) {
      active = new Set();
    } else {
      active = new Set([...active].filter((t) => pinned.has(t)));
    }
  }

  function setPinned(name: VisualizerType, value: boolean) {
    if (value) {
      pinned.add(name);
    } else {
      pinned.delete(name);
    }
  }

  return {
    get active() {
      return active;
    },
    isActive,
    isPinned,
    toggle,
    close,
    closeAll,
    setPinned,
  };
}

export const visualizerStore = createVisualizerStore();
