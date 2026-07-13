<script lang="ts">
  import CalibrationPanel from "../components/CalibrationPanel.svelte";
  import DebugPanel from "../components/DebugPanel.svelte";
  import MapToolbar from "../components/MapToolbar.svelte";
  import RadarScene from "../components/RadarScene.svelte";
  import ZonePanel from "../components/ZonePanel.svelte";
  import type { Messages } from "../i18n/types";
  import { isDeviceStorageSaveDisabled } from "../state/device-storage-status";
  import type { SaveState, WebDeviceConfig, WebDeviceState, WebZone, WebZoneType } from "../types";

  type ZoneTool = "" | "zones" | "calibration";
  type CalibrationActionType = Extract<WebZoneType, "filter" | "reduced" | "disabled">;

  type Props = {
    messages: Messages;
    activeZoneTool: ZoneTool;
    activeTargetCount: number;
    calibrationRun: boolean;
    calibrationStatusText: string;
    calibrationTypeLabels: Record<CalibrationActionType, string>;
    calibrationZones: WebZone[];
    canRedo: boolean;
    canUndo: boolean;
    config: WebDeviceConfig | null;
    debugMode: boolean;
    displayConfig: WebDeviceConfig | null;
    hasState: boolean;
    pirMotion: boolean;
    saveState: SaveState;
    saveStatusText: string;
    selectedCalibrationZone: WebZone | null;
    selectedLabel: string;
    selectedPointIndex: number;
    selectedZone: WebZone | null;
    selectedZoneId: string;
    state: WebDeviceState | null;
    updatedText: string;
    zoneTypeLabels: Record<WebZoneType, string>;
    zones: WebZone[];
    onAddZone: () => void;
    onAddExitZone: () => void;
    onCalibrationInfoClick: (zoneId: string) => void;
    onConvertToRect: () => void;
    onDeleteCalibrationZone: (zoneId: string) => void;
    onDeleteSelected: () => void;
    onRedo: () => void;
    onSaveConfig: () => void;
    onSelectZone: (zoneId: string) => void;
    onSetActiveZoneTool: (tool: ZoneTool) => void;
    onSetCalibrationZoneType: (zoneId: string, type: CalibrationActionType) => void;
    onSetDebugMode: (enabled: boolean) => void;
    onSetZoneName: (name: string) => void;
    onSetZoneType: (type: WebZoneType) => void;
    onStartCalibration: () => void;
    onStopCalibration: () => void;
    onUndo: () => void;
    onZoneEdgeClick: (event: MouseEvent) => void;
    onZonePointDoubleClick: (event: MouseEvent) => void;
    onZonePointerDown: (event: PointerEvent) => void;
    onCanvasClick: (event: MouseEvent) => void;
  };

  let {
    messages,
    activeZoneTool,
    activeTargetCount,
    calibrationRun,
    calibrationStatusText,
    calibrationTypeLabels,
    calibrationZones,
    canRedo,
    canUndo,
    config,
    debugMode,
    displayConfig,
    hasState,
    pirMotion,
    saveState,
    saveStatusText,
    selectedCalibrationZone,
    selectedLabel,
    selectedPointIndex,
    selectedZone,
    selectedZoneId,
    state,
    updatedText,
    zoneTypeLabels,
    zones,
    onAddZone,
    onAddExitZone,
    onCalibrationInfoClick,
    onConvertToRect,
    onDeleteCalibrationZone,
    onDeleteSelected,
    onRedo,
    onSaveConfig,
    onSelectZone,
    onSetActiveZoneTool,
    onSetCalibrationZoneType,
    onSetDebugMode,
    onSetZoneName,
    onSetZoneType,
    onStartCalibration,
    onStopCalibration,
    onUndo,
    onZoneEdgeClick,
    onZonePointDoubleClick,
    onZonePointerDown,
    onCanvasClick
  }: Props = $props();

  const text = $derived(messages.zones);
  const saveDisabled = $derived(isDeviceStorageSaveDisabled(Boolean(config), saveState));
</script>

