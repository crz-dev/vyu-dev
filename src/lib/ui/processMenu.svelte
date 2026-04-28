<script lang="ts">
  import { fly } from "svelte/transition";

  let {
    visible,
    onClose,
  }: {
    visible: boolean;
    onClose: () => void;
  } = $props();
</script>

{#if visible}
  <div class="process-menu" transition:fly={{ y: -26, duration: 190, opacity: 0.08 }}>
    <div
      class="ctx-drag"
      onmousedown={(e) => {
        e.preventDefault();
        const menu = (e.currentTarget as HTMLElement).closest(".process-menu") as HTMLElement;
        if (!menu) return;
        const startX = e.clientX;
        const startY = e.clientY;
        const rect = menu.getBoundingClientRect();
        const startLeft = rect.left;
        const startTop = rect.top;

        function onMouseMove(ev: MouseEvent) {
          menu.style.left = `${startLeft + ev.clientX - startX}px`;
          menu.style.top = `${startTop + ev.clientY - startY}px`;
          menu.style.transform = "none";
        }

        function onMouseUp() {
          window.removeEventListener("mousemove", onMouseMove);
          window.removeEventListener("mouseup", onMouseUp);
        }

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
      }}
    >
      <span class="ctx-dot"></span><span class="ctx-dot"></span><span class="ctx-dot"></span>
      <button
        class="ctx-close"
        onclick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onmousedown={(e) => e.stopPropagation()}
        aria-label="Close"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
    <div class="edit-menu-row">
      <button class="edit-menu-btn blue">Placeholder 1</button>
      <button class="edit-menu-btn yellow">Placeholder 2</button>
    </div>
  </div>
{/if}
