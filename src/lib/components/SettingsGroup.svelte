<script lang="ts">
  import type { Snippet } from "svelte";
  import SettingsGroupIcon from "$lib/components/SettingsGroupIcon.svelte";

  let {
    label,
    icon = "",
    id = "",
    flash = false,
    children,
  }: {
    label: string;
    icon?: string;
    id?: string;
    flash?: boolean;
    children: Snippet;
  } = $props();
</script>

<p class="settings-group-label">
  {#if icon}
    <span class="settings-group-icon">
      <SettingsGroupIcon name={icon} />
    </span>
  {/if}
  {label}
</p>
<div id={id || undefined} class="settings-card has-child" class:flash>
  {@render children()}
</div>
