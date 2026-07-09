<script lang="ts">
  let { class: className = "" }: { class?: string } = $props();
</script>

<div class="thumb-gen-toast {className}">
  <span>Generating thumbnails</span>
</div>

<style>
  .thumb-gen-toast {
    width: fit-content;
    border: 0.5px solid var(--bg-border);
    color: var(--text-secondary);
    font-size: 11px;
    font-family: var(--font-family);
    padding: 5px 8px;
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    display: flex;
    pointer-events: none;
    background: linear-gradient(
      90deg,
      var(--bg-elevated) 20%,
      var(--bg-shimmer) 50%,
      var(--bg-elevated) 80%
    );
    background-size: 200% 100%;
    animation:
      uiToastPopIn 190ms cubic-bezier(0.22, 0.9, 0.3, 1) both,
      thumbShimmer 3s ease-in-out infinite;
  }
</style>
