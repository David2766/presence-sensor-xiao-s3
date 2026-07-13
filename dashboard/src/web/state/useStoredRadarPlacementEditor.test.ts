import { describe, expect, it } from "vitest";
import type { FloorplanStorageDocument } from "../../core/floorplan/floorplan-storage";
import { createStoredRadarPlacementEditor } from "./useStoredRadarPlacementEditor.svelte";

function documentFixture(): FloorplanStorageDocument {
  return {
    version: 1,
    image: {
      path: "/floorplan.webp",
      mime: "image/webp",
      width: 200,
      height: 120
    },
    scale: {
      widthMm: 2000,
      heightMm: 1200,
      outerBoundsPx: [0, 0, 200, 120],
      mmPerPxX: 10,
      mmPerPxY: 10
    },
    radar: {
      originPx: [50, 100],
      rotationDeg: 0,
      scale: 1
    },
    rooms: [],
    occlusion: {
      ignoredEdges: []
    },
    objects: []
  };
}

describe("stored radar placement editor", () => {
  it("reads placement from the stored floorplan document", () => {
    let document = documentFixture();
    const editor = createStoredRadarPlacementEditor({
      getDocument: () => document,
      setDocument: (nextDocument) => {
        document = nextDocument;
      },
      editSession: {
        beginHistoryAction: () => {},
        finishHistoryAction: () => {},
        markChanged: () => {}
      }
    });

    expect(editor.placement()).toEqual({
      originX: 50,
      originY: 100,
      rotation: 0
    });
  });

  it("updates placement with stable rounding and history hooks", () => {
    let document = documentFixture();
    const calls: string[] = [];
    const editor = createStoredRadarPlacementEditor({
      getDocument: () => document,
      setDocument: (nextDocument) => {
        document = nextDocument;
      },
      editSession: {
        beginHistoryAction: (key) => calls.push(`begin:${key}`),
        finishHistoryAction: (key) => calls.push(`finish:${key}`),
        markChanged: (_message, scopes) => calls.push(`changed:${scopes?.join(",")}`)
      }
    });

    editor.update({ originX: 10.126, originY: 20.124, rotation: 33.36 }, true);

    expect(document.radar.originPx).toEqual([10.13, 20.12]);
    expect(document.radar.rotationDeg).toBe(33.4);
    expect(calls).toEqual(["begin:radar-placement", "changed:radar,roomContext", "finish:radar-placement"]);
  });
});
