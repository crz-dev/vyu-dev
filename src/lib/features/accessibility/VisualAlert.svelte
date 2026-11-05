<script lang="ts">
  import { accessibility } from "$lib/features/menus/accessibility.svelte";
</script>

{#if accessibility.visualAlerts && accessibility.visualAlertTick > 0}
  {#key accessibility.visualAlertTick}
    <div
      class="a11y-visual-alert"
      class:paused={accessibility.visualAlertKind === "pause"}
      aria-hidden="true"
    ></div>
  {/key}
{/if}
