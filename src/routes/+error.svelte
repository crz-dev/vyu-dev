<script lang="ts">
  import { page } from "$app/stores";
  import { theme } from "$lib/features/theme/theme.svelte";
  import "../app.css";

  function reload() {
    window.location.reload();
  }
</script>

<svelte:head>
  <title>Vyu — Error</title>
</svelte:head>

<div class="error-container">
  <div class="error-card">
    <h1>Something went wrong</h1>
    <p class="error-message">{$page.status === 404 ? "Page not found" : "An unexpected error occurred"}</p>
    {#if $page.error}
      <p class="error-detail">{$page.error.message}</p>
    {/if}
    <button class="error-reload" onclick={reload}>Reload app</button>
  </div>
</div>

<style>
  .error-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100vh;
    background: var(--bg-base, #000);
    color: var(--text-primary, #fff);
    font-family: var(--font-family, system-ui, sans-serif);
  }
  .error-card {
    text-align: center;
    max-width: 400px;
    padding: 32px;
  }
  h1 {
    font-size: 20px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .error-message {
    font-size: 14px;
    color: var(--text-muted, #888);
    margin-bottom: 4px;
  }
  .error-detail {
    font-size: 12px;
    color: var(--text-muted, #666);
    margin-bottom: 24px;
    word-break: break-word;
  }
  .error-reload {
    padding: 8px 24px;
    border: 1px solid var(--bg-border, #333);
    border-radius: 6px;
    background: var(--bg-secondary, #111);
    color: var(--text-primary, #fff);
    font-size: 13px;
    cursor: pointer;
  }
  .error-reload:hover {
    background: var(--bg-elevated, #222);
  }
</style>
