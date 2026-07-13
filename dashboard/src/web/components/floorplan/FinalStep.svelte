<script>
  import {
    FLOORPLAN_CONFIG_PATH,
    FLOORPLAN_IMAGE_PATH,
    floorplanStorageJson
  } from "../../../core/floorplan/floorplan-storage";
  import { formatBytes } from "../../utils/formatters";

  let {
    messages,
    storageDocument = null,
    scaleSummary = null,
    placement = { originX: 0, originY: 0, rotation: 0, scale: 1 },
    imageName = "",
    roomCount = 0,
    ignoredOcclusionEdges = [],
    canSave = false,
    saveBusy = false,
    saveStatus = "",
    saveTone = "idle",
    onBack,
    onSave
  } = $props();

  const text = $derived(messages.floorplan.finalStep);

  function jsonSizeText() {
    return storageDocument
      ? formatBytes(floorplanStorageJson(storageDocument).length, {
        invalidText: "0 B",
        nonPositiveText: "0 B",
        unitSeparator: " ",
        kbPrecision: 1,
        mbPrecision: 1
      })
      : text.unavailable;
  }
</script>

<div class="floorplan-radar-placement-card">
  <strong>{text.title}</strong>
  <span>{text.description}</span>
  <dl>
    <div><dt>{text.image}</dt><dd>{imageName || FLOORPLAN_IMAGE_PATH}</dd></div>
    <div><dt>{text.config}</dt><dd>{FLOORPLAN_CONFIG_PATH}</dd></div>
    <div><dt>{text.roomCandidates}</dt><dd>{text.roomCount(roomCount)}</dd></div>
    <div><dt>{text.totalSize}</dt><dd>{scaleSummary ? `${scaleSummary.widthMm} x ${scaleSummary.heightMm}mm` : text.inputRequired}</dd></div>
    <div><dt>{text.radarPosition}</dt><dd>{Math.round(placement.originX)}, {Math.round(placement.originY)}px</dd></div>
    <div><dt>{text.rotation}</dt><dd>{Math.round(placement.rotation)}°</dd></div>
    <div><dt>{text.occlusionExceptions}</dt><dd>{text.edgeCount(ignoredOcclusionEdges.length)}</dd></div>
    <div><dt>{text.jsonSize}</dt><dd>{jsonSizeText()}</dd></div>
  </dl>
  <ul class="floorplan-final-summary-list">
    <li>{text.checklistImage}</li>
    <li>{text.checklistRooms}</li>
    <li>{text.checklistScale}</li>
    <li>{text.checklistRadar}</li>
  </ul>
  {#if !storageDocument}
    <em>{text.cannotBuildJson}</em>
  {/if}
</div>

<div class="floorplan-step-actions">
  <button type="button" class="floorplan-step-button floorplan-fixed-text" onclick={onBack}>
    <span>{text.previousStep}</span>
    <strong>{text.radarPlacement}</strong>
  </button>
  <button
    type="button"
    class="floorplan-next-button floorplan-fixed-text"
    onclick={onSave}
    disabled={saveBusy || !canSave}
  >
    <span>{saveBusy ? text.saving : text.save}</span>
    <strong>{text.saveAction}</strong>
  </button>
</div>

{#if saveStatus}
  <div class="floorplan-save-status" data-tone={saveTone}>{saveStatus}</div>
{/if}
