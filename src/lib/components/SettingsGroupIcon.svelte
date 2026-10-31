<script lang="ts">
  let { name }: { name: string } = $props();
</script>

<svg
  width="12"
  height="12"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  {#if name === "display"}
    <rect x="2" y="3" width="20" height="14" rx="2" /><line
      x1="8"
      y1="21"
      x2="16"
      y2="21"
    /><line x1="12" y1="17" x2="12" y2="21" />
  {:else if name === "eye"}
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle
      cx="12"
      cy="12"
      r="3"
    />
  {:else if name === "accessibility"}
    <circle cx="12" cy="5" r="2" /><path d="M5 9l7 2 7-2" /><path
      d="M12 11v6"
    /><path d="M8 21l4-4 4 4" />
  {:else if name === "rewind"}
    <polyline points="1 4 1 10 7 10" /><path
      d="M3.51 15a9 9 0 102.13-9.36L1 10"
    />
  {:else if name === "volume"}
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path
      d="M15.54 8.46a5 5 0 010 7.07"
    />
  {:else if name === "play"}
    <polygon points="5 3 19 12 5 21 5 3" />
  {:else if name === "pencil"}
    <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4z" />
  {:else if name === "image"}
    <rect x="3" y="3" width="18" height="18" rx="2" /><circle
      cx="8.5"
      cy="8.5"
      r="1.5"
    /><polyline points="21 15 16 10 5 21" />
  {:else if name === "video"}
    <polygon points="23 7 16 12 23 17 23 7" /><rect
      x="1"
      y="5"
      width="15"
      height="14"
      rx="2"
    />
  {:else if name === "sliders"}
    <line x1="4" y1="21" x2="4" y2="14" /><line
      x1="4"
      y1="10"
      x2="4"
      y2="3"
    /><line x1="12" y1="21" x2="12" y2="12" /><line
      x1="12"
      y1="8"
      x2="12"
      y2="3"
    /><line x1="20" y1="21" x2="20" y2="16" /><line
      x1="20"
      y1="12"
      x2="20"
      y2="3"
    /><line x1="1" y1="14" x2="7" y2="14" /><line
      x1="9"
      y1="8"
      x2="15"
      y2="8"
    /><line x1="17" y1="16" x2="23" y2="16" />
  {:else if name === "folder"}
    <path
      d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"
    />
  {:else if name === "cpu"}
    <rect x="4" y="4" width="16" height="16" rx="2" /><rect
      x="9"
      y="9"
      width="6"
      height="6"
    /><line x1="9" y1="1" x2="9" y2="4" /><line
      x1="15"
      y1="1"
      x2="15"
      y2="4"
    /><line x1="9" y1="20" x2="9" y2="23" /><line
      x1="15"
      y1="20"
      x2="15"
      y2="23"
    /><line x1="20" y1="9" x2="23" y2="9" /><line
      x1="20"
      y1="14"
      x2="23"
      y2="14"
    /><line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
  {:else if name === "layout"}
    <rect x="3" y="3" width="7" height="7" /><rect
      x="14"
      y="3"
      width="7"
      height="7"
    /><rect x="3" y="14" width="7" height="7" /><rect
      x="14"
      y="14"
      width="7"
      height="7"
    />
  {:else if name === "clock"}
    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
  {:else if name === "shield"}
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  {:else if name === "window"}
    <rect x="2" y="3" width="20" height="14" rx="2" /><line
      x1="8"
      y1="21"
      x2="16"
      y2="21"
    /><line x1="12" y1="17" x2="12" y2="21" />
  {:else if name === "database"}
    <ellipse cx="12" cy="5" rx="9" ry="3" /><path
      d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"
    /><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
  {:else if name === "refresh"}
    <polyline points="23 4 23 10 17 10" /><path
      d="M20.49 15a9 9 0 11-2.12-9.36L23 10"
    />
  {:else if name === "power"}
    <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline
      points="10 17 15 12 10 7"
    /><line x1="15" y1="12" x2="3" y2="12" />
  {:else if name === "windows"}
    <rect x="3" y="3" width="7" height="7" /><rect
      x="14"
      y="3"
      width="7"
      height="7"
    /><rect x="3" y="14" width="7" height="7" /><rect
      x="14"
      y="14"
      width="7"
      height="7"
    />
  {:else if name === "mouse"}
    <rect x="6" y="2" width="12" height="20" rx="6" /><line
      x1="12"
      y1="6"
      x2="12"
      y2="10"
    />
  {:else if name === "danger"}
    <path
      d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
    /><line x1="12" y1="9" x2="12" y2="13" /><line
      x1="12"
      y1="17"
      x2="12.01"
      y2="17"
    />
  {:else if name === "broom"}
    <path d="M4 20l6-6" /><path d="M14 4l6 6-8 8H6v-6z" /><path
      d="M9 15l-2 2"
    />
  {:else if name === "archive"}
    <polyline points="21 8 21 21 3 21 3 8" /><rect
      x="1"
      y="3"
      width="22"
      height="5"
    /><line x1="10" y1="12" x2="14" y2="12" />
  {:else if name === "trash"}
    <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path
      d="M10 11v6M14 11v6M9 6V4h6v2"
    />
  {:else if name === "filter"}
    <circle cx="11" cy="11" r="8" /><line
      x1="21"
      y1="21"
      x2="16.65"
      y2="16.65"
    />
  {:else if name === "keyboard"}
    <rect x="2" y="4" width="20" height="16" rx="2" /><path
      d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"
    />
  {:else if name === "compass"}
    <circle cx="12" cy="12" r="10" /><polygon
      points="16 8 14 14 8 16 10 10 16 8"
    />
  {:else if name === "file"}
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline
      points="14 2 14 8 20 8"
    />
  {:else if name === "book"}
    <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path
      d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"
    />
  {:else if name === "slideshow"}
    <circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" />
  {:else}
    <circle cx="12" cy="12" r="3" />
  {/if}
</svg>
