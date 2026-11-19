import { slideshow } from "$lib/features/media/slideshow.svelte";

export interface QueuePlayOptions {
  /** Keep active slideshow/queue playback running while the file loads. */
  preservePlayback?: boolean;
}

type QueuePlayer = (path: string, opts?: QueuePlayOptions) => Promise<void>;

function createQueue() {
  let items = $state<string[]>([]);
  let player: QueuePlayer = async () => {};
  let advancing = false;

  function configure(fn: QueuePlayer) {
    player = fn;
  }

  function enqueue(paths: string[]): number {
    const seen = new Set(items);
    const next: string[] = [];
    for (const path of paths) {
      if (!path || seen.has(path)) continue;
      seen.add(path);
      next.push(path);
    }
    if (next.length > 0) items = [...items, ...next];
    return next.length;
  }

  function remove(path: string) {
    if (!items.includes(path)) return;
    items = items.filter((item) => item !== path);
  }

  function move(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    if (from >= items.length || to >= items.length) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    items = next;
  }

  function clear() {
    items = [];
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
    items = items.map((item) => (item === oldPath ? newPath : item));
  }

  function replacePrefix(oldPrefix: string, newPrefix: string) {
    if (!oldPrefix || !newPrefix || oldPrefix === newPrefix) return;
    const normalized =
      oldPrefix.endsWith("\\") || oldPrefix.endsWith("/")
        ? oldPrefix
        : `${oldPrefix}\\`;
    items = items.map((item) => {
      if (item === oldPrefix) return newPrefix;
      if (item.startsWith(normalized)) {
        return `${newPrefix}${item.slice(oldPrefix.length)}`;
      }
      return item;
    });
  }

  function shift(): string | null {
    if (items.length === 0) return null;
    const path = items[0];
    items = items.slice(1);
    return path;
  }

  async function playNext(opts?: QueuePlayOptions): Promise<boolean> {
    if (advancing) return false;
    advancing = true;
    try {
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
    remove(path);
    try {
      await player(path, opts);
      return true;
    } catch {
      return false;
    }
  }

  async function startPlayback(): Promise<boolean> {
    if (items.length === 0) return false;
    if (slideshow.active) {
      slideshow.resume();
      return true;
    }
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
    startPlayback,
  };
}

export type QueueStore = typeof queue;
export const queue = createQueue();
