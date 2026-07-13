import type {
  FloorplanStorageDocument,
  FloorplanStorageOcclusion,
  FloorplanStorageObject,
  FloorplanStorageRadar
} from "../../core/floorplan/floorplan-storage";
import type { WebDeviceConfig } from "../types";
import { buildFloorplanRoomContext } from "../floorplan/floorplan-room-context";

type UpdateDeviceConfig = (mutator: (current: WebDeviceConfig) => WebDeviceConfig) => void;

interface StoredFloorplanSaveOptions {
  document: FloorplanStorageDocument;
  saveScopes?: StoredFloorplanSaveScopes;
  roomNamePatches?: Record<string, string>;
  saveDocument: (document: FloorplanStorageDocument) => Promise<void>;
  saveRadar?: (radar: FloorplanStorageRadar) => Promise<void>;
  saveRoomName?: (roomId: string, name: string) => Promise<void>;
  saveOcclusion?: (occlusion: FloorplanStorageOcclusion) => Promise<void>;
  saveObjects?: (objects: FloorplanStorageObject[]) => Promise<void>;
  updateDeviceConfig: UpdateDeviceConfig;
  saveDeviceConfig: () => Promise<void>;
}

export interface StoredFloorplanSaveScopes {
  document?: boolean;
  config?: boolean;
  roomContext?: boolean;
  radar?: boolean;
  roomName?: boolean;
  occlusion?: boolean;
  objects?: boolean;
}

export function withStoredFloorplanRoomContext(
  current: WebDeviceConfig,
  document: FloorplanStorageDocument
): WebDeviceConfig {
  return {
    ...current,
    floorplan: {
      ...(current.floorplan ?? {}),
      enabled: true,
      hasImage: current.floorplan?.hasImage ?? true,
      room: buildFloorplanRoomContext(document)
    }
  };
}

export async function saveStoredFloorplanWithConfig({
  document,
  saveScopes,
  roomNamePatches = {},
  saveDocument,
  saveRadar,
  saveRoomName,
  saveOcclusion,
  saveObjects,
  updateDeviceConfig,
  saveDeviceConfig
}: StoredFloorplanSaveOptions): Promise<void> {
  const scopes = saveScopes ?? { document: true, config: true, roomContext: true };
  const needsPartialDocumentSave = scopes.radar || scopes.roomName || scopes.occlusion || scopes.objects;
  const canPatchDocument =
    (!scopes.radar || saveRadar) &&
    (!scopes.roomName || saveRoomName) &&
    (!scopes.occlusion || saveOcclusion) &&
    (!scopes.objects || saveObjects);

  if (scopes.document || (needsPartialDocumentSave && !canPatchDocument)) {
    await saveDocument(document);
  } else {
    if (scopes.radar) await saveRadar?.(document.radar);
    if (scopes.roomName) {
      for (const [roomId, name] of Object.entries(roomNamePatches)) {
        await saveRoomName?.(roomId, name);
      }
    }
    if (scopes.occlusion) await saveOcclusion?.(document.occlusion);
    if (scopes.objects) await saveObjects?.(document.objects ?? []);
  }
  if (scopes.roomContext) updateDeviceConfig((current) => withStoredFloorplanRoomContext(current, document));
  if (scopes.config || scopes.roomContext) await saveDeviceConfig();
}
