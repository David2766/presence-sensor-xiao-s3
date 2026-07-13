export const DEFAULT_OCCLUSION_GROUP_LINE_TOLERANCE_PX = 3;
export const DEFAULT_OCCLUSION_GROUP_TOUCH_TOLERANCE_PX = 6;

export type FloorplanPoint = [number, number];

export interface FloorplanRectBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorplanBoundarySource {
  id: string;
  points: FloorplanPoint[];
  segmentPrefix: string;
}

export interface FloorplanOcclusionSegment {
  id: string;
  occlusionKey: string;
  locked?: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  axis: "horizontal" | "vertical" | "diagonal";
}

export function buildBoundaryOcclusionSegments(sources: FloorplanBoundarySource[]): FloorplanOcclusionSegment[] {
  return sources.flatMap((source) => {
    const points = source.points;
    if (points.length < 2) return [];
    return points.map((point, index) => {
      const next = points[(index + 1) % points.length];
      const [x1, y1] = point;
      const [x2, y2] = next;
      return {
        id: `${source.segmentPrefix}-${source.id}-${index}`,
        occlusionKey: wallSegmentGeometryKey(x1, y1, x2, y2),
        x1,
        y1,
        x2,
        y2,
        axis: segmentAxisFromPoints(x1, y1, x2, y2)
      };
    });
  });
}

export function nextIgnoredOcclusionEdges(
  ignoredEdges: string[],
  segment: FloorplanOcclusionSegment | string,
  segments: FloorplanOcclusionSegment[],
  lineTolerancePx = DEFAULT_OCCLUSION_GROUP_LINE_TOLERANCE_PX,
  touchTolerancePx = DEFAULT_OCCLUSION_GROUP_TOUCH_TOLERANCE_PX
): string[] {
  const target = resolveOcclusionSegment(segment, segments);
  const keys = occlusionSegmentGroupKeys(target, segments, lineTolerancePx, touchTolerancePx);
  const ignored = new Set(ignoredEdges);
  const shouldIgnore = keys.some((key) => !ignored.has(key));

  for (const key of occlusionSegmentLegacyKeys(target, segments, lineTolerancePx, touchTolerancePx)) {
    ignored.delete(key);
  }

  if (shouldIgnore) {
    for (const key of keys) {
      ignored.add(key);
    }
  } else {
    for (const key of keys) {
      ignored.delete(key);
    }
  }

  return [...ignored];
}

export function wallSegmentGeometryKey(x1: number, y1: number, x2: number, y2: number): string {
  const first = [Math.round(x1), Math.round(y1)];
  const second = [Math.round(x2), Math.round(y2)];
  const [start, end] =
    first[0] < second[0] || (first[0] === second[0] && first[1] <= second[1])
      ? [first, second]
      : [second, first];
  return `wall:${start[0]},${start[1]}-${end[0]},${end[1]}`;
}

function resolveOcclusionSegment(
  segment: FloorplanOcclusionSegment | string,
  segments: FloorplanOcclusionSegment[]
): FloorplanOcclusionSegment {
  if (segment && typeof segment === "object") return segment;
  return segments.find((candidate) => candidate.id === segment || candidate.occlusionKey === segment) ?? {
    id: segment,
    occlusionKey: segment,
    x1: 0,
    y1: 0,
    x2: 0,
    y2: 0,
    axis: "diagonal"
  };
}

function occlusionSegmentGroupKeys(
  target: FloorplanOcclusionSegment,
  segments: FloorplanOcclusionSegment[],
  lineTolerancePx: number,
  touchTolerancePx: number
): string[] {
  return uniqueStrings(
    occlusionSegmentGroup(target, segments, lineTolerancePx, touchTolerancePx)
      .map((segment) => segment.occlusionKey ?? segment.id)
      .filter(Boolean)
  );
}

function occlusionSegmentLegacyKeys(
  target: FloorplanOcclusionSegment,
  segments: FloorplanOcclusionSegment[],
  lineTolerancePx: number,
  touchTolerancePx: number
): string[] {
  return uniqueStrings(
    occlusionSegmentGroup(target, segments, lineTolerancePx, touchTolerancePx)
      .flatMap((segment) => [segment.id, segment.occlusionKey])
      .filter(Boolean)
  );
}

function occlusionSegmentGroup(
  target: FloorplanOcclusionSegment,
  segments: FloorplanOcclusionSegment[],
  lineTolerancePx: number,
  touchTolerancePx: number
): FloorplanOcclusionSegment[] {
  if (!target) return [];
  return segments.filter((segment) => areSameOcclusionWall(target, segment, lineTolerancePx, touchTolerancePx));
}

function areSameOcclusionWall(
  a: FloorplanOcclusionSegment,
  b: FloorplanOcclusionSegment,
  lineTolerancePx: number,
  touchTolerancePx: number
): boolean {
  if (!a || !b) return false;
  if ((a.occlusionKey ?? a.id) === (b.occlusionKey ?? b.id)) return true;
  const axis = occlusionSegmentAxis(a);
  if (axis !== occlusionSegmentAxis(b)) return false;
  if (axis === "horizontal") {
    return (
      Math.abs(segmentMidY(a) - segmentMidY(b)) <= lineTolerancePx &&
      rangesTouchOrOverlap(segmentRangeX(a), segmentRangeX(b), touchTolerancePx)
    );
  }
  if (axis === "vertical") {
    return (
      Math.abs(segmentMidX(a) - segmentMidX(b)) <= lineTolerancePx &&
      rangesTouchOrOverlap(segmentRangeY(a), segmentRangeY(b), touchTolerancePx)
    );
  }
  return false;
}

function occlusionSegmentAxis(segment: FloorplanOcclusionSegment): FloorplanOcclusionSegment["axis"] {
  if (segment.axis === "horizontal" || segment.axis === "vertical") return segment.axis;
  return segmentAxisFromPoints(segment.x1, segment.y1, segment.x2, segment.y2);
}

function segmentAxisFromPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number
): FloorplanOcclusionSegment["axis"] {
  const dx = Math.abs(Number(x2) - Number(x1));
  const dy = Math.abs(Number(y2) - Number(y1));
  if (dy <= 1) return "horizontal";
  if (dx <= 1) return "vertical";
  return "diagonal";
}

function segmentMidX(segment: FloorplanOcclusionSegment): number {
  return (Number(segment.x1) + Number(segment.x2)) / 2;
}

function segmentMidY(segment: FloorplanOcclusionSegment): number {
  return (Number(segment.y1) + Number(segment.y2)) / 2;
}

function segmentRangeX(segment: FloorplanOcclusionSegment): [number, number] {
  return [Math.min(Number(segment.x1), Number(segment.x2)), Math.max(Number(segment.x1), Number(segment.x2))];
}

function segmentRangeY(segment: FloorplanOcclusionSegment): [number, number] {
  return [Math.min(Number(segment.y1), Number(segment.y2)), Math.max(Number(segment.y1), Number(segment.y2))];
}

function rangesTouchOrOverlap(a: [number, number], b: [number, number], tolerance: number): boolean {
  return Math.max(a[0], b[0]) <= Math.min(a[1], b[1]) + tolerance;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
