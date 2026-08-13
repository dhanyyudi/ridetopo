import type { RoadSegment } from "./route";

export interface RoadSelection {
  startShapeIndex: number;
  endShapeIndex: number;
  segmentIds: readonly string[];
}

const ROAD_CLASS_DESCRIPTIONS: Record<RoadSegment["roadClass"], string> = {
  motorway: "Jalan tol/freeway dengan akses terbatas; umumnya tidak dapat dilalui sepeda.",
  trunk: "Jalan nasional utama non-tol.",
  primary: "Jalan utama penghubung kota atau kawasan penting.",
  secondary: "Jalan penghubung regional atau antarkawasan.",
  tertiary: "Jalan penghubung lokal atau kolektor.",
  unclassified: "Jalan umum kecil yang tetap berfungsi sebagai jalan tembus.",
  residential: "Jalan lingkungan permukiman.",
  service: "Jalan akses menuju bangunan, parkir, atau fasilitas.",
  cycleway: "Jalur yang ditujukan untuk sepeda.",
  other: "Jalan lainnya.",
};

const SURFACE_LABELS: Record<string, string> = {
  asphalt: "Aspal",
  paved: "Beraspal",
  concrete: "Beton",
  gravel: "Kerikil",
  dirt: "Tanah",
  sand: "Pasir",
  compacted: "Tanah padat",
  unpaved: "Tidak beraspal",
};

export const UNNAMED_FALLBACK = "Ruas tanpa nama — Jalan Lokal — Permukaan tidak diketahui";
export const UNNAMED_ROAD_LABEL = "Ruas tanpa nama";
export const SURFACE_UNKNOWN_LABEL = "Permukaan tidak diketahui";

export function getRoadDisplayName(segment: RoadSegment): string {
  return segment.name ?? UNNAMED_ROAD_LABEL;
}

export function getRoadClassDescription(segment: RoadSegment): string {
  return ROAD_CLASS_DESCRIPTIONS[segment.roadClass];
}

export function getSurfaceLabel(segment: RoadSegment): string | null {
  if (!segment.surface) return SURFACE_UNKNOWN_LABEL;
  return SURFACE_LABELS[segment.surface] ?? segment.surface;
}
