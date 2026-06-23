// Global mouse handler
export function createGlobalMouseHandler(deps: {
  contextMenuStore: { isOpen: boolean; close: () => void };
  menuStore: {
    editMenuVisible: boolean;
    markupMenuVisible: boolean;
    effectsMenuVisible: boolean;
    equalizerMenuVisible: boolean;
    slideshowMenuVisible: boolean;
    appDropdownVisible: boolean;
    libraryOpen: boolean;
  };
  markerStore: { tsEditMenu: { visible: boolean } };
  closeEditMenu: () => void;
  closeMarkupMenu: () => void;
  closeEffectsMenu: () => void;
  closeEqualizerMenu: () => void;
  closeSlideshowMenu: () => void;
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
      !target.closest(".edit-menu") &&
      !target.closest(".edit-menu-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      deps.closeEditMenu();
    if (
      deps.menuStore.markupMenuVisible &&
      e.button === 2 &&
      !target.closest(".markup-menu-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      deps.closeMarkupMenu();
    if (
      deps.menuStore.effectsMenuVisible &&
      e.button === 2 &&
      !target.closest(".edit-menu-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      deps.closeEffectsMenu();
    if (
      deps.menuStore.equalizerMenuVisible &&
      e.button === 2 &&
      !target.closest(".equalizer-wrapper") &&
      !document.querySelector(".edit-menu.pinned")
    )
      deps.closeEqualizerMenu();
    if (
      deps.menuStore.slideshowMenuVisible &&
      e.button === 2 &&
      !target.closest(".slideshow-menu") &&
      !target.closest(".slideshow-btn") &&
      !document.querySelector(".slideshow-menu.pinned")
    )
      deps.closeSlideshowMenu();
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
