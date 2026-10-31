<script lang="ts">
  import type { Snippet } from "svelte";
  import { slide } from "svelte/transition";
  import { appearance } from "$lib/features/theme/appearance.svelte";

  let {
    label,
    hint = "",
    subrow = false,
    open,
    control,
    children,
  }: {
    label: string;
    hint?: string;
    subrow?: boolean;
    open?: boolean;
    control: Snippet;
    children?: Snippet;
  } = $props();

  const duration = $derived(appearance.reducedMotion ? 0 : 160);
</script>

{#snippet body()}
  <div class="settings-label-col">
    <div class="settings-label-text">
      <span class="settings-label">{label}</span>
      {#if hint}<span class="settings-hint">{hint}</span>{/if}
      {#if children}{@render children()}{/if}
    </div>
  </div>
  <div class="settings-control">{@render control()}</div>
{/snippet}

{#if open === undefined}
  <div class="settings-row" class:settings-subrow={subrow}>
    {@render body()}
  </div>
{:else if open}
  <div
    class="settings-row"
    class:settings-subrow={subrow}
    transition:slide={{ duration }}
  >
    {@render body()}
  </div>
{/if}
