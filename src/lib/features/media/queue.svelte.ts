import { slideshow } from "$lib/features/media/slideshow.svelte";
import { loadQueue, saveQueue } from "$lib/services/storage";

export interface QueuePlayOptions {
  /** Keep active slideshow/queue playback running while the file loads. */
  preservePlayback?: boolean;
}

type QueuePlayer = (path: string, opts?: QueuePlayOptions) => Promise<void>;

function createQueue() {
  let items = $state<string[]>(loadQueue());
  let history = $state<string[]>([]);
  let player: QueuePlayer = async () => {};
  let getCurrentPath: () => string = () => "";
  let advancing = false;

  function configure(fn: QueuePlayer, currentPath?: () => string) {
    player = fn;
    if (currentPath) getCurrentPath = currentPath;
  }

  function rememberCurrent() {
    const current = getCurrentPath();
    if (!current) return;
    if (history[history.length - 1] === current) return;
    history = [...history.slice(-49), current];
  }

  function setItems(next: string[]) {
    items = next;
    saveQueue(next);
  }

  function enqueue(paths: string[]): number {
    const seen = new Set(items);
    const next: string[] = [];
    for (const path of paths) {
      if (!path || seen.has(path)) continue;
      seen.add(path);
      next.push(path);
    }
    if (next.length > 0) setItems([...items, ...next]);
    return next.length;
  }

  function remove(path: string) {
    if (!items.includes(path)) return;
    setItems(items.filter((item) => item !== path));
  }

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    if (from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
  }

  function clear() {
    setItems([]);
    history = [];
  }

  function has(path: string): boolean {
    return items.includes(path);
  }

  function position(path: string): number {
    const index = items.indexOf(path);
    return index === -1 ? 0 : index + 1;
  }

  function replacePath(oldPath: string, newPath: string) {
    if (!oldPath || !newPath || oldPath === newPath) return;
    setItems(items.map((item) => (item === oldPath ? newPath : item)));
  }

  function replacePrefix(oldPrefix: string, newPrefix: string) {
    if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) return;
    const normalized =
      oldPrefix.endsWith("\\") || oldPrefix.endsWith("/")
        ? oldPrefix
        : `${oldPrefix}\\`;
    setItems(
      items.map((item) => {
        if (item === oldPrefix) return newPrefix;
        if (item.startsWith(normalized)) {
          return `${newPrefix}${item.slice(oldPrefix.length)}`;
        }
        return item;
      }),
    );
  }

  function shift(): string | null {
    if (items.length === 0) return null;
    const path = items[0];
    setItems(items.slice(1));
    return path;
  }

  async function playNext(opts?: QueuePlayOptions): Promise<boolean> {
    if (advancing) return false;
    advancing = true;
    try {
      if (items.length > 0) rememberCurrent();
      while (items.length > 0) {
        const path = shift();
        if (!path) continue;
        try {
          await player(path, opts);
          return true;
        } catch {
          // A moved or deleted queued path should not block the rest.
        }
      }
      return false;
    } finally {
      advancing = false;
    }
  }

  async function playNow(
    path: string,
    opts?: QueuePlayOptions,
  ): Promise<boolean> {
    if (getCurrentPath() !== path) rememberCurrent();
    remove(path);
    try {
      await player(path, opts);
      return true;
    } catch {
      return false;
    }
  }

  async function playPrevious(opts?: QueuePlayOptions): Promise<boolean> {
    if (advancing) return false;
    advancing = true;
    try {
      while (history.length > 0) {
        const path = history[history.length - 1];
        history = history.slice(0, -1);
        if (!path) continue;
        const current = getCurrentPath();
        if (current && current !== path && !items.includes(current)) {
          setItems([current, ...items]);
        }
        try {
          await player(path, opts);
          return true;
        } catch {
          // Skipped or deleted history entries should not block the rest.
        }
      }
      return false;
    } finally {
      advancing = false;
    }
  }

  async function startPlayback(): Promise<boolean> {
    if (items.length === 0) return false;
    if (slideshow.active) {
      slideshow.resume();
      return true;
    }
    history = [];
    const played = await playNext();
    if (!played) return false;
    slideshow.start();
    return true;
  }

  return {
    get items() {
      return items;
    },
    get length() {
      return items.length;
    },
    get canGoPrevious() {
      return history.length > 0;
    },
    configure,
    enqueue,
    remove,
    move,
    clear,
    has,
    position,
    replacePath,
    replacePrefix,
    playNext,
    playNow,
    playPrevious,
    startPlayback,
  };
}

export type QueueStore = typeof queue;
export const queue = createQueue();
