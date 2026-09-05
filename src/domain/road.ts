import type { RoadSegment } from "./route";
import { COPY } from "@/content/id";

export interface RoadSelection {
  startShapeIndex: number;
  endShapeIndex: number;
  segmentIds: readonly string[];
}

/* Wording lives in the central copy module; this only maps class to string. */
const ROAD_CLASS_DESCRIPTIONS: Record<RoadSegment["roadClass"], string> = {
  motorway: COPY.roadClassMotorway,
  trunk: COPY.roadClassTrunk,
  primary: COPY.roadClassPrimary,
  secondary: COPY.roadClassSecondary,
  tertiary: COPY.roadClassTertiary,
  unclassified: COPY.roadClassUnclassified,
  residential: COPY.roadClassResidential,
  service: COPY.roadClassService,
  cycleway: COPY.roadClassCycleway,
  other: COPY.roadClassOther,
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

export const UNNAMED_ROAD_LABEL = COPY.unnamedRoad;
export const SURFACE_UNKNOWN_LABEL = COPY.surfaceUnknown;

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

/** True when the trace gave us nothing usable about this ruas. */
export function hasNoMetadata(segment: RoadSegment): boolean {
  return segment.name === null && segment.roadClass === "other" && !segment.surface;
}

/**
 * Class and surface for one ruas, or the single agreed fallback line when the
 * trace returned no metadata at all.
 */
export function getRoadDescriptor(segment: RoadSegment): string {
  if (hasNoMetadata(segment)) return COPY.unnamedFallback;
  return `${getRoadClassDescription(segment)} · ${getSurfaceLabel(segment)}`;
}
