import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import {
  invokeClearMediaSession,
  invokeExtractCoverArt,
  invokeUpdateMediaSession,
  type MediaSessionUpdate,
} from "$lib/features/media/api";

export interface MediaSessionSnapshot {
  hasMedia: boolean;
  path: string;
  title: string;
  mediaType: "audio" | "video";
  playing: boolean;
  position: number;
  duration: number;
  playbackRate: number;
  canNext: boolean;
  canPrevious: boolean;
}

export interface MediaSessionDeps {
  getSnapshot: () => MediaSessionSnapshot;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
}

interface SmtcCommand {
  command: string;
  position?: number | null;
}

function createMediaSession(deps: MediaSessionDeps) {
  const sessionId = Date.now() * 1000 + Math.floor(Math.random() * 1000);
  let started = false;
  let active = false;
  let generation = 0;
  let lastPayloadKey = "";
  let lastPath = "";
  let thumbnailPath: string | null = null;
  let thumbnailRequest = 0;
  let cleared = true;
  let unlisteners: UnlistenFn[] = [];
  let interval: ReturnType<typeof setInterval> | null = null;
  let updateChain: Promise<void> = Promise.resolve();
  let updateErrorLogged = false;

  function nextGeneration(): number {
    generation += 1;
    return generation;
  }

  function requestPush(force = false) {
    if (!active) return;
    updateChain = updateChain.then(() => push(force)).catch(() => {});
  }

  function payloadKey(update: MediaSessionUpdate): string {
    return [
      update.title,
      update.artist,
      update.album,
      update.mediaType,
      update.playing,
      update.playbackRate,
      Math.floor(update.position),
      Math.round(update.duration),
      update.canNext,
      update.canPrevious,
      update.thumbnailPath ?? "",
    ].join("|");
  }

  async function push(force: boolean) {
    if (!active) return;
    const snapshot = deps.getSnapshot();
    if (!snapshot.hasMedia) {
      if (!cleared) {
        cleared = true;
        lastPayloadKey = "";
        lastPath = "";
        thumbnailPath = null;
        try {
          await invokeClearMediaSession(sessionId, nextGeneration());
        } catch (e) {
          if (!updateErrorLogged) {
            updateErrorLogged = true;
            console.error("Failed to clear media session:", e);
          }
        }
      }
      return;
    }

    cleared = false;
    if (snapshot.path !== lastPath) {
      lastPath = snapshot.path;
      thumbnailPath = null;
      void loadThumbnail(snapshot.path, snapshot.mediaType);
    }

    const update: MediaSessionUpdate = {
      sessionId,
      generation: nextGeneration(),
      title: snapshot.title,
      artist: "",
      album: "",
      mediaType: snapshot.mediaType,
      playing: snapshot.playing,
      position: snapshot.position,
      duration: snapshot.duration,
      playbackRate: snapshot.playbackRate,
      canNext: snapshot.canNext,
      canPrevious: snapshot.canPrevious,
      thumbnailPath,
    };

    const key = payloadKey(update);
    if (!force && key === lastPayloadKey) return;
    lastPayloadKey = key;

    try {
      await invokeUpdateMediaSession(update);
      updateErrorLogged = false;
    } catch (e) {
      if (!updateErrorLogged) {
        updateErrorLogged = true;
        console.error("Failed to update media session:", e);
      }
    }
  }

  async function loadThumbnail(path: string, mediaType: "audio" | "video") {
    const request = ++thumbnailRequest;
    if (!path || mediaType !== "audio") return;
    try {
      const cover = await invokeExtractCoverArt(path);
      if (request !== thumbnailRequest) return;
      thumbnailPath = cover;
      requestPush(true);
    } catch {
      if (request === thumbnailRequest) thumbnailPath = null;
    }
  }

  function handleCommand(command: SmtcCommand) {
    switch (command.command) {
      case "play":
        deps.play();
        break;
      case "pause":
        deps.pause();
        break;
      case "play-pause":
        deps.toggle();
        break;
      case "next":
        deps.next();
        break;
      case "previous":
        deps.previous();
        break;
      case "seek":
        if (typeof command.position === "number") {
          deps.seek(command.position);
        }
        break;
      default:
        return;
    }
    // Give the media element a beat to reflect the new state.
    setTimeout(() => requestPush(true), 120);
  }

  function start() {
    if (started) return;
    started = true;
    active = true;

    const listeners = Promise.all([
      listen<SmtcCommand>("media:smtc-command", (event) =>
        handleCommand(event.payload),
      ),
      listen<string>("media:tray-command", (event) =>
        handleCommand({ command: event.payload }),
      ),
    ]);

    listeners
      .then((fns) => {
        if (!started) {
          for (const unlisten of fns) unlisten();
          return;
        }
        unlisteners = fns;
      })
      .catch((e) => {
        console.error("Failed to register media session listeners:", e);
      });

    interval = setInterval(() => requestPush(), 1000);
    requestPush(true);
  }

  function stop() {
    if (!started) return;
    started = false;
    active = false;
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
    for (const unlisten of unlisteners) unlisten();
    unlisteners = [];
    if (!cleared) {
      cleared = true;
      void invokeClearMediaSession(sessionId, nextGeneration()).catch(() => {});
    }
  }

  return {
    start,
    stop,
    notify: () => requestPush(true),
  };
}

export type MediaSession = ReturnType<typeof createMediaSession>;

export { createMediaSession };
