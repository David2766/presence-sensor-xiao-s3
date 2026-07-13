import { describe, expect, it } from "vitest";
import { addSoftwareZone } from "./zone-geometry";
import type { WebDeviceConfig } from "../core/types";

function emptyConfig(): WebDeviceConfig {
  return {
    version: 1,
    zones: [],
    calibrationZones: []
  };
}

describe("addSoftwareZone", () => {
  it("uses a detection-zone default name for normal zones", () => {
    const result = addSoftwareZone(emptyConfig(), "detection");

    expect(result.config.zones[0]?.name).toBe("구역 1");
  });

  it("uses an exit-point default name for exit zones", () => {
    const result = addSoftwareZone(emptyConfig(), "exit");

    expect(result.config.zones[0]?.name).toBe("퇴실지점 1");
  });
});
