import type { FloorplanStorageRoom, FloorplanStorageScale } from "../../core/floorplan/floorplan-storage";
import type { RoomCandidate } from "../../core/floorplan/floorplan-types";
import { roomCandidatePoints } from "./room-candidate-points";

export function currentStoredFloorplanRooms(
  candidates: RoomCandidate[],
  scale: FloorplanStorageScale | null | undefined,
  previousRooms: FloorplanStorageRoom[],
  touchTolerancePx: number
): FloorplanStorageRoom[] {
  if (!scale) return [];
  const previousRoomById = new Map(previousRooms.map((room) => [room.id, room]));
  return candidates.map((candidate) => storedRoomFromCandidate(
    candidate,
    scale,
    previousRoomById.get(candidate.id) ?? null,
    touchTolerancePx
  ));
}

export function storedRoomFromCandidate(
  candidate: RoomCandidate,
  scale: FloorplanStorageScale,
  previousRoom: FloorplanStorageRoom | null,
  touchTolerancePx: number
): FloorplanStorageRoom {
  const points = roomCandidatePoints(candidate).map(([x, y]) => [roundPoint(x), roundPoint(y)] as [number, number]);
  const bounds = rectFromPoints(points);
  const outerBounds = {
    x: scale.outerBoundsPx[0],
    y: scale.outerBoundsPx[1],
    width: scale.outerBoundsPx[2],
    height: scale.outerBoundsPx[3]
  };
  const touchesLeft = Math.abs(bounds.x - outerBounds.x) <= touchTolerancePx;
  const touchesRight = Math.abs(bounds.x + bounds.width - (outerBounds.x + outerBounds.width)) <= touchTolerancePx;
  const touchesTop = Math.abs(bounds.y - outerBounds.y) <= touchTolerancePx;
  const touchesBottom = Math.abs(bounds.y + bounds.height - (outerBounds.y + outerBounds.height)) <= touchTolerancePx;
  const estimatedWidthMm = touchesLeft && touchesRight ? scale.widthMm : bounds.width * scale.mmPerPxX;
  const estimatedHeightMm = touchesTop && touchesBottom ? scale.heightMm : bounds.height * scale.mmPerPxY;
  const manualSize = Boolean(previousRoom?.manualSize);
  return {
    id: candidate.id,
    name: candidate.name,
    kind: candidate.kind ?? "unknown",
    pointsPx: points,
    widthMm: Math.round(manualSize && previousRoom?.widthMm ? previousRoom.widthMm : estimatedWidthMm),
    heightMm: Math.round(manualSize && previousRoom?.heightMm ? previousRoom.heightMm : estimatedHeightMm),
    manualSize
  };
}

function rectFromPoints(points: Array<[number, number]>): { x: number; y: number; width: number; height: number } {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

function roundPoint(value: number): number {
  return Math.round(value);
}
