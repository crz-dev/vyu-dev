import { cubicIn } from "svelte/easing";
import { appearance } from "$lib/features/theme/appearance.svelte";

interface MenuOutOptions {
  y?: number;
  scale?: number;
  duration?: number;
}

/**
 * Menu outro that mirrors the entry pop. Animates the independent
 * `translate`/`scale` properties so it composes with the `transform` values
 * menus use for positioning.
 */
export function menuOut(
  _node: Element,
  { y = 0, scale = 1, duration = 180 }: MenuOutOptions = {},
) {
  return {
    duration: appearance.reducedMotion ? 0 : duration,
    easing: cubicIn,
    css: (t: number) => {
      const offset = (1 - t) * y;
      const shrink = 1 - (1 - t) * (1 - scale);
      return `opacity: ${t}; translate: 0 ${offset}px; scale: ${shrink};`;
    },
  };
}
