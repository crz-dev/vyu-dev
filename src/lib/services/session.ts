// Session utilities
import type { ContextMenu } from "$lib/shared/types";

export function computeContextMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
): Pick<ContextMenu, "x" | "y"> {
  let x = clientX;
  let y = clientY;
  if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 8;
  if (y + menuHeight > window.innerHeight)
    y = window.innerHeight - menuHeight - 8;
  return { x, y };
}

export function showFloatingTooltip(
  id: string,
  anchorRect: DOMRect,
  text: string,
): void {
  const tip = document.getElementById(id);
  if (!tip) return;
  tip.textContent = text;
  tip.style.left = `${anchorRect.left}px`;
  tip.style.top = `${anchorRect.bottom + 6}px`;
  tip.style.opacity = "1";

  const rafId = requestAnimationFrame(() => {
    if (!tip) return;
    const tipRect = tip.getBoundingClientRect();
    const centeredLeft =
      anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
    tip.style.left = `${centeredLeft}px`;
  });
  tip.dataset.rafId = String(rafId);
}

export function hideFloatingTooltip(id: string): void {
  const tip = document.getElementById(id);
  if (tip) {
    const rafId = Number(tip.dataset.rafId);
    if (rafId) cancelAnimationFrame(rafId);
    tip.style.opacity = "0";
  }
}
