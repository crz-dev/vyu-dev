import { save } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { showToast } from "$lib/components/toast.svelte";
import { locale } from "$lib/features/i18n/locale.svelte";
import { invokeWriteFileAtomic } from "$lib/features/media/api";
import { queue } from "$lib/features/media/queue.svelte";
import { slideshow } from "$lib/features/media/slideshow.svelte";
import { getFileExt } from "$lib/services/files";
import { stringToBase64 } from "$lib/shared/base64";
import { PLAYLIST_EXTS } from "$lib/shared/constants";
import {
  parsePlaylist,
  playlistFormatForPath,
  serializePlaylist,
} from "$lib/features/playlists/playlistFile";

function playlistFromPath(path: string): string {
  return PLAYLIST_EXTS.includes(getFileExt(path)) ? path : `${path}.m3u`;
}

/** Replace Up Next with the playlist's tracks and start playing the first. */
export async function openPlaylistFile(path: string): Promise<boolean> {
  let tracks: string[];
  try {
    const bytes = await readFile(path);
    tracks = parsePlaylist(new TextDecoder("utf-8").decode(bytes), path);
  } catch (e) {
    console.error("Failed to read playlist:", e);
    showToast({
      message: locale.t("menus.queue.playlistOpenFailed"),
      color: "red",
    });
    return false;
  }

  if (tracks.length === 0) {
    showToast({
      message: locale.t("menus.queue.playlistEmpty"),
      color: "grey",
    });
    return false;
  }

  slideshow.stop();
  queue.clear();
  queue.enqueue(tracks);
  const played = await queue.startPlayback();
  if (!played) {
    showToast({
      message: locale.t("menus.queue.playlistOpenFailed"),
      color: "red",
    });
  }
  return played;
}

export async function saveQueueAsPlaylist(): Promise<boolean> {
  const paths = [...queue.items];
  if (paths.length === 0) return false;

  const selected = await save({
    defaultPath: "vyu-playlist.m3u",
    filters: [
      { name: "M3U playlist", extensions: ["m3u"] },
      { name: "M3U8 playlist", extensions: ["m3u8"] },
      { name: "PLS playlist", extensions: ["pls"] },
    ],
  });
  if (!selected) return false;

  const outputPath = playlistFromPath(selected);
  try {
    const text = serializePlaylist(paths, playlistFormatForPath(outputPath));
    await invokeWriteFileAtomic(outputPath, stringToBase64(text));
    showToast({ message: locale.t("shell.files.saved"), color: "green" });
    return true;
  } catch (e) {
    console.error("Failed to save playlist:", e);
    showToast({ message: locale.t("shell.files.saveFailed"), color: "red" });
    return false;
  }
}
