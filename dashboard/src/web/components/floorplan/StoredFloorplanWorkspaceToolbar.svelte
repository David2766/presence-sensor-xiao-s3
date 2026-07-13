<script>
  import EditorToolbar from "../EditorToolbar.svelte";

  let {
    text,
    canUndo = false,
    canRedo = false,
    furnitureControlsVisible = false,
    furnitureSelected = false,
    radarVisible = false,
    onUndo,
    onRedo,
    onRotateCounterClockwise,
    onRotateClockwise,
    onToggleRadar
  } = $props();
</script>

<EditorToolbar ariaLabel={text.storedEditToolsAria}>
  <button type="button" title={text.undoTitle} onclick={onUndo} disabled={!canUndo}>↶</button>
  <button type="button" title={text.redoTitle} onclick={onRedo} disabled={!canRedo}>↷</button>
  {#if furnitureControlsVisible}
    <button
      type="button"
      title={text.storedRotateCounterClockwiseTitle}
      onclick={onRotateCounterClockwise}
      disabled={!furnitureSelected}
    >
      ⟲ 90°
    </button>
    <button
      type="button"
      title={text.storedRotateClockwiseTitle}
      onclick={onRotateClockwise}
      disabled={!furnitureSelected}
    >
      ⟳ 90°
    </button>
  {/if}
  <button
    type="button"
    title={text.radarMapTitle}
    data-active={radarVisible ? "true" : "false"}
    onclick={onToggleRadar}
  >
    {text.radarMap}
  </button>
</EditorToolbar>
