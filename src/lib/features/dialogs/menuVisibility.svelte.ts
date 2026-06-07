import { editing } from "$lib/features/editing/editing.svelte";

function createMenuVisibilityStore() {
  let editMenuVisible = $state(false);
  let markupMenuVisible = $state(false);
  let slideshowMenuVisible = $state(false);
  let appDropdownVisible = $state(false);
  let settingsOpen = $state(false);
  let accessibilityOpen = $state(false);
  let helpOpen = $state(false);
  let aboutOpen = $state(false);
  let feedbackOpen = $state(false);
  let tsMenuOpen = $state(false);
  let loopMenuOpen = $state(false);

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
  };
}

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
  };
}
