import { describe, expect, it, vi } from "vitest";
import type { RoomCandidate, RoomCandidateStatus } from "../../core/floorplan/floorplan-types";
import { createRoomCandidateEditSession } from "./useRoomCandidateEditSession.svelte";

function candidateFixture(overrides: Partial<RoomCandidate> = {}): RoomCandidate {
  return {
    id: "room_1",
    name: "Room 1",
    kind: "unknown",
    confidence: 100,
    status: "candidate",
    shape: "polygon",
    rect: { x: 0, y: 0, width: 100, height: 100 },
    points: [[0, 0], [100, 0], [100, 100], [0, 100]],
    ...overrides
  };
}

function createCandidateState(initialCandidates = [candidateFixture()]) {
  let candidates = initialCandidates;
  let selectedCandidateId = initialCandidates[0]?.id ?? "";
  return {
    get candidates() {
      return candidates;
    },
    get selectedCandidateId() {
      return selectedCandidateId;
    },
    replace(nextCandidates: RoomCandidate[], nextSelectedCandidateId = selectedCandidateId) {
      candidates = nextCandidates;
      selectedCandidateId = nextSelectedCandidateId;
    },
    update(id: string, candidate: RoomCandidate) {
      candidates = candidates.map((item) => item.id === id ? candidate : item);
    },
    remove(id: string) {
      candidates = candidates.filter((item) => item.id !== id);
    },
    setStatus(id: string, status: RoomCandidateStatus) {
      candidates = candidates.map((item) => item.id === id ? { ...item, status } : item);
    },
    select(id: string) {
      selectedCandidateId = id;
    },
    rename(id: string, name: string) {
      candidates = candidates.map((item) => item.id === id ? { ...item, name } : item);
    },
    add(candidate: RoomCandidate) {
      candidates = [...candidates, candidate];
    }
  };
}

function createSession() {
  const state = createCandidateState();
  let manualRoomDraft = { active: false, points: [] as Array<[number, number]> };
  let manualRoomDraftHover: { x: number; y: number } | null = null;
  const markStoredRoomsChanged = vi.fn();
  const markStoredRoomNameChanged = vi.fn();
  const resetSnapEdit = vi.fn();
  const session = createRoomCandidateEditSession({
    roomCandidates: state,
    maxHistory: 40,
    getImageSize: () => ({ width: 200, height: 200 }),
    getManualRoomDraft: () => manualRoomDraft,
    setManualRoomDraft: (draft) => {
      manualRoomDraft = draft;
    },
    getManualRoomDraftHover: () => manualRoomDraftHover,
    setManualRoomDraftHover: (hover) => {
      manualRoomDraftHover = hover;
    },
    snapPoint: (point) => point,
    markStoredRoomsChanged,
    markStoredRoomNameChanged,
    canDeleteSelectedVertex: () => true,
    resetSnapEdit
  });
  return {
    state,
    session,
    markStoredRoomsChanged,
    markStoredRoomNameChanged,
    resetSnapEdit
  };
}

describe("room candidate edit session", () => {
  it("tracks local history for candidate mutations", () => {
    const { state, session } = createSession();

    session.setStatus("room_1", "confirmed");

    expect(state.candidates[0].status).toBe("confirmed");
    expect(session.canUndo).toBe(true);

    session.undo();

    expect(state.candidates[0].status).toBe("candidate");
    expect(session.canRedo).toBe(true);

    session.redo();

    expect(state.candidates[0].status).toBe("confirmed");
  });

  it("updates vertex edits and remembers the selected vertex", () => {
    const { state, session } = createSession();

    session.addVertex("room_1", 0, { x: 50, y: 0 });

    expect(state.candidates[0].points).toEqual([[0, 0], [50, 0], [100, 0], [100, 100], [0, 100]]);
    expect(session.selectedVertexIndex).toBe(1);

    session.moveVertex("room_1", 1, { x: 60, y: 0 });

    expect(state.candidates[0].points?.[1]).toEqual([60, 0]);
    expect(session.selectedVertexIndex).toBe(1);

    session.deleteVertex("room_1", 1);

    expect(state.candidates[0].points).toEqual([[0, 0], [100, 0], [100, 100], [0, 100]]);
  });

  it("reports room name changes through the stored-room callback", () => {
    const { state, session, markStoredRoomNameChanged } = createSession();

    session.rename("room_1", "Living");

    expect(state.candidates[0].name).toBe("Living");
    expect(markStoredRoomNameChanged).toHaveBeenCalledWith("room_1", "Living");
  });
});
