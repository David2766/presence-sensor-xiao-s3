type PointTuple = [number, number];

interface RectLike {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface RoomCandidateLike {
  shape?: string;
  points?: PointTuple[];
  rect: RectLike;
}

interface SplitLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface Segment {
  start: PointTuple;
  end: PointTuple;
  midpoint: PointTuple;
}

interface AxisIntersection {
  edgeIndex: number;
  position: number;
  point: PointTuple;
}

export function mergeRoomCandidatePoints(first: RoomCandidateLike, second: RoomCandidateLike): PointTuple[] {
  const firstPoints = orientPolygonClockwise(normalizePolygonPoints(candidateSplitPoints(first)));
  const secondPoints = orientPolygonClockwise(normalizePolygonPoints(candidateSplitPoints(second)));
  if (firstPoints.length < 3 || secondPoints.length < 3) return [];
  const unionPoints = traceUnionBoundary(firstPoints, secondPoints);
  return unionPoints.length >= 3 ? unionPoints : [];
}

export function splitRoomCandidateByLine(candidate: RoomCandidateLike, line: SplitLine): [PointTuple[], PointTuple[]] | null {
  const points = normalizePolygonPoints(candidateSplitPoints(candidate));
  if (points.length < 3) return null;
  const vertical = Math.abs(line.x2 - line.x1) < Math.abs(line.y2 - line.y1);
  const splitValue = vertical
    ? Math.round((line.x1 + line.x2) / 2)
    : Math.round((line.y1 + line.y2) / 2);
  const center = {
    x: (line.x1 + line.x2) / 2,
    y: (line.y1 + line.y2) / 2
  };
  const intersections = findAxisLineIntersections(points, vertical ? "vertical" : "horizontal", splitValue)
    .sort((a, b) => Math.hypot(a.point[0] - center.x, a.point[1] - center.y) - Math.hypot(b.point[0] - center.x, b.point[1] - center.y));
  if (intersections.length < 2) return null;

  const selected = intersections.slice(0, 2).sort((a, b) => a.position - b.position);
  const [first, second] = selected;
  if (first.edgeIndex === second.edgeIndex) return null;
  if (Math.hypot(first.point[0] - second.point[0], first.point[1] - second.point[1]) < 16) return null;

  const firstPolygon = normalizePolygonPoints([first.point, ...walkPolygonPoints(points, first.edgeIndex, second.edgeIndex), second.point]);
  const secondPolygon = normalizePolygonPoints([second.point, ...walkPolygonPoints(points, second.edgeIndex, first.edgeIndex), first.point]);
  if (!validSplitPolygon(firstPolygon) || !validSplitPolygon(secondPolygon)) return null;
  return [firstPolygon, secondPolygon];
}

export function candidateSplitPoints(candidate: RoomCandidateLike): PointTuple[] {
  if (candidate.shape === "polygon" && candidate.points?.length && candidate.points.length >= 3) {
    return candidate.points.map(([x, y]) => [x, y]);
  }
  const { x, y, width, height } = candidate.rect;
  return [
    [x, y],
    [x + width, y],
    [x + width, y + height],
    [x, y + height]
  ];
}

export function normalizeRect(rect: RectLike): RectLike {
  const x = Math.min(rect.x, rect.x + rect.width);
  const y = Math.min(rect.y, rect.y + rect.height);
  return {
    x,
    y,
    width: Math.abs(rect.width),
    height: Math.abs(rect.height)
  };
}

export function rectFromPoints(points: PointTuple[]): RectLike {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function rectPointsFromBounds(rect: RectLike): PointTuple[] {
  const x1 = rect.x;
  const y1 = rect.y;
  const x2 = rect.x + rect.width;
  const y2 = rect.y + rect.height;
  return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
}

export function roundPoint(value: number): number {
  return Math.round(value * 100) / 100;
}

function findAxisLineIntersections(points: PointTuple[], axis: "vertical" | "horizontal", value: number): AxisIntersection[] {
  const intersections: AxisIntersection[] = [];
  const epsilon = 0.001;
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const startAxis = axis === "vertical" ? start[0] : start[1];
    const endAxis = axis === "vertical" ? end[0] : end[1];
    const delta = endAxis - startAxis;
    if (Math.abs(delta) <= epsilon) continue;
    const t = (value - startAxis) / delta;
    if (t < -epsilon || t > 1 + epsilon) continue;
    const clampedT = Math.min(1, Math.max(0, t));
    const point: PointTuple = [
      roundPoint(start[0] + (end[0] - start[0]) * clampedT),
      roundPoint(start[1] + (end[1] - start[1]) * clampedT)
    ];
    if (intersections.some((item) => samePoint(item.point, point))) continue;
    intersections.push({
      edgeIndex: index,
      position: index + clampedT,
      point
    });
  }
  return intersections;
}

function walkPolygonPoints(points: PointTuple[], fromEdgeIndex: number, toEdgeIndex: number): PointTuple[] {
  const result: PointTuple[] = [];
  let index = (fromEdgeIndex + 1) % points.length;
  const stop = (toEdgeIndex + 1) % points.length;
  while (index !== stop) {
    result.push(points[index]);
    index = (index + 1) % points.length;
  }
  return result;
}

function traceUnionBoundary(firstPoints: PointTuple[], secondPoints: PointTuple[]): PointTuple[] {
  const firstEdges = splitPolygonEdges(firstPoints, secondPoints);
  const secondEdges = splitPolygonEdges(secondPoints, firstPoints);
  const segments: Segment[] = [];
  for (const edge of firstEdges) {
    if (!pointInPolygon(edge.midpoint, secondPoints) && !edgeOnPolygonBoundary(edge, secondPoints)) segments.push(edge);
  }
  for (const edge of secondEdges) {
    if (!pointInPolygon(edge.midpoint, firstPoints) && !edgeOnPolygonBoundary(edge, firstPoints)) segments.push(edge);
  }
  const uniqueSegments = removeDuplicateSegments(segments);
  const loops = traceSegmentLoops(uniqueSegments);
  return loops.sort((a, b) => Math.abs(polygonArea(b)) - Math.abs(polygonArea(a)))[0] ?? [];
}

function splitPolygonEdges(points: PointTuple[], otherPoints: PointTuple[]): Segment[] {
  const edges: Segment[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const start = points[index];
    const end = points[(index + 1) % points.length];
    const vertical = Math.abs(start[0] - end[0]) < 0.001;
    const horizontal = Math.abs(start[1] - end[1]) < 0.001;
    if (!vertical && !horizontal) continue;
    const cuts = [0, 1];
    const minX = Math.min(start[0], end[0]);
    const maxX = Math.max(start[0], end[0]);
    const minY = Math.min(start[1], end[1]);
    const maxY = Math.max(start[1], end[1]);
    for (let otherIndex = 0; otherIndex < otherPoints.length; otherIndex += 1) {
      const otherStart = otherPoints[otherIndex];
      const otherEnd = otherPoints[(otherIndex + 1) % otherPoints.length];
      if (vertical) {
        if (pointBetween(otherStart[1], minY, maxY) && Math.abs(otherStart[0] - start[0]) < 0.001) cuts.push((otherStart[1] - start[1]) / (end[1] - start[1]));
        if (segmentsIntersectVerticalHorizontal(start, end, otherStart, otherEnd)) cuts.push((otherStart[1] - start[1]) / (end[1] - start[1]));
      } else if (horizontal) {
        if (pointBetween(otherStart[0], minX, maxX) && Math.abs(otherStart[1] - start[1]) < 0.001) cuts.push((otherStart[0] - start[0]) / (end[0] - start[0]));
        if (segmentsIntersectVerticalHorizontal(otherStart, otherEnd, start, end)) cuts.push((otherStart[0] - start[0]) / (end[0] - start[0]));
      }
    }
    const sortedCuts = [...new Set(cuts.map((value) => Math.round(Math.min(1, Math.max(0, value)) * 100000) / 100000))]
      .sort((a, b) => a - b);
    for (let cutIndex = 0; cutIndex < sortedCuts.length - 1; cutIndex += 1) {
      const t1 = sortedCuts[cutIndex];
      const t2 = sortedCuts[cutIndex + 1];
      if (Math.abs(t2 - t1) < 0.00001) continue;
      const a: PointTuple = [
        roundPoint(start[0] + (end[0] - start[0]) * t1),
        roundPoint(start[1] + (end[1] - start[1]) * t1)
      ];
      const b: PointTuple = [
        roundPoint(start[0] + (end[0] - start[0]) * t2),
        roundPoint(start[1] + (end[1] - start[1]) * t2)
      ];
      edges.push({ start: a, end: b, midpoint: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] });
    }
  }
  return edges;
}

