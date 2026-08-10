import type { ElevationSample } from "@/domain/route";
import type { TerrainSection } from "@/domain/elevation";

export function segmentTerrainRoute(
  sections: readonly TerrainSection[],
  _samples: readonly ElevationSample[],
  _routeDistanceMeters: number,
): { color: string; sections: TerrainSection[] }[] {
  return [{ color: "#0F766E", sections: [...sections] }];
}

export function getColorForClass(classification: string | null): string {
  switch (classification) {
    case "climb":
      return "#EA580C";
    case "descent":
      return "#2563EB";
    default:
      return "#0F766E";
  }
}
