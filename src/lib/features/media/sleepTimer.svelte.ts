import {
  loadSleepTimerCloseApp,
  saveSleepTimerCloseApp,
} from "$lib/services/storage";

function createSleepTimer() {
  let endAt = $state<number | null>(null);
  let remainingSecs = $state(0);
  let minutes = $state(30);
  let closeApp = $state(loadSleepTimerCloseApp());
  let interval: ReturnType<typeof setInterval> | null = null;
  let onExpire: (() => void) | null = null;

  function updateRemaining() {
    if (endAt === null) {
      remainingSecs = 0;
      return;
    }
    remainingSecs = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (remainingSecs === 0) finish();
  }

  function clearIntervalOnly() {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  }

  function finish() {
    clearIntervalOnly();
    endAt = null;
    remainingSecs = 0;
    onExpire?.();
  }

  function start(value: number) {
    clearIntervalOnly();
    minutes = value;
    endAt = Date.now() + value * 60_000;
    remainingSecs = value * 60;
    interval = setInterval(updateRemaining, 1000);
  }

  function clear() {
    clearIntervalOnly();
    endAt = null;
    remainingSecs = 0;
  }

  function configure(callback: () => void) {
    onExpire = callback;
  }

  function formatRemaining(): string {
    const mins = Math.floor(remainingSecs / 60);
    const secs = remainingSecs % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  }

  return {
    get active() {
      return endAt !== null;
    },
    get remainingSecs() {
      return remainingSecs;
    },
    get minutes() {
      return minutes;
    },
    get label() {
      return formatRemaining();
    },
    get closeApp() {
      return closeApp;
    },
    setCloseApp(value: boolean) {
      closeApp = value;
      saveSleepTimerCloseApp(value);
    },
    start,
    clear,
    configure,
  };
}

export const sleepTimer = createSleepTimer();
