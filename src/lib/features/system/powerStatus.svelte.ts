// AC/battery status polling
import { invokeGetPowerStatus } from "$lib/features/system/api";

function createPowerStatus() {
  let supported = $state(false);
  let onBattery = $state(false);
  let percent = $state(0);
  let charging = $state(false);

  let started = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;

  async function refresh() {
    try {
      const status = await invokeGetPowerStatus();
      supported = status.supported;
      onBattery = status.onBattery;
      percent = status.percent;
      charging = status.charging;
    } catch {
      supported = false;
      onBattery = false;
    }
  }

  function handleFocus() {
    void refresh();
  }

  function start() {
    if (started || typeof window === "undefined") return;
    started = true;
    void refresh();
    pollTimer = setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", handleFocus);
  }

  function stop() {
    if (!started) return;
    started = false;
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
    window.removeEventListener("focus", handleFocus);
  }

  return {
    get supported() {
      return supported;
    },
    get onBattery() {
      return onBattery;
    },
    get percent() {
      return percent;
    },
    get charging() {
      return charging;
    },
    refresh,
    start,
    stop,
  };
}

export const powerStatus = createPowerStatus();
