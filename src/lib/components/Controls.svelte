<script lang="ts">
  import TimelineMarkers from "$lib/components/TimelineMarkers.svelte";
  import PlaybackControls from "$lib/features/media/PlaybackControls.svelte";

  let { fullscreen, timelineProps, playbackProps } = $props();
</script>

<TimelineMarkers {fullscreen} {...timelineProps} />
<PlaybackControls {fullscreen} {...playbackProps} />
