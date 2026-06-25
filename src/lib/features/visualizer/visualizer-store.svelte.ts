// Visualizer state — tracks which floating visualizer windows are active (ephemeral)
export type VisualizerType = "bars" | "spectrum" | "scope" | "particles";

export interface VisualizerStore {
  readonly active: ReadonlySet<VisualizerType>;
  readonly isActive: (name: VisualizerType) => boolean;
  toggle: (name: VisualizerType) => void;
  close: (name: VisualizerType) => void;
  closeAll: () => void;
}

function createVisualizerStore(): VisualizerStore {
  let active = $state(new Set<VisualizerType>());

  function isActive(name: VisualizerType): boolean {
    return active.has(name);
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
    active = new Set();
  }

  return {
    get active() {
      return active;
    },
    isActive,
    toggle,
    close,
    closeAll,
  };
}

export const visualizerStore = createVisualizerStore();
