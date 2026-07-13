import {
  detectWallLineRoomCandidates,
  type WallLineRoomDetectorDebug
} from "../../core/floorplan/wall-line-room-detector";
import type { FloorplanWallSegment, RoomCandidate } from "../../core/floorplan/floorplan-types";
import { downloadBlob } from "../utils/download";

interface FloorplanWallAnalysisText {
  uploadThenAnalyze: string;
  canAnalyzeRooms: string;
  autoDetectingRooms: string;
  autoAnalysisStarted: string;
  analysisCanvasFailed: string;
  pixelDataReady: string;
  wallAnalysisRunning: string;
  roomCandidatesFound: (count: number) => string;
  noRoomCandidates: string;
  autoAnalysisComplete: (count: number) => string;
  error: (message: string) => string;
}

interface FloorplanWallAnalysisDebugText {
  wallSelectionDebug: string;
  imageLine: (width: number | string, height: number | string) => string;
  gridLine: (width: number | string, height: number | string, cellSize: number | string) => string;
  selectedWallCellsLine: (count: number) => string;
  rejectedWallCellsLine: (count: number) => string;
  selectedReasonCountsHeader: string;
  rejectedReasonCountsHeader: string;
  reasonCountLine: (reason: string, count: number) => string;
  selectedWallCellsHeader: string;
  rejectedWallCandidateCellsHeader: string;
  selectedState: string;
  rejectedState: string;
  none: string;
}

interface FloorplanWallAnalysisImageSize {
  width: number;
  height: number;
}

interface FloorplanWallAnalysisResult {
  candidates: RoomCandidate[];
  wallSegments: FloorplanWallSegment[];
  snapSegments: FloorplanWallSegment[];
}

interface FloorplanWallAnalysisSessionOptions {
  getImageBlob: () => Blob | null;
  getImageSize: () => FloorplanWallAnalysisImageSize | null;
  getImageName: () => string;
  getText: () => FloorplanWallAnalysisText;
  getDebugText: () => FloorplanWallAnalysisDebugText;
  formatError: (error: unknown) => string;
  onDetected: (result: FloorplanWallAnalysisResult) => void;
}

export function createFloorplanWallAnalysisSession({
  getImageBlob,
  getImageSize,
  getImageName,
  getText,
  getDebugText,
  formatError,
  onDetected
}: FloorplanWallAnalysisSessionOptions) {
  let busy = $state(false);
  let text = $state("");
  let debug = $state<WallLineRoomDetectorDebug | null>(null);
  let engine = $state("");
  let steps = $state<string[]>([]);

  async function detect(): Promise<void> {
    const imageBlob = getImageBlob();
    if (!imageBlob || !getImageSize()) return;
    const messages = getText();
    busy = true;
    text = messages.autoDetectingRooms;
    steps = [messages.autoAnalysisStarted];

    try {
      const bitmap = await createImageBitmap(imageBlob);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) throw new Error(messages.analysisCanvasFailed);
        context.drawImage(bitmap, 0, 0);
        steps = [...steps, messages.pixelDataReady];
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        steps = [...steps, messages.wallAnalysisRunning];
        const result = detectWallLineRoomCandidates({
          imageData,
          applyCandidateFilters: true,
          preferThickWalls: true,
          excludeTextLikeNoise: true
        });
        const candidates = result.candidates;
        onDetected({
          candidates,
          wallSegments: result.wallSegments ?? [],
          snapSegments: result.snapSegments ?? result.wallSegments ?? []
        });
        debug = result.debug;
        engine = result.debug.engine;
        text = candidates.length
          ? messages.roomCandidatesFound(candidates.length)
          : messages.noRoomCandidates;
        steps = [...steps, messages.autoAnalysisComplete(candidates.length)];
      } finally {
        bitmap.close?.();
      }
    } catch (error) {
      text = formatError(error);
      steps = [...steps, messages.error(text)];
    } finally {
      busy = false;
    }
  }

  function reset(): void {
    text = getText().uploadThenAnalyze;
    debug = null;
    engine = "";
    steps = [];
  }

  function ensureDefaultText(hasImage: boolean, canAnalyze: boolean): void {
    const messages = getText();
    if (!hasImage) text = messages.uploadThenAnalyze;
    else if (canAnalyze && !busy) text = messages.canAnalyzeRooms;
  }

  function markReady(): void {
    text = getText().canAnalyzeRooms;
  }

  function wallMaskReasonCounts(): Record<string, number> {
    const cells = debug?.wallMaskCells ?? [];
    return cells.reduce((counts, cell) => {
      const key = cell.source ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  function wallRejectedReasonCounts(): Record<string, number> {
    const cells = debug?.wallRejectedCells ?? [];
    return cells.reduce((counts, cell) => {
      const key = cell.source ?? "unknown";
      counts[key] = (counts[key] ?? 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }

  function buildDebugText(): string {
    const debugText = getDebugText();
    const imageSize = getImageSize();
    const selected = debug?.wallMaskCells ?? [];
    const rejected = debug?.wallRejectedCells ?? [];
    const lines = [
      debugText.wallSelectionDebug,
      "",
      debugText.imageLine(imageSize?.width ?? debug?.imageWidth ?? "-", imageSize?.height ?? debug?.imageHeight ?? "-"),
      debugText.gridLine(debug?.gridWidth ?? "-", debug?.gridHeight ?? "-", debug?.cellSize ?? "-"),
      debugText.selectedWallCellsLine(selected.length),
      debugText.rejectedWallCellsLine(rejected.length),
      "",
      debugText.selectedReasonCountsHeader,
      ...Object.entries(wallMaskReasonCounts()).map(([reason, count]) => debugText.reasonCountLine(reason, count)),
      "",
      debugText.rejectedReasonCountsHeader,
      ...(rejected.length ? Object.entries(wallRejectedReasonCounts()).map(([reason, count]) => debugText.reasonCountLine(reason, count)) : [debugText.none]),
      "",
      debugText.selectedWallCellsHeader,
      ...selected.map((cell) => formatWallDebugCell(cell, debugText.selectedState)),
      "",
      debugText.rejectedWallCandidateCellsHeader,
      ...(rejected.length ? rejected.map((cell) => formatWallDebugCell(cell, debugText.rejectedState)) : [debugText.none])
    ];
    return lines.join("\n");
  }

  function downloadDebug(): void {
    if (!debug) return;
    const blob = new Blob([buildDebugText()], { type: "text/plain;charset=utf-8" });
    const baseName = getImageName() ? getImageName().replace(/\.[^.]+$/, "") : "floorplan";
    downloadBlob(blob, `${baseName}-wall-debug.txt`);
  }

  return {
    get busy() {
      return busy;
    },
    get text() {
      return text;
    },
    get debug() {
      return debug;
    },
    get engine() {
      return engine;
    },
    get steps() {
      return steps;
    },
    detect,
    reset,
    ensureDefaultText,
    markReady,
    wallMaskReasonCounts,
    downloadDebug
  };
}

function formatWallDebugCell(
  cell: WallLineRoomDetectorDebug["wallMaskCells"][number],
  state: string
): string {
  return [
    state,
    `x=${Math.round(cell.x)}`,
    `y=${Math.round(cell.y)}`,
    `grid=${cell.gridX},${cell.gridY}`,
    `source=${cell.source}`,
    `dark=${cell.darkPixels}`,
    cell.reason
  ].join(" · ");
}
