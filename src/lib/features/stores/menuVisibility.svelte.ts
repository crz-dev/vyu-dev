import { editing } from "$lib/features/editing/editing.svelte";

function createMenuVisibilityStore() {
  let editMenuVisible = $state(false);
  let markupMenuVisible = $state(false);
  let effectsMenuVisible = $state(false);
  let equalizerMenuVisible = $state(false);
  let slideshowMenuVisible = $state(false);
  let appDropdownVisible = $state(false);
  let settingsOpen = $state(false);
  let accessibilityOpen = $state(false);
  let helpOpen = $state(false);
  let aboutOpen = $state(false);
  let feedbackOpen = $state(false);
  let libraryOpen = $state(false);
  let tsMenuOpen = $state(false);
  let loopMenuOpen = $state(false);

  // Saved state for viewer menus when library is open
  let savedViewerMenus: {
    editMenuVisible: boolean;
    markupMenuVisible: boolean;
    effectsMenuVisible: boolean;
    equalizerMenuVisible: boolean;
    slideshowMenuVisible: boolean;
  } | null = null;

  return {
    get editMenuVisible() {
      return editMenuVisible;
    },
    set editMenuVisible(v: boolean) {
      editMenuVisible = v;
    },
    get markupMenuVisible() {
      return markupMenuVisible;
    },
    set markupMenuVisible(v: boolean) {
      markupMenuVisible = v;
    },
    get effectsMenuVisible() {
      return effectsMenuVisible;
    },
    set effectsMenuVisible(v: boolean) {
      effectsMenuVisible = v;
    },
    get equalizerMenuVisible() {
      return equalizerMenuVisible;
    },
    set equalizerMenuVisible(v: boolean) {
      equalizerMenuVisible = v;
    },
    get slideshowMenuVisible() {
      return slideshowMenuVisible;
    },
    set slideshowMenuVisible(v: boolean) {
      slideshowMenuVisible = v;
    },
    get appDropdownVisible() {
      return appDropdownVisible;
    },
    set appDropdownVisible(v: boolean) {
      appDropdownVisible = v;
    },
    get settingsOpen() {
      return settingsOpen;
    },
    set settingsOpen(v: boolean) {
      settingsOpen = v;
    },
    get accessibilityOpen() {
      return accessibilityOpen;
    },
    set accessibilityOpen(v: boolean) {
      accessibilityOpen = v;
    },
    get helpOpen() {
      return helpOpen;
    },
    set helpOpen(v: boolean) {
      helpOpen = v;
    },
    get aboutOpen() {
      return aboutOpen;
    },
    set aboutOpen(v: boolean) {
      aboutOpen = v;
    },
    get feedbackOpen() {
      return feedbackOpen;
    },
    set feedbackOpen(v: boolean) {
      feedbackOpen = v;
    },
    get libraryOpen() {
      return libraryOpen;
    },
    set libraryOpen(v: boolean) {
      libraryOpen = v;
    },
    get tsMenuOpen() {
      return tsMenuOpen;
    },
    set tsMenuOpen(v: boolean) {
      tsMenuOpen = v;
    },
    get loopMenuOpen() {
      return loopMenuOpen;
    },
    set loopMenuOpen(v: boolean) {
      loopMenuOpen = v;
    },
    get isAnyOpen() {
      return !!(
        editMenuVisible ||
        markupMenuVisible ||
        effectsMenuVisible ||
        equalizerMenuVisible ||
        slideshowMenuVisible ||
        appDropdownVisible ||
        settingsOpen ||
        accessibilityOpen ||
        helpOpen ||
        aboutOpen ||
        feedbackOpen ||
        libraryOpen ||
        tsMenuOpen
      );
    },
    saveViewerMenus() {
      savedViewerMenus = {
        editMenuVisible,
        markupMenuVisible,
        effectsMenuVisible,
        equalizerMenuVisible,
        slideshowMenuVisible,
      };
      editMenuVisible = false;
      markupMenuVisible = false;
      effectsMenuVisible = false;
      equalizerMenuVisible = false;
      slideshowMenuVisible = false;
    },
    restoreViewerMenus() {
      if (!savedViewerMenus) return;
      editMenuVisible = savedViewerMenus.editMenuVisible;
      markupMenuVisible = savedViewerMenus.markupMenuVisible;
      effectsMenuVisible = savedViewerMenus.effectsMenuVisible;
      equalizerMenuVisible = savedViewerMenus.equalizerMenuVisible;
      slideshowMenuVisible = savedViewerMenus.slideshowMenuVisible;
      savedViewerMenus = null;
    },
    closeAll() {
      editMenuVisible = false;
      markupMenuVisible = false;
      effectsMenuVisible = false;
      equalizerMenuVisible = false;
      slideshowMenuVisible = false;
      appDropdownVisible = false;
      settingsOpen = false;
      accessibilityOpen = false;
      helpOpen = false;
      aboutOpen = false;
      feedbackOpen = false;
      libraryOpen = false;
      tsMenuOpen = false;
    },
  };
}

