import { afterEach, describe, expect, it, vi } from "vitest";
import { createFloorplanWallAnalysisSession } from "./useFloorplanWallAnalysisSession.svelte";
import { detectWallLineRoomCandidates } from "../../core/floorplan/wall-line-room-detector";

vi.mock("../../core/floorplan/wall-line-room-detector", () => ({
  detectWallLineRoomCandidates: vi.fn()
}));

const text = {
  uploadThenAnalyze: "upload",
  canAnalyzeRooms: "can analyze",
  autoDetectingRooms: "detecting",
  autoAnalysisStarted: "started",
  analysisCanvasFailed: "canvas failed",
  pixelDataReady: "pixels ready",
  wallAnalysisRunning: "running",
  roomCandidatesFound: (count: number) => `found ${count}`,
  noRoomCandidates: "none",
  autoAnalysisComplete: (count: number) => `complete ${count}`,
  error: (message: string) => `error: ${message}`
};

const debugText = {
  wallSelectionDebug: "debug",
  imageLine: (width: number | string, height: number | string) => `image ${width} ${height}`,
  gridLine: (width: number | string, height: number | string, cellSize: number | string) => `grid ${width} ${height} ${cellSize}`,
  selectedWallCellsLine: (count: number) => `selected ${count}`,
  rejectedWallCellsLine: (count: number) => `rejected ${count}`,
  selectedReasonCountsHeader: "selected reasons",
  rejectedReasonCountsHeader: "rejected reasons",
  reasonCountLine: (reason: string, count: number) => `${reason} ${count}`,
  selectedWallCellsHeader: "selected cells",
  rejectedWallCandidateCellsHeader: "rejected cells",
  selectedState: "selected",
  rejectedState: "rejected",
  none: "none"
};

function detectorDebug() {
  return {
    engine: "wall-line" as const,
    imageWidth: 100,
    imageHeight: 80,
    cellSize: 4,
    gridWidth: 25,
    gridHeight: 20,
    totalCells: 500,
    darkPixels: 1,
    wallCells: 1,
    expandedWallCells: 1,
    freeComponents: 1,
    acceptedBeforeSanitize: 1,
    acceptedAfterSanitize: 1,
    rejectedSmall: 0,
    rejectedTooSmallArea: 0,
    rejectedTooLargeArea: 0,
    rejectedSparse: 0,
    rejectedThin: 0,
    filtersEnabled: true,
    polygonRawPoints: 4,
    polygonSimplifiedPoints: 4,
    polygonFinalPoints: 4,
    polygonClosedLoops: 1,
    polygonOpenLoops: 0,
    thickWallMode: true,
    wallCellThreshold: 1,
    gapClosedCells: 0,
    attachedThinWallCells: 0,
    externalFreeCells: 0,
    rejectedExternal: 0,
    removedSmallWallComponents: 0,
    removedSmallWallCells: 0,
    textExclusionEnabled: true,
    textCandidateBoxes: 0,
    textExcludedPixels: 0,
    wallMaskCells: [{
      x: 1,
      y: 2,
      width: 4,
      height: 4,
      gridX: 0,
      gridY: 0,
      source: "wall",
      reason: "accepted",
      darkPixels: 9
    }],
    wallRejectedCells: [],
    wallSnap: {
      edgeChecks: 0,
      noAxisEdges: 0,
      candidateQueries: 0,
      candidateNone: 0,
      alreadyAligned: 0,
      moveAttempts: 0,
      applied: 0,
      rejectedSelfIntersection: 0,
      rejectedOverExpanded: 0,
      cornerAttempts: 0,
      cornerApplied: 0,
      cornerNoIntersection: 0,
      cornerExistingPoint: 0,
      cornerSpike: 0,
      cornerSelfIntersection: 0,
      logs: []
    }
  };
}

function installCanvasMocks() {
  vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
    width: 100,
    height: 80,
    close: vi.fn()
  })));
  vi.stubGlobal("document", {
    createElement: vi.fn((tagName: string) => {
    if (tagName !== "canvas") return {} as HTMLElement;
    return {
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({ data: new Uint8ClampedArray(4), width: 1, height: 1 }))
      })
    } as unknown as HTMLCanvasElement;
    })
  });
}

describe("floorplan wall analysis session", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs the existing wall detector and exposes the result through callbacks/state", async () => {
    installCanvasMocks();
    const onDetected = vi.fn();
    vi.mocked(detectWallLineRoomCandidates).mockReturnValue({
      candidates: [{
        id: "room_1",
        name: "Room",
        kind: "unknown",
        confidence: 100,
        status: "candidate",
        shape: "polygon",
        rect: { x: 0, y: 0, width: 10, height: 10 },
        points: [[0, 0], [10, 0], [10, 10], [0, 10]]
      }],
      debugCandidates: [],
      wallSegments: [{ id: "w1", axis: "horizontal", x1: 0, y1: 0, x2: 10, y2: 0, length: 10 }],
      snapSegments: [{ id: "s1", axis: "vertical", x1: 0, y1: 0, x2: 0, y2: 10, length: 10 }],
      debug: detectorDebug()
    });
    const session = createFloorplanWallAnalysisSession({
      getImageBlob: () => new Blob(["image"], { type: "image/webp" }),
      getImageSize: () => ({ width: 100, height: 80 }),
      getImageName: () => "floorplan.webp",
      getText: () => text,
      getDebugText: () => debugText,
      formatError: (error) => error instanceof Error ? error.message : String(error),
      onDetected
    });

    await session.detect();

    expect(detectWallLineRoomCandidates).toHaveBeenCalledWith({
      imageData: expect.any(Object),
      applyCandidateFilters: true,
      preferThickWalls: true,
      excludeTextLikeNoise: true
    });
    expect(onDetected).toHaveBeenCalledWith({
      candidates: expect.arrayContaining([expect.objectContaining({ id: "room_1" })]),
      wallSegments: [expect.objectContaining({ id: "w1" })],
      snapSegments: [expect.objectContaining({ id: "s1" })]
    });
    expect(session.busy).toBe(false);
    expect(session.text).toBe("found 1");
    expect(session.engine).toBe("wall-line");
    expect(session.steps).toEqual(["started", "pixels ready", "running", "complete 1"]);
    expect(session.wallMaskReasonCounts()).toEqual({ wall: 1 });
  });

  it("does not run without an image blob", async () => {
    const session = createFloorplanWallAnalysisSession({
      getImageBlob: () => null,
      getImageSize: () => ({ width: 100, height: 80 }),
      getImageName: () => "",
      getText: () => text,
      getDebugText: () => debugText,
      formatError: String,
      onDetected: vi.fn()
    });

    await session.detect();

    expect(detectWallLineRoomCandidates).not.toHaveBeenCalled();
  });
});
