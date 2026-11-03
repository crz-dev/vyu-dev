import {
  hideFloatingTooltip,
  showFloatingTooltip,
} from "$lib/services/session";

const FILENAME_TOOLTIP_ID = "filename-tooltip";

export function showFilenameTooltip(e: MouseEvent, text: string) {
  const el = e.currentTarget as HTMLElement;
  showFloatingTooltip(
    FILENAME_TOOLTIP_ID,
    el.getBoundingClientRect(),
    text || "File name",
  );
}

export function hideFilenameTooltip() {
  hideFloatingTooltip(FILENAME_TOOLTIP_ID);
}
