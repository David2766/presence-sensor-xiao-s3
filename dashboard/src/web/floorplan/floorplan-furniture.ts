import type { FloorplanFurnitureAsset } from "./furniture-assets";

export interface FloorplanRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorplanPoint {
  x: number;
  y: number;
}

export interface FloorplanFurnitureObject {
  id: string;
  asset: string;
  roomId?: string;
  xPx: number;
  yPx: number;
  widthPx: number;
  heightPx: number;
  rotationDeg?: number;
}

export interface FloorplanFurnitureRoom {
  id: string;
  pointsPx: Array<[number, number]>;
}

const MIN_OBJECT_SIZE_PX = 18;
const ASSET_ASPECT_RATIOS: Record<string, number> = {
  bed: 130 / 150,
  desk: 110 / 80,
  dining_table: 130 / 110,
  sofa: 170 / 80,
  tv_console: 150 / 60
};

export function createDefaultFurnitureObject(
  asset: FloorplanFurnitureAsset,
  bounds: FloorplanRect,
  id: string,
  roomId?: string
): FloorplanFurnitureObject {
  const aspectRatio = furnitureAssetAspectRatio(asset);
  const maxWidth = Math.max(MIN_OBJECT_SIZE_PX, bounds.width * 0.9);
  const maxHeight = Math.max(MIN_OBJECT_SIZE_PX, bounds.height * 0.9);
  let widthPx = Math.min(maxWidth, Math.max(MIN_OBJECT_SIZE_PX, 36, bounds.width * asset.widthRatio));
  let heightPx = widthPx / aspectRatio;
  if (heightPx > maxHeight) {
    heightPx = maxHeight;
    widthPx = Math.min(maxWidth, heightPx * aspectRatio);
  }
  if (heightPx < MIN_OBJECT_SIZE_PX && maxHeight >= MIN_OBJECT_SIZE_PX) {
    heightPx = MIN_OBJECT_SIZE_PX;
    widthPx = Math.min(maxWidth, heightPx * aspectRatio);
  }
  const centerX = bounds.x + bounds.width / 2;
  const centerY = bounds.y + bounds.height / 2;
  return {
    id,
    asset: asset.id,
    roomId,
    xPx: roundPoint(centerX - widthPx / 2),
    yPx: roundPoint(centerY - heightPx / 2),
    widthPx: roundPoint(widthPx),
    heightPx: roundPoint(heightPx),
    rotationDeg: 0
  };
}

export function constrainFurnitureObjectToRooms<T extends FloorplanFurnitureObject>(
  proposed: T,
  previous: T | null | undefined,
  rooms: FloorplanFurnitureRoom[],
  fallbackBounds: FloorplanRect | null | undefined
): T {
  if (!rooms.length) {
    return fallbackBounds ? clampFurnitureObjectToBounds(proposed, fallbackBounds) : proposed;
  }

  const currentRoom = rooms.find((room) => room.id === proposed.roomId) ?? null;
  if (currentRoom) {
    return isFurnitureObjectInsideRoom(proposed, currentRoom)
      ? { ...proposed, roomId: currentRoom.id }
      : previous ?? proposed;
  }

  const containingRoom = rooms.find((room) => isFurnitureObjectInsideRoom(proposed, room)) ?? null;
  if (containingRoom) {
    return { ...proposed, roomId: containingRoom.id };
  }

  return previous ?? proposed;
}

export function clampFurnitureObjectToBounds<T extends FloorplanFurnitureObject>(
  object: T,
  bounds: FloorplanRect
): T {
  const widthPx = Math.min(Math.max(MIN_OBJECT_SIZE_PX, object.widthPx), bounds.width);
  const heightPx = Math.min(Math.max(MIN_OBJECT_SIZE_PX, object.heightPx), bounds.height);
  const sized = {
    ...object,
    widthPx: roundPoint(widthPx),
    heightPx: roundPoint(heightPx)
  };
  const rotatedBounds = furnitureAxisAlignedBounds(sized);
  const dx = clampBoundsOffset(rotatedBounds.x, rotatedBounds.width, bounds.x, bounds.width);
  const dy = clampBoundsOffset(rotatedBounds.y, rotatedBounds.height, bounds.y, bounds.height);
  return translateFurnitureObject(sized, dx, dy);
}

