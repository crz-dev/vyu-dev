<script lang="ts">
  import CropOverlay from "$lib/features/editing/CropOverlay.svelte";
  import DrawOverlay from "$lib/features/markup/DrawOverlay.svelte";

  let {
    fileSrc,
    fileName,
    imageEl = $bindable(null),
    onImageLoad,
    onImageError,
    imageStyle,
    cropContainerEl = $bindable(null),
    slideshowActive,
    slideshowTransition,
    currentIndex,
  }: {
    fileSrc: string;
    fileName: string;
    imageEl: HTMLImageElement | null;
    onImageLoad: (e: Event) => void;
    onImageError: (e: Event) => void;
    imageStyle: string;
    cropContainerEl: HTMLElement | null;
    slideshowActive: boolean;
    slideshowTransition: string;
    currentIndex: number;
  } = $props();
</script>

<div
  class="media-container"
  bind:this={cropContainerEl}
  style="position: relative; display: flex; align-items: center; justify-content: center; max-width: 100%; max-height: 100%; overflow: hidden;"
>
  {#key slideshowActive && slideshowTransition !== "none" ? currentIndex : fileSrc}
    <div
      class={slideshowActive && slideshowTransition !== "none"
        ? `transition-${slideshowTransition}`
        : ""}
    >
      <img
        bind:this={imageEl}
        src={fileSrc}
        alt={fileName}
        decoding="async"
        onload={onImageLoad}
        onerror={onImageError}
        style={imageStyle}
      />
    </div>
  {/key}
  <CropOverlay containerEl={cropContainerEl} mediaEl={imageEl} />
  <DrawOverlay containerEl={cropContainerEl} mediaEl={imageEl} />
</div>
