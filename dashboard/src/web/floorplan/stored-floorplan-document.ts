import type {
  FloorplanStorageDocument,
  FloorplanStorageObject,
  FloorplanStorageRoom,
  FloorplanStorageScale
} from "../../core/floorplan/floorplan-storage";
import { pointInPolygon } from "../../core/geometry";
import type { FloorplanWallSegment, RoomCandidate } from "../../core/floorplan/floorplan-types";
import { rectFromPoints } from "./floorplan-room-edit-geometry";
import { currentStoredFloorplanRooms as buildRoomsFromCandidates } from "./floorplan-storage-room";

interface StoredFloorplanRoomsInput {
  candidates: RoomCandidate[];
  scale: FloorplanStorageScale | null | undefined;
  previousRooms: FloorplanStorageRoom[];
  touchTolerancePx: number;
}

interface StoredFloorplanDocumentInput extends StoredFloorplanRoomsInput {
  document: FloorplanStorageDocument | null | undefined;
  objects: unknown[];
  wallSegments?: FloorplanWallSegment[];
}

export function buildStoredFloorplanRooms({
  candidates,
  scale,
  previousRooms,
  touchTolerancePx
}: StoredFloorplanRoomsInput): FloorplanStorageRoom[] {
  if (!scale) return [];
  return buildRoomsFromCandidates(candidates, scale, previousRooms, touchTolerancePx);
}

export function storedRoomToCandidate(room: FloorplanStorageRoom): RoomCandidate {
  const points = room.pointsPx.map(([x, y]) => [x, y] as [number, number]);
  return {
    id: room.id,
    name: room.name,
    kind: room.kind ?? "unknown",
    confidence: 100,
    status: "confirmed",
    shape: "polygon",
    rect: rectFromPoints(points),
    points,
    debug: {
      reason: "stored",
      finalPoints: points.length,
      closedLoop: true
    }
  };
}

export function buildCurrentStoredFloorplanDocument({
  document,
  candidates,
  scale,
  previousRooms,
  touchTolerancePx,
  objects,
  wallSegments
}: StoredFloorplanDocumentInput): FloorplanStorageDocument | null {
  if (!document || !scale) return null;
  const rooms = buildStoredFloorplanRooms({
    candidates,
    scale,
    previousRooms,
    touchTolerancePx
  });
  return {
    ...document,
    rooms,
    occlusion: {
      ignoredEdges: document.occlusion?.ignoredEdges ?? []
    },
    wallSegments: wallSegments ?? document.wallSegments ?? [],
    objects: sanitizeStoredFloorplanObjects(objects, rooms)
  };
}

export function sanitizeStoredFloorplanDocument(document: FloorplanStorageDocument): FloorplanStorageDocument {
  return {
    ...document,
    rooms: Array.isArray(document.rooms) ? document.rooms : [],
    occlusion: {
      ignoredEdges: Array.isArray(document.occlusion?.ignoredEdges) ? document.occlusion.ignoredEdges : []
    },
    objects: sanitizeStoredFloorplanObjects(document.objects ?? [], Array.isArray(document.rooms) ? document.rooms : [])
  };
}

export function sanitizeStoredFloorplanObjects(
  objects: unknown[],
  rooms: FloorplanStorageRoom[] = []
): FloorplanStorageObject[] {
  return objects
    .filter(isFloorplanStorageObject)
    .map((object) => normalizeStoredFloorplanObject(object, rooms));
}

function normalizeStoredFloorplanObject(
  object: FloorplanStorageObject,
  rooms: FloorplanStorageRoom[]
): FloorplanStorageObject {
  const containingRoom = roomContainingObjectCenter(object, rooms);
  if (containingRoom) {
    return {
      ...object,
      roomId: containingRoom.id
    };
  }
  const currentRoomExists = rooms.some((room) => room.id === object.roomId);
  if (!currentRoomExists && object.roomId) {
    const { roomId: _roomId, ...withoutRoomId } = object;
    return withoutRoomId;
  }
  return object;
}

function roomContainingObjectCenter(
  object: FloorplanStorageObject,
  rooms: FloorplanStorageRoom[]
): FloorplanStorageRoom | null {
  const point = {
    x: object.xPx + object.widthPx / 2,
    y: object.yPx + object.heightPx / 2
  };
  return rooms.find((room) => pointInPolygon(point, room.pointsPx)) ?? null;
}

function isFloorplanStorageObject(value: unknown): value is FloorplanStorageObject {
  if (!value || typeof value !== "object") return false;
  const object = value as Partial<FloorplanStorageObject>;
  return typeof object.id === "string" &&
    object.id.length > 0 &&
    typeof object.asset === "string" &&
    object.asset.length > 0 &&
    isFiniteNumber(object.xPx) &&
    isFiniteNumber(object.yPx) &&
    isFiniteNumber(object.widthPx) &&
    isFiniteNumber(object.heightPx) &&
    object.widthPx > 0 &&
    object.heightPx > 0 &&
    (object.rotationDeg === undefined || isFiniteNumber(object.rotationDeg)) &&
    (object.roomId === undefined || typeof object.roomId === "string");
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
