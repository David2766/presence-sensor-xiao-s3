import type { FloorplanStorageDocument, FloorplanStorageObject } from "../../core/floorplan/floorplan-storage";
import { findFloorplanFurnitureAsset } from "../floorplan/furniture-assets";
import {
  constrainFurnitureObjectToRooms,
  createDefaultFurnitureObject,
  type FloorplanFurnitureObject,
  type FloorplanFurnitureRoom,
  type FloorplanRect
} from "../floorplan/floorplan-furniture";
import type { StoredFloorplanDirtyScope } from "./useStoredFloorplanEditSession.svelte";

interface StoredFloorplanEditSessionLike {
  selectedFurnitureObjectId: string;
  pushHistory(): void;
  beginHistoryAction(actionKey: string): void;
  finishHistoryAction(actionKey?: string): void;
  markChanged(message?: string, scopes?: StoredFloorplanDirtyScope[]): void;
}

interface StoredFurnitureEditorText {
  storedFurnitureAdded: string;
  storedFurnitureChanged: string;
  storedFurnitureDeleted: string;
  storedFurnitureRotated: string;
}

interface StoredFurnitureEditorOptions {
  getDocument: () => FloorplanStorageDocument | null;
  setDocument: (document: FloorplanStorageDocument) => void;
  getDefaultPlacementContext: () => { bounds: FloorplanRect; roomId?: string } | null;
  getRooms: () => FloorplanFurnitureRoom[];
  editSession: StoredFloorplanEditSessionLike;
  getText: () => StoredFurnitureEditorText;
}

export function createStoredFurnitureEditor({
  getDocument,
  setDocument,
  getDefaultPlacementContext,
  getRooms,
  editSession,
  getText
}: StoredFurnitureEditorOptions) {
  function objects(): FloorplanStorageObject[] {
    return getDocument()?.objects ?? [];
  }

  function selectedObject(): FloorplanStorageObject | null {
    return objects().find((object) => object.id === editSession.selectedFurnitureObjectId) ?? null;
  }

  function clampObject<T extends FloorplanFurnitureObject>(object: T, previous: T | null = null): T {
    return constrainFurnitureObjectToRooms(object, previous, getRooms(), getDocumentScaleBounds());
  }

  function addObject(assetId: string): void {
    const document = getDocument();
    if (!document) return;
    const object = defaultPlacement(assetId);
    if (!object) return;
    editSession.pushHistory();
    setDocument({
      ...document,
      objects: [...objects(), ensureStorageObject(object)]
    });
    editSession.selectedFurnitureObjectId = object.id;
    editSession.markChanged(getText().storedFurnitureAdded, ["objects"]);
  }

  function updateObject(id: string, patch: Partial<FloorplanFurnitureObject>, recordHistory = true): void {
    const document = getDocument();
    if (!document) return;
    if (recordHistory) editSession.beginHistoryAction(`furniture:${id}`);
    setDocument({
      ...document,
      objects: objects().map((object) => (
        object.id === id
          ? ensureStorageObject({
              ...object,
              ...clampObject({ ...object, ...patch }, object),
              rotationDeg: roundPoint(patch.rotationDeg ?? object.rotationDeg ?? 0)
            })
          : object
      ))
    });
    editSession.markChanged(getText().storedFurnitureChanged, ["objects"]);
  }

  function rotateObject(id: string, deltaDeg: number): void {
    const object = objects().find((item) => item.id === id);
    if (!object) return;
    editSession.pushHistory();
    updateObject(id, {
      rotationDeg: (object.rotationDeg ?? 0) + deltaDeg
    }, false);
    editSession.selectedFurnitureObjectId = id;
    editSession.markChanged(getText().storedFurnitureRotated, ["objects"]);
  }

  function deleteObject(id: string): void {
    const document = getDocument();
    if (!document) return;
    editSession.pushHistory();
    setDocument({
      ...document,
      objects: objects().filter((object) => object.id !== id)
    });
    if (editSession.selectedFurnitureObjectId === id) editSession.selectedFurnitureObjectId = "";
    editSession.markChanged(getText().storedFurnitureDeleted, ["objects"]);
  }

  function commitObjectEdit(id: string, finalObject?: FloorplanFurnitureObject): void {
    if (finalObject) {
      commitObjectDraft(id, finalObject);
      return;
    }
    editSession.finishHistoryAction(`furniture:${id}`);
  }

  function commitObjectDraft(id: string, finalObject: FloorplanFurnitureObject): void {
    const document = getDocument();
    if (!document) return;
    const current = objects().find((object) => object.id === id);
    if (!current) return;
    const nextObject = ensureStorageObject(clampObject({ ...current, ...finalObject }, current));
    if (sameFurnitureObject(current, nextObject)) return;
    editSession.pushHistory();
    setDocument({
      ...document,
      objects: objects().map((object) => object.id === id ? nextObject : object)
    });
    editSession.selectedFurnitureObjectId = id;
    editSession.markChanged(getText().storedFurnitureChanged, ["objects"]);
  }

  function defaultPlacement(assetId: string): FloorplanFurnitureObject | null {
    const asset = findFloorplanFurnitureAsset(assetId);
    const context = getDefaultPlacementContext();
    if (!asset || !context) return null;
    return clampObject(createDefaultFurnitureObject(
      asset,
      context.bounds,
      `object_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
      context.roomId
    ));
  }

  function getDocumentScaleBounds(): FloorplanRect | null {
    const scale = getDocument()?.scale;
    if (!scale) return null;
    const [x, y, width, height] = scale.outerBoundsPx;
    return { x, y, width, height };
  }

  return {
    objects,
    selectedObject,
    clampObject,
    addObject,
    updateObject,
    rotateObject,
    deleteObject,
    commitObjectEdit
  };
}

function ensureStorageObject(object: FloorplanFurnitureObject): FloorplanStorageObject {
  return {
    id: object.id,
    asset: object.asset,
    roomId: object.roomId,
    xPx: roundPoint(object.xPx),
    yPx: roundPoint(object.yPx),
    widthPx: roundPoint(object.widthPx),
    heightPx: roundPoint(object.heightPx),
    rotationDeg: roundPoint(object.rotationDeg ?? 0)
  };
}

function roundPoint(value: number): number {
  return Math.round(value);
}

function sameFurnitureObject(left: FloorplanStorageObject, right: FloorplanStorageObject): boolean {
  return left.id === right.id &&
    left.asset === right.asset &&
    left.roomId === right.roomId &&
    left.xPx === right.xPx &&
    left.yPx === right.yPx &&
    left.widthPx === right.widthPx &&
    left.heightPx === right.heightPx &&
    (left.rotationDeg ?? 0) === (right.rotationDeg ?? 0);
}
