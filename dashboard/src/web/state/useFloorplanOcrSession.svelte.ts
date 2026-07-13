import type { RoomCandidate } from "../../core/floorplan/floorplan-types";
import {
  createFloorplanOcrJob,
  FloorplanOcrCancelledError,
  type FloorplanOcrProgress,
  type FloorplanOcrResult,
  type FloorplanOcrWord,
  type FloorplanOcrMessages
} from "../floorplan/floorplan-ocr";
import { applyOcrRoomLabels } from "../floorplan/ocr-room-matcher";

interface FloorplanOcrSessionText {
  ocrPreparing: string;
  ocrStarted: string;
  ocrUseOriginal: string;
  ocrUseWebp: string;
  ocrJob: FloorplanOcrMessages;
  ocrMatches: (count: number) => string;
  ocrNoMatches: string;
  ocrDone: string;
  ocrDoneSummary: (
    textCandidateBoxes: number,
    ocrRegions: number,
    rawBlockCount: number,
    lines: number,
    words: number
  ) => string;
  ocrCancelled: string;
  ocrCancelledByUser: string;
  ocrError: string;
  ocrCanceling: string;
  ocrCancelRequested: string;
  ocrNotRun: string;
  error: (message: string) => string;
}

interface FloorplanOcrSessionOptions {
  getSourceBlob: () => Blob | null;
  hasOriginalSource: () => boolean;
  getRoomCandidates: () => RoomCandidate[];
  getSelectedCandidateId: () => string;
  replaceRoomCandidates: (candidates: RoomCandidate[], selectedCandidateId: string) => void;
  getText: () => FloorplanOcrSessionText;
  formatError: (error: unknown) => string;
}

export function createFloorplanOcrSession({
  getSourceBlob,
  hasOriginalSource,
  getRoomCandidates,
  getSelectedCandidateId,
  replaceRoomCandidates,
  getText,
  formatError
}: FloorplanOcrSessionOptions) {
  let busy = $state(false);
  let open = $state(false);
  let progress = $state(0);
  let statusText = $state("");
  let logs = $state<string[]>([]);
  let result = $state<FloorplanOcrResult | null>(null);
  let errorText = $state("");
  let showOverlay = $state(false);
  let job: ReturnType<typeof createFloorplanOcrJob> | null = null;

  async function run(): Promise<void> {
    const source = getSourceBlob();
    if (!source || busy) return;
    const text = getText();
    busy = true;
    open = true;
    progress = 0.02;
    statusText = text.ocrPreparing;
    logs = [text.ocrStarted];
    result = null;
    errorText = "";

    appendLog(hasOriginalSource() ? text.ocrUseOriginal : text.ocrUseWebp);
    const nextJob = createFloorplanOcrJob(
      source,
      (nextProgress) => {
        progress = nextProgress.progress;
        statusText = nextProgress.message;
        if (shouldKeepProgressLog(nextProgress)) {
          appendLog(nextProgress.message);
        }
      },
      {
        roomCandidates: getRoomCandidates(),
        messages: text.ocrJob
      }
    );
    job = nextJob;

    try {
      const nextResult = await nextJob.promise;
      result = nextResult;
      const roomLabelResult = applyOcrRoomLabels(getRoomCandidates(), nextResult);
      if (roomLabelResult.matches.length) {
        replaceRoomCandidates(roomLabelResult.candidates, getSelectedCandidateId());
        appendLog(text.ocrMatches(roomLabelResult.matches.length));
      } else {
        appendLog(text.ocrNoMatches);
      }
      progress = 1;
      statusText = text.ocrDone;
      appendLog(
        text.ocrDoneSummary(
          nextResult.textCandidateBoxes,
          nextResult.ocrRegions,
          nextResult.rawBlockCount,
          nextResult.lines.length,
          nextResult.words.length
        )
      );
    } catch (error) {
      if (error instanceof FloorplanOcrCancelledError) {
        progress = 0;
        statusText = text.ocrCancelled;
        appendLog(text.ocrCancelledByUser);
      } else {
        errorText = formatError(error);
        statusText = text.ocrError;
        appendLog(text.error(errorText));
      }
    } finally {
      busy = false;
      job = null;
    }
  }

  async function cancel(): Promise<void> {
    if (!job) {
      open = false;
      return;
    }
    const text = getText();
    statusText = text.ocrCanceling;
    appendLog(text.ocrCancelRequested);
    await job.cancel();
  }

  function close(): void {
    if (busy) return;
    open = false;
  }

  function reset(): void {
    busy = false;
    open = false;
    progress = 0;
    statusText = getText().ocrNotRun;
    logs = [];
    result = null;
    errorText = "";
    showOverlay = false;
    job = null;
  }

  function destroy(): void {
    void job?.cancel?.();
    job = null;
  }

  function ensureDefaultStatus(): void {
    if (!statusText) statusText = getText().ocrNotRun;
  }

  function resultSummary(): string {
    return "";
  }

  function previewWords(): FloorplanOcrWord[] {
    return result?.words?.slice(0, 16) ?? [];
  }

  function overlayItems(): FloorplanOcrWord[] {
    if (!result) return [];
    return result.lines.length ? result.lines : result.words;
  }

  function kindCounts(): Record<"room-label" | "dimension" | "noise", number> {
    const items = overlayItems();
    return items.reduce(
      (counts, item) => {
        const kind = item.kind ?? "noise";
        counts[kind] = (counts[kind] ?? 0) + 1;
        return counts;
      },
      { "room-label": 0, dimension: 0, noise: 0 }
    );
  }

  function setShowOverlay(checked: boolean): void {
    showOverlay = checked;
  }

  function appendLog(message: string): void {
    if (!message) return;
    const last = logs[logs.length - 1];
    if (last === message) return;
    logs = [...logs, message].slice(-80);
  }

  return {
    get busy() {
      return busy;
    },
    get open() {
      return open;
    },
    get progress() {
      return progress;
    },
    get statusText() {
      return statusText;
    },
    get logs() {
      return logs;
    },
    get result() {
      return result;
    },
    get errorText() {
      return errorText;
    },
    get showOverlay() {
      return showOverlay;
    },
    run,
    cancel,
    close,
    reset,
    destroy,
    ensureDefaultStatus,
    resultSummary,
    overlayItems,
    previewWords,
    kindCounts,
    setShowOverlay
  };
}

function shouldKeepProgressLog(progress: FloorplanOcrProgress): boolean {
  return progress.status !== "recognize" && progress.status !== "recognizing text";
}
