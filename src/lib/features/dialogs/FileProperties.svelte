<script lang="ts">
  import type { MediaProperties } from "$lib/shared/types";

  let {
    propertiesOpen,
    fileName,
    filePath,
    fileExt,
    fileDimensions,
    fileSize,
    fileCreated,
    fileModified,
    durationDisplay,
    isVideo,
    isPdf = false,
    ffprobeChecked,
    ffprobeAvailable,
    ffmpegInstalling,
    ffmpegInstallError,
    mediaPropsLoading,
    mediaProps,
    installFfmpegAndWait,
    refreshFfprobeAvailability,
    loadMediaProperties,
    showValue,
    propsCopyPath,
    propsOpenFolder,
    propsCopyAll,
    copyPropValue,
    parentFolder,
    closeProperties,
  }: {
    propertiesOpen: boolean;
    fileName: string;
    filePath: string;
    fileExt: () => string;
    fileDimensions: string;
    fileSize: string;
    fileCreated: string;
    fileModified: string;
    durationDisplay: string;
    isVideo: boolean;
    isPdf?: boolean;
    ffprobeChecked: boolean;
    ffprobeAvailable: boolean;
    ffmpegInstalling: boolean;
    ffmpegInstallError: string;
    mediaPropsLoading: boolean;
    mediaProps: MediaProperties | null;
    installFfmpegAndWait: () => void;
    refreshFfprobeAvailability: () => Promise<void>;
    loadMediaProperties: () => Promise<void>;
    showValue: (v: string | undefined) => string;
    propsCopyPath: () => void;
    propsOpenFolder: () => void;
    propsCopyAll: () => void;
    copyPropValue: (value: string) => void;
    parentFolder: () => string;
    closeProperties: () => void;
  } = $props();
</script>

