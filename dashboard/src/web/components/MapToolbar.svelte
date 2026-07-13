<script lang="ts">
  import EditorToolbar from "./EditorToolbar.svelte";
  import type { Messages } from "../i18n/types";
  import type { SaveState, WebZone } from "../types";

  type Props = {
    messages: Messages;
    canUndo: boolean;
    canRedo: boolean;
    selectedZone: WebZone | null;
    hasSelectedCalibrationZone: boolean;
    selectedLabel: string;
    saveState: SaveState;
    saveStatusText: string;
    updatedText: string;
    debugMode: boolean;
    onUndo: () => void;
    onRedo: () => void;
    onConvertToRect: () => void;
    onDeleteSelected: () => void;
    onToggleDebug: () => void;
  };

  let {
    messages,
    canUndo,
    canRedo,
    selectedZone,
    hasSelectedCalibrationZone,
    selectedLabel,
    saveState,
    saveStatusText,
    updatedText,
    debugMode,
    onUndo,
    onRedo,
    onConvertToRect,
    onDeleteSelected,
    onToggleDebug
  }: Props = $props();

  const text = $derived(messages.zones);
</script>

<EditorToolbar ariaLabel={text.toolbarAria} label={selectedLabel}>
  <button type="button" disabled={!canUndo} title={text.undo} onclick={onUndo}>↶</button>
  <button type="button" disabled={!canRedo} title={text.redo} onclick={onRedo}>↷</button>
  <button
    type="button"
    disabled={!selectedZone || selectedZone.shape === "rect" || selectedZone.type === "exit"}
    title={text.convertToRect}
    onclick={onConvertToRect}
  >
    {text.rect}
  </button>
  <button type="button" disabled={!selectedZone && !hasSelectedCalibrationZone} title={text.deleteSelected} onclick={onDeleteSelected}>
    {text.delete}
  </button>
  <button type="button" data-active={debugMode ? "true" : "false"} aria-pressed={debugMode} onclick={onToggleDebug}>Debug</button>
</EditorToolbar>

<div class="map-toolbar-status" data-map-toolbar>
  <span class="save-status" data-save-state={saveState}>{saveStatusText}</span>
  <span>{text.lastUpdated}</span>
  <strong data-updated-at>{updatedText}</strong>
</div>
