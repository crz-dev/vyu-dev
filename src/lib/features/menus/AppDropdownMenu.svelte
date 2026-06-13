<script lang="ts">
  let {
    visible,
    onClose,
    onOpenSettings,
    onOpenAccessibility,
    onOpenHelp,
    onOpenAbout,
    onOpenFeedback,
    onOpenLibrary,
    libraryOpen = false,
    onCloseLibrary,
  }: {
    visible: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
    onOpenAccessibility: () => void;
    onOpenHelp: () => void;
    onOpenAbout: () => void;
    onOpenFeedback: () => void;
    onOpenLibrary: () => void;
    libraryOpen?: boolean;
    onCloseLibrary?: () => void;
  } = $props();
</script>

{#if visible}
  <div class="app-dropdown-menu">
    <button
      class="app-dropdown-item"
      class:active={libraryOpen}
      onclick={() => {
        if (libraryOpen) {
          onCloseLibrary?.();
        } else {
          onOpenLibrary();
        }
        onClose();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><rect x="3" y="3" width="7" height="7" /><rect
          x="14"
          y="3"
          width="7"
          height="7"
        /><rect x="14" y="14" width="7" height="7" /><rect
          x="3"
          y="14"
          width="7"
          height="7"
        /></svg
      >
      Library
    </button>
    <div class="app-dropdown-separator"></div>
    <button
      class="app-dropdown-item"
      onclick={() => {
        onOpenSettings();
        onClose();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><circle cx="12" cy="12" r="3" /><path
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z"
        /></svg
      >
      Settings
    </button>
    <button
      class="app-dropdown-item"
      onclick={() => {
        onOpenAccessibility();
        onClose();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><circle cx="12" cy="4" r="2" /><path d="M12 6v6" /><path
          d="M8 12h8"
        /><path d="M7 22l5-10 5 10" /><path d="M3 16l4-4" /><path
          d="M21 16l-4-4"
        /></svg
      >
      Accessibility
    </button>
    <button
      class="app-dropdown-item"
      onclick={() => {
        onOpenFeedback();
        onClose();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><path
          d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
        /></svg
      >
      Feedback
    </button>
    <button
      class="app-dropdown-item"
      onclick={() => {
        onOpenHelp();
        onClose();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><circle cx="12" cy="12" r="10" /><path
          d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"
        /><line x1="12" y1="17" x2="12.01" y2="17" /></svg
      >
      Help
    </button>
    <div class="app-dropdown-separator"></div>
    <button
      class="app-dropdown-item"
      onclick={() => {
        onOpenAbout();
        onClose();
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        ><circle cx="12" cy="12" r="10" /><line
          x1="12"
          y1="16"
          x2="12"
          y2="12"
        /><line x1="12" y1="8" x2="12.01" y2="8" /></svg
      >
      About
    </button>
  </div>
{/if}
