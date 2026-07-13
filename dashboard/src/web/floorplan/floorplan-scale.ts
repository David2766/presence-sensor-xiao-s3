import type { FloorplanStorageScale } from "../../core/floorplan/floorplan-storage";

export interface FloorplanBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorplanScaleEstimate {
  outerBounds: FloorplanBounds;
  widthMm: number;
  heightMm: number;
  mmPerPxX: number;
  mmPerPxY: number;
}

export interface FloorplanScaleSummary {
  widthMm: number;
  heightMm: number;
  widthPx: string;
  heightPx: string;
  mmPerPxX: string;
  mmPerPxY: string;
}

export interface FloorplanSizeInput {
  width: string;
  height: string;
}

export function parseDimensionInput(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function calculateFloorplanScale(
  outerBounds: FloorplanBounds | null | undefined,
  size: FloorplanSizeInput
): FloorplanScaleEstimate | null {
  const widthMm = parseDimensionInput(size.width);
  const heightMm = parseDimensionInput(size.height);
  if (!outerBounds || outerBounds.width <= 0 || outerBounds.height <= 0 || !widthMm || !heightMm) return null;
  return {
    outerBounds,
    widthMm,
    heightMm,
    mmPerPxX: widthMm / outerBounds.width,
    mmPerPxY: heightMm / outerBounds.height
  };
}

export function floorplanScaleSummary(scale: FloorplanScaleEstimate | null | undefined): FloorplanScaleSummary | null {
  if (!scale) return null;
  return {
    widthMm: Math.round(scale.widthMm),
    heightMm: Math.round(scale.heightMm),
    widthPx: scale.outerBounds.width.toFixed(2),
    heightPx: scale.outerBounds.height.toFixed(2),
    mmPerPxX: scale.mmPerPxX.toFixed(2),
    mmPerPxY: scale.mmPerPxY.toFixed(2)
  };
}

export function storedFloorplanScaleEstimate(scale: FloorplanStorageScale | null | undefined): FloorplanScaleEstimate | null {
  if (!scale) return null;
  const [x, y, width, height] = scale.outerBoundsPx;
  return {
    outerBounds: { x, y, width, height },
    widthMm: scale.widthMm,
    heightMm: scale.heightMm,
    mmPerPxX: scale.mmPerPxX,
    mmPerPxY: scale.mmPerPxY
  };
}

export function storedFloorplanScaleInputValid(size: FloorplanSizeInput): boolean {
  return Boolean(parseDimensionInput(size.width) && parseDimensionInput(size.height));
}

export function updateStoredFloorplanScaleFromInput(
  currentScale: FloorplanStorageScale,
  size: FloorplanSizeInput
): FloorplanStorageScale | null {
  const widthMm = parseDimensionInput(size.width);
  const heightMm = parseDimensionInput(size.height);
  if (!widthMm || !heightMm) return null;
  const [x, y, width, height] = currentScale.outerBoundsPx;
  if (width <= 0 || height <= 0) return null;
  return {
    widthMm: Math.round(widthMm),
    heightMm: Math.round(heightMm),
    outerBoundsPx: [x, y, width, height],
    mmPerPxX: roundPoint(widthMm / width),
    mmPerPxY: roundPoint(heightMm / height)
  };
}

function roundPoint(value: number): number {
  return Math.round(value * 100) / 100;
}
