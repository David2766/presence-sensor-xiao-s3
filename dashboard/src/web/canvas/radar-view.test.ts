import { describe, expect, it } from "vitest";
import { clampRadarEditPoint, clampRadarEditZonePoint } from "./radar-view";

describe("clampRadarEditPoint", () => {
  it("clamps edit points to the radar coordinate bounds", () => {
    expect(clampRadarEditPoint({ x: -2500.4, y: -120.7 }, { rangeX: 2000, rangeY: 6000 })).toEqual({
      x: -2000,
      y: 0
    });

    expect(clampRadarEditPoint({ x: 2500.4, y: 6200.7 }, { rangeX: 2000, rangeY: 6000 })).toEqual({
      x: 2000,
      y: 6000
    });
  });

  it("rounds in-range edit points the same way as radar pointer input", () => {
    expect(clampRadarEditPoint({ x: 123.6, y: 456.4 }, { rangeX: 2000, rangeY: 6000 })).toEqual({
      x: 124,
      y: 456
    });
  });

  it("keeps zone point tuple input and output shape", () => {
    expect(clampRadarEditZonePoint([-2500.4, -120.7], { rangeX: 2000, rangeY: 6000 })).toEqual([
      -2000,
      0
    ]);
  });
});
