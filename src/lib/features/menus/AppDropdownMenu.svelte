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
</script>

{#if visible}
  <div class="app-dropdown-menu">
    <div class="app-dropdown-header">
      <span class="app-dropdown-title"><span>v{__APP_VERSION__}</span></span>
    </div>
    <div class="app-dropdown-separator"></div>
    <button class="app-dropdown-item" onclick={() => { onOpenSettings(); onClose(); }}>
      Settings
    </button>
    <button class="app-dropdown-item" onclick={() => { onOpenAccessibility(); onClose(); }}>
      Accessibility
    </button>
    <button class="app-dropdown-item" onclick={() => { onOpenHelp(); onClose(); }}>
      Help
    </button>
    <button class="app-dropdown-item" onclick={() => { onOpenFeedback(); onClose(); }}>
      Feedback
    </button>
    <div class="app-dropdown-separator"></div>
    <button class="app-dropdown-item" onclick={() => { onOpenAbout(); onClose(); }}>
      About
    </button>
  </div>
{/if}
