// Context menu state
import { computeContextMenuPosition } from "$lib/services/session";

export interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
}

function createContextMenuStore() {
  let contextMenu = $state<ContextMenuState>({ x: 0, y: 0, visible: false });

  return {
    get contextMenu() {
      return contextMenu;
    },
    get isOpen() {
      return contextMenu.visible;
    },
    open(e: MouseEvent, menuW: number, menuH: number) {
      const { x, y } = computeContextMenuPosition(
        e.clientX,
        e.clientY,
        menuW,
        menuH,
      );
      contextMenu = { x, y, visible: true };
    },
    close() {
      contextMenu = { ...contextMenu, visible: false };
    },
  };
}

export const contextMenuStore = createContextMenuStore();
