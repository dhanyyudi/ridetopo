import type { RoadSegment } from "./route";

export interface RoadSelection {
  startShapeIndex: number;
  endShapeIndex: number;
  segmentIds: readonly string[];
}

export const ROAD_CLASS_LABELS: Record<string, string> = {
  motorway: "Jalan Tol",
  trunk: "Jalan Nasional",
  primary: "Jalan Provinsi",
  secondary: "Jalan Kabupaten",
  tertiary: "Jalan Lokal Utama",
  unclassified: "Jalan Tidak Terklasifikasi",
  residential: "Jalan Perumahan",
  service: "Jalan Servis",
  cycleway: "Jalur Sepeda",
  other: "Jalan Lainnya",
};

export const SURFACE_LABELS: Record<string, string | null> = {
  asphalt: null,
  paved: null,
  concrete: "Beton",
  gravel: "Kerikil",
  dirt: "Tanah",
  sand: "Pasir",
  unpaved: "Tidak beraspal",
};

export function getRoadDisplayName(segment: RoadSegment): string {
  if (segment.name) return segment.name;
  return "Ruas tanpa nama";
}

export function getRoadDescription(segment: RoadSegment, distanceMeters: number): string {
  const className = ROAD_CLASS_LABELS[segment.roadClass] ?? "Jalan Lokal";
  const surface = segment.surface ? (SURFACE_LABELS[segment.surface] ?? segment.surface) : "Permukaan tidak diketahui";
  const km = (distanceMeters / 1000).toFixed(1);
  return `${className} — ${surface} — km ${km}`;
}
