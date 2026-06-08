<script lang="ts">
  import { toastStore } from "$lib/features/toast/toast.svelte";
</script>

{#if toastStore.toasts.length > 0}
  <div class="toast-stack">
    {#each toastStore.toasts as toast (toast.id)}
      <div
        class="toast toast-{toast.color}"
        class:toast-exiting={toast.exiting}
        style="--toast-duration: {toast.duration}ms"
      >
        <div class="toast-body">
          <span class="toast-msg">{toast.message}</span>
          {#if toast.actions.length > 0}
            <div class="toast-actions">
              {#each toast.actions as action}
                <button
                  class="toast-action-btn toast-action-{action.variant ??
                    'default'}"
                  onclick={action.onClick}
                >
                  {#if action.icon}{@html action.icon}{/if}
                  {action.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        {#if toast.duration > 0}
          <div class="toast-progress">
            <div class="toast-progress-bar"></div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}
