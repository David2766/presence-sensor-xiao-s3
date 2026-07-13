export function floorplanImageFrameStyle(width: number, height: number, maxVh = 72): string {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 1;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 1;
  const maxWidthVh = Math.round((safeWidth / safeHeight) * maxVh * 10000) / 10000;
  return `width: min(100%, ${maxWidthVh}vh); aspect-ratio: ${safeWidth} / ${safeHeight};`;
}