<section class={`workspace zone-workspace ${activeZoneTool ? "edit-step" : ""}`}>
  <aside class="side-panel zone-workflow-panel">
    <div class="floorplan-workflow-card zone-summary-card">
      <div>
        <strong>{text.title}</strong>
        <span>{text.description}</span>
      </div>
      <dl class="zone-summary-list">
        <div>
          <dt>{text.status}</dt>
          <dd>{config ? text.loaded : text.loading}</dd>
        </div>
        <div>
          <dt>{text.zones}</dt>
          <dd>{text.count(zones.length)}</dd>
        </div>
        <div>
          <dt>{text.calibration}</dt>
          <dd>{text.count(calibrationZones.length)}</dd>
        </div>
        <div>
          <dt>{text.detection}</dt>
          <dd>{text.count(activeTargetCount)}</dd>
        </div>
      </dl>
    </div>

    <div class="floorplan-stored-tools zone-mode-tools">
      <button
        type="button"
        data-active={activeZoneTool === "zones" ? "true" : "false"}
        onclick={() => onSetActiveZoneTool(activeZoneTool === "zones" ? "" : "zones")}
      >
        {text.zoneSettings}
      </button>
      <button
        type="button"
        data-active={activeZoneTool === "calibration" ? "true" : "false"}
        onclick={() => onSetActiveZoneTool(activeZoneTool === "calibration" ? "" : "calibration")}
      >
        {text.calibrationSettings}
      </button>
      <button
        type="button"
        data-active={selectedZone?.type === "exit" ? "true" : "false"}
        disabled={!config}
        onclick={onAddExitZone}
      >
        {text.exitPoint}
      </button>
      <button
        type="button"
        disabled={saveDisabled}
        onclick={onSaveConfig}
      >
        {messages.common.save}
      </button>
    </div>
  </aside>

  {#if activeZoneTool}
    <aside class="side-panel zone-detail-panel">
      {#if activeZoneTool === "zones"}
        <ZonePanel
          {messages}
          loaded={Boolean(config)}
          {zones}
          {selectedZone}
          {selectedZoneId}
          {zoneTypeLabels}
          onSelectZone={onSelectZone}
          onAddZone={onAddZone}
          onSetZoneName={onSetZoneName}
          onSetZoneType={onSetZoneType}
          onDeleteSelected={onDeleteSelected}
        />
      {:else}
        <CalibrationPanel
          {messages}
          loaded={Boolean(config)}
          {hasState}
          {pirMotion}
          running={calibrationRun}
          zones={calibrationZones}
          {selectedZoneId}
          statusText={calibrationStatusText}
          {calibrationTypeLabels}
          onStart={onStartCalibration}
          onStop={onStopCalibration}
          onSelectZone={onSelectZone}
          onSetZoneType={onSetCalibrationZoneType}
          onDeleteZone={onDeleteCalibrationZone}
        />
      {/if}
    </aside>
  {/if}

  <section class="map-panel zone-map-panel">
    <div class="radar-host" data-radar-scene>
      <div class="radar-scene-frame">
        <MapToolbar
          {messages}
          {canUndo}
          {canRedo}
          {selectedZone}
          hasSelectedCalibrationZone={Boolean(selectedCalibrationZone)}
          {selectedLabel}
          {saveState}
          {saveStatusText}
          {updatedText}
          {debugMode}
          onUndo={onUndo}
          onRedo={onRedo}
          onConvertToRect={onConvertToRect}
          onDeleteSelected={onDeleteSelected}
          onToggleDebug={() => onSetDebugMode(!debugMode)}
        />
        <RadarScene
          {messages}
          {state}
          config={displayConfig}
          {selectedZoneId}
          editable
          {selectedPointIndex}
          {debugMode}
          onCanvasClick={onCanvasClick}
          onZonePointerDown={onZonePointerDown}
          onZoneEdgeClick={onZoneEdgeClick}
          onZonePointDoubleClick={onZonePointDoubleClick}
          onCalibrationInfoClick={onCalibrationInfoClick}
        />
        <p class="map-status-line">{text.mapStatus(activeTargetCount)}</p>
      </div>
    </div>
    {#if debugMode}
      <DebugPanel targets={state?.targets ?? []} />
    {/if}
  </section>
</section>