{#if propertiesOpen}
  <div
    class="delete-overlay"
    role="presentation"
    onmousedown={(e) => e.stopPropagation()}
  >
    <div class="delete-dialog props-dialog" role="dialog" aria-modal="true">
      <div class="props-header-bar">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 10.5V16" stroke-linecap="round" />
          <circle cx="12" cy="7.5" r="1" fill="currentColor" />
        </svg>
        <div>
          <p class="delete-title">Properties</p>
          <p class="delete-subtitle">{fileName}</p>
        </div>
      </div>
      <div class="props-list">
        <div
          class="props-row"
          onclick={() =>
            copyPropValue(
              `${isPdf ? "Document (PDF)" : isVideo ? "Video" : "Image"} (${fileExt() || "unknown"})`,
            )}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(
                `${isPdf ? "Document (PDF)" : isVideo ? "Video" : "Image"} (${fileExt() || "unknown"})`,
              );
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              /><polyline points="14 2 14 8 20 8" /></svg
            >
            Type
          </span>
          <span class="props-v"
            >{isPdf ? "Document (PDF)" : isVideo ? "Video" : "Image"} ({fileExt() || "unknown"})</span
          >
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(fileDimensions || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileDimensions || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg
            >
            Dimensions
          </span>
          <span class="props-v">{fileDimensions || "Unknown"}</span>
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(fileSize || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileSize || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline
                points="7 10 12 15 17 10"
              /><line x1="12" y1="15" x2="12" y2="3" /></svg
            >
            Size
          </span>
          <span class="props-v">{fileSize || "Unknown"}</span>
        </div>
        {#if isVideo}
          <div
            class="props-row"
            onclick={() => copyPropValue(durationDisplay)}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(durationDisplay);
              }
            }}
            role="button"
            tabindex="0"
          >
            <span class="props-k">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><polyline
                  points="12 6 12 12 16 14"
                /></svg
              >
              Duration
            </span>
            <span class="props-v">{durationDisplay}</span>
          </div>
        {/if}
        {#if ffprobeChecked && !ffprobeAvailable}
          <div class="ffprobe-note">
            <p class="ffprobe-title">Advanced metadata needs FFmpeg</p>
            <p class="ffprobe-sub">
              To show Container, Codec, Color, and Frame Rate, install FFmpeg.
              Your files stay local on your device and are not uploaded
              anywhere.
            </p>
            <div class="ffprobe-actions">
              <button
                class="props-btn"
                onclick={installFfmpegAndWait}
                disabled={ffmpegInstalling}
              >
                {ffmpegInstalling ? "Installing FFmpeg..." : "Install FFmpeg"}
              </button>
              <button
                class="props-btn props-btn-secondary"
                onclick={async () => {
                  await refreshFfprobeAvailability();
                  if (ffprobeAvailable) {
                    await loadMediaProperties();
                  }
                }}
                disabled={ffmpegInstalling}
              >
                Retry detection
              </button>
              {#if ffmpegInstalling}
                <div class="ffprobe-progress"><span></span></div>
              {/if}
            </div>
            {#if ffmpegInstallError}
              <p class="ffprobe-error">{ffmpegInstallError}</p>
            {/if}
          </div>
        {:else}
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? "Loading..."
                  : showValue(mediaProps?.container),
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? "Loading..."
                    : showValue(mediaProps?.container),
                );
              }
            }}
            role="button"
            tabindex="0"
          >
            <span class="props-k">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><path
                  d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                /></svg
              >
              Container
            </span>
            <span class="props-v"
              >{mediaPropsLoading
                ? "Loading..."
                : showValue(mediaProps?.container)}</span
            >
          </div>
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? "Loading..."
                  : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`,
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? "Loading..."
                    : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`,
                );
              }
            }}
            role="button"
            tabindex="0"
          >
            <span class="props-k">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line
                  x1="8"
                  y1="21"
                  x2="16"
                  y2="21"
                /><line x1="12" y1="17" x2="12" y2="21" /></svg
              >
              Codec
            </span>
            <span class="props-v">
              {mediaPropsLoading
                ? "Loading..."
                : `${showValue(mediaProps?.video_codec)}${mediaProps?.audio_codec ? ` / ${mediaProps.audio_codec}` : ""}`}
            </span>
          </div>
          <div
            class="props-row"
            onclick={() =>
              copyPropValue(
                mediaPropsLoading
                  ? "Loading..."
                  : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`,
              )}
            onkeydown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                copyPropValue(
                  mediaPropsLoading
                    ? "Loading..."
                    : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`,
                );
              }
            }}
            role="button"
            tabindex="0"
          >
            <span class="props-k">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                ><circle cx="12" cy="12" r="10" /><line
                  x1="14.31"
                  y1="8"
                  x2="20.05"
                  y2="17.94"
                /><line x1="9.69" y1="8" x2="21.17" y2="8" /><line
                  x1="7.38"
                  y1="12"
                  x2="13.12"
                  y2="2.06"
                /><line x1="9.69" y1="16" x2="3.95" y2="6.06" /><line
                  x1="14.31"
                  y1="16"
                  x2="2.83"
                  y2="16"
                /><line x1="16.62" y1="12" x2="10.88" y2="21.94" /></svg
              >
              Color
            </span>
            <span class="props-v">
              {mediaPropsLoading
                ? "Loading..."
                : `${showValue(mediaProps?.pixel_format)}${mediaProps?.color_space ? ` · ${mediaProps.color_space}` : ""}${mediaProps?.bit_depth ? ` · ${mediaProps.bit_depth} bit` : ""}`}
            </span>
          </div>
          {#if isVideo}
            <div
              class="props-row"
              onclick={() =>
                copyPropValue(
                  mediaPropsLoading
                    ? "Loading..."
                    : showValue(mediaProps?.frame_rate),
                )}
              onkeydown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  copyPropValue(
                    mediaPropsLoading
                      ? "Loading..."
                      : showValue(mediaProps?.frame_rate),
                  );
                }
              }}
              role="button"
              tabindex="0"
            >
              <span class="props-k">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  ><polygon
                    points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"
                  /></svg
                >
                Frame rate
              </span>
              <span class="props-v"
                >{mediaPropsLoading
                  ? "Loading..."
                  : showValue(mediaProps?.frame_rate)}</span
              >
            </div>
          {/if}
        {/if}
        <div
          class="props-row"
          onclick={() => copyPropValue(fileCreated || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileCreated || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line
                x1="16"
                y1="2"
                x2="16"
                y2="6"
              /><line x1="8" y1="2" x2="8" y2="6" /><line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
              /></svg
            >
            Created
          </span>
          <span class="props-v">{fileCreated || "Unknown"}</span>
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(fileModified || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(fileModified || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line
                x1="16"
                y1="2"
                x2="16"
                y2="6"
              /><line x1="8" y1="2" x2="8" y2="6" /><line
                x1="3"
                y1="10"
                x2="21"
                y2="10"
              /></svg
            >
            Modified
          </span>
          <span class="props-v">{fileModified || "Unknown"}</span>
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(parentFolder() || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(parentFolder() || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              ><path
                d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
              /></svg
            >
            Folder
          </span>
          <span class="props-v">{parentFolder() || "Unknown"}</span>
        </div>
        <div
          class="props-row"
          onclick={() => copyPropValue(filePath || "Unknown")}
          onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              copyPropValue(filePath || "Unknown");
            }
          }}
          role="button"
          tabindex="0"
        >
          <span class="props-k">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              ><path
                d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
              /><polyline points="14 2 14 8 20 8" /><line
                x1="16"
                y1="13"
                x2="8"
                y2="13"
              /><line x1="16" y1="17" x2="8" y2="17" /><polyline
                points="10 9 9 9 8 9"
              /></svg
            >
            Path
          </span>
          <span class="props-v">{filePath || "Unknown"}</span>
        </div>
      </div>
      <div class="props-actions">
        <button class="props-btn" onclick={propsCopyPath}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <path
              d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"
            />
            <path
              d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"
            />
          </svg>
          Copy path
        </button>
        <button class="props-btn" onclick={propsOpenFolder}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"
            />
          </svg>
          Open folder
        </button>
        <button class="props-btn" onclick={propsCopyAll}>
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          >
            <rect x="8" y="8" width="13" height="13" rx="2" />
            <path d="M4 16V5a1 1 0 011-1h11" />
          </svg>
          Copy all properties
        </button>
      </div>
      <div class="delete-actions">
        <button class="delete-cancel" onclick={closeProperties}> Close </button>
      </div>
    </div>
  </div>
{/if}
