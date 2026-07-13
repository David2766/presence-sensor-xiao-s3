import {
  deviceStorageQueue,
  type DeviceStorageQueueSnapshot,
  type DeviceStorageTaskKind
} from "../api/device-storage-queue";
import type { SaveState } from "../types";
import {
  deviceStorageSaveState,
  deviceStorageSaveStateLabel,
  type DeviceStorageSaveStateLabels,
  isDeviceStorageSaveBusy,
  isDeviceStorageSaveDisabled
} from "./device-storage-status";

export function useDeviceStorageStatus(
  ownKind: DeviceStorageTaskKind,
  getLabels: () => DeviceStorageSaveStateLabels
) {
  let snapshot = $state<DeviceStorageQueueSnapshot>(deviceStorageQueue.snapshot());
  const unsubscribe = deviceStorageQueue.subscribe((nextSnapshot) => {
    snapshot = nextSnapshot;
  });

  function saveState(localState: SaveState): SaveState {
    return deviceStorageSaveState(localState, snapshot, ownKind);
  }

  return {
    get snapshot() {
      return snapshot;
    },
    get isBusy() {
      return snapshot.isBusy;
    },
    get active() {
      return snapshot.active;
    },
    get queued() {
      return snapshot.queued;
    },
    saveState,
    saveBusy(localState: SaveState) {
      return isDeviceStorageSaveBusy(saveState(localState));
    },
    saveDisabled(available: boolean, localState: SaveState) {
      return isDeviceStorageSaveDisabled(available, saveState(localState));
    },
    saveStatus(localState: SaveState, status: string) {
      const state = saveState(localState);
      return state === "queued" ? deviceStorageSaveStateLabel(state, getLabels()) : status;
    },
    saveTone(localState: SaveState, tone: string) {
      const state = saveState(localState);
      return state === "saving" || state === "queued" ? "saving" : tone;
    },
    saveStatusText(localState: SaveState) {
      return deviceStorageSaveStateLabel(saveState(localState), getLabels());
    },
    destroy() {
      unsubscribe();
    }
  };
}
