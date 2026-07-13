import type { RoomCandidate } from "../../core/floorplan/floorplan-types";
import { rectPointsFromBounds } from "./floorplan-room-edit-geometry";

export type RoomCandidatePoint = [number, number];

export function roomCandidatePoints(candidate: RoomCandidate): RoomCandidatePoint[] {
  if (candidate.shape === "polygon" && candidate.points?.length) {
    return candidate.points;
  }
  return rectPointsFromBounds(candidate.rect);
}

export function roomCandidatePointString(candidate: RoomCandidate): string {
  return roomCandidatePoints(candidate).map(([x, y]) => `${x},${y}`).join(" ");
}
