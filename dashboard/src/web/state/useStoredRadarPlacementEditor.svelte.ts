import type { FloorplanStorageDocument } from "../../core/floorplan/floorplan-storage";
import type { StoredFloorplanDirtyScope } from "./useStoredFloorplanEditSession.svelte";

export interface StoredRadarPlacement {
  originX: number;
  originY: number;
  rotation: number;
}

interface StoredFloorplanEditSessionLike {
  beginHistoryAction(actionKey: string): void;
  finishHistoryAction(actionKey?: string): void;
  markChanged(message?: string, scopes?: StoredFloorplanDirtyScope[]): void;
}

interface StoredRadarPlacementEditorOptions {
  getDocument: () => FloorplanStorageDocument | null;
  setDocument: (document: FloorplanStorageDocument) => void;
  editSession: StoredFloorplanEditSessionLike;
}

export function createStoredRadarPlacementEditor({
  getDocument,
  setDocument,
  editSession
}: StoredRadarPlacementEditorOptions) {
  function placement(): StoredRadarPlacement | null {
    const document = getDocument();
    if (!document) return null;
    return {
      originX: document.radar.originPx[0],
      originY: document.radar.originPx[1],
      rotation: document.radar.rotationDeg
    };
  }

  function update(nextPlacement: StoredRadarPlacement, commit = false): void {
    const document = getDocument();
    if (!document) return;
    editSession.beginHistoryAction("radar-placement");
    setDocument({
      ...document,
      radar: {
        ...document.radar,
        originPx: [
          roundPoint(nextPlacement.originX),
          roundPoint(nextPlacement.originY)
        ],
        rotationDeg: roundRotation(nextPlacement.rotation)
      }
    });
    editSession.markChanged("", ["radar", "roomContext"]);
    if (commit) editSession.finishHistoryAction("radar-placement");
  }

  return {
    placement,
    update
  };
}

function roundPoint(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRotation(value: number): number {
  return Math.round(value * 10) / 10;
}
