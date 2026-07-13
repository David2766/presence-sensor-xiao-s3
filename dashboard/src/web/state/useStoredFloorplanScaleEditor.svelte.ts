import type { FloorplanStorageDocument, FloorplanStorageRoom, FloorplanStorageScale } from "../../core/floorplan/floorplan-storage";
import {
  storedFloorplanScaleEstimate,
  storedFloorplanScaleInputValid,
  updateStoredFloorplanScaleFromInput,
  type FloorplanScaleEstimate,
  type FloorplanSizeInput
} from "../floorplan/floorplan-scale";

interface StoredFloorplanScaleEditorOptions {
  getDocument: () => FloorplanStorageDocument | null;
  setDocument: (document: FloorplanStorageDocument) => void;
  buildRooms: (scale: FloorplanStorageScale) => FloorplanStorageRoom[];
  markDirty: () => void;
  setSaveStatus: (message: string, tone: "idle" | "saving" | "ok" | "error") => void;
  getMessages: () => {
    sizeRequired: string;
    scaleRecalculated: string;
  };
}

export function createStoredFloorplanScaleEditor({
  getDocument,
  setDocument,
  buildRooms,
  markDirty,
  setSaveStatus,
  getMessages
}: StoredFloorplanScaleEditorOptions) {
  let size = $state<FloorplanSizeInput>({ width: "", height: "" });

  function loadFromScale(scale: FloorplanStorageScale | null | undefined): void {
    size = {
      width: String(scale?.widthMm ?? ""),
      height: String(scale?.heightMm ?? "")
    };
  }

  function reset(): void {
    size = { width: "", height: "" };
  }

  function estimate(): FloorplanScaleEstimate | null {
    return storedFloorplanScaleEstimate(getDocument()?.scale);
  }

  function valid(): boolean {
    return storedFloorplanScaleInputValid(size);
  }

  function updateTotalSize(field: keyof FloorplanSizeInput, value: string): void {
    size = {
      ...size,
      [field]: normalizeDimensionInput(value)
    };
    applyFromInput();
  }

  function applyFromInput(): void {
    const document = getDocument();
    if (!document) return;
    const scale = updateStoredFloorplanScaleFromInput(document.scale, size);
    if (!scale) {
      setSaveStatus(getMessages().sizeRequired, "error");
      return;
    }
    setDocument({
      ...document,
      scale,
      rooms: buildRooms(scale)
    });
    markDirty();
    setSaveStatus(getMessages().scaleRecalculated, "ok");
  }

  return {
    get size() {
      return size;
    },
    estimate,
    valid,
    updateTotalSize,
    applyFromInput,
    loadFromScale,
    reset
  };
}

function normalizeDimensionInput(value: string): string {
  return value.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}
