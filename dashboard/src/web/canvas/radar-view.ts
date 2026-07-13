import { DEFAULT_CARD_CONFIG } from "../../core/defaults";
import { LD2450_FOV_DEGREES, radarViewportRangeX, toRadarPoint } from "../../core/radar-math";
import type { RadarScreenPoint, RadarViewport } from "../../core/types";

export const RADAR_SCENE_WIDTH = 760;
export const RADAR_SCENE_HEIGHT = 540;
export const RADAR_SCENE_PAD = 34;

export function radarSceneViewport(): RadarViewport {
  const rangeY = DEFAULT_CARD_CONFIG.range_y;
  const specRangeX = radarViewportRangeX(rangeY, LD2450_FOV_DEGREES);
  return {
    width: RADAR_SCENE_WIDTH,
    height: RADAR_SCENE_HEIGHT,
    pad: RADAR_SCENE_PAD,
    rangeX: Math.max(DEFAULT_CARD_CONFIG.range_x, specRangeX),
    rangeY,
    fovDegrees: LD2450_FOV_DEGREES
  };
}

export function radarPointFromEvent(event: PointerEvent | MouseEvent, svg: SVGSVGElement): RadarScreenPoint {
  const rect = svg.getBoundingClientRect();
  const screenX = ((event.clientX - rect.left) / rect.width) * RADAR_SCENE_WIDTH;
  const screenY = ((event.clientY - rect.top) / rect.height) * RADAR_SCENE_HEIGHT;
  const viewport = radarSceneViewport();
  const point = toRadarPoint(screenX, screenY, viewport);
  return clampRadarEditPoint(point, viewport);
}

export function clampRadarEditPoint(
  point: RadarScreenPoint,
  bounds: Pick<RadarViewport, "rangeX" | "rangeY">
): RadarScreenPoint {
  return {
    x: clamp(Math.round(point.x), -bounds.rangeX, bounds.rangeX),
    y: clamp(Math.round(point.y), 0, bounds.rangeY)
  };
}

export function clampRadarEditZonePoint(
  point: [number, number],
  bounds: Pick<RadarViewport, "rangeX" | "rangeY">
): [number, number] {
  const clamped = clampRadarEditPoint({ x: point[0], y: point[1] }, bounds);
  return [clamped.x, clamped.y];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
