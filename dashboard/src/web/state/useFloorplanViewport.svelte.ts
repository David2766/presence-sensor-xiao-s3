import {
  clampFloorplanPan,
  floorplanImageLayerStyle as buildFloorplanImageLayerStyle,
  floorplanTransformStyle as buildFloorplanTransformStyle,
  type FloorplanImageSize,
  type FloorplanViewState
} from "../floorplan/floorplan-view";

interface FloorplanViewportOptions {
  hasImage: () => boolean;
  getImageSize: () => FloorplanImageSize | null | undefined;
  getLayerElement?: () => Element | null;
}

export function createFloorplanViewport({
  hasImage,
  getImageSize,
  getLayerElement = () => document.querySelector(".floorplan-image-layer")
}: FloorplanViewportOptions) {
  let view = $state({
    scale: 1,
    x: 0,
    y: 0,
    panning: false,
    lastX: 0,
    lastY: 0
  });

  function transformStyle(): string {
    return buildFloorplanTransformStyle(view);
  }

  function imageLayerStyle(): string {
    return buildFloorplanImageLayerStyle(getImageSize());
  }

  function setZoom(nextScale: number, origin: { x: number; y: number } | null = null): void {
    const layer = getLayerElement();
    const bounds = layer?.getBoundingClientRect?.();
    const width = bounds?.width ?? 0;
    const height = bounds?.height ?? 0;
    const scale = Math.min(5, Math.max(1, nextScale));
    if (!width || !height || scale === view.scale) {
      view = { ...view, scale, x: scale <= 1 ? 0 : view.x, y: scale <= 1 ? 0 : view.y };
      return;
    }
    const pointerX = origin?.x ?? width / 2;
    const pointerY = origin?.y ?? height / 2;
    const contentX = (pointerX - view.x) / view.scale;
    const contentY = (pointerY - view.y) / view.scale;
    const nextPan = clampFloorplanPan(
      pointerX - contentX * scale,
      pointerY - contentY * scale,
      scale,
      width,
      height
    );
    view = {
      ...view,
      scale,
      x: nextPan.x,
      y: nextPan.y
    };
  }

  function zoom(direction: number): void {
    setZoom(view.scale * (direction > 0 ? 1.18 : 0.84));
  }

  function reset(): void {
    view = initialView();
  }

  function handleWheel(event: WheelEvent): void {
    if (!hasImage()) return;
    event.preventDefault();
    const bounds = (event.currentTarget as Element | null)?.getBoundingClientRect?.();
    if (!bounds?.width || !bounds?.height) return;
    const pointerX = event.clientX - bounds.left;
    const pointerY = event.clientY - bounds.top;
    setZoom(view.scale * (event.deltaY < 0 ? 1.12 : 0.89), { x: pointerX, y: pointerY });
  }

  function handlePointerDown(event: PointerEvent): void {
    if (!hasImage() || event.button !== 1) return;
    event.preventDefault();
    (event.currentTarget as Element | null)?.setPointerCapture?.(event.pointerId);
    view = {
      ...view,
      panning: true,
      lastX: event.clientX,
      lastY: event.clientY
    };
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!view.panning) return;
    const bounds = (event.currentTarget as Element | null)?.getBoundingClientRect?.();
    const nextPan = clampFloorplanPan(
      view.x + event.clientX - view.lastX,
      view.y + event.clientY - view.lastY,
      view.scale,
      bounds?.width ?? 0,
      bounds?.height ?? 0
    );
    view = {
      ...view,
      x: nextPan.x,
      y: nextPan.y,
      lastX: event.clientX,
      lastY: event.clientY
    };
  }

  function stopPan(event: PointerEvent): void {
    if (!view.panning) return;
    (event.currentTarget as Element | null)?.releasePointerCapture?.(event.pointerId);
    view = { ...view, panning: false };
  }

  function preventAuxClick(event: MouseEvent): void {
    if (event.button === 1) event.preventDefault();
  }

  return {
    get view(): FloorplanViewState & { panning: boolean; lastX: number; lastY: number } {
      return view;
    },
    transformStyle,
    imageLayerStyle,
    zoom,
    reset,
    handleWheel,
    handlePointerDown,
    handlePointerMove,
    stopPan,
    preventAuxClick
  };
}

function initialView(): FloorplanViewState & { panning: boolean; lastX: number; lastY: number } {
  return { scale: 1, x: 0, y: 0, panning: false, lastX: 0, lastY: 0 };
}
