import type { FloorplanStorageDocument } from "../../core/floorplan/floorplan-storage";
import {
  deleteFloorplanStorage,
  loadFloorplanStorageDocument,
  loadFloorplanStorageImage,
  loadFloorplanStorageStatus
} from "../floorplan/floorplan-storage-client";

interface StoredFloorplanEditorOptions {
  getBaseUrl: () => string;
  getFetcher: () => typeof fetch | undefined;
  errorMessage: (error: unknown) => string;
  onLoaded: (document: FloorplanStorageDocument, image: Blob, imageUrl: string) => void | Promise<void>;
  onDeleted?: () => void | Promise<void>;
}

export function createStoredFloorplanEditor({
  getBaseUrl,
  getFetcher,
  errorMessage,
  onLoaded,
  onDeleted
}: StoredFloorplanEditorOptions) {
  let checkBusy = $state(false);
  let detected = $state(false);
  let checkError = $state("");
  let imageUrl = $state("");
  let deleteOpen = $state(false);
  let deleteBusy = $state(false);
  let deleteError = $state("");

  function storageOptions() {
    return {
      baseUrl: getBaseUrl(),
      fetcher: getFetcher()
    };
  }

  async function check(): Promise<void> {
    checkBusy = true;
    checkError = "";
    try {
      const status = await loadFloorplanStorageStatus(storageOptions());
      const hasStoredFloorplan = status.ok === true && status.hasConfig === true && status.hasImage === true;
      detected = hasStoredFloorplan;
      if (hasStoredFloorplan) {
        await load();
      }
    } catch (error) {
      detected = false;
      checkError = errorMessage(error);
    } finally {
      checkBusy = false;
    }
  }

  async function load(): Promise<void> {
    const [document, image] = await Promise.all([
      loadFloorplanStorageDocument(storageOptions()),
      loadFloorplanStorageImage(storageOptions())
    ]);
    replaceImageUrl(URL.createObjectURL(image));
    detected = true;
    await onLoaded(document, image, imageUrl);
  }

  function requestDelete(): void {
    deleteError = "";
    deleteOpen = true;
  }

  function cancelDelete(): void {
    if (deleteBusy) return;
    deleteOpen = false;
    deleteError = "";
  }

  async function confirmDelete(): Promise<void> {
    deleteBusy = true;
    deleteError = "";
    try {
      await deleteFloorplanStorage(storageOptions());
      clearLoadedState();
      deleteOpen = false;
      await onDeleted?.();
    } catch (error) {
      deleteError = errorMessage(error);
    } finally {
      deleteBusy = false;
    }
  }

  function clearLoadedState(): void {
    replaceImageUrl("");
    detected = false;
  }

  function replaceImageUrl(nextUrl: string): void {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl = nextUrl;
  }

  function destroy(): void {
    replaceImageUrl("");
  }

  return {
    get checkBusy() {
      return checkBusy;
    },
    get detected() {
      return detected;
    },
    get checkError() {
      return checkError;
    },
    get imageUrl() {
      return imageUrl;
    },
    get deleteOpen() {
      return deleteOpen;
    },
    get deleteBusy() {
      return deleteBusy;
    },
    get deleteError() {
      return deleteError;
    },
    check,
    load,
    requestDelete,
    cancelDelete,
    confirmDelete,
    clearLoadedState,
    destroy
  };
}