function segmentsIntersectVerticalHorizontal(
  verticalStart: PointTuple,
  verticalEnd: PointTuple,
  horizontalStart: PointTuple,
  horizontalEnd: PointTuple
): boolean {
  if (Math.abs(verticalStart[0] - verticalEnd[0]) >= 0.001) return false;
  if (Math.abs(horizontalStart[1] - horizontalEnd[1]) >= 0.001) return false;
  return pointBetween(verticalStart[0], Math.min(horizontalStart[0], horizontalEnd[0]), Math.max(horizontalStart[0], horizontalEnd[0]))
    && pointBetween(horizontalStart[1], Math.min(verticalStart[1], verticalEnd[1]), Math.max(verticalStart[1], verticalEnd[1]));
}

function edgeOnPolygonBoundary(edge: Segment, points: PointTuple[]): boolean {
  return points.some((start, index) => {
    const end = points[(index + 1) % points.length];
    return pointOnSegment(edge.midpoint, start, end);
  });
}

function removeDuplicateSegments(segments: Segment[]): Segment[] {
  const map = new Map<string, Segment>();
  for (const segment of segments) {
    const key = segmentKey(segment.start, segment.end);
    const existing = map.get(key);
    if (existing) {
      map.delete(key);
    } else {
      map.set(key, segment);
    }
  }
  return [...map.values()];
}