export function furnitureRoomScore(
  object: FloorplanFurnitureObject,
  room: FloorplanFurnitureRoom
): number {
  return furnitureProbePoints(object).filter((point) => pointInPolygon(point, room.pointsPx)).length;
}

export function isFurnitureObjectInsideRoom(
  object: FloorplanFurnitureObject,
  room: FloorplanFurnitureRoom
): boolean {
  const corners = furnitureRotatedCorners(object);
  if (!corners.every((point) => pointInPolygon([point.x, point.y], room.pointsPx))) return false;
  return !furnitureEdges(corners).some((edge) =>
    roomEdges(room).some((wall) => segmentsProperlyCross(edge.start, edge.end, wall.start, wall.end))
  );
}

export function furnitureCenter(object: FloorplanFurnitureObject): FloorplanPoint {
  return {
    x: object.xPx + object.widthPx / 2,
    y: object.yPx + object.heightPx / 2
  };
}

export function furnitureRotatedCorners(object: FloorplanFurnitureObject): FloorplanPoint[] {
  const center = furnitureCenter(object);
  const corners = [
    { x: object.xPx, y: object.yPx },
    { x: object.xPx + object.widthPx, y: object.yPx },
    { x: object.xPx + object.widthPx, y: object.yPx + object.heightPx },
    { x: object.xPx, y: object.yPx + object.heightPx }
  ];
  return corners.map((point) => rotatePointAround(point, center, object.rotationDeg ?? 0));
}

export function furnitureAxisAlignedBounds(object: FloorplanFurnitureObject): FloorplanRect {
  return boundsFromPoints(furnitureRotatedCorners(object));
}

export function worldPointToFurnitureLocal(
  object: FloorplanFurnitureObject,
  point: FloorplanPoint
): FloorplanPoint {
  const center = furnitureCenter(object);
  return rotatePointAround({ x: point.x - center.x, y: point.y - center.y }, { x: 0, y: 0 }, -(object.rotationDeg ?? 0));
}

export function furnitureLocalPointToWorld(
  object: FloorplanFurnitureObject,
  point: FloorplanPoint
): FloorplanPoint {
  const center = furnitureCenter(object);
  const rotated = rotatePointAround(point, { x: 0, y: 0 }, object.rotationDeg ?? 0);
  return {
    x: center.x + rotated.x,
    y: center.y + rotated.y
  };
}

export function resizeFurnitureObjectFromCorner<T extends FloorplanFurnitureObject>(
  object: T,
  corner: string,
  worldPoint: FloorplanPoint,
  minSizePx = MIN_OBJECT_SIZE_PX
): T {
  const signX = corner.includes("e") ? 1 : -1;
  const signY = corner.includes("s") ? 1 : -1;
  const anchor = {
    x: -signX * object.widthPx / 2,
    y: -signY * object.heightPx / 2
  };
  const rawHandle = worldPointToFurnitureLocal(object, worldPoint);
  const handle = {
    x: signX > 0
      ? Math.max(anchor.x + minSizePx, rawHandle.x)
      : Math.min(anchor.x - minSizePx, rawHandle.x),
    y: signY > 0
      ? Math.max(anchor.y + minSizePx, rawHandle.y)
      : Math.min(anchor.y - minSizePx, rawHandle.y)
  };
  const widthPx = Math.abs(handle.x - anchor.x);
  const heightPx = Math.abs(handle.y - anchor.y);
  const localCenter = {
    x: (anchor.x + handle.x) / 2,
    y: (anchor.y + handle.y) / 2
  };
  const center = furnitureLocalPointToWorld(object, localCenter);
  return {
    ...object,
    xPx: roundPoint(center.x - widthPx / 2),
    yPx: roundPoint(center.y - heightPx / 2),
    widthPx: roundPoint(widthPx),
    heightPx: roundPoint(heightPx)
  };
}

export function boundsFromRoom(room: FloorplanFurnitureRoom): FloorplanRect {
  return boundsFromPoints(room.pointsPx.map(([x, y]) => ({ x, y })));
}

export function boundsFromPoints(points: FloorplanPoint[]): FloorplanRect {
  const xs = points.map(({ x }) => x);
  const ys = points.map(({ y }) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY
  };
}

function furnitureProbePoints(object: FloorplanFurnitureObject): Array<[number, number]> {
  const center = furnitureCenter(object);
  return [
    [center.x, center.y],
    ...furnitureRotatedCorners(object).map((point): [number, number] => [point.x, point.y])
  ];
}

