import { stripPlaceholders } from "../../core/zones";
import type { DeviceStorageSaveStateLabels } from "./device-storage-status";
import type { DeviceApi, SaveState, WebDeviceConfig } from "../types";
import { useDeviceStorageStatus } from "./useDeviceStorageStatus.svelte";

interface ConfigSaveOptions {
  api: DeviceApi;
  getConfig: () => WebDeviceConfig | null;
  setStatus: (message: string, tone: "ok" | "warn" | "error") => void;
  errorMessage: (error: unknown) => string;
  getSaveStatusLabels: () => DeviceStorageSaveStateLabels;
  savedMessage: () => string;
  saveFailedMessage: (error: string) => string;
}

export function createConfigSave({
  api,
  getConfig,
  setStatus,
  errorMessage,
  getSaveStatusLabels,
  savedMessage,
  saveFailedMessage
}: ConfigSaveOptions) {
  let saveInFlightPromise: Promise<void> | null = null;
  let dirtyVersion = 0;
  let savedVersion = 0;
  let saveState = $state<SaveState>("idle");
  const storageStatus = useDeviceStorageStatus("config", getSaveStatusLabels);

  function markPending(): void {
    dirtyVersion += 1;
    if (saveInFlightPromise) {
      saveState = "queued";
      return;
    }
    saveState = "pending";
  }

  async function saveConfigNow(): Promise<void> {
    if (saveInFlightPromise) {
      await saveInFlightPromise;
      return;
    }

    const config = getConfig();
    if (!config) return;
    if (dirtyVersion === savedVersion) dirtyVersion += 1;
    const versionToSave = dirtyVersion;
    saveState = "saving";
    saveInFlightPromise = (async () => {
      try {
        await api.saveConfig(stripPlaceholders(config));
        savedVersion = Math.max(savedVersion, versionToSave);
        saveState = dirtyVersion > savedVersion ? "pending" : "saved";
        setStatus(savedMessage(), "ok");
      } catch (error) {
        saveState = "error";
        setStatus(saveFailedMessage(errorMessage(error)), "error");
      } finally {
        saveInFlightPromise = null;
      }
    })();
    await saveInFlightPromise;
  }

  function destroy(): void {
    storageStatus.destroy();
  }

  return {
    get saveState() {
      return storageStatus.saveState(saveState);
    },
    get saveStatusText() {
      return storageStatus.saveStatusText(saveState);
    },
    get hasPendingChanges() {
      return dirtyVersion > savedVersion;
    },
    markPending,
    saveConfigNow,
    destroy
  };
}
