import { describe, expect, it, vi } from "vitest";
import { createFloorplanOcrSession } from "./useFloorplanOcrSession.svelte";

const text = {
  ocrPreparing: "preparing",
  ocrStarted: "started",
  ocrUseOriginal: "original",
  ocrUseWebp: "webp",
  ocrJob: {
    cancelled: "cancelled",
    engineLoading: "engine",
    detectingText: "detecting",
    noTextRegions: "no regions",
    preparingWorker: (regions: number) => `worker ${regions}`,
    recognizingRegion: (index: number, total: number) => `region ${index}/${total}`,
    recognizingRegionRotation: (index: number, total: number, rotationIndex: number, rotations: number) =>
      `region ${index}/${total} rotation ${rotationIndex}/${rotations}`,
    mergingResults: "merging",
    done: "done",
    tesseractMissing: "missing",
    tesseractCdnFailed: "cdn failed",
    imageDataFailed: "image failed",
    cropCanvasFailed: "crop canvas failed",
    cropScaleFailed: "crop scale failed",
    cropPngFailed: "crop png failed",
    cropRotateFailed: "crop rotate failed",
    statusLoadingCore: "loading core",
    statusInitializingEngine: "initializing engine",
    statusLoadingLanguage: "loading language",
    statusInitializingApi: "initializing api",
    statusRecognizingText: "recognizing text",
    statusWorking: "working"
  },
  ocrMatches: (count: number) => `matches ${count}`,
  ocrNoMatches: "no matches",
  ocrDone: "done",
  ocrDoneSummary: () => "summary",
  ocrCancelled: "cancelled",
  ocrCancelledByUser: "cancelled by user",
  ocrError: "error",
  ocrCanceling: "canceling",
  ocrCancelRequested: "cancel requested",
  ocrNotRun: "not run",
  error: (message: string) => `error: ${message}`
};

function createSession() {
  return createFloorplanOcrSession({
    getSourceBlob: () => null,
    hasOriginalSource: () => false,
    getRoomCandidates: () => [],
    getSelectedCandidateId: () => "",
    replaceRoomCandidates: vi.fn(),
    getText: () => text,
    formatError: (error) => error instanceof Error ? error.message : String(error)
  });
}

describe("floorplan OCR session", () => {
  it("owns dialog status and overlay reset state", () => {
    const session = createSession();

    session.ensureDefaultStatus();
    session.setShowOverlay(true);

    expect(session.statusText).toBe("not run");
    expect(session.showOverlay).toBe(true);

    session.reset();

    expect(session.open).toBe(false);
    expect(session.busy).toBe(false);
    expect(session.progress).toBe(0);
    expect(session.statusText).toBe("not run");
    expect(session.logs).toEqual([]);
    expect(session.result).toBeNull();
    expect(session.errorText).toBe("");
    expect(session.showOverlay).toBe(false);
  });

  it("closes immediately when cancel is requested without an active job", async () => {
    const session = createSession();

    await session.cancel();

    expect(session.open).toBe(false);
  });
});
