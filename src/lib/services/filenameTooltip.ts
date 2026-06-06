import {
  showFloatingTooltip,
  hideFloatingTooltip,
} from "$lib/services/session";

const FILENAME_TOOLTIP_ID = "filename-tooltip";
const FILENAME_TOOLTIP_TEXT = "File name";

export function showFilenameTooltip(e: MouseEvent) {
  const el = e.currentTarget as HTMLElement;
  showFloatingTooltip(
    FILENAME_TOOLTIP_ID,
    el.getBoundingClientRect(),
    FILENAME_TOOLTIP_TEXT,
  );
}

export function hideFilenameTooltip() {
  hideFloatingTooltip(FILENAME_TOOLTIP_ID);
}
