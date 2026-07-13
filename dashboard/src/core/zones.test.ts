import { describe, expect, it } from "vitest";
import { normalizeSoftwareConfig, normalizeZoneType } from "./zones";
import type { WebDeviceConfig, WebZone } from "./types";

const zoneBase = {
  id: "zone_1",
  name: "Zone 1",
  shape: "rect",
  points: [
    [-500, 1000],
    [500, 1000],
    [500, 2000],
    [-500, 2000]
  ]
} satisfies Omit<WebZone, "type">;

function configWithZone(zone: Partial<Omit<WebZone, "type">> & { type?: unknown }): WebDeviceConfig {
  return {
    version: 1,
    zones: [{ ...zoneBase, ...zone } as WebZone],
    calibrationZones: []
  };
}

describe("normalizeZoneType", () => {
  it("keeps supported software zone types", () => {
    expect(normalizeZoneType("detection")).toBe("detection");
    expect(normalizeZoneType("filter")).toBe("filter");
    expect(normalizeZoneType("reduced")).toBe("reduced");
    expect(normalizeZoneType("disabled")).toBe("disabled");
    expect(normalizeZoneType("exit")).toBe("exit");
  });

  it("defaults missing or invalid zone types to detection", () => {
    expect(normalizeZoneType(undefined)).toBe("detection");
    expect(normalizeZoneType("")).toBe("detection");
    expect(normalizeZoneType("unknown")).toBe("detection");
    expect(normalizeZoneType({ isTrusted: true })).toBe("detection");
  });
});

describe("normalizeSoftwareConfig", () => {
  it("repairs missing software zone types so radar CSS classes remain stable", () => {
    const normalized = normalizeSoftwareConfig(configWithZone({ type: undefined }));

    expect(normalized.zones[0]?.type).toBe("detection");
  });

  it("repairs event-like software zone types created by accidental click handler forwarding", () => {
    const normalized = normalizeSoftwareConfig(configWithZone({ type: { isTrusted: true } }));

    expect(normalized.zones[0]?.type).toBe("detection");
  });

  it("preserves valid software zone types", () => {
    const normalized = normalizeSoftwareConfig(configWithZone({ type: "filter" }));

    expect(normalized.zones[0]?.type).toBe("filter");
  });
});
