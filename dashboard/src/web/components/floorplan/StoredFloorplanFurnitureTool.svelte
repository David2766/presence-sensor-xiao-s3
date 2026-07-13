<script>
  import { findFloorplanFurnitureAsset } from "../../floorplan/furniture-assets";

  let {
    text,
    assets = [],
    objects = [],
    selectedObjectId = "",
    hasSelectedObject = false,
    targetRoomName = "",
    onAdd,
    onSelect,
    onDeleteSelected
  } = $props();
</script>

<div class="floorplan-furniture-card">
  <strong>{text.storedFurnitureTitle}</strong>
  <span>{text.storedFurnitureDescription}</span>
  {#if targetRoomName}
    <div class="floorplan-furniture-target">
      <span>{text.demoRoom}</span>
      <strong>{targetRoomName}</strong>
    </div>
  {/if}
  <div class="floorplan-furniture-palette">
    {#each assets as asset}
      <button type="button" onclick={() => onAdd?.(asset.id)}>
        <img src={asset.url} alt="" />
        <span>{asset.label}</span>
      </button>
    {/each}
  </div>
  <div class="floorplan-furniture-list">
    {#if !objects.length}
      <em>{text.storedNoFurniture}</em>
    {:else}
      {#each objects as object (object.id)}
        {@const asset = findFloorplanFurnitureAsset(object.asset)}
        <button
          type="button"
          class="floorplan-furniture-list-item"
          data-active={selectedObjectId === object.id ? "true" : "false"}
          onclick={() => onSelect?.(object.id)}
        >
          <span>{asset?.label ?? object.asset}</span>
          <small>{Math.round(object.widthPx)} x {Math.round(object.heightPx)}px</small>
        </button>
      {/each}
    {/if}
  </div>
  {#if hasSelectedObject}
    <button type="button" class="danger-button" onclick={onDeleteSelected}>
      {text.storedDeleteSelectedFurniture}
    </button>
  {/if}
</div>
