import { describe, expect, it } from "vitest";
import { buildFloorplanStorageDocument } from "./floorplan-storage";

describe("floorplan storage document builder", () => {
  it("stores detected wall candidates separately from confirmed room polygons", () => {
    const document = buildFloorplanStorageDocument({
      image: {
        width: 200,
        height: 120
      },
      scale: {
        widthMm: 2000,
        heightMm: 1200,
        outerBounds: { x: 0, y: 0, width: 200, height: 120 },
        mmPerPxX: 10,
        mmPerPxY: 10
      },
      radar: {
        originX: 50,
        originY: 100,
        rotation: 0,
        scale: 1
      },
      rooms: [{
        id: "room_1",
        name: "Room",
        kind: "room",
        confidence: 100,
        status: "confirmed",
        shape: "polygon",
        rect: { x: 0, y: 0, width: 100, height: 120 },
        points: [[0, 0], [100, 0], [100, 120], [0, 120]]
      }],
      wallSegments: [{
        id: "wall_1",
        axis: "vertical",
        x1: 12.345,
        y1: 20,
        x2: 12.345,
        y2: 90,
        length: 70
      }]
    });

    expect(document.rooms[0].pointsPx).toEqual([[0, 0], [100, 0], [100, 120], [0, 120]]);
    expect(document.wallSegments).toEqual([{
      id: "wall_1",
      axis: "vertical",
      x1: 12.35,
      y1: 20,
      x2: 12.35,
      y2: 90,
      length: 70
    }]);
  });
});
