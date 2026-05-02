<script lang="ts">
  let {
    visible,
    onClose,
    onOpenSettings,
    onOpenAccessibility,
    onOpenHelp,
    onOpenAbout,
    onOpenFeedback,
  }: {
    visible: boolean;
    onClose: () => void;
    onOpenSettings: () => void;
    onOpenAccessibility: () => void;
    onOpenHelp: () => void;
    onOpenAbout: () => void;
    onOpenFeedback: () => void;
  } = $props();

  function handleItemClick(action: string) {
    if (action === "settings") {
      onOpenSettings();
    }
    if (action === "accessibility") {
      onOpenAccessibility();
    }
    if (action === "help") {
      onOpenHelp();
    }
    if (action === "about") {
      onOpenAbout();
    }
    if (action === "feedback") {
      onOpenFeedback();
    }
    onClose();
  }
</script>

{#if visible}
  <div class="app-dropdown-menu">
    <div class="app-dropdown-header">
      <span class="app-dropdown-title"><span>v{__APP_VERSION__}</span></span>
    </div>
    <div class="app-dropdown-separator"></div>
    <button
      class="app-dropdown-item"
      onclick={() => handleItemClick("settings")}
    >
      Settings
    </button>
    <button
      class="app-dropdown-item"
      onclick={() => handleItemClick("accessibility")}
    >
      Accessibility
    </button>
    <button class="app-dropdown-item" onclick={() => handleItemClick("help")}>
      Help
    </button>
    <button
      class="app-dropdown-item"
      onclick={() => handleItemClick("feedback")}
    >
      Feedback
    </button>
    <div class="app-dropdown-separator"></div>
    <button class="app-dropdown-item" onclick={() => handleItemClick("about")}>
      About
    </button>
  </div>
{/if}
