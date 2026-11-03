import {
  loadSortMode,
  saveSortMode,
  loadSortDesc,
  saveSortDesc,
} from "$lib/services/storage";
import type { SortMode } from "$lib/shared/constants";

export function createSort() {
  let mode = $state<SortMode>(loadSortMode());
  let desc = $state(loadSortDesc());
  let menuVisible = $state(false);
  let menuX = $state(0);
  let menuY = $state(0);

  function toggle() {
    menuVisible = !menuVisible;
  }

  function open() {
    menuVisible = true;
  }

  function close() {
    menuVisible = false;
  }

  function openAt(x: number, y: number) {
    menuX = x;
    menuY = y;
    menuVisible = true;
  }

  function toggleAt(x: number, y: number) {
    menuX = x;
    menuY = y;
    menuVisible = !menuVisible;
  }

  function change(newMode: SortMode, newDesc: boolean) {
    mode = newMode;
    desc = newDesc;
    saveSortMode(newMode);
    saveSortDesc(newDesc);
    menuVisible = false;
  }

  return {
    get mode() {
      return mode;
    },
    get desc() {
      return desc;
    },
    get menuVisible() {
      return menuVisible;
    },
    get menuX() {
      return menuX;
    },
    get menuY() {
      return menuY;
    },
    toggle,
    open,
    close,
    openAt,
    toggleAt,
    change,
  };
}

export type SortStore = typeof sort;
export const sort = createSort();
