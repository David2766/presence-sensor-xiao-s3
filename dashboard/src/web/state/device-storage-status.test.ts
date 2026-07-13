import { describe, expect, it } from "vitest";
import type { DeviceStorageQueueSnapshot } from "../api/device-storage-queue";
import {
  deviceStorageSaveState,
  deviceStorageSaveStateLabel,
  isDeviceStorageSaveBusy,
  isDeviceStorageSaveDisabled
} from "./device-storage-status";
import type { SaveState } from "../types";

const labels: Record<SaveState, string> = {
  idle: "Idle",
  pending: "Pending",
  saving: "Saving",
  queued: "Queued",
  saved: "Saved",
  error: "Error"
};

function snapshot(active: DeviceStorageQueueSnapshot["active"], queued = 0): DeviceStorageQueueSnapshot {
  return {
    active,
    queued,
    isBusy: active !== null || queued > 0
  };
}

describe("deviceStorageSaveState", () => {
  it("keeps local pending, saved, and error states ahead of queue state", () => {
    const busy = snapshot("floorplan", 1);

    expect(deviceStorageSaveState("pending", busy, "config")).toBe("pending");
    expect(deviceStorageSaveState("saved", busy, "config")).toBe("saved");
    expect(deviceStorageSaveState("error", busy, "config")).toBe("error");
  });

  it("keeps an explicit queued local state queued", () => {
    expect(deviceStorageSaveState("queued", snapshot(null), "config")).toBe("queued");
    expect(deviceStorageSaveState("queued", snapshot("config"), "config")).toBe("queued");
    expect(deviceStorageSaveState("queued", snapshot("floorplan"), "config")).toBe("queued");
  });

  it("shows a local save as queued while another storage task is active", () => {
    expect(deviceStorageSaveState("saving", snapshot("floorplan"), "config")).toBe("queued");
    expect(deviceStorageSaveState("saving", snapshot("stats"), "config")).toBe("queued");
    expect(deviceStorageSaveState("saving", snapshot("config"), "config")).toBe("saving");
  });

  it("reports global storage activity when the local state is idle", () => {
    expect(deviceStorageSaveState("idle", snapshot("floorplan"), "config")).toBe("queued");
    expect(deviceStorageSaveState("idle", snapshot("config"), "config")).toBe("saving");
    expect(deviceStorageSaveState("idle", snapshot(null, 1), "config")).toBe("queued");
    expect(deviceStorageSaveState("idle", snapshot(null), "config")).toBe("idle");
  });

  it("keeps busy and disabled helpers aligned with save states", () => {
    expect(isDeviceStorageSaveBusy("saving")).toBe(true);
    expect(isDeviceStorageSaveBusy("queued")).toBe(true);
    expect(isDeviceStorageSaveBusy("pending")).toBe(false);
    expect(isDeviceStorageSaveBusy("saved")).toBe(false);
    expect(isDeviceStorageSaveBusy("error")).toBe(false);
    expect(isDeviceStorageSaveBusy("idle")).toBe(false);

    expect(isDeviceStorageSaveDisabled(false, "idle")).toBe(true);
    expect(isDeviceStorageSaveDisabled(true, "saving")).toBe(true);
    expect(isDeviceStorageSaveDisabled(true, "queued")).toBe(true);
    expect(isDeviceStorageSaveDisabled(true, "pending")).toBe(false);
    expect(isDeviceStorageSaveDisabled(true, "saved")).toBe(false);
    expect(isDeviceStorageSaveDisabled(true, "error")).toBe(false);
    expect(isDeviceStorageSaveDisabled(true, "idle")).toBe(false);
  });

  it("keeps labels stable for every save state", () => {
    const states: SaveState[] = ["idle", "pending", "saving", "queued", "saved", "error"];

    for (const state of states) {
      expect(deviceStorageSaveStateLabel(state, labels)).toBe(labels[state]);
    }
  });
});
