// Visualizer state — tracks which floating visualizer windows are active (ephemeral)
export type VisualizerType = "pulse" | "spectrum" | "heartbeat" | "diamonds";

const COL_W = 386;
const COL_GAP = 16;
const ROW_GAP = 16;
const ROW_H = 165;

export interface LayoutPos {
  left: number;
  top: number;
}

export interface VisualizerStore {
  readonly active: readonly VisualizerType[];
  readonly isActive: (name: VisualizerType) => boolean;
  readonly isPinned: (name: VisualizerType) => boolean;
  readonly getLayoutPosition: (name: VisualizerType) => LayoutPos;
  toggle: (name: VisualizerType) => void;
  close: (name: VisualizerType) => void;
  closeAll: () => void;
  setPinned: (name: VisualizerType, value: boolean) => void;
}

function createVisualizerStore(): VisualizerStore {
  let active = $state<VisualizerType[]>([]);
  const pinned = new Set<VisualizerType>();

  function isActive(name: VisualizerType): boolean {
    return active.includes(name);
  }

  function isPinned(name: VisualizerType): boolean {
    return pinned.has(name);
  }

  function toggle(name: VisualizerType) {
    if (active.includes(name)) {
      active = active.filter((t) => t !== name);
    } else {
      active = [...active, name];
    }
  }

  function close(name: VisualizerType) {
    if (!active.includes(name)) return;
    active = active.filter((t) => t !== name);
  }

  function closeAll() {
    if (active.length === 0) return;
    if (pinned.size === 0) {
      active = [];
    } else {
      active = active.filter((t) => pinned.has(t));
    }
  }

  function setPinned(name: VisualizerType, value: boolean) {
    if (value) {
      pinned.add(name);
    } else {
      pinned.delete(name);
    }
  }

  function getLayoutPosition(name: VisualizerType): LayoutPos {
    const idx = active.indexOf(name);
    if (idx === -1) return { left: 0, top: 0 };

    const count = active.length;
    const cols = count <= 1 ? 1 : 2;
    const rows = Math.ceil(count / cols);
    const row = Math.floor(idx / cols);
    const col = idx % cols;

    const rowItems = row < rows - 1 ? cols : count - (rows - 1) * cols;
    const rowWidth = rowItems * COL_W + (rowItems - 1) * COL_GAP;
    const left = -(rowWidth / 2) + col * (COL_W + COL_GAP);
    const top = row * (ROW_H + ROW_GAP);

    return { left, top };
  }

  return {
    get active() {
      return active;
    },
    isActive,
    isPinned,
    getLayoutPosition,
    toggle,
    close,
    closeAll,
    setPinned,
  };
}

export const visualizerStore = createVisualizerStore();
