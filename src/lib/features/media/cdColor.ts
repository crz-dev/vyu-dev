// CD color state
import { convertFileSrc } from "@tauri-apps/api/core";
import { invokeExtractCoverArt } from "$lib/features/media/tools";
import { CD_COLORS } from "$lib/shared/constants";
import {
  loadCdColor as dbLoadCdColor,
  saveCdColor as dbSaveCdColor,
} from "$lib/services/database";
import { loadCdColor, saveCdColor } from "$lib/services/storage";

export interface CdColorSetters {
  setCdColor: (v: string) => void;
  setCdColorIndex: (v: number) => void;
  setCoverArtSrc: (v: string) => void;
}

export async function loadCdColorForFile(
  filePath: string,
  setters: CdColorSetters,
) {
  const idx = await dbLoadCdColor(filePath).catch(() => loadCdColor(filePath));
  if (idx >= 0 && idx < CD_COLORS.length) {
    setters.setCdColorIndex(idx);
    setters.setCdColor(CD_COLORS[idx]);
  } else {
    const rand = Math.floor(Math.random() * CD_COLORS.length);
    dbSaveCdColor(filePath, rand);
    setters.setCdColorIndex(rand);
    setters.setCdColor(CD_COLORS[rand]);
  }
  invokeExtractCoverArt(filePath)
    .then((coverPath) => {
      setters.setCoverArtSrc(coverPath ? convertFileSrc(coverPath) : "");
    })
    .catch(() => {
      setters.setCoverArtSrc("");
    });
}
