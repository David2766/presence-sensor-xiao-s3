export interface FloorplanViewState {
  scale: number;
  x: number;
  y: number;
}

export interface FloorplanImageSize {
  width?: number;
  height?: number;
}

export function floorplanTransformStyle(view: FloorplanViewState): string {
  return `transform: translate(${view.x}px, ${view.y}px) scale(${view.scale}); transform-origin: 0 0;`;
}

export function floorplanImageLayerStyle(size: FloorplanImageSize | null | undefined): string {
  const width = size?.width ?? 1;
  const height = size?.height ?? 1;
  const maxWidthVh = height > 0 ? Math.round((width / height) * 82 * 10000) / 10000 : 82;
  return `width: min(100%, ${maxWidthVh}vh); aspect-ratio: ${width} / ${height};`;
}

export function clampFloorplanPan(
  x: number,
  y: number,
  scale: number,
  width: number,
  height: number
): { x: number; y: number } {
  if (scale <= 1) return { x: 0, y: 0 };
  const minX = width * (1 - scale);
  const minY = height * (1 - scale);
  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y))
  };
}