export type MenuVisibilityStore = typeof menuStore;
export const menuStore = createMenuVisibilityStore();

export interface MenuActionsDeps {
  closeContextMenu: () => void;
  getFilePath: () => string;
}

export function createMenuActions(deps: MenuActionsDeps) {
  function openEditMenu() {
    deps.closeContextMenu();
    editing.setFilePath(deps.getFilePath());
    menuStore.editMenuVisible = true;
  }

  function closeEditMenu() {
    menuStore.editMenuVisible = false;
  }

  function openMarkupMenu() {
    deps.closeContextMenu();
    menuStore.markupMenuVisible = true;
  }

  function closeMarkupMenu() {
    menuStore.markupMenuVisible = false;
  }

  function openEffectsMenu() {
    deps.closeContextMenu();
    menuStore.effectsMenuVisible = true;
  }

  function closeEffectsMenu() {
    menuStore.effectsMenuVisible = false;
  }

  function openEqualizerMenu() {
    deps.closeContextMenu();
    menuStore.equalizerMenuVisible = true;
  }

  function closeEqualizerMenu() {
    menuStore.equalizerMenuVisible = false;
  }

  function toggleSlideshowMenu() {
    menuStore.slideshowMenuVisible = !menuStore.slideshowMenuVisible;
  }

  function closeSlideshowMenu() {
    menuStore.slideshowMenuVisible = false;
  }

  return {
    openEditMenu,
    closeEditMenu,
    openMarkupMenu,
    closeMarkupMenu,
    openEffectsMenu,
    closeEffectsMenu,
    openEqualizerMenu,
    closeEqualizerMenu,
    toggleSlideshowMenu,
    closeSlideshowMenu,
  };
}

export function createMenuBindings() {
  return {
    get appDropdownVisible() {
      return menuStore.appDropdownVisible;
    },
    toggleAppDropdown: () =>
      (menuStore.appDropdownVisible = !menuStore.appDropdownVisible),
    closeAppDropdown: () => (menuStore.appDropdownVisible = false),
    openSettings: () => (menuStore.settingsOpen = true),
    openAccessibility: () => (menuStore.accessibilityOpen = true),
    openHelp: () => (menuStore.helpOpen = true),
    openAbout: () => (menuStore.aboutOpen = true),
    openFeedback: () => (menuStore.feedbackOpen = true),
    get settingsOpen() {
      return menuStore.settingsOpen;
    },
    closeSettings: () => (menuStore.settingsOpen = false),
    get accessibilityOpen() {
      return menuStore.accessibilityOpen;
    },
    closeAccessibility: () => (menuStore.accessibilityOpen = false),
    get helpOpen() {
      return menuStore.helpOpen;
    },
    closeHelp: () => (menuStore.helpOpen = false),
    get aboutOpen() {
      return menuStore.aboutOpen;
    },
    closeAbout: () => (menuStore.aboutOpen = false),
    get feedbackOpen() {
      return menuStore.feedbackOpen;
    },
    closeFeedback: () => (menuStore.feedbackOpen = false),
    openLibrary: () => (menuStore.libraryOpen = true),
    closeLibrary: () => (menuStore.libraryOpen = false),
    get libraryOpen() {
      return menuStore.libraryOpen;
    },
  };
}

export function areDialogsOpen(deps: {
  contextMenuStore: { isOpen: boolean };
  menuStore: { isAnyOpen: boolean };
  markerStore: { tsEditMenu: { visible: boolean } };
  deleteStore: { deleteConfirm: boolean };
  propertiesOpen: boolean;
  shareOpen: boolean;
  clips: { clipDeleteConfirm: { visible: boolean } };
  editDialogStore: {
    editApplyConfirm: boolean;
    editTransparencyConfirm: boolean;
  };
  corruption: { state: { warning: boolean } };
  sort: { menuVisible: boolean };
}): boolean {
  return (
    deps.contextMenuStore.isOpen ||
    deps.menuStore.isAnyOpen ||
    deps.markerStore.tsEditMenu.visible ||
    deps.deleteStore.deleteConfirm ||
    deps.propertiesOpen ||
    deps.shareOpen ||
    deps.clips.clipDeleteConfirm.visible ||
    deps.editDialogStore.editApplyConfirm ||
    deps.editDialogStore.editTransparencyConfirm ||
    deps.corruption.state.warning ||
    deps.sort.menuVisible
  );
}
