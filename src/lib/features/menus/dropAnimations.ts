// Stagger delays (in ms) for the tsDropItemPopIn entry animation shared
// by LoopDropdown and MarkerDropdown. Header animates first, then items
// cascade in 55ms steps.
export const TS_DROP_ANIM_DELAYS_MS = [0, 55, 110, 165, 220] as const;
