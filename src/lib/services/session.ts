import type { ContextMenu } from "$lib/shared/types";

export function computeContextMenuPosition(
  clientX: number,
  clientY: number,
  menuWidth: number,
  menuHeight: number,
): Pick<ContextMenu, "x" | "y"> {
  const maxX = Math.max(0, window.innerWidth - menuWidth - 8);
  const maxY = Math.max(0, window.innerHeight - menuHeight - 8);
  const x = Math.max(0, Math.min(clientX, maxX));
  const y = Math.max(0, Math.min(clientY, maxY));
  return { x, y };
}

export function showFloatingTooltip(
  id: string,
  anchorRect: DOMRect,
  text: string,
): void {
  const tip = document.getElementById(id);
  if (!tip) return;
  const previousRaf = Number(tip.dataset.rafId);
  if (previousRaf) cancelAnimationFrame(previousRaf);
  tip.textContent = text;
  tip.style.left = "8px";
  tip.style.top = `${anchorRect.bottom + 6}px`;
  tip.style.opacity = "0";

  const rafId = requestAnimationFrame(() => {
    if (!tip) return;
    const tipRect = tip.getBoundingClientRect();
    const maxLeft = Math.max(8, window.innerWidth - tipRect.width - 8);
    const centeredLeft =
      anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
    const left = Math.min(Math.max(centeredLeft, 8), maxLeft);
    const top = Math.min(
      anchorRect.bottom + 6,
      window.innerHeight - tipRect.height - 8,
    );
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(8, top)}px`;
    tip.style.opacity = "1";
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