function traceSegmentLoops(segments: Segment[]): PointTuple[][] {
  const adjacency = new Map<string, Segment[]>();
  for (const segment of segments) {
    const startKey = pointKey(segment.start);
    if (!adjacency.has(startKey)) adjacency.set(startKey, []);
    adjacency.get(startKey)?.push(segment);
  }
  const used = new Set<string>();
  const loops: PointTuple[][] = [];
  for (const segment of segments) {
    const startKey = directedSegmentKey(segment);
    if (used.has(startKey)) continue;
    const loop: PointTuple[] = [segment.start];
    let current: Segment | null = segment;
    while (current && !used.has(directedSegmentKey(current))) {
      used.add(directedSegmentKey(current));
      loop.push(current.end);
      if (samePoint(current.end, loop[0])) break;
      const candidates: Segment[] = adjacency.get(pointKey(current.end)) ?? [];
      current = candidates.find((item) => !used.has(directedSegmentKey(item))) ?? null;
    }
    const normalized = normalizePolygonPoints(loop);
    if (normalized.length >= 3) loops.push(normalized);
  }
  return loops;
}

function pointInPolygon(point: PointTuple, points: PointTuple[]): boolean {
  if (points.some((start, index) => pointOnSegment(point, start, points[(index + 1) % points.length]))) return false;
  let inside = false;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [xi, yi] = points[index];
    const [xj, yj] = points[previous];
    const intersects = yi > point[1] !== yj > point[1]
      && point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function pointOnSegment(point: PointTuple, start: PointTuple, end: PointTuple): boolean {
  const cross = (point[0] - start[0]) * (end[1] - start[1]) - (point[1] - start[1]) * (end[0] - start[0]);
  if (Math.abs(cross) > 0.001) return false;
  return pointBetween(point[0], Math.min(start[0], end[0]), Math.max(start[0], end[0]))
    && pointBetween(point[1], Math.min(start[1], end[1]), Math.max(start[1], end[1]));
}

function pointBetween(value: number, min: number, max: number): boolean {
  return value >= min - 0.001 && value <= max + 0.001;
}

function segmentKey(a: PointTuple, b: PointTuple): string {
  const first = pointKey(a);
  const second = pointKey(b);
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function directedSegmentKey(segment: Segment): string {
  return `${pointKey(segment.start)}>${pointKey(segment.end)}`;
}

function pointKey(point: PointTuple): string {
  return `${roundPoint(point[0])},${roundPoint(point[1])}`;
}

function normalizePolygonPoints(points: PointTuple[]): PointTuple[] {
  const result: PointTuple[] = [];
  for (const point of points) {
    const normalized: PointTuple = [roundPoint(point[0]), roundPoint(point[1])];
    if (!result.length || !samePoint(result[result.length - 1], normalized)) {
      result.push(normalized);
    }
  }
  if (result.length > 1 && samePoint(result[0], result[result.length - 1])) {
    result.pop();
  }
  return result;
}

function validSplitPolygon(points: PointTuple[]): boolean {
  return points.length >= 3 && Math.abs(polygonArea(points)) >= 256;
}

function polygonArea(points: PointTuple[]): number {
  let area = 0;
  for (let index = 0; index < points.length; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[(index + 1) % points.length];
    area += x1 * y2 - x2 * y1;
  }
  return area / 2;
}

function orientPolygonClockwise(points: PointTuple[]): PointTuple[] {
  return polygonArea(points) < 0 ? [...points].reverse() : points;
}

function samePoint(a: PointTuple, b: PointTuple): boolean {
  return Math.abs(a[0] - b[0]) < 0.001 && Math.abs(a[1] - b[1]) < 0.001;
}
