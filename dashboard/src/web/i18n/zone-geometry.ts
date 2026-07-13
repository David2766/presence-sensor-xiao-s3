import type { ZoneGeometryMessageCode, ZoneGeometryMessageParams } from "../zone-geometry";
import type { Messages } from "./types";

function numberParam(params: ZoneGeometryMessageParams | undefined, key: string, fallback: number): number {
  const value = params?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function zoneGeometryMessage(
  messages: Messages,
  code: ZoneGeometryMessageCode | undefined,
  params?: ZoneGeometryMessageParams
): string {
  const text = messages.zones.geometryMessages;
  switch (code) {
    case "polygon_max_points":
      return text.polygonMaxPoints(numberParam(params, "maxPoints", 0));
    case "polygon_min_points":
      return text.polygonMinPoints(numberParam(params, "minPoints", 3));
    case "zones_max_count":
      return text.zonesMaxCount(numberParam(params, "max", 6));
    case "zone_max_points":
      return text.zoneMaxPoints(numberParam(params, "maxPoints", 8));
    case "zone_min_points":
      return text.zoneMinPoints(numberParam(params, "minPoints", 3));
    default:
      return "";
  }
}
