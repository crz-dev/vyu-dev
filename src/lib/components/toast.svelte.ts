export type ToastColor = "green" | "red" | "yellow" | "blue" | "grey";

export interface ToastAction {
  label?: string;
  icon?: string;
  variant?: "default" | "accent" | "red" | "green";
  tooltip?: string;
  onClick: () => void;
}

export interface ToastOptions {
  message: string;
  color: ToastColor;
  duration?: number;
  icon?: string;
  actions?: ToastAction[];
  prepend?: boolean;
  progress?: number | null;
}

interface ToastItem extends Required<
  Omit<ToastOptions, "actions" | "prepend" | "icon" | "progress">
> {
  id: number;
  actions: ToastAction[];
  exiting: boolean;
  exitingUp: boolean;
  icon: string;
  progress: number | null;
}

const EXIT_MS = 200;
const MAX_TOASTS = 4;

let nextId = 0;

function createToastStore() {
  const toasts = $state<ToastItem[]>([]);
  const timers = new Map<number, ReturnType<typeof setTimeout>>();

  function removeFromDom(id: number) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    const idx = toasts.findIndex((t) => t.id === id);
    if (idx !== -1) toasts.splice(idx, 1);
  }

  function animateOut(id: number, up = false) {
    const toast = toasts.find((t) => t.id === id);
    if (!toast || toast.exiting) return;
    toast.exiting = true;
    toast.exitingUp = up;
    setTimeout(() => removeFromDom(id), EXIT_MS);
  }

  // The oldest toasts sit at the top of the stack; drop them once over the cap.
  function trimToLimit() {
    const live = toasts.filter((t) => !t.exiting);
    let overflow = live.length - MAX_TOASTS;
    if (overflow <= 0) return;
    for (let i = live.length - 1; i >= 0 && overflow > 0; i--) {
      // Sticky toasts (durations of 0) are owned by their caller; keep them.
      if (live[i].duration === 0) continue;
      animateOut(live[i].id, true);
      overflow--;
    }
  }

  function showToast(opts: ToastOptions): number {
    const id = nextId++;
    const duration = opts.duration ?? 3000;
    const item: ToastItem = {
      id,
      message: opts.message,
      color: opts.color,
      duration,
      icon: opts.icon ?? "",
      actions: opts.actions ?? [],
      exiting: false,
      exitingUp: false,
      progress: opts.progress ?? null,
    };
    // Newest toasts sit at the bottom of the stack, closest to the bottombar.
    if (opts.prepend) {
      toasts.push(item);
    } else {
      toasts.unshift(item);
    }
    trimToLimit();

    if (duration > 0) {
      timers.set(
        id,
        setTimeout(() => animateOut(id), duration),
      );
    }

    return id;
  }

  function updateToast(id: number, changes: Partial<ToastOptions>) {
    const toast = toasts.find((t) => t.id === id);
    if (!toast) return;
    if (changes.message !== undefined) toast.message = changes.message;
    if (changes.color !== undefined) toast.color = changes.color;
    if (changes.actions !== undefined) toast.actions = changes.actions;
    if (changes.progress !== undefined) toast.progress = changes.progress;
    if (changes.duration !== undefined) {
      toast.duration = changes.duration;
      toast.exiting = false;
      toast.exitingUp = false;
      clearTimeout(timers.get(id));
      if (changes.duration > 0) {
        timers.set(
          id,
          setTimeout(() => animateOut(id), changes.duration!),
        );
      }
    }
  }

  function dismissToast(id: number) {
    animateOut(id);
  }

  return {
    get toasts() {
      return toasts;
    },
    showToast,
    updateToast,
    dismissToast,
  };
}

export const toastStore = createToastStore();

export function showToast(opts: ToastOptions): number {
  return toastStore.showToast(opts);
}

export function updateToast(id: number, changes: Partial<ToastOptions>) {
  toastStore.updateToast(id, changes);
}

export function dismissToast(id: number) {
  toastStore.dismissToast(id);
}
