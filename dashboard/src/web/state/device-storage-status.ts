import type { DeviceStorageQueueSnapshot, DeviceStorageTaskKind } from "../api/device-storage-queue";
import type { SaveState } from "../types";

export type DeviceStorageSaveStateLabels = Record<SaveState, string>;

export function deviceStorageSaveState(
  localState: SaveState,
  snapshot: DeviceStorageQueueSnapshot,
  ownKind: DeviceStorageTaskKind
): SaveState {
  if (localState === "error") return "error";
  if (localState === "pending") return "pending";
  if (localState === "saved") return "saved";
  if (localState === "queued") return "queued";
  if (localState === "saving") {
    return snapshot.active !== null && snapshot.active !== ownKind ? "queued" : "saving";
  }
  if (snapshot.active === ownKind) return "saving";
  if (snapshot.active !== null || snapshot.queued > 0) return "queued";
  return "idle";
}

export function deviceStorageSaveStateLabel(state: SaveState, labels: DeviceStorageSaveStateLabels): string {
  return labels[state];
}

export function isDeviceStorageSaveBusy(state: SaveState): boolean {
  return state === "saving" || state === "queued";
}

export function isDeviceStorageSaveDisabled(available: boolean, state: SaveState): boolean {
  return !available || isDeviceStorageSaveBusy(state);
}
