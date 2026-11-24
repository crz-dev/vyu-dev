<script lang="ts">
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import { appearance } from "$lib/features/theme/appearance.svelte";

  let {
    value,
    options,
    ariaLabel,
    onchange,
  }: {
    value: string;
    options: Array<{ value: string; label: string }>;
    ariaLabel: string;
    onchange: (value: string) => void;
  } = $props();

  const duration = $derived(appearance.reducedMotion ? 0 : 150);

  let open = $state(false);
  let activeIndex = $state(0);
  let placement = $state<"down" | "up">("down");
  let menuStyle = $state("");
  let wrapEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);

  const selectedIndex = $derived(
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const selectedLabel = $derived(options[selectedIndex]?.label ?? "");

  function scrollActiveIntoView() {
    const menu = menuEl;
    if (!menu) return;
    const item = menu.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    if (!item) return;
    const top = item.offsetTop;
    const bottom = top + item.offsetHeight;
    if (top < menu.scrollTop) {
      menu.scrollTop = top;
    } else if (bottom > menu.scrollTop + menu.clientHeight) {
      menu.scrollTop = bottom - menu.clientHeight;
    }
  }

  function portal(node: HTMLElement) {
    document.body.appendChild(node);
    return {
      destroy() {
        node.remove();
      },
    };
  }

  function openMenu() {
    const rect = triggerEl?.getBoundingClientRect();
    if (!rect) return;
    const margin = 6;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const openUp = spaceBelow < 180 && spaceAbove > spaceBelow;
    const width = Math.min(rect.width, window.innerWidth - margin * 2);
    const left = Math.min(
      Math.max(margin, rect.left),
      window.innerWidth - width - margin,
    );
    const maxHeight = Math.max(
      80,
      Math.min(220, openUp ? spaceAbove - 4 : spaceBelow - 4),
    );
    placement = openUp ? "up" : "down";
    menuStyle = openUp
      ? `left:${left}px;width:${width}px;max-height:${maxHeight}px;bottom:${window.innerHeight - rect.top + 4}px;`
      : `left:${left}px;width:${width}px;max-height:${maxHeight}px;top:${rect.bottom + 4}px;`;
    activeIndex = selectedIndex;
    open = true;
    void tick().then(() => {
      scrollActiveIntoView();
      menuEl?.focus({ preventScroll: true });
    });
  }

  function closeMenu(restoreFocus = false) {
    open = false;
    if (restoreFocus) {
      void tick().then(() => triggerEl?.focus({ preventScroll: true }));
    }
  }

  function toggleMenu() {
    if (open) closeMenu();
    else openMenu();
  }

  function choose(next: string) {
    onchange(next);
    closeMenu(true);
  }

  function moveActive(delta: number) {
    activeIndex = (activeIndex + delta + options.length) % options.length;
    void tick().then(scrollActiveIntoView);
  }

  function handleTriggerKeydown(event: KeyboardEvent) {
    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      openMenu();
    }
  }

  function handleMenuKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeMenu(true);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key === "Home") {
      event.preventDefault();
      activeIndex = 0;
      void tick().then(scrollActiveIntoView);
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      activeIndex = options.length - 1;
      void tick().then(scrollActiveIntoView);
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option.value);
    }
  }

  function handleWindowMouseDown(event: MouseEvent) {
    if (!open) return;
    const target = event.target as Node;
    if (wrapEl?.contains(target) || menuEl?.contains(target)) return;
    closeMenu();
  }
</script>

<svelte:window
  onmousedown={handleWindowMouseDown}
  onresize={() => closeMenu()}
  onscroll={() => closeMenu()}
/>

<div class="subtitle-select-wrap" bind:this={wrapEl}>
  <button
    bind:this={triggerEl}
    type="button"
    class="subtitle-select-trigger"
    class:open
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    onclick={toggleMenu}
    onkeydown={handleTriggerKeydown}
  >
    <span class="subtitle-select-label">{selectedLabel}</span>
    <svg
      class="subtitle-select-chevron"
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"><polyline points="6 9 12 15 18 9" /></svg
    >
  </button>

  {#if open}
    <div
      bind:this={menuEl}
      class="subtitle-select-menu"
      style={menuStyle}
      use:portal
      role="listbox"
      tabindex="-1"
      aria-label={ariaLabel}
      onkeydown={handleMenuKeydown}
      transition:fly={{
        y: placement === "up" ? 5 : -5,
        duration,
      }}
    >
      {#each options as option, index (option.value)}
        <button
          type="button"
          role="option"
          aria-selected={option.value === value}
          data-index={index}
          class="subtitle-select-option"
          class:active={index === activeIndex}
          class:selected={option.value === value}
          onmouseenter={() => (activeIndex = index)}
          onclick={() => choose(option.value)}
        >
          <span>{option.label}</span>
          {#if option.value === value}
            <svg
              class="subtitle-select-check"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg
            >
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