function furnitureEdges(points: FloorplanPoint[]): Array<{ start: FloorplanPoint; end: FloorplanPoint }> {
  return points.map((point, index) => ({
    start: point,
    end: points[(index + 1) % points.length]
  }));
}

function roomEdges(room: FloorplanFurnitureRoom): Array<{ start: FloorplanPoint; end: FloorplanPoint }> {
  return room.pointsPx.map(([x, y], index) => {
    const [nextX, nextY] = room.pointsPx[(index + 1) % room.pointsPx.length];
    return {
      start: { x, y },
      end: { x: nextX, y: nextY }
    };
  });
}

function pointInPolygon([x, y]: [number, number], polygon: Array<[number, number]>): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (pointOnSegment(x, y, xi, yi, xj, yj)) return true;
    const intersects = ((yi > y) !== (yj > y)) &&
      x <= ((xj - xi) * (y - yi)) / ((yj - yi) || Number.EPSILON) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnSegment(
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): boolean {
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > 0.001) return false;
  const dot = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
  if (dot < -0.001) return false;
  const lengthSq = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  return dot <= lengthSq + 0.001;
}

function segmentsProperlyCross(
  a1: FloorplanPoint,
  a2: FloorplanPoint,
  b1: FloorplanPoint,
  b2: FloorplanPoint
): boolean {
  if (!segmentsIntersect(a1, a2, b1, b2)) return false;
  if (pointOnSegment(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y)) return false;
  if (pointOnSegment(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) return false;
  if (pointOnSegment(b1.x, b1.y, a1.x, a1.y, a2.x, a2.y)) return false;
  if (pointOnSegment(b2.x, b2.y, a1.x, a1.y, a2.x, a2.y)) return false;
  return true;
}

function segmentsIntersect(
  a1: FloorplanPoint,
  a2: FloorplanPoint,
  b1: FloorplanPoint,
  b2: FloorplanPoint
): boolean {
  const o1 = orientation(a1, a2, b1);
  const o2 = orientation(a1, a2, b2);
  const o3 = orientation(b1, b2, a1);
  const o4 = orientation(b1, b2, a2);
  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && pointOnSegment(b1.x, b1.y, a1.x, a1.y, a2.x, a2.y)) return true;
  if (o2 === 0 && pointOnSegment(b2.x, b2.y, a1.x, a1.y, a2.x, a2.y)) return true;
  if (o3 === 0 && pointOnSegment(a1.x, a1.y, b1.x, b1.y, b2.x, b2.y)) return true;
  if (o4 === 0 && pointOnSegment(a2.x, a2.y, b1.x, b1.y, b2.x, b2.y)) return true;
  return false;
}

function orientation(a: FloorplanPoint, b: FloorplanPoint, c: FloorplanPoint): -1 | 0 | 1 {
  const value = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  if (Math.abs(value) <= 0.001) return 0;
  return value > 0 ? 1 : -1;
}

function roundPoint(value: number): number {
  return Math.round(value);
}

function furnitureAssetAspectRatio(asset: FloorplanFurnitureAsset): number {
  const knownRatio = ASSET_ASPECT_RATIOS[asset.id];
  if (Number.isFinite(knownRatio) && knownRatio > 0) return knownRatio;
  const fallbackRatio = asset.widthRatio / asset.heightRatio;
  return Number.isFinite(fallbackRatio) && fallbackRatio > 0 ? fallbackRatio : 1;
}

function rotatePointAround(point: FloorplanPoint, center: FloorplanPoint, angleDeg: number): FloorplanPoint {
  const radians = angleDeg * Math.PI / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos
  };
}

function clampBoundsOffset(value: number, size: number, limitValue: number, limitSize: number): number {
  if (size > limitSize) return limitValue + limitSize / 2 - (value + size / 2);
  if (value < limitValue) return limitValue - value;
  const maxValue = limitValue + limitSize;
  if (value + size > maxValue) return maxValue - (value + size);
  return 0;
}

function translateFurnitureObject<T extends FloorplanFurnitureObject>(object: T, dx: number, dy: number): T {
  if (dx === 0 && dy === 0) return object;
  return {
    ...object,
    xPx: roundPoint(object.xPx + dx),
    yPx: roundPoint(object.yPx + dy)
  };
}
