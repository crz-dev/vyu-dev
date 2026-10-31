<script lang="ts">
  import type { Snippet } from "svelte";
  import SettingsGroupIcon from "$lib/components/SettingsGroupIcon.svelte";

  let {
    label,
    icon = "",
    children,
  }: {
    label: string;
    icon?: string;
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
<div class="settings-card has-child">
  {@render children()}
</div>
