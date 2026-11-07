<script lang="ts">
  import { tick } from "svelte";
  import { fly } from "svelte/transition";
  import {
    LOCALES,
    locale,
    type LanguagePreference,
  } from "$lib/features/i18n/locale.svelte";
  import { appearance } from "$lib/features/theme/appearance.svelte";

  const t = locale.t;
  const menuDuration = $derived(appearance.reducedMotion ? 0 : 150);

  let open = $state(false);
  let activeIndex = $state(0);
  let wrapEl = $state<HTMLDivElement | null>(null);
  let triggerEl = $state<HTMLButtonElement | null>(null);
  let menuEl = $state<HTMLDivElement | null>(null);
  let measureEl = $state<HTMLDivElement | null>(null);
  let measuredWidth = $state(0);

  const options = $derived([
    {
      value: "system" as LanguagePreference,
      label: t("settings.appearance.language.system"),
    },
    ...LOCALES.map((entry) => ({
      value: entry.code as LanguagePreference,
      label: entry.label,
    })),
  ]);

  const selectedIndex = $derived(
    Math.max(
      0,
      options.findIndex((option) => option.value === locale.preference),
    ),
  );
  const selectedLabel = $derived(options[selectedIndex]?.label ?? "");

  const NON_LATIN_LOCALES = new Set<string>([
    "zh-CN",
    "zh-TW",
    "ja",
    "ko",
    "ru",
  ]);

  function isNonLatin(code: string): boolean {
    return NON_LATIN_LOCALES.has(code);
  }

  const triggerNonLatin = $derived(
    isNonLatin(
      locale.preference === "system" ? locale.current : locale.preference,
    ),
  );

  const selectWidth = $derived(Math.max(150, measuredWidth + 60));

  function measureWidth() {
    const el = measureEl;
    if (!el) return;
    measuredWidth = Math.ceil(el.getBoundingClientRect().width);
  }

  $effect(() => {
    options;
    measureWidth();
    if (typeof document !== "undefined" && document.fonts) {
      void document.fonts.ready.then(measureWidth);
    }
  });

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

  function openMenu() {
    measureWidth();
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

  function choose(value: LanguagePreference) {
    locale.setLocale(value);
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
      return;
    }
    if (event.key === "End") {
      event.preventDefault();
      activeIndex = options.length - 1;
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      choose(options[activeIndex].value);
    }
  }

  function handleWindowMouseDown(event: MouseEvent) {
    if (!open) return;
    if (wrapEl && !wrapEl.contains(event.target as Node)) {
      closeMenu();
    }
  }
</script>

<svelte:window onmousedown={handleWindowMouseDown} />

<div
  class="language-select-wrap"
  style="--language-width: {selectWidth}px"
  bind:this={wrapEl}
>
  <div class="language-measure" aria-hidden="true" bind:this={measureEl}>
    {#each options as option (option.value)}
      <span
        class:non-latin={option.value === "system"
          ? isNonLatin(locale.current)
          : isNonLatin(option.value)}>{option.label}</span
      >
    {/each}
  </div>
  <button
    bind:this={triggerEl}
    type="button"
    class="language-trigger"
    class:open
    class:non-latin={triggerNonLatin}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={t("settings.appearance.language.label")}
    onclick={toggleMenu}
    onkeydown={handleTriggerKeydown}
  >
    <span class="language-trigger-label">{selectedLabel}</span>
    <svg
      class="language-trigger-chevron"
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
      class="language-menu"
      role="listbox"
      tabindex="-1"
      aria-label={t("settings.appearance.language.label")}
      onkeydown={handleMenuKeydown}
      transition:fly={{ y: -5, duration: menuDuration }}
    >
      {#each options as option, index (option.value)}
        <button
          type="button"
          role="option"
          aria-selected={option.value === locale.preference}
          data-index={index}
          class="language-option"
          class:active={index === activeIndex}
          class:selected={option.value === locale.preference}
          class:non-latin={option.value === "system"
            ? isNonLatin(locale.current)
            : isNonLatin(option.value)}
          onmouseenter={() => (activeIndex = index)}
          onclick={() => choose(option.value)}
        >
          <span>{option.label}</span>
          {#if option.value === locale.preference}
            <svg
              class="language-check"
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
        {#if index === 0}
          <div class="language-menu-divider" aria-hidden="true"></div>
        {/if}
      {/each}
    </div>
  {/if}
</div>
