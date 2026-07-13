<script lang="ts">
  import type { FloorplanStorageDocument } from "../../core/floorplan/floorplan-storage";
  import FloorplanPanel from "../components/FloorplanPanel.svelte";
  import type { Messages } from "../i18n/types";
  import type { WebDeviceConfig, WebDeviceState } from "../types";

  type Props = {
    messages: Messages;
    deviceConfig: WebDeviceConfig;
    deviceState: WebDeviceState | null;
    floorplanStorageBaseUrl: string;
    floorplanStorageFetcher?: typeof fetch;
    onUpdateDeviceConfig: (mutator: (current: WebDeviceConfig) => WebDeviceConfig) => void;
    onSelectDeviceZone: (zoneId: string) => void;
    onSaveDeviceConfig: () => void | Promise<void>;
    onSaveFloorplan: (document: FloorplanStorageDocument, image: Blob) => void | Promise<void>;
    onFloorplanDeleted: () => void | Promise<void>;
    onUnsavedChange?: (dirty: boolean) => void;
  };

  let {
    messages,
    deviceConfig,
    deviceState,
    floorplanStorageBaseUrl,
    floorplanStorageFetcher,
    onUpdateDeviceConfig,
    onSelectDeviceZone,
    onSaveDeviceConfig,
    onSaveFloorplan,
    onFloorplanDeleted,
    onUnsavedChange
  }: Props = $props();
</script>

<section class="tab-page">
    <FloorplanPanel
    {messages}
    {deviceConfig}
    {deviceState}
    {floorplanStorageBaseUrl}
    {floorplanStorageFetcher}
    {onUpdateDeviceConfig}
    {onSelectDeviceZone}
    {onSaveDeviceConfig}
    {onSaveFloorplan}
    {onFloorplanDeleted}
    {onUnsavedChange}
  />
</section>
