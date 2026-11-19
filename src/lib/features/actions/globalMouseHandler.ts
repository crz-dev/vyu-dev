export function createGlobalMouseHandler(deps: {
  contextMenuStore: { isOpen: boolean; close: () => void };
  menuStore: {
    editMenuVisible: boolean;
    markupMenuVisible: boolean;
    effectsMenuVisible: boolean;
    equalizerMenuVisible: boolean;
    queueMenuVisible: boolean;
    sleepTimerMenuVisible: boolean;
    appDropdownVisible: boolean;
    libraryOpen: boolean;
  };
  markerStore: { tsEditMenu: { visible: boolean } };
  closeEditMenu: () => void;
  closeMarkupMenu: () => void;
  closeEffectsMenu: () => void;
  closeEqualizerMenu: () => void;
  closeQueueMenu: () => void;
  closeSleepTimerMenu: () => void;
  closeTimestampEditor: () => void;
}) {
  return function handleGlobalMouseDown(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (deps.menuStore.libraryOpen) return;
    if (
      deps.contextMenuStore.isOpen &&
      !target.closest(".context-menu") &&
      !document.querySelector(".context-menu.pinned")
    )
      deps.contextMenuStore.close();
    if (
      deps.menuStore.editMenuVisible &&
      e.button === 2 &&
      !target.closest(".edit-menu-wrapper-edit") &&
      !document.querySelector(".edit-menu-edit.pinned")
    )
      deps.closeEditMenu();
    if (
      deps.menuStore.markupMenuVisible &&
      e.button === 2 &&
      !target.closest(".markup-menu-wrapper-markup") &&
      !document.querySelector(".edit-menu-markup.pinned")
    )
      deps.closeMarkupMenu();
    if (
      deps.menuStore.effectsMenuVisible &&
      e.button === 2 &&
      !target.closest(".edit-menu-wrapper-effects") &&
      !document.querySelector(".edit-menu-effects.pinned")
    )
      deps.closeEffectsMenu();
    if (
      deps.menuStore.equalizerMenuVisible &&
      e.button === 2 &&
      !target.closest(".equalizer-wrapper") &&
      !document.querySelector(".edit-menu-equalizer.pinned")
    )
      deps.closeEqualizerMenu();
    if (
      deps.menuStore.queueMenuVisible &&
      e.button === 2 &&
      !target.closest(".queue-menu") &&
      !target.closest(".queue-btn") &&
      !document.querySelector(".queue-menu.pinned")
    )
      deps.closeQueueMenu();
    if (
      deps.menuStore.sleepTimerMenuVisible &&
      !target.closest(".sleep-timer-menu") &&
      !target.closest(".sleep-timer-indicator")
    )
      deps.closeSleepTimerMenu();
    if (
      deps.markerStore.tsEditMenu.visible &&
      !target.closest(".ts-edit-menu") &&
      !target.closest(".ts-marker") &&
      !target.closest(".clip-marker") &&
      !target.closest(".fs-clip-marker")
    )
      deps.closeTimestampEditor();
    if (
      deps.menuStore.appDropdownVisible &&
      !target.closest(".app-dropdown-menu") &&
      !target.closest(".app-dropdown-toggle")
    )
      deps.menuStore.appDropdownVisible = false;
  };
}
